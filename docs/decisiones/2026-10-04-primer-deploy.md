# Primer deploy a Supabase · 4 de octubre de 2026

Fran eligió "lo que sea más conveniente". El primer deploy era el único riesgo abierto: confirmar T9 en producción y dejar andando los cron de cotizaciones y avisos antes de construir la app encima.

## Qué se hizo

- **Proyecto:**
  - `mangos` (`pkhjsrknnijjygzwvtkn`), en sa-east-1 y en el plan gratis de `franco-balsamo's Org` (US$ 0). Fran lo aprobó después de ver el costo;
  - el paso al plan pago (D3) queda para antes de la beta, con T12;
  - límite del plan gratis: Supabase pausa los proyectos que pasan una semana sin uso.
- **Migraciones:** las 8 (de `20261002120000` a `20261004150000`) por el MCP de Supabase.
  - `db push` del CLI pide la contraseña de la base, que la generó Supabase al crear el proyecto.
  - El MCP guarda la hora de aplicación como versión, así que después se corrigieron a las versiones de los archivos en `supabase_migrations.schema_migrations`. Así, un `db push` futuro solo aplica las nuevas.
- **Verificación del esquema:**
  - un hash por categoría, calculado igual en la base local y en la remota: funciones (con el hash de su código), permisos de funciones, columnas, restricciones, índices, políticas, RLS, triggers, permisos de tablas, cron y categorías;
  - los 11 coinciden.
- **Edge Functions:** las 4, con `npx supabase functions deploy --project-ref …`.
  - Las de avisos pesan 28 kB y las de cotizaciones 3 kB: el paquete incluye `packages/core`.
- **Prueba en producción:**
  - con un secreto falso, 401;
  - `fx-rates` guardó 6 filas;
  - `fx-history` con `{"full": true}` guardó 23.244 filas, desde 2011;
  - las de avisos respondieron 200.
  - **Con un usuario de prueba** (una tarjeta que cerraba ese día), el cron generó "Cerró tu Visa: te vienen $187.000 + US$ 50. ¿Te falta cargar algo?" y los consumos guardaron la cotización MEP de su fecha. El usuario se borró después: la base quedó sin usuarios ni datos personales.
- **T9 confirmado:** core funciona dentro de las Edge Functions deployadas.

## Decisión: el secreto de los cron vive solo en Vault

- **El problema:**
  - antes había dos copias, `CRON_SECRET` en las funciones y `fx_cron_secret` en Vault, y tenían que coincidir;
  - para cargar la segunda por el MCP o por el CLI, el valor tenía que pasar por la conversación o por la línea de comandos.
- **La solución:**
  - migración `20261004150000_cron_secret_check.sql` con `public.cron_secret_matches(token)` (solo `service_role`), que compara por SHA-256 con el secreto de Vault;
  - las funciones la llaman en cada pedido (`_shared/cron.ts`) y `CRON_SECRET` ya no existe;
  - el secreto se generó dentro de la base (`encode(extensions.gen_random_bytes(32), 'hex')`) y no salió nunca de ahí.
- **Rotarlo:** `select vault.update_secret((select id from vault.secrets where name = 'fx_cron_secret'), encode(extensions.gen_random_bytes(32), 'hex'));`.
- **Tests:** `supabase/tests/12_cron_secret.test.sql`, con 6 asserts. En total, 392 pgTAP.
- **Costo:** cada pedido a las funciones hace una consulta más a la base. Para cron cada 10 minutos, no importa.

## Cómo se cargó el historial completo

Desde el SQL editor, sin que el secreto salga de la base:

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_url') || '/fx-history',
  headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fx_cron_secret'), 'Content-Type', 'application/json'),
  body := '{"full": true}'::jsonb,
  timeout_milliseconds := 120000);
```

La respuesta queda en `net._http_response`.

## Advisors de Supabase

- **Seguridad:** sin errores.
  - Hay 16 advertencias de "función `security definer` ejecutable desde la API" y son intencionales: cada una valida adentro quién la llama.
  - `get_guest_group` es la única entrada del rol anónimo (D5).
- **Rendimiento:** solo informativos.
  - 25 claves foráneas sin índice; con la base vacía no importan.
  - **Antes de la beta conviene indexar estas:**
    - `movements(group_expense_id)`, porque la usan `delete_group` y `undo_claim`;
    - `statement_payments(user_id, card_id)` y `statement_overrides(user_id, card_id)`, por el borrado en cascada de tarjetas;
    - `group_payments(group_id, from_member_id)` y `(group_id, to_member_id)`.

## Abierto

- **T12:** precio del plan pago y cómo pausa los proyectos inactivos.
- **Índices** de las claves foráneas de arriba.
- **Contraseña de la base:** para usar `db push` hay que resetearla desde el panel y guardarla en tu gestor de contraseñas.
- **Auth de producción:** URL del sitio, plantilla del mail con el código y SMTP propio. Va con la app.
