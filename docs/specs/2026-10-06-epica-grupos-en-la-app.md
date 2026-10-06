---
spec_kind: epic
status: approved
date: 2026-10-06
---

# Épica: grupos en la app (lista, detalle, gastos de grupo, pagos y edición)

## Contexto

La base y core de grupos están hechos desde el 2/10, pero la app no tiene ninguna pantalla de grupos: no se puede crear un grupo, cargarle un gasto ni saldar una deuda. La Billetera ya suma tu saldo de grupos al patrimonio, pero ese saldo siempre da cero porque no hay forma de generarlo. Grupos es una de las tres zonas de la v1 (01-alcance §6) y la puerta de entrada de los invitados.

Esta épica agrega:
- la barra de pestañas (Billetera y Grupos);
- la lista de grupos y crear un grupo con integrantes provisorios;
- el detalle de grupo (diseño 1A);
- el gasto de grupo: desde el detalle y desde la hoja de carga, con tu gasto personal en la misma transacción;
- registrar y anular pagos entre integrantes, moviendo opcionalmente el saldo de una cuenta;
- editar, abandonar y eliminar el grupo, y quitar integrantes.

La web de invitados, "Compartir link" y el reclamo van en la tanda siguiente.

## Estado actual (verificado el 6/10/2026)

| Pieza | Estado | Dónde |
|---|---|---|
| Navegación | `Stack` sin pestañas: Billetera (`index`) y las hojas de tarjeta. E4 dejó dicho que `(tabs)` se suma cuando lleguen Grupos, Inicio y Ajustes | `apps/mobile/src/app/(app)/_layout.tsx` |
| Pantallas de grupo | No existen. `g/[token].tsx` es un placeholder de 14 líneas | `apps/mobile/src/app/g/[token].tsx` |
| Crear grupo | `create_group(name, currency, member_name)`: crea el grupo, te suma como integrante y dueño | `schema_v1.sql:520` |
| Integrantes provisorios | `insert` directo en `group_members (id, group_id, display_name)` con RLS de integrante | `schema_v1.sql:580`, política `members_insert` |
| Gasto de grupo | `save_group_expense(...)` valida y guarda gasto y partes (alta y edición). **No crea tu movimiento personal** (`group_expense_id`, `my_share`): hoy la app tendría que hacer dos escrituras | `group_closing.sql:23` |
| Borrar un gasto de grupo | Solo `update (deleted_at)` directo. No toca el movimiento personal de quien pagó | `group_closing.sql:11` |
| Pagos | `insert` directo en `group_payments`; `void_group_payment(id)` anula. No hay forma de mover el saldo de una cuenta | `schema_v1.sql:588`, `group_functions.sql:340` |
| Quitar, abandonar, eliminar | `remove_member`, `leave_group`, `delete_group`, con las reglas de 02 §7 | `group_closing.sql:163,208`, `group_functions.sql:306` |
| Core | `shares`, `groupBalances`, `displayBalance`, `isSettled` y `simplifyDebts`, con ejemplos compartidos con pgTAP | `packages/core/src/groups/` |
| Billetera | `loadGroups` trae tus grupos activos con integrantes, gastos y pagos; `myGroupBalance` da tu saldo. Los pagos anulados no se filtran en core sino en la consulta | `apps/mobile/src/lib/wallet.ts:36`, `packages/core/src/wallet/wallet.ts:183` |
| Hoja de carga | La línea plegada muestra fecha y cuotas; "Grupo" quedó fuera de E5 (D4) | `apps/mobile/src/app/(app)/cargar.tsx` |

## Decisiones tomadas en esta spec

