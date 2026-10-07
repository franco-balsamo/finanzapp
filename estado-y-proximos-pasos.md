# Mangos: estado y próximos pasos (cierre del 7 de octubre de 2026)

Nota para retomar en una sesión nueva. Mangos es la app de finanzas personales de Fran para Argentina; el nombre es provisorio.

## Para retomar
- **Dónde quedó (cierre del 7/10):** las cuatro épicas de la v1 en pantalla están hechas y **probadas en el teléfono contra `mangos`** (Expo Go), con la web de invitados probada en el navegador del celular. Después vino una revisión de diseño contra `DESIGN.md`, también vista en el teléfono. Todo commiteado y pusheado en `main`.

  | Épica | Spec | Estado |
  |---|---|---|
  | Primeras pantallas (E1 a E5): login con código, bienvenida, altas, Billetera y hoja de carga | `docs/specs/2026-10-05-epica-primeras-pantallas.md` | Hecha y probada |
  | Detalle de tarjeta (D-1 a D-6): detalle, pagos, corregir cierre, favorita, archivar, carga por texto de varias líneas y "¿Ya lo pagaste?" | `docs/specs/2026-10-05-epica-detalle-de-tarjeta.md` | Hecha y probada |
  | Grupos en la app (G-1 a G-7): pestañas, lista, nuevo grupo, detalle, gasto de grupo en la hoja, pagos y editar o abandonar o eliminar | `docs/specs/2026-10-06-epica-grupos-en-la-app.md` | Hecha y probada |
  | Web de invitados (W-1 a W-6): link guardado, web en Vercel, `/g/[token]`, compartir o regenerar o revocar, "Soy Juan" y deshacer un reclamo | `docs/specs/2026-10-06-epica-web-de-invitados.md` | Hecha y probada |

  Cada spec tiene notas de "Implementado el …" y sus decisiones en `docs/decisiones/` (el índice está en `docs/decisiones/README.md`).

- **Lo que cambió el 7/10** (cada punto con su commit y su nota en `docs/decisiones/`):
  - **Login:** `mangos` mandaba códigos de 8 dígitos; Fran pasó "Email OTP Length" a 6 en el panel (Authentication → Sign In / Providers → Email), igual que `supabase/config.toml`.
  - **Bienvenida de un paso** (solo el dólar de referencia): sin objetivo (`goal` queda en la base, sin uso) y sin la primera tarjeta, que se suma desde la Billetera (`2026-10-07-bienvenida-de-un-paso.md`).
  - **Moneda del patrimonio:** chip con bandera 🇦🇷 AR$ / 🇺🇸 US$ al lado de "Patrimonio", como en Cocos; recalcula sin volver a pedir datos y guarda `display_currency`.
  - **Cotizaciones:** ArgentinaDatos traía hoy con el cierre de ayer y le ganaba todo el día a DolarApi. Migración `20261007150000_fx_history_closed_days` (aplicada en `mangos`): solo días terminados y corrige los que ya tenía (`2026-10-07-cotizacion-del-dia.md`). **Verificar** que después de las 3:00 del 8/10 `fx-history` no haya guardado filas con fecha 8/10 y que el 7/10 tenga el cierre real.
  - **Detalle de tarjeta:** el último resumen cerrado aparece aunque esté vacío ("Sin consumos"), para poder corregir su cierre (`2026-10-07-ultimo-resumen-cerrado.md`).
  - **Pagar resumen** sin cuentas ofrece "Sumar cuenta" y vuelve con la cuenta en la lista.
  - **Web:** iniciar sesión para reclamar mandaba a la Billetera (`_layout.tsx` desmontaba la navegación mientras cargaban los ajustes); "Usar otro mail" quedaba en el paso del código. Arreglados.
  - **Web y móvil:** Fran quiere Mangos en los dos. La app completa en la web va **después de la beta**, con diseño de escritorio como el del prototipo (`2026-10-07-web-completa.md`). Mientras tanto la web publicada es solo `/g/…`; lo demás muestra "Mangos está en el teléfono" (`GUEST_WEB_ONLY` en `_layout.tsx`, solo fuera de desarrollo).
  - **App para otros países:** anotada en "Queda para después" de `01-alcance-v1.md` (hoy todo está atado a Argentina).
  - **Revisión de diseño** a 320 y 390 con datos reales (`2026-10-07-revision-de-diseno.md`): fila de tarjeta con pesos y dólares en dos líneas, "Cómo saldar" sin cortar a quién pagar, cuotas una por fila, montos en Plex Mono (`components/Mono.tsx`), avatares con colores de categoría, patrimonio en 30 en pantallas angostas y otros arreglos menores. Fran lo vio en el teléfono y anda bien.

