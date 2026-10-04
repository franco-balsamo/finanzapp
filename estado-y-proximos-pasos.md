# Mangos: estado y próximos pasos (2 de octubre de 2026)

Nota para retomar en una sesión nueva. Mangos es la app de finanzas personales de Fran para Argentina; el nombre es provisorio.

## Dónde está cada cosa
- **Repo de Fran (fuente de verdad):** `CLAUDE.md`, `DESIGN.md`, `docs/01-alcance-v1.md`, `docs/02-reglas-de-negocio.md`, `docs/03-modelo-de-datos.md`, `docs/04-guia-gstack.md`, `docs/05-plan-tecnico.md`, `docs/producto-y-lanzamiento.md`, `docs/diseno-pantallas-v1.md`, `docs/decisiones/` y `prototipo/mangos.html`. Para revisar algo, Fran pasa los archivos como adjuntos.
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

- **T9 en local** (decisiones en `docs/decisiones/2026-10-04-t9-core-en-edge.md`): una Edge Function importa `packages/core` directo. Core pasó a importar con la extensión `.ts`; Vitest, los dos typecheck y el export web de Expo siguen andando. Falta confirmarlo en el primer deploy.

- **Avisos de cierre y de vencimiento** (decisiones en `docs/decisiones/2026-10-04-spec-avisos-de-tarjeta.md`):
  - Core calcula qué avisar y el texto (`closingNotices`, `dueNotices`, `formatMoney`); las Edge Functions `card-closing-notices` (20:00) y `card-due-notices` (10:00) leen con `card_notice_input` y guardan con `record_card_notices`, una vez por tarjeta y ciclo.
  - Migración `supabase/migrations/20261004140000_card_notices.sql`. El push no se manda todavía: queda en `notifications` con `deliver_after`.
  - 386 tests pgTAP y 167 de Vitest en verde.

## Próximos pasos
1. **Claude:** actualizar el prototipo a la v1:
   - lista de tarjetas con `CardRow` en vez del carrusel;
   - fichas de medio de pago (favorita, 2 más usados y "Otro…", sin preselección);
   - hoja de carga en el orden nuevo, con carga por texto;
   - toast con "Deshacer";
   - detalle de tarjeta y de grupo en el orden nuevo;
   - sin débito como tipo propio, sin comprobante, sin presupuestos, sin alertas de precio, solo Iguales y Montos.
2. **Producción de T6:** cargar `CRON_SECRET`, los secretos de Vault y el historial completo (README). En ese primer deploy, confirmar que las Edge Functions llevan `packages/core` (T9). Después, el envío del push de los avisos (cuando la app registre tokens) y la parte de la app de T10 (Ajustes, volver a pedir el código y descargar el JSON).
3. **Pendiente de herramientas:** instalar `codex` si se quiere la revisión externa en `/spec` y `/review` (esta vez no corrió) y `gh` si se suben los specs como issues.

## Commits
Sin la línea "Co-Authored-By" de Claude. Se usa la identidad global de git.

## Cómo trabajar con Fran
Castellano rioplatense, ritmo rápido y pocas preguntas. Aprueba con "Dale".