| # | Decisión | Elección |
|---|---|---|
| D1 | Alcance | App de grupos completa sin la web: pestañas, lista, crear, detalle, gasto de grupo, pagos y edición. Web de invitados, link y reclamo, en la tanda siguiente |
| D2 | Navegación | `(tabs)` ahora, con Billetera y Grupos |
| D3 | Gasto que pagaste vos | Función nueva `save_group_expense_with_movement`: gasto de grupo, partes y tu movimiento en una transacción, sin duplicar si se reintenta |
| D4 | "Grupo" en la hoja de carga | Entra en esta tanda, en la línea plegada. No es obligatorio: por defecto "Sin grupo" |
| D5 | Editar un gasto de grupo | Cualquiera edita descripción, fecha, categoría y división, y tu parte se recalcula. El monto, la moneda y quién pagó los cambia solo quien pagó, si tiene el gasto en sus finanzas |
| D6 | Borrar un gasto de grupo | El gasto personal de quien pagó **pierde el vínculo** y vuelve a contar completo, igual que al eliminar un grupo. El "Deshacer" del toast, justo después de guardar, borra los dos |
| D7 | Pago con saldo de una cuenta | Opcional, "No mover saldos" por defecto. Anular el pago revierte el movimiento |
| D8 | Cotización de un gasto en otra moneda | Tu dólar de referencia (MEP por defecto) de la fecha del gasto, editable |
| — | Un solo formulario | El gasto de grupo usa la misma hoja de carga (`cargar.tsx`) con el grupo elegido; desde el detalle abre con `groupId` |
| — | Escrituras de grupo | Todas por funciones: se revocan `update (deleted_at)` en `group_expenses` e `insert` en `group_payments` |

## Hijas

| # | Título | Prioridad | Esfuerzo (vos solo / CC) | Depende de |
|---|---|---|---|---|
| G-1 | Base: gasto con movimiento, borrar gasto, pagos con cuenta | Crítica | ~1 día / ~2 h | — |
| G-2 | Core: `groupDetail` y `groupList` | Crítica | ~0,5 día / ~1 h | — |
| G-3 | Pestañas, lista de grupos y crear grupo | Crítica | ~1 día / ~1,5 h | G-2 |
| G-4 | Detalle de grupo (lectura) | Crítica | ~1 día / ~2 h | G-2, G-3 |
| G-5 | Gasto de grupo en la hoja de carga (alta, edición y borrado) | Alta | ~1,5 días / ~3 h | G-1, G-4 |
| G-6 | Registrar y anular pagos | Alta | ~1 día / ~1,5 h | G-1, G-4 |
| G-7 | Editar, abandonar y eliminar el grupo | Media | ~1 día / ~1,5 h | G-4 |

```
G-1 Base ─────────────────────────┬──> G-5 Gasto de grupo
                                  └──> G-6 Pagos
G-2 Core ──> G-3 Pestañas y lista ──> G-4 Detalle ──┬──> G-5
                                                    ├──> G-6
                                                    └──> G-7 Editar, abandonar, eliminar
```

**Por qué este orden:** G-1 y G-2 no dependen entre sí y pueden ir en paralelo; G-1 va primero en el deploy porque las funciones se aplican aparte en `mangos`. G-3 va antes que G-4 porque el detalle se abre desde la lista. G-5 y G-6 necesitan las funciones de G-1 y el detalle para ver el resultado. G-7 es lo menos usado y no bloquea nada.

---

### G-1. Base

**Migración `supabase/migrations/20261006130000_group_app.sql`:**