- **Primer paso de la próxima sesión:** elegir la próxima tanda (abajo, "Próximos pasos") y arrancar con su `/spec`. Antes, la verificación rápida de las cotizaciones del punto de arriba.

- **Pendientes chicos:**
  - Íconos de categoría en filas y fichas: falta `react-native-svg` y `CategoryIcon` con los 6 glifos (`DESIGN.md`, "Ícono de categoría").
  - `apps/mobile/src/lib/authErrors.ts`: un 401 (clave mal configurada) se muestra como "Sin conexión. Probá de nuevo."; solo los errores de red deberían decir eso.
  - "¿Ya lo pagaste?" no se combina con un gasto de grupo (haría falta una función de la base que guarde las dos cosas juntas).
  - El bloqueo del monto (D5) en la hoja es más estricto que en la base.
  - Completar el medio de pago de los "Sin medio de pago" de un reclamo va con la lista de movimientos.
  - Preview y producción de Vercel usan la misma base `mangos`.

- **Datos de prueba en `mangos`:** la cuenta de Fran (`balsamote96@gmail.com`) tiene la tarjeta "Bna Visa" (··2337), la cuenta "Caja De Ahorros - Bna", gastos del 7/10 y el grupo "Asado" (Fran, Juan y Caro provisorios). Existe además el usuario `balsamote96+juan@gmail.com`, que reclamó y deshizo el lugar de Juan. Son datos reales de prueba: no borrarlos sin preguntar.

- **Servicios configurados:**
  - **Supabase `mangos`** (`pkhjsrknnijjygzwvtkn`): migraciones al día hasta `20261007150000_fx_history_closed_days`. Se aplican por el MCP (`apply_migration`) y después se corrige `supabase_migrations.schema_migrations.version` a la del nombre del archivo. Mail con el código: SMTP de Gmail (remitente "Mangos", contraseña de aplicación) con la plantilla `supabase/templates/codigo.html`; unos 500 mails por día (Gmail) y 30 por hora (Supabase).
  - **Vercel `mangos`** (equipo `franco-balsamos-projects`): https://mangos-kohl.vercel.app, deploy automático en cada push a `main`. **La conexión de Vercel de Claude solo lee**: cambios de proyecto o variables los hace Fran.
  - **`apps/mobile/.env`** (no se commitea) apunta a `mangos` para probar en el teléfono: `EXPO_PUBLIC_SUPABASE_URL=https://pkhjsrknnijjygzwvtkn.supabase.co`, la clave publicable de `mangos` y `EXPO_PUBLIC_WEB_URL=https://mangos-kohl.vercel.app`. Para probar contra la base local, pasar las variables locales al comando (las del entorno le ganan al `.env`).

- **Estado del código:** todo en `main` (`franco-balsamo/finanzapp`). Pasan 454 tests pgTAP, 325 de Vitest y el typecheck.

- **Cómo se trabajó cada parte:**
  1. Lógica pura en `packages/core` con tests Vitest.
  2. Consultas de la app en `apps/mobile/src/lib/`.
  3. Pantallas en `apps/mobile/src/app/`.
  4. Prueba contra la base local (scripts o Chrome headless, abajo) y después en el teléfono contra `mangos`.
  5. Commit, push y actualizar esta sección.

