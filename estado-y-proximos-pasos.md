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

- **Cotizaciones (8/10):** verificado que `fx-history` ya no guarda filas del día. El historial de ArgentinaDatos ahora se guarda a las 00:00 de su fecha, así el cierre de DolarApi le gana (`docs/decisiones/2026-10-08-historial-al-abrir-el-dia.md`). Aplicado en `mangos`.

- **Primer paso de la próxima sesión:** implementar la épica de Inicio (`docs/specs/2026-10-08-epica-inicio.md`), empezando por I-1 (íconos), I-2 (`home()` en core, con `tdd`) e I-3 (pestañas). Decisiones en `docs/decisiones/2026-10-08-spec-inicio.md`.

- **Historial:** lo que cambió el 7/10 y lo hecho antes está en `docs/decisiones/2026-10-07-historial-estado.md`. Leelo solo si la tarea lo necesita.

- **Pendientes chicos:**
  - Íconos de categoría en filas y fichas: falta `react-native-svg` y `CategoryIcon` con los 6 glifos (`DESIGN.md`, "Ícono de categoría").
  - `apps/mobile/src/lib/authErrors.ts`: un 401 (clave mal configurada) se muestra como "Sin conexión. Probá de nuevo."; solo los errores de red deberían decir eso.
  - "¿Ya lo pagaste?" no se combina con un gasto de grupo (haría falta una función de la base que guarde las dos cosas juntas).
  - El bloqueo del monto (D5) en la hoja es más estricto que en la base.
  - Completar el medio de pago de los "Sin medio de pago" de un reclamo va con la lista de movimientos.
  - Preview y producción de Vercel usan la misma base `mangos`.

- **Datos de prueba en `mangos`:** la cuenta de Fran (`balsamote96@gmail.com`) tiene la tarjeta "Bna Visa" (··2337), la cuenta "Caja De Ahorros - Bna", gastos del 7/10 y el grupo "Asado" (Fran, Juan y Caro provisorios). Existe además el usuario `balsamote96+juan@gmail.com`, que reclamó y deshizo el lugar de Juan. Son datos reales de prueba: no borrarlos sin preguntar.

- **Servicios configurados:**
  - **Supabase `mangos`** (`pkhjsrknnijjygzwvtkn`): migraciones al día hasta `20261008120000_fx_history_start_of_day`. Se aplican por el MCP (`apply_migration`) y después se corrige `supabase_migrations.schema_migrations.version` a la del nombre del archivo. Mail con el código: SMTP de Gmail (remitente "Mangos", contraseña de aplicación) con la plantilla `supabase/templates/codigo.html`; unos 500 mails por día (Gmail) y 30 por hora (Supabase).
  - **Vercel `mangos`** (equipo `franco-balsamos-projects`): https://mangos-kohl.vercel.app, deploy automático en cada push a `main`. **La conexión de Vercel de Claude solo lee**: cambios de proyecto o variables los hace Fran.
  - **`apps/mobile/.env`** (no se commitea) apunta a `mangos` para probar en el teléfono: `EXPO_PUBLIC_SUPABASE_URL=https://pkhjsrknnijjygzwvtkn.supabase.co`, la clave publicable de `mangos` y `EXPO_PUBLIC_WEB_URL=https://mangos-kohl.vercel.app`. Para probar contra la base local, pasar las variables locales al comando (las del entorno le ganan al `.env`).

- **Estado del código:** todo en `main` (`franco-balsamo/finanzapp`). Pasan 458 tests pgTAP, 325 de Vitest y el typecheck.

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

## Próximos pasos
1. **Siguiente tanda de pantallas**, cada una con su `/spec` (Fran elige el orden):
   - **Inicio:** spec hecho el 8/10, falta implementarlo.
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