```sql
-- Pagos que mueven el saldo de una cuenta (D7).
alter table public.movements add column group_payment_id uuid references public.group_payments (id) on delete cascade;

-- Gasto de grupo y tu movimiento personal en una transacción (D3, D5).
-- `movement`: null si no pagaste vos o elegiste "No sumarlo a mis finanzas";
--   si no: {id, card_id | account_id, installments, debited_amount, origin}. El monto, la moneda,
--   la fecha, la descripción y la categoría salen del gasto; my_share lo calcula private.member_shares.
-- Reintento con el mismo expense_id y movement.id: no duplica nada.
create function public.save_group_expense_with_movement(
  expense_id uuid, group_id uuid, expense_date date, description text, amount numeric, currency text,
  fx_rate numeric, payer_member_id uuid, split_mode text, category_id uuid, parts jsonb, movement jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$ … $$;

-- Borrar un gasto de grupo (D6): deleted_at y el movimiento de quien pagó pierde el vínculo.
create function public.delete_group_expense(expense_id uuid) returns void
language plpgsql security definer set search_path = '' as $$ … $$;

-- Registrar un pago (D7). `account_id` solo si sos el que paga o el que cobra:
-- cobrás → movimiento 'income'; pagás → 'adjustment' negativo; los dos con group_payment_id.
create function public.register_group_payment(
  payment_id uuid, group_id uuid, from_member_id uuid, to_member_id uuid, amount numeric,
  payment_date date, account_id uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$ … $$;

revoke update (deleted_at) on public.group_expenses from authenticated;
revoke insert on public.group_payments from authenticated;
grant execute on function public.save_group_expense_with_movement(uuid, uuid, date, text, numeric, text, numeric, uuid, text, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.delete_group_expense(uuid) to authenticated;
grant execute on function public.register_group_payment(uuid, uuid, uuid, uuid, numeric, date, uuid) to authenticated;
```

`save_group_expense_with_movement`:
- llama a `save_group_expense` con los mismos parámetros (valida y guarda gasto y partes);
- **alta:** si viene `movement` y el que pagó sos vos, inserta el movimiento `expense` con `group_expense_id` y `my_share` = tu parte en la moneda del gasto (`private.member_shares(id, false)`), `on conflict (id) do nothing`;
- **edición (D5):** si cambian monto, moneda o quién pagó y el que pagó tiene un movimiento vinculado de otro usuario, falla con `42501` ("only the payer can change the amount"). Si lo edita quien pagó, actualiza monto y moneda de su movimiento. Si quien pagó pasa a ser otro, el movimiento de quien pagaba se borra (el que edita es él). En todos los casos recalcula `my_share` en los movimientos vinculados;
- si el que pagó es un provisorio, cualquiera edita todo.

`delete_group_expense`: cualquier integrante. `deleted_at = now()` y `group_expense_id = null, my_share = null` en los movimientos vinculados (vuelven a contar completos).

`register_group_payment`:
- valida integrantes activos, monto > 0 con 2 decimales, distintos;
- con `account_id`: la cuenta es tuya y está en la moneda del grupo, y vos sos `from` o `to`; si no, `22023`;
- `on conflict (id) do nothing` en el pago y en el movimiento (reintento).

`void_group_payment` pasa a borrar el movimiento con ese `group_payment_id` (sale con el `on delete cascade` si se borra el pago; como el pago se anula y no se borra, se borra a mano en la función).

**Tests pgTAP `supabase/tests/15_group_app.test.sql`** (+14):
- ejemplo de 02 §7 con movimiento: Vos pagás $90.000 con la Visa en partes iguales → tu movimiento queda en $90.000 con `my_share` $30.000;
- reintento con los mismos ids: un gasto, un movimiento;
- "No sumarlo a mis finanzas": sin movimiento;
- D5: Ana cambia la división → tu `my_share` se recalcula; Ana cambia el monto → `42501`; vos cambiás el monto → tu movimiento cambia;
- D6: borrar deja el movimiento sin vínculo y el saldo del grupo sin ese gasto;
- D7: Juan → Vos $50.000 a tu Caja → `income` de $50.000; anularlo borra el movimiento; con una cuenta en otra moneda o ajena falla; si no sos `from` ni `to`, con cuenta falla;
- ya no se puede `update deleted_at` ni `insert` en `group_payments` directo.

**Criterios de aceptación de G-1:**
1. Pasan `npx supabase test db` y `db lint`, y la migración queda en `mangos` con la versión del archivo.
2. Los tests de arriba pasan, y los 412 tests anteriores siguen en verde.

---

### G-2. Core

En `packages/core/src/wallet/wallet.ts`, junto a `myGroupBalance` (usa sus mismas conversiones):

