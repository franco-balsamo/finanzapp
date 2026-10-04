# /spec de T6: cotizaciones · 2 de octubre de 2026

- **Migración:** `supabase/migrations/20261002150000_fx_rates.sql`.
- **Edge Functions:** `supabase/functions/fx-rates`, `fx-history` y `_shared/fx.ts`.
- **Tests:** `supabase/tests/08_fx_rates.test.sql`, con 38 asserts.
- **Terminado:**
  - 287 asserts pgTAP en verde;
  - `db lint` sin errores ni avisos;
  - Vitest con 139 tests.
- **Prueba manual en local** (`supabase functions serve`, contra las APIs reales):
  - **sin el secreto:** 401;
  - **`fx-rates`:** 7 casas y 6 filas; repetida, 0;
  - **`fx-history`:** 30 días, 186 filas; con `{"full": true}`, 23.046 filas desde 2011;
  - **cron completo:** `private.call_edge` → `pg_net` → Edge Function → 200.
- **Revisión externa:** el gate de calidad con `codex` no corrió (no está instalado). Sin `gh`, no se abrió issue.

## Pedido de Fran

T6 del informe de eng review:
- trigger de cotización por fecha del gasto (02 §1, D7 y T-17);
- cron cada 10 minutos con DolarApi;
- cron diario con el historial de ArgentinaDatos;
- la tarea que completa los `fx_pending`.

## Decisiones aprobadas ("dale", las 4 recomendadas)

1. **Editar la fecha recalcula:**
   - el trigger corre al crear y al editar;
   - recalcula si cambió `date` o si el movimiento estaba pendiente;
   - en cualquier otra edición conserva lo guardado;
   - la app nunca escribe las cotizaciones: lo que mande se pisa.
2. **Fines de semana y feriados:** se usa la venta más reciente desde el día del gasto hasta 4 días antes (cubre los fines de semana largos). Sin nada en esa ventana, la que falta queda nula y `fx_pending = true`. Se descartó un calendario de feriados: una tabla y un cron más, a cambio de un error de un día si el cron se cae un día hábil.
3. **La lógica va en SQL:**
   - las Edge Functions solo traen el JSON y llaman a `public.ingest_fx_rates`;
   - la función mapea las casas, saltea las filas inválidas, no duplica y completa los pendientes;
   - todo queda probado con pgTAP, sin sumar Deno ni tests de Edge Functions.
4. **Historial completo una vez:** `fx-history` con `{"full": true}` carga unas 23.000 filas desde 2011, así ningún gasto viejo queda pendiente para siempre. El cron diario manda los últimos 30 días.

## Decisiones de la implementación

- **`fetched_at`:**
  - es la hora que informa la fuente, no la del cron. El sábado DolarApi sigue devolviendo la hora del viernes: con la del cron, la cotización del viernes quedaría como del sábado;
  - el historial de ArgentinaDatos se guarda a las 23:59:59 de Argentina de su fecha, para que el cierre le gane a las del día.
- **`rate_date`:**
  - columna generada con el día en hora de Argentina (`timezone()` es inmutable);
  - único por (source, kind, fetched_at);
  - índice (kind, rate_date desc, fetched_at desc), que reemplaza al de (kind, fetched_at).
- **Casas:**
  - `bolsa` → `mep`, `contadoconliqui` → `ccl`;
  - `oficial`, `blue`, `tarjeta` y `cripto` quedan igual;
  - `mayorista`, `solidario` y las desconocidas se ignoran.
- **Filas inválidas:**
  - se saltean sin frenar el lote: venta nula, en texto, ≤ 0 o que redondea a 0 con 4 decimales, fecha inválida o elementos que no son objetos;
  - si la fuente no es `dolarapi` ni `argentinadatos`, o el payload no es una lista: `22023`.
- **Completar pendientes:**
  - `ingest_fx_rates` termina con `update movements set fx_pending = true where fx_pending`, y el trigger los vuelve a calcular;
  - no hace falta una variable de sesión para distinguir a la app de la tarea.
