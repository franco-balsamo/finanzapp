# /spec de T5: base en Supabase · 2 de octubre de 2026

Cubre T5 del informe de eng review: migraciones de 03, políticas por fila con `is_group_member`, índices de D16 y tests T-20, T-21 y T-25 con pgTAP.

- **Migración:** `supabase/migrations/20261002120000_schema_v1.sql`.
- **Tests:** `supabase/tests/` (4 archivos, 125 asserts).
- **Terminado:**
  - `npx supabase db reset` aplica la migración limpia;
  - `npx supabase test db` da todo en verde;
  - `npx supabase db lint` no encuentra errores.
- **Contraprueba:** se rompió la base a propósito de cuatro formas y cada rotura hizo fallar los tests que correspondían:
  - `is_group_member` sin `left_at`;
  - `select` para el rol anónimo;
  - FK simple en lugar de compuesta;
  - sin la protección del alias.

## Alcance

**Entra:**
- las tablas de la v1, con `fx_rates` vacía y `category_keywords`;
- `alerts`, solo con aviso de cierre y de vencimiento;
- `is_group_member`, `get_guest_group` y `create_group`.

**Queda afuera:**
- el trigger de cotizaciones y los cron (T6);
- `claim_member`, `undo_claim`, `transfer_ownership`, `leave_group`, `delete_account`, `export_account` y `purge_archived_cards`;
- las reglas de "al día" en la base;
- `budgets`, `cards.kind`, `cards.account_id` y `receipt_path`;
- en `user_settings`: avisos por mail y WhatsApp y el resumen semanal (recortados en 01);
- regenerar o revocar el token de invitación: los tests lo cambian como `postgres`. Hace falta una función para la app.

## Decisiones de Fran

1. **`create_group(group_name, group_currency, member_name)`:**
   - security definer, con `search_path` fijo;
   - toma el usuario de `auth.uid()` y falla si es nulo;
   - crea el grupo y el lugar de quien lo crea, y lo deja como dueño.
   - **Ejecución:** igual que `is_group_member`, solo para `authenticated`. `get_guest_group` es la única función que ejecuta `anon`.
2. **`groups`:**
   - primero se revoca el update de toda la tabla y después se da `grant update (name)`;
   - `deleted_at`, `owner_member_id`, `invite_token_hash` y `currency` se cambian solo con funciones.
3. **Integrantes:**
   - cualquier integrante suma provisorios: hay grant de insert solo en `id`, `group_id` y `display_name`, así que `user_id` queda nulo;
   - **nadie escribe `left_at`**, ni en su propia fila. Salir va por `leave_group` en otra tarea (02 §7);
   - cada uno edita solo su propio `payment_alias`; lo controla un trigger;
   - `display_name`: cada uno edita el suyo, y cualquier integrante edita el de un provisorio.
4. **Referencias a filas ajenas:** las políticas por fila no alcanzan, así que se usan FK compuestas:
   - `movements (user_id, card_id | account_id | to_account_id)` → `cards`/`accounts (user_id, id)`;
   - `statement_payments` y `statement_overrides`: tarjeta y cuenta del mismo usuario;
   - `group_expenses`, `group_expense_parts` y `group_payments` → `group_members (group_id, id)`.
   - **Con trigger:**
     - `movements.group_expense_id`, solo de un grupo donde el usuario es integrante activo;
     - las categorías;
     - la tarjeta de un aviso.
5. **Borrado:**
   - en las tablas personales el dueño borra, porque el "Deshacer" borra el gasto;
   - en las de grupo no hay delete: se usa `deleted_at`, que los integrantes cambian con un update de `group_expenses`.

## Decisiones del spec

- **Categorías del sistema:**
  - las 6 fijas tienen `user_id` nulo y UUID fijos (`…0001` Supermercado a `…0006` Otros);
  - las comparten todos, así un gasto de grupo tiene la misma categoría para cada integrante;
  - un gasto de grupo solo usa categorías del sistema;
  - `movements` y `category_keywords` usan las del sistema o las propias (trigger, porque una FK compuesta no admite el `user_id` nulo).
- **`is_group_member`:** además de `left_at` nulo, exige que el grupo no esté eliminado. Así, un grupo eliminado deja de verse y de aceptar escrituras en un solo lugar.
- **`get_guest_group`:**
  - devuelve nombre, moneda, integrantes (`id`, `display_name`, `has_account`, `active`), gastos no borrados con sus partes, y pagos;
  - los saldos **no** se calculan en SQL: la web de invitados los calcula con `groupBalances` de core, para no tener dos implementaciones;
  - los montos van como texto (`'20.00'`) para `fromDbNumeric`;
  - no devuelve `payment_alias`, `user_id`, `created_by` ni la categoría.
- **`has_account`:** la web lo necesita para ofrecer "soy Juan" solo en los lugares provisorios.
- **Token:** se guarda el SHA-256 en hex del token (`sha256()` de Postgres, sin extensiones).
- **Partes de un gasto de grupo:** tienen `group_id` (para la FK compuesta) y **sí se pueden borrar**, porque editar un gasto puede excluir a alguien. El gasto en sí nunca se borra.
- **Permisos:**
  - se revoca todo a `anon` y `authenticated`, y cada tabla recibe solo lo que necesita;
  - las tablas que se creen después no le dan nada a `anon` por defecto.
- **Tipos:**
  - los valores van en inglés (`bank`/`wallet`/`cash`, `card_closing`/`card_due`, `control`/`save`/`invest`), salvo `mep`/`oficial`/`blue`, que son nombres propios;
  - cotizaciones en `numeric(14,4)`.
- **Avisos:**
  - uno por tarjeta y tipo;
  - `days_before` de 1 a 5 en el aviso de vencimiento;
  - las notificaciones las crea solo el backend: el usuario las lee, las marca como leídas y las borra.
- **Herramientas:**
  - `supabase start` local sin Studio, storage, realtime ni edge runtime;
  - con colima, a veces la primera conexión al puerto 54322 da timeout: se reintenta.

## Abierto

- ~~Pagos entre integrantes~~ y ~~alias al borrar la cuenta~~: resueltos en `2026-10-02-spec-funciones-de-grupo.md`.
- **Gasto de grupo en otra moneda:** que tenga `fx_rate` no se valida en la base. Lo valida core (`shares` rechaza un gasto sin cotización).