```ts
export function groupList(input: WalletInput): { groups: GroupListItem[]; owed: Money[]; owe: Money[] };
// GroupListItem: id, name, currency, memberCount, myBalance (displayBalance).
// owed / owe: suma de lo que te deben y lo que debés, una por moneda.

export function groupDetail(input: WalletInput, groupId: string): GroupDetail;
// GroupDetail:
//   group: id, name, currency, isOwner, ownerName
//   myBalance (displayBalance), totalSpent (suma de los gastos en la moneda del grupo)
//   transfers: simplifyDebts → [{ from: {id, name}, to: {id, name}, amount, involvesMe }]
//   members: [{ id, name, isMe, isProvisional (user_id nulo), claimedAt, leftAt, balance, settled }]
//     en orden de joined_at; los que se fueron, al final y solo si tienen gastos o pagos
//   expenses: [{ id, date, description, amount, payerName, myShare, categoryId }] del más nuevo al más viejo
//   payments: [{ id, date, from, to, amount, voided }] del más nuevo al más viejo
```

`DbWalletGroup` suma `name`, `owner_member_id`, los integrantes con `user_id`, `left_at` y `claimed_at`, los gastos con `date`, `description` y `category_id`, y los pagos con `date` y `deleted_at` (`loadGroups` deja de filtrar los anulados y core los ignora en el saldo).

**Texto del toast** en `packages/core/src/entry/toast.ts`: `savedToastText({ kind: 'group', myShare, owedToMe })` → "Guardado · tu parte $30.000; te deben $60.000". Si no pagaste vos: "Guardado · tu parte $30.000".

**Criterios de aceptación de G-2:**
1. Con el ejemplo de 02 §7, `groupDetail` da tu saldo +$60.000, total gastado $120.000 y 2 transferencias: Juan → Vos $50.000 y Ana → Vos $10.000.
2. Con el ejemplo del umbral de 02 §7 (Ana −$2,97; Beto, Caro y Dani +$0,99), Beto, Caro y Dani salen en $0 con `settled`, y Ana tiene 3 transferencias de $0,99.
3. Un pago anulado sale en `payments` con `voided` y no cambia los saldos.
4. `groupList` con dos grupos en pesos (+$60.000 y −$5.000) da `owed` $60.000 y `owe` $5.000.

---

### G-3. Pestañas, lista de grupos y crear grupo

**Rutas:**
- `(app)/(tabs)/_layout.tsx` con `Tabs`: "Billetera" (`index`) y "Grupos" (`grupos`). Íconos de texto hasta que esté `react-native-svg`.
- `(app)/(tabs)/index.tsx`: la Billetera actual, movida.
- `(app)/(tabs)/grupos.tsx`: la lista.
- `(app)/grupo-nuevo.tsx` (hoja).
- Las demás rutas del Stack (`tarjeta/[id]`, hojas) quedan donde están.

**Lista (prototipo, vista "grupos"):**
- arriba, "Te deben +$X · Debés −$Y" en `moneyLg`, sumando todos tus grupos (una línea por moneda si hay grupos en dólares);
- `+ Nuevo grupo` (`primary`);
- una fila por grupo: inicial, nombre, "N personas" y tu saldo con signo (`success` si te deben, `error` si debés, `textMuted` si estás al día);
- vacía: "Todavía no tenés grupos. Creá uno para un viaje, la casa o el asado.";
- cargando: 3 filas esqueleto; error: "No pudimos traer tus grupos." con "Reintentar".

**Nuevo grupo (hoja):**
- "Nombre del grupo" (obligatorio: "Poné un nombre.");
- "Moneda del grupo": `Segmented` Pesos / Dólares, pesos por defecto;
- "Personas": tu nombre fijo ("Vos") y campos para sumar nombres (provisorios), con "+ Sumar otra" y "✕" en cada una. Nombres repetidos: "Ya hay alguien con ese nombre.";
- guardar: `create_group(nombre, moneda, user_settings.name)` (si está vacío, pide "¿Cómo te llaman en el grupo?") y un `insert` en `group_members` con los provisorios, con ids del teléfono (reintento sin duplicar);
- al terminar abre el detalle del grupo nuevo.