- **Cómo probar la web y sacar capturas sin la extensión de Chrome** (la extensión no conecta en esta máquina):
  - `puppeteer-core` en el scratchpad de la sesión, con `executablePath: '/usr/bin/google-chrome'`; el código del login sale de la API de Mailpit (`http://127.0.0.1:54324/api/v1/messages`).
  - Pantallas de la app: `npx expo start --web --port 8090 --clear` con las variables locales. **El servidor no toma cambios de archivos en caliente:** reiniciarlo después de cada cambio (o verificar con `grep` en el bundle). El puerto 8081 suele ser el Expo de Fran para el teléfono: no tocarlo.
  - Lo publicado (con `GUEST_WEB_ONLY`): `npx expo export --platform web --clear --output-dir <dir>` y servirlo como Vercel (cleanUrls y `/g/:token` → `/g/[token].html`). El export cambia `127.0.0.1` por la IP de la red en la URL de Supabase: corregirlo con `sed` en `_expo/static/js/web/*.js`.
  - Las pantallas largas scrollean por dentro: para capturarlas enteras, usar una ventana alta (por ejemplo 320 × 2600).
  - Un usuario insertado a mano en `auth.users` necesita los `*_token` y `email_change` en `''` (no null), o GoTrue responde 500.

- **Entorno local:**
  - colima con 6 GiB de memoria; para que Docker apunte a colima: `export DOCKER_HOST=unix://$HOME/.config/colima/default/docker.sock`. No hay `psql` instalado: usar `docker exec -i supabase_db_mangos psql -U postgres`.
  - Supabase local: `npx supabase start -x vector,logflare,studio,imgproxy,realtime,storage-api,postgres-meta,supavisor`, `npx supabase db reset` y `npx supabase test db`. La base local tiene datos de la revisión de diseño (usuario `fran@test.local`, grupo de 12): `npx supabase db reset` antes de correr los tests pgTAP.
  - **Rutas tipadas:** al sumar una ruta, `tsc` falla hasta que Expo regenera `.expo/types/router.d.ts` (levantar `npx expo start` unos segundos, sin `CI=1`). No usar `pkill -f "expo start…"`, porque mata a la propia shell.
  - **Formato:** no hay Prettier configurado en el repo; el estilo es comillas simples y ancho 140 (`npx prettier --single-quote --print-width 140`). Varios archivos ya no lo cumplen del todo: formatear solo lo que se toca.
  - El error rojo de `React Native DevTools` (`chrome-sandbox`) al arrancar Expo no afecta a la app.

## Dónde está cada cosa
- **Repo de Fran (fuente de verdad):** `CLAUDE.md`, `DESIGN.md`, `docs/01-alcance-v1.md`, `docs/02-reglas-de-negocio.md`, `docs/03-modelo-de-datos.md`, `docs/04-guia-gstack.md`, `docs/05-plan-tecnico.md`, `docs/producto-y-lanzamiento.md`, `docs/diseno-pantallas-v1.md`, `docs/decisiones/` y `prototipo/mangos.html`. Para revisar algo, Fran pasa los archivos como adjuntos.
- **Web publicada (invitados):** https://mangos-kohl.vercel.app (Vercel, proyecto `mangos`, equipo `franco-balsamos-projects`).
- **Prototipo publicado:** https://claude.ai/artifact/VcdZaUcopPPczEKi8vjSh4. Se lee con Artifact (action read) y conserva la capacidad `sample`.
- **Documento de producto (Claude Docs):** https://claude.ai/code/artifact/bdee199b-bc4c-4257-a296-be764d705be4. Está desactualizado; la copia del repo es la que vale.
- **En este proyecto:** `mangos/01-alcance-v1.md`, que es la versión del 1/10, anterior a las revisiones de gstack.

## Qué está hecho
- Prototipo HTML completo:
  - Billetera con carrusel, tarjetas de crédito, débito y prepagas con detalle, editar y eliminar en la tarjeta, banco, vencimiento MM/AA y red.
  - Grupos estilo Sesterce, categorías con íconos y medio de pago vacío por defecto.
