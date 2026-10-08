# Historial del estado hasta el 7/10

Secciones movidas desde `estado-y-proximos-pasos.md` el 8/10 para que esa nota quede corta. El texto es el original, sin cambios.

## Lo que cambió el 7/10

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