**Criterios de aceptación de G-3:**
1. La app abre en la Billetera con la barra de pestañas; "Grupos" muestra la lista y volver a "Billetera" conserva su estado.
2. Crear "Cabaña" en pesos con Ana y Juan deja un grupo con 3 integrantes (vos dueño, Ana y Juan provisorios) y abre su detalle.
3. Con 0 grupos se ve el texto de vacío; con un grupo en pesos y otro en dólares, el total muestra las dos monedas.
4. Las rutas tipadas compilan (`pnpm typecheck`) y el export web sigue andando.

---

### G-4. Detalle de grupo (lectura)

**Ruta:** `(app)/grupo/[id].tsx` (pantalla, no hoja). La abre la fila de la lista.

**Orden de 1A** (`docs/diseno-pantallas-v1.md:124-148`):
1. `‹ Grupos`.
2. "4 personas · pesos", el nombre en `title` y las caritas (iniciales) de los integrantes, cortadas en "+N" después de 4.
3. Tu saldo en `moneyLg`: "+$60.000 te deben" (`success`), "−$10.000 debés" (`error`) o "Estás al día" (`textMuted`).
4. "Total gastado: $480.000".
5. Botones: `+ Gasto` (`primary`, abre la hoja con el grupo, G-5) y `⋯` (Editar grupo, G-7). "Compartir link" no va en esta tanda.
6. **Cómo saldar · N transferencias:** "Juan → Vos $50.000" con "Registrar" (G-6). Si nadie debe: "Están todos al día.".
7. **Integrantes:** inicial, nombre, "· sin cuenta" en los provisorios, "· se sumó 2/10" en los reclamados, y su saldo. Los que se fueron, con opacidad 0.5 y "· se fue".
8. **Gastos · N:** fecha, descripción, "pagó Ana", monto y "tu parte $X". Muestra 30 y "Ver todos (N)". Tocar uno abre la hoja en modo edición (G-5).
9. **▸ Pagos registrados (N)**, plegado: fecha, "Juan → Vos", monto y "Anular" (G-6). Los anulados, tachados.

**Estados (8A):**
- cargando: esqueleto del encabezado y de 3 filas;
- sin gastos: "Todavía no hay gastos. Cargá el primero.";
- error: "No pudimos traer el grupo." con "Reintentar";
- 12 integrantes: caritas en "+8", nombres largos con "…".

**Criterios de aceptación de G-4:**
1. Con el ejemplo de 02 §7 cargado, el detalle muestra +$60.000, 2 transferencias y los saldos +$60.000, −$10.000 y −$50.000, iguales a `groupDetail`.
2. Cada monto tiene `accessibilityLabel` en palabras, y cada fila se lee como una unidad.
3. Un grupo con 12 integrantes y un nombre de 40 letras no rompe la pantalla en un ancho de 320.

---

### G-5. Gasto de grupo en la hoja de carga

**Entrada:**
- desde el detalle: `/cargar?groupId=…` abre la hoja con el grupo elegido y la línea plegada abierta;
- desde el FAB: la línea plegada pasa a "▸ Hoy · Sin grupo · 1 cuota"; al abrirla aparece "Grupo" con fichas de tus grupos (los 3 de actividad más reciente y "Otro…"). **No hay preselección** y no suma pasos a la carga común.

**Con un grupo elegido**, debajo de la descripción:
- **Quién pagó:** fichas con los integrantes activos, "Vos" marcado por defecto;
- **Cómo se divide:** `Segmented` "Iguales" / "Montos". En Iguales, fichas por integrante, todas marcadas (tocar excluye). En Montos, un campo por integrante y "Falta asignar $X" / "Te pasaste por $X" en `caption`, con la tolerancia de $0,50 de 02 §7;
- **Medio de pago:** solo si pagaste vos; suma la ficha "No sumarlo a mis finanzas". Si pagó otro, el bloque de medio de pago se oculta;
- **Moneda distinta a la del grupo:** "Cotización $1.500 (MEP del 6/10)" editable, con tu dólar de referencia de la fecha (`fx_rate_on(settings.fx_reference, fecha)`). Sin cotización: "Escribí la cotización.";
- se guarda con `save_group_expense_with_movement`, con los ids generados al abrir la hoja;
- toast: "Guardado · tu parte $30.000; te deben $60.000", con "Deshacer" (borra el gasto de grupo y tu movimiento: `delete_group_expense` y `delete` del movimiento).

