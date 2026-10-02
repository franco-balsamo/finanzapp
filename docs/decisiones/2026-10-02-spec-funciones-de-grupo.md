# /spec de funciones de grupo · 2 de octubre de 2026

- **Migración:** `supabase/migrations/20261002130000_group_functions.sql`.
- **Tests:**
  - `supabase/tests/05_group_balances.test.sql`: los saldos en SQL dan lo mismo que core;
  - `supabase/tests/06_group_functions.test.sql`: las funciones.
- **Terminado:**
  - `db reset` aplica las dos migraciones;
  - `test db` da 195 asserts en verde (70 nuevos);
  - `db lint` no encuentra errores.
- **Contraprueba:** se rompieron a propósito el redondeo half-up y el umbral en dólares, y los tests fallaron.

## Respuestas de Fran a lo abierto de T5

1. **Pagos entre integrantes:**
   - nunca se editan;
   - cualquier integrante los anula con `void_group_payment`, que guarda `deleted_at` y `voided_by`;
   - si el pago estaba mal, se registra de nuevo;
   - los saldos y la web de invitados ignoran los anulados.
2. **`delete_account`** pone `payment_alias` en nulo. Quedó anotado en T10.
3. **Link de invitación:** `rotate_invite_token(gid)` y `revoke_invite_token(gid)`, security definer, solo para integrantes con cuenta.
4. **`group_expenses`** guarda `updated_by` y `updated_at` con un trigger al editar.

## Decisiones del spec (aprobadas: "dale, las 4 sí")

1. **Saldos en SQL:**
   - `private.member_shares` y `private.group_balances` copian las reglas de `shares` y `groupBalances` de core:
     - centavos;
     - resto al que pagó o al primer incluido por orden de ingreso;
     - half-up con aritmética entera.
   - Los usan `leave_group` (para "al día") y `claim_member` (para `my_share`).
   - Los tests usan los mismos ejemplos de 02 §7 que core. Si cambia una regla en core, hay que cambiarla también acá.
   - Se descartó una Edge Function con core porque depende de T9.
2. **`my_share` al reclamar:** la misma división, aplicada directamente sobre el monto en la moneda del gasto, sin convertir de ida y vuelta. *Ejemplo: US$ 10,01 entre 3, pagó Juan → Juan US$ 3,35.*
3. **Reclamo del dueño:** si se deshace el reclamo de un lugar que era dueño, el rol pasa como al salir (`private.transfer_ownership`).
4. **Pago ya anulado:** anularlo de nuevo no hace nada ni da error.

## Decisiones de la implementación

- **`claim_member(token, member_id)`:**
  - **Pide:** sesión iniciada y token vigente; el lugar tiene que ser del grupo del token, provisorio y activo; quien reclama no tiene que ser ya integrante activo.
  - **Crea:** un movimiento `expense`/`claim` "Sin medio de pago" por cada gasto no borrado que pagó ese lugar, con la categoría del gasto y su parte.
  - **Avisa:** a los demás integrantes con cuenta: "Juan se sumó a Cabaña".
- **`undo_claim(member_id)`:**
  - **Quién:** la dueña o quien reclamó, dentro de los 7 días.
  - **Movimientos:** borra los movimientos `claim` de ese grupo; los que la persona vinculó ella misma pierden `group_expense_id` y `my_share`, y cuentan completos.
  - **El lugar:** borra el `payment_alias`, porque el alias es de la persona y no del lugar. Así el próximo que lo reclame no hereda un CBU ajeno.
  - **Aviso:** se avisa a la persona desvinculada, salvo que lo haya deshecho ella misma.
- **`leave_group(gid)`:**
  - el umbral es el de D14 (menos de $1 o de US$ 0,01);
  - si sale el dueño, el rol pasa al azar a otro integrante activo con cuenta, se avisa a todos y, si no hay nadie, el grupo queda sin dueño;
  - los movimientos personales no cambian.
- **Códigos de error para la app:**
  - `42501`: sin sesión, sin permiso o no es integrante;
  - `P0002`: no existe o no lo ve (token, lugar o pago);
  - `55000`: no se puede en este estado (no está al día, ya reclamado, ya es integrante, pasaron los 7 días).
- **Avisos:** son filas en `notifications`. Mandarlos (push) es otra tarea.
- **Permisos (arreglo en la migración de T5):**
  - **Problema:** Postgres da `EXECUTE` a `PUBLIC` sobre cada función nueva por un permiso por defecto global, y el `alter default privileges in schema public` de T5 no lo sacaba.
  - **Cómo se encontró:** el test de estructura (`04`) lo detectó al aparecer las funciones nuevas.
  - **Arreglo:** se agregó `alter default privileges revoke execute on functions from public`.
- **Core:** `groupBalances` no conoce los pagos anulados. La app le pasa solo los no anulados (`deleted_at` nulo).

## Abierto

- **Funciones de grupo pendientes:** quitar a un integrante y eliminar el grupo (02 §7).
- **Montos exactos en la base:** que sumen el total (tolerancia de $0,50) no se valida al guardar. Lo valida core en la app; la base calcula igual aunque no sumen.
- **Herramientas:** con colima, `db reset` se colgó una vez con la base `unhealthy`. Se arregla con `npx supabase stop --no-backup` y `start`.