- gstack corrido hasta el paso 4: `/office-hours`, `/plan-ceo-review`, `/plan-design-review` con `/design-consultation`, y `/plan-eng-review`. Lo decidido está en `docs/decisiones/`.
- Decisiones principales:
  - **Supabase:** autenticación por mail con código, políticas por fila, pg_cron y Edge Functions.
  - **Repo:** monorepo con `apps/mobile` (Expo Router, con la web de invitados en `/g/[token]`) y `packages/core` (cálculos en TypeScript con Vitest).
  - **Producto:** el cierre de tarjeta como ritual de vuelta, carga rápida por texto con reglas, sin IA; invitados con web de solo lectura que reclaman su lugar.
  - **Fuera de la v1:** presupuestos, alerta del dólar, débito como tipo propio, carrusel, comprobantes y categorías editables.
- Revisión de Claude: `docs/decisiones/2026-10-02-revision-claude.md`, con propuestas para R3-1 a R3-10, el rango de cuotas, T9, el plazo sin margen, la métrica "activo en el ciclo" y la lista de lo que hay que actualizar en `producto-y-lanzamiento.md`.

- Propuestas de la revisión aplicadas en 02, `producto-y-lanzamiento` y 01. Revisión posterior de 02 y 01 hecha y corregida (también 03); el detalle está en `docs/decisiones/README.md`, "Correcciones de la revisión de Claude (2/10)".
- **Paso 5 de gstack (`/spec`) hecho e implementado** (T1 a T4 del informe de eng review):
  - Spec en `docs/specs/2026-10-02-epica-core.md`; decisiones en `docs/decisiones/2026-10-02-spec-core.md`.
  - El repo ya es git (rama `main`). Monorepo con pnpm: `packages/core` (`@mangos/core`) y `apps/mobile` (Expo SDK 57, rutas en `src/app/`, export web con `/g/[token]`).
  - Core tiene `Money`/`convert`, tarjetas (`statementFor`, `cardState`, `lateExpenseImpact`…), grupos (`shares`, `groupBalances`, `simplifyDebts`), `accountBalance`, `categorySpend` y `netWorth`. 139 tests en verde.
  - Comandos: `pnpm test`, `pnpm typecheck`, y `npx expo export --platform web` dentro de `apps/mobile`.
- **T5 hecho** (decisiones en `docs/decisiones/2026-10-02-spec-t5-supabase.md`):
  - Migración `supabase/migrations/20261002120000_schema_v1.sql` con las tablas de la v1, FK compuestas, permisos por columna y políticas por fila.
  - Funciones `is_group_member`, `get_guest_group` y `create_group`.
  - 125 tests pgTAP en `supabase/tests/` (T-20, T-21, T-25, dos usuarios y permisos de grupo).
  - Comandos (con colima andando): `npx supabase start`, `npx supabase db reset`, `npx supabase test db` y `npx supabase db lint`.
- **Funciones de grupo hechas** (decisiones en `docs/decisiones/2026-10-02-spec-funciones-de-grupo.md`):
  - Migración `supabase/migrations/20261002130000_group_functions.sql`: `claim_member`, `undo_claim`, `leave_group`, `void_group_payment`, `rotate_invite_token`, `revoke_invite_token`, `updated_by` en gastos de grupo y saldos en SQL que copian core.
  - 195 tests pgTAP en verde.
- **Cierre de grupos hecho** (decisiones en `docs/decisiones/2026-10-02-spec-cierre-de-grupos.md`):
  - `save_group_expense` valida en la base y es la única forma de escribir gastos de grupo y partes; `remove_member` y `delete_group`.
  - Ejemplos de saldos en `packages/core/fixtures/group-balances.json`, compartidos por Vitest y pgTAP (`pnpm gen:sql-fixtures`).
  - 249 tests pgTAP y 139 de Vitest en verde.
- **T6 hecho** (decisiones en `docs/decisiones/2026-10-02-spec-t6-cotizaciones.md`):
  - Migración `supabase/migrations/20261002150000_fx_rates.sql`: trigger `movements_fx` (venta de la fecha del gasto, hasta 4 días hacia atrás, si no `fx_pending`), `ingest_fx_rates` y cron `fx-rates` (cada 10 minutos) y `fx-history` (diario).
  - Edge Functions `fx-rates` (DolarApi) y `fx-history` (ArgentinaDatos), sin dependencias. Para activarlas en un entorno, seguir los pasos del README.
  - 287 tests pgTAP en verde.
  - Ajustes del 4/10 (migración `20261004120000_fx_estimated.sql`): la tarea diaria `fx-resolve-stale` estima los pendientes de más de 2 días (`fx_estimated`), y `fx_rate_on(kind, date)` le da a la app el dólar tarjeta de una fecha. 314 tests pgTAP en verde.