**Validaciones** (las de la base, en voseo):
- "Elegí al menos una persona.";
- "Los montos suman $X y el gasto es $Y." si la diferencia pasa de $0,50;
- "Elegí con qué pagaste." solo si pagaste vos y no elegiste "No sumarlo a mis finanzas".

**Edición** (tocar un gasto en el detalle): la misma hoja con los datos del gasto. Si el que pagó tiene el gasto en sus finanzas y no sos vos, monto, moneda y quién pagó quedan deshabilitados con "Lo puede cambiar quien pagó." (D5). Abajo, "Borrar gasto" (`delete_group_expense`, D6), con confirmación en la misma hoja.

**"¿Ya lo pagaste?"** (D-6) aplica igual cuando pagaste vos con tarjeta: el movimiento es el mismo.

**Criterios de aceptación de G-5:**
1. Ejemplo de 02 §7: desde el detalle, "Vos pagás $90.000 con la Visa, iguales" y "Ana paga $30.000, montos: Ana $10.000, Juan $20.000" dejan los saldos del criterio 1 de G-4. La Visa suma $90.000 y tu gasto por categoría suma $30.000.
2. Desde el FAB, cargar un gasto sin tocar "Grupo" sigue igual que hoy (mismos pasos, mismo toast).
3. Ana edita la división del gasto de $90.000 y tu `my_share` cambia; el campo de monto le aparece deshabilitado.
4. Borrar el gasto de $90.000: el grupo deja de contarlo y la Visa sigue con $90.000 que cuentan completos en tu categoría.
5. US$ 120 en un grupo en pesos con MEP a $1.500 propone $1.500 y deja la deuda en pesos sin cambiar si después cambia el dólar.
6. Un corte de señal y reintentar no duplican ni el gasto ni el movimiento.

---

### G-6. Registrar y anular pagos

**Ruta:** `(app)/grupo-pago/[groupId].tsx` (hoja). Abre desde "Registrar" en "Cómo saldar" (con from, to y monto propuestos) o desde "+ Registrar pago" al final de "Cómo saldar" (vacía).

**Campos:**
- "Quién pagó" y "A quién": fichas con los integrantes activos;
- monto, propuesto con la transferencia y editable;
- fecha: hoy por defecto, con `DateChooser`;
- **"Mover saldo de…"** (D7): solo si sos el que paga o el que cobra; fichas con tus cuentas en la moneda del grupo y "No mover saldos" marcada por defecto.

**Validaciones:** "Poné un monto mayor a cero."; "Elegí a dos personas distintas.".

**Al guardar:** `register_group_payment` con el id del teléfono; toast "Pago registrado · Juan → Vos $50.000" con "Deshacer" (`void_group_payment`).

**Anular** desde "Pagos registrados": confirmación en la fila ("¿Anulás este pago? Se registra de nuevo si estaba mal.") y `void_group_payment`. Si había movido el saldo de una cuenta, el movimiento se borra.

**Criterios de aceptación de G-6:**
1. Con el ejemplo de 02 §7, registrar "Juan → Vos $50.000" y "Ana → Vos $10.000" deja a todos al día y "Cómo saldar" dice "Están todos al día.".
2. Registrar Juan → Vos $50.000 moviendo el saldo a Caja Galicia sube la caja $50.000; anularlo la devuelve y Juan vuelve a deber $50.000.
3. Si no sos ni el que paga ni el que cobra, "Mover saldo de…" no aparece.

---

### G-7. Editar, abandonar y eliminar el grupo

**Ruta:** `(app)/grupo-editar/[id].tsx` (hoja), desde `⋯`.