- **Permisos:**
  - `ingest_fx_rates` solo la ejecuta `service_role`. Los permisos por defecto de Supabase le dan execute a `authenticated`, así que se revoca explícito;
  - las funciones internas nuevas también se revocan.
- **Cron:**
  - `fx-rates` `*/10 * * * *`;
  - `fx-history` `0 6 * * *` (pg_cron usa UTC: son las 3:00 en Argentina);
  - los dos pasan por `private.call_edge`, que lee `functions_url` y `fx_cron_secret` de Vault; si falta alguno, tira un warning y no hace nada.
- **Edge Functions:**
  - `verify_jwt = false`: comparan `Authorization: Bearer <CRON_SECRET>` en tiempo constante;
  - llaman a la RPC con `fetch`, sin dependencias;
  - timeout de 10 s para las APIs;
  - si falla la API o la base, devuelven 502.
- **02 §1:** el ejemplo usaba el calendario de 2025 (en 2026 el 4/10 es domingo). Quedó "sábado 3/10 cargado el lunes 5/10 → viernes 2/10", y se sumaron la ventana de 4 días y el recálculo al cambiar la fecha.

## Abierto

- **Producción:** cargar `CRON_SECRET` (`supabase secrets set`), los dos secretos de Vault y correr la carga inicial. Los pasos están en el README.
- **`group_expenses.fx_rate`:** sigue llegando desde la app (`save_group_expense`). Si se quiere que lo complete la base, va aparte.
- **`fx_rates` crece:** unas 6 filas por cada cambio de DolarApi, más 6 por día de historial. Sin purga por ahora.
- **colima:** con 2 GiB y los contenedores de otros proyectos, la VM se colgó. Se reinició con 6 GiB (`colima start --memory 6`).

## Ajustes del 4/10

Pedido de Fran:
1. La tarea diaria resuelve los `fx_pending` de más de 2 días con la última cotización anterior a la fecha, sin límite de días. Si la fecha es anterior a todo el historial, usa la primera disponible y marca el movimiento para revisar (`fx_estimated`).
2. Confirmar que se guarda la casa `tarjeta` de DolarApi y sumar `fx_rate_on(kind, date)` para el dólar tarjeta de una fecha (02 §2 y §3).

Migración `supabase/migrations/20261004120000_fx_estimated.sql` y tests en `supabase/tests/09_fx_estimated.test.sql` (27 asserts, 314 en total). 02 §1, §2 y §3 y 03 actualizados antes del código.

Criterios que tomé (Fran respondió "dale" sin elegir; se pueden cambiar):
- **"Más de 2 días"** se cuenta desde la fecha del gasto (`date < hoy − 2` en hora de Argentina), no desde que se cargó: si el historial de esa fecha no llegó en 2 días, no va a llegar.
- **`fx_estimated`** se marca siempre que la cotización sale de fuera de la ventana de 4 días, no solo para fechas anteriores a todo el historial: las dos son estimaciones.

Decisiones de la implementación:
- **Solo la tarea estima.** `private.resolve_stale_fx` prende `mangos.fx_resolve_stale` (variable local de la transacción) y el trigger solo busca sin límite cuando la ve prendida. Editar un pendiente viejo desde la app lo deja pendiente.
- **Cron `fx-resolve-stale`** a las 7:00 UTC, una hora después de `fx-history`, sin pasar por una Edge Function: corre SQL directo.
- **Los estimados no se corrigen solos** si después llega historial de su fecha: ya no están pendientes. Se corrigen cambiando la fecha (vuelve a la ventana normal y se borra la marca).
- **`fx_rate_on`** usa la misma ventana de 4 días que el trigger y devuelve nulo sin datos, así la app pide el dato en vez de proponer una cotización vieja. Valida el tipo (`22023`).
- **Casa `tarjeta`:** ya se guardaba desde T6. La prueba con DolarApi trajo $2.002 del 2/10, y el historial tiene 2.476 días desde el 23/12/2019. El test 09 lo confirma.
- **Test 08:** ahora borra `fx_rates` y los secretos de Vault al empezar, para no depender de lo que haya en la base local.