- **T7 y la base de T10 hechos** (decisiones en `docs/decisiones/2026-10-04-spec-purga-y-cuenta.md`):
  - Migración `supabase/migrations/20261004130000_purge_and_account.sql`: `purge_archived_cards` (cron diario, fallas en `private.job_failures`), `delete_account` (pide login de menos de 10 minutos por `amr`) y `export_account`.
  - Arreglo: borrar una cuenta ya no rompe la FK de `updated_by` en los gastos de grupo.
  - 356 tests pgTAP y 142 de Vitest en verde.

- **T9 hecho** (decisiones en `docs/decisiones/2026-10-04-t9-core-en-edge.md`): las Edge Functions importan `packages/core` directo. Core importa con la extensión `.ts` (regla: todo import relativo de core lleva `.ts`). Confirmado en producción con el primer deploy.

- **Avisos de cierre y de vencimiento** (decisiones en `docs/decisiones/2026-10-04-spec-avisos-de-tarjeta.md`):
  - Core calcula qué avisar y el texto (`closingNotices`, `dueNotices`, `formatMoney`); las Edge Functions `card-closing-notices` (20:00) y `card-due-notices` (10:00) leen con `card_notice_input` y guardan con `record_card_notices`, una vez por tarjeta y ciclo.
  - Migración `supabase/migrations/20261004140000_card_notices.sql`. El push no se manda todavía: queda en `notifications` con `deliver_after`.
  - 386 tests pgTAP y 167 de Vitest en verde.

- **Primer deploy hecho** (decisiones en `docs/decisiones/2026-10-04-primer-deploy.md`):
  - Proyecto `mangos` (`pkhjsrknnijjygzwvtkn`, plan gratis, sa-east-1) con las 8 migraciones (verificadas por hash contra la base local), las 4 Edge Functions, Vault y el historial de cotizaciones desde 2011. Los cron ya corren.
  - T9 confirmado en producción. El secreto de los cron vive solo en Vault (`cron_secret_matches`); 392 tests pgTAP.

## Próximos pasos
1. **Siguiente tanda de pantallas**, cada una con su `/spec` (Fran elige el orden):
   - **Inicio:** el resumen del mes y lo que viene de las tarjetas (`docs/diseno-pantallas-v1.md`).
   - **Lista de movimientos:** con completar los "Sin medio de pago" de un reclamo.
   - **Ajustes (T10):** perfil, dólar de referencia, tema, avisos por tarjeta, no molestar, tarjetas archivadas, borrar la cuenta (volver a pedir el código si la base responde "reauthentication required") y exportar el JSON.
   - **Cola sin conexión (T8):** gastos guardados en el teléfono con "Pendiente" y envío automático.
   - **Íconos de categoría:** `react-native-svg` y `CategoryIcon`.
2. **Antes de la beta:**
   - T12: plan pago de Supabase y cómo pausa los proyectos;
   - los índices de las claves foráneas que marcó el advisor (`docs/decisiones/2026-10-04-primer-deploy.md`);
   - el envío del push de los avisos, cuando la app registre tokens;
   - Maestro (T11);
   - la Auth de producción: remitente con dominio propio (Resend o Brevo) y la URL del sitio;
   - legal: consultar con un abogado e inscribir la base de datos (Ley 25.326).
3. **Después de la beta:** la app completa en la web con diseño de escritorio (`docs/decisiones/2026-10-07-web-completa.md`).
4. **Herramientas:** instalar `codex` (revisión externa en `/spec` y `/review`) y `gh` (subir los specs como issues).

## Commits
Sin la línea "Co-Authored-By" de Claude. Se usa la identidad global de git.

## Cómo trabajar con Fran
Castellano rioplatense, ritmo rápido y pocas preguntas. Aprueba con "Dale".