- **Nombre:** `update groups set name` ("Poné un nombre.").
- **Sumar personas:** campos como en "Nuevo grupo"; se insertan como provisorios. Lo que sumaste en esta edición se puede sacar con "✕" antes de guardar.
- **Quitar a alguien** (solo el dueño): "Quitar" en la fila de quien nunca participó y tiene saldo cero (`remove_member`). Si no se puede, el botón no aparece.
- **Abandonar el grupo:** si estás al día, confirmación "Dejás de ver el grupo. Para volver hace falta otra invitación." y `leave_group`; vuelve a la lista con el toast "Saliste de Cabaña". Si no estás al día: "Para irte tenés que estar al día (debés $X)." y sin botón. Si eras el dueño, el aviso suma "El rol de dueño pasa a otra persona con cuenta.".
- **Eliminar el grupo** (solo el dueño): confirmación con el aviso de saldos pendientes si los hay ("Hay saldos sin saldar: Juan debe $50.000.") y `delete_group`; vuelve a la lista con el toast "Eliminaste Cabaña".

**Criterios de aceptación de G-7:**
1. Cambiar el nombre se ve en el detalle y en la lista.
2. Con Juan debiendo $50.000, Juan (si tuviera cuenta) no puede abandonar; vos, al día, sí.
3. Quitar a un provisorio que nunca participó lo saca de la lista; a uno con gastos no se le ofrece "Quitar".
4. Eliminar el grupo lo saca de la lista, y tus gastos personales del grupo vuelven a contar completos en la categoría.

---

## Testing

| Capa | Qué | Cantidad |
|---|---|---|
| pgTAP | `save_group_expense_with_movement`, `delete_group_expense`, `register_group_payment`, `void_group_payment` con movimiento y los permisos revocados | +14 |
| Unit (Vitest) | `groupDetail`, `groupList`, el toast de grupo y la validación de montos exactos de la hoja | +12 |
| Contra la base local (script) | Los criterios de G-5, G-6 y G-7 con dos usuarios reales (vos y Ana) | 1 script |
| Manual en el teléfono | Crear el grupo del ejemplo de 02 §7, cargar los 2 gastos, saldar y editar | 1 recorrido |

## Plan de vuelta atrás

- **App:** se revierte el merge. La Billetera vuelve a ser la única pantalla.
- **Migración:** `drop function` de las tres funciones nuevas, se restaura `void_group_payment` y los `grant` revocados, y `alter table movements drop column group_payment_id`. Antes de borrar la columna, los movimientos con `group_payment_id` se borran (son de pagos de esta tanda).
- **Datos:** los grupos, gastos y pagos creados quedan; los gastos se borran con `delete_group_expense` y los pagos se anulan.

## Fuera de alcance

- La web de invitados (`g/[token]`), "Compartir link", regenerar o revocar el link (`rotate_invite_token`, `revoke_invite_token`).
- Reclamar un lugar y deshacer un reclamo (`claim_member`, `undo_claim`).
- Porcentajes y partes (fase 2); grupos sin conexión (fase 2).
- El push a los integrantes (cambio de dueño, grupo eliminado): quedan en `notifications` como hoy.
- Inicio y Ajustes como pestañas.
- Que el gasto de grupo entre en las finanzas de otro integrante con cuenta que pagó pero no lo cargó.
- El alias o CBU de cada integrante (`payment_alias`).

## Definición de terminado

1. Los criterios de G-1 a G-7 se verificaron contra la base local y, en el teléfono de Fran, contra `mangos`.
2. `pnpm test`, `pnpm typecheck`, `npx supabase test db`, `db lint` y `npx expo export --platform web` están en verde.
3. `docs/03-modelo-de-datos.md` tiene las tres funciones, la columna `group_payment_id` y los permisos nuevos; `docs/02-reglas-de-negocio.md` §7 tiene D5, D6 y D8; las decisiones quedan en `docs/decisiones/2026-10-06-spec-grupos-en-la-app.md`.
