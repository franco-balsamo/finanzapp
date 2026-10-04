# /spec de T7 y T10 (base): purga de tarjetas, borrar la cuenta y exportar los datos · 4 de octubre de 2026

- **Migración:** `supabase/migrations/20261004130000_purge_and_account.sql`.
- **Tests:**
  - `supabase/tests/10_purge_and_account.test.sql`, con 42 asserts;
  - en core, 3 tests nuevos en `packages/core/src/personal/personal.test.ts`.
- **Terminado:**
  - 356 asserts pgTAP en verde;
  - Vitest con 142 tests;
  - `db lint` sin errores ni avisos.
- **Revisión externa:** el gate de calidad con `codex` no corrió (no está instalado). Sin `gh`, no se abrió issue.

## Pedido de Fran

- **`purge_archived_cards`** (02 §3, D13, T-19):
  - en una transacción, cada pago no revertido pasa a ser un movimiento de su cuenta, y después se borran la tarjeta, sus consumos y sus pagos;
  - cron diario;
  - los saldos de las cuentas son iguales antes y después.
- **`delete_account`** (02 §10, T-26):
  - borra todo lo personal;
  - en cada grupo, el lugar pasa a provisorio con el mismo nombre y sin alias;
  - si era dueño, el rol pasa al azar a otro integrante con cuenta.
- **`export_account`:** un JSON con todo lo del usuario, sin datos de otros más allá de sus nombres en los grupos.

## Decisiones aprobadas

1. **Login reciente para borrar** (D1, recomendada). Fran pidió cambiar `iat` por `amr`:
   - `amr` tiene que tener un método `otp` o `password` con `timestamp` de menos de 10 minutos; si no, `42501` "reauthentication required";
   - **por qué no `iat`:** Supabase lo renueva en cada refresh, así que una sesión robada siempre tiene un `iat` reciente;
   - **verificado en local:** después de un refresh, `iat` pasó de …383 a …387 y `amr[0].timestamp` se quedó en …383. El login por mail aparece como `method: "otp"`.
2. **Export de grupos como en la app** (D2, recomendada):
   - en los grupos activos, nombres, gastos, partes y pagos (lo mismo que la web de invitados), más su lugar con su alias;
   - en los grupos que dejó o se eliminaron, solo el nombre y su lugar;
   - nunca alias ni `user_id` de los demás.
3. **Core** (pedido de Fran): no hizo falta cambiar código.
   - `accountBalance` ya resta todos los `card_payment` de la cuenta y `categorySpend` solo cuenta `expense`;
   - se sumaron tests con el caso de T-19: el saldo de core es igual antes y después, y la purga no cambia el gasto por categoría;
   - core no modela `origin`: no hace falta.
4. **`private.job_failures`** (pedido de Fran):
   - si una tarjeta falla, además del warning queda una fila con `job`, `ref_id`, `error` y `failed_at`;
   - cada tarjeta corre en su propio bloque `begin … exception`, así las demás se purgan igual;
   - la que falló queda entera y se reintenta al día siguiente.

## Decisiones de la implementación

- **El borrado de cuenta usa la cascada:**
  - todas las tablas personales tienen `on delete cascade` sobre `auth.users`, y las de grupo (`user_id`, `created_by`, `updated_by`, `voided_by` y `unclaimed_by`) tienen `set null`;
  - `delete_account` hace antes solo lo que la cascada no hace: `transfer_ownership`, y `payment_alias` y `claimed_at` en nulo;
  - `postgres` tiene permiso de `delete` sobre `auth.users`, igual que en el proyecto real.
- **Bug encontrado y arreglado:**
  - al borrar a un usuario, la FK pone en nulo el `created_by` de sus gastos de grupo;
  - esa actualización disparaba `set_group_expense_audit`, que volvía a escribir `updated_by := auth.uid()` (el usuario que se estaba borrando) y rompía la FK;
  - ahora el trigger no audita los updates que cambian `created_by` o `updated_by`, que solo hacen las FK porque la app no tiene permiso sobre esas columnas;
  - se conserva quién editó por última vez y cuándo.
- **Alertas de la tarjeta:** `alerts.params.card_id` no tiene FK, así que la purga las borra a mano.
- **Movimiento de la purga:**
  - `type = 'card_payment'`, `origin = 'purge'`;
  - `account_id = from_account_id`, `amount = debited_amount`, en la moneda de la cuenta;
  - `date` = día de `paid_at` en hora de Argentina;
  - descripción "Pago de tarjeta {Visa|Mastercard|Amex|Cabal} ··{last4} (eliminada)".
- **`private.group_snapshot(gid)`:** se sacó de `get_guest_group` para que `export_account` use el mismo formato sin repetir código. La web de invitados devuelve lo mismo que antes; el test 03 sigue en verde.
- **Cron:** `purge-archived-cards` a las 6:30 UTC (3:30 en Argentina).
- **Grupo sin nadie más con cuenta:** queda sin dueño, igual que T-22. No se borra, porque los provisorios lo siguen viendo con el link de invitados.

## Abierto

- **T10, app:** la pantalla de Ajustes, la confirmación, el pedido del código otra vez cuando la base responde "reauthentication required", y descargar o compartir el JSON.
- **Aviso al grupo:** cuando alguien borra su cuenta, a los demás no se les avisa, salvo al nuevo dueño. 02 no lo pide.
- **Fallas de la purga:** `private.job_failures` no tiene alerta. Hay que revisarla a mano o sumar un aviso cuando haya CI o monitoreo.
