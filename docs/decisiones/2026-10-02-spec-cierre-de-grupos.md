# /spec de cierre de grupos · 2 de octubre de 2026

- **Migración:** `supabase/migrations/20261002140000_group_closing.sql`.
- **Tests:**
  - `supabase/tests/07_group_closing.test.sql`;
  - el 05, ahora generado desde el JSON;
  - ajustes en el 02, el 04 y el 06.
- **Terminado:**
  - 249 asserts pgTAP en verde;
  - `db lint` sin errores ni avisos;
  - Vitest con 139 tests;
  - `pnpm gen:sql-fixtures --check` al día.
- **Contraprueba:**
  - se subió la tolerancia de $0,50 a $5 y se volvió a abrir la escritura directa de partes: fallaron los tests del 04 y el 07;
  - se cambió un saldo esperado en el JSON: falló Vitest.

## Pedido de Fran

1. `save_group_expense` valida en la base y es la única forma de cambiar las partes.
2. `remove_member` (02 §7).
3. `delete_group` (02 §7).
4. En core, `groupBalances` ignora los pagos anulados (`deletedAt`).
5. Los ejemplos de saldos van a un JSON compartido. Vitest los lee de ahí, y `pnpm gen:sql-fixtures` genera el test pgTAP desde el mismo archivo.

## Decisiones aprobadas ("dale, las 5 sí")

1. **El gasto también va por la función:**
   - se revocaron el insert y el update de `group_expenses`, menos `update (deleted_at)`;
   - si no, alguien podía cambiar `amount` directo y las partes dejaban de sumar;
   - `save_group_expense` crea el gasto, o lo edita si ya existe ese `expense_id`.
2. **Integrantes que se fueron:** al editar un gasto viejo, el pagador y las partes que ya tenía pueden quedar aunque esa persona se haya ido. Los que se suman tienen que estar activos.
3. **Validaciones de más:**
   - `fx_rate` solo si la moneda difiere de la del grupo;
   - sin integrantes repetidos;
   - partes exactas ≥ 0, con 2 decimales, en la moneda del gasto;
   - monto > 0.

   Las partes se guardan como se cargaron, y la diferencia va al que pagó al calcular.
4. **`remove_member`:**
   - borra la fila, porque nada la referencia;
   - "participó" incluye gastos borrados y pagos anulados;
   - el dueño no se quita a sí mismo;
   - se avisa a quien tenía cuenta.
5. **`delete_group`:**
   - borrado lógico y revoca el link;
   - los movimientos de todos los integrantes que venían del grupo pierden `group_expense_id` y `my_share`, incluidos los "Sin medio de pago" del reclamo;
   - se avisa a los integrantes;
   - un grupo sin dueño no se puede eliminar.

## Decisiones de la implementación

- **Firma de `save_group_expense`:**
  - parámetros con nombre (`expense_id`, `group_id`, `expense_date`, `description`, `amount`, `currency`, `fx_rate`, `payer_member_id`, `split_mode`, `category_id`, `parts`);
  - `parts` es un JSON `[{"member_id", "value"}]`; en partes iguales, `value` se ignora y se guarda 1.
- **Errores:**
  - `22023`: datos inválidos;
  - `42501`: no es integrante, o el `expense_id` es de otro grupo;
  - `55000`: gasto borrado.
- **JSON compartido (`packages/core/fixtures/group-balances.json`):**
  - **Formato:** cada caso tiene integrantes en orden de ingreso, gastos, pagos (con `voided`), partes esperadas por gasto y saldos esperados; además, una lista de casos de "al día".
  - **Montos:** en texto con 2 decimales, para no pasar por float.
  - **Qué se movió:** en core, los ejemplos de partes y saldos pasaron de `groups.test.ts` a `fixtures.test.ts`. En `groups.test.ts` quedaron la simplificación, los rechazos y el umbral de mostrar.
- **Script:**
  - `packages/core/scripts/gen-sql-fixtures.ts`, que Node 26 corre directo, sin dependencias nuevas;
  - `--check` no escribe nada y falla si el SQL generado quedó viejo, así se puede sumar a CI;
  - en el README quedó cuándo hay que correrlo.
- **Casos que no entran en el JSON:**
  - "un gasto borrado no cuenta" quedó en el 07, porque core no modela gastos borrados (la app no se los pasa);
  - `my_share` en la moneda del gasto quedó en el 06, porque core no lo calcula.

## Abierto

- **CI:** sumar `pnpm gen:sql-fixtures --check` cuando haya CI.
- **colima:** `db reset` se colgó dos veces (timeout). `supabase stop --no-backup` y `start` aplican las tres migraciones limpias.
