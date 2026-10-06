---
spec_kind: epic
status: approved
date: 2026-10-05
---

# Épica: detalle de tarjeta de crédito, pagos y gastos cargados tarde

## Contexto

La Billetera ya muestra lo que viene en cada tarjeta, pero tocar una fila no hace nada y no hay forma de registrar un pago. Por eso, todo resumen cerrado figura como deuda para siempre: el patrimonio baja mes a mes aunque la persona pague. Además, el detalle de tarjeta es la pantalla que abre el aviso de cierre (recorte C9), con el campo "¿Te falta cargar algo?" para ponerse al día. Ese es el ritual de vuelta del producto.

Esta épica agrega:
- el detalle (diseño 6A);
- los pagos totales y parciales, con deshacer;
- la corrección del cierre real;
- editar, archivar y marcar favorita;
- la carga por texto de varias líneas;
- la pregunta "¿Ya lo pagaste?" para los gastos cargados tarde (02 §3, R3-3 y R3-4).

## Estado actual (verificado el 5/10/2026)

| Pieza | Estado | Dónde |
|---|---|---|
| Fila de tarjeta | `CardRow` sin acción al tocar | `apps/mobile/src/components/CardRow.tsx`, `src/app/(app)/index.tsx` |
| Cálculo de resúmenes | `cardState` da `statements` (estado, total, pagado, pendiente, excedente e ítems), `toPay`, `pendingTotal`, `limitUsed` y `available` | `packages/core/src/cards/state.ts` |
| Gasto tarde | `lateExpenseImpact` devuelve `isLate`, `askAlreadyPaid` y `proposedPayments` (cuenta y fecha del último pago; R3-4 en dólares). No lo usa nadie | `packages/core/src/cards/late.ts` |
| Corrección del cierre | `validateOverride` (±10 días, entre los cierres vecinos, vencimiento después del cierre) | `packages/core/src/cards/schedule.ts:113` |
| Billetera | `wallet()` arma tarjetas, cuentas y patrimonio. **Bug:** `loadWalletInput` trae solo las tarjetas con `archived_at` nulo, así que la deuda de una archivada deja de contar (02 §3 dice que sigue contando) | `apps/mobile/src/lib/wallet.ts` |
| Carga por texto | `parseQuickEntry` ya acepta varias líneas y devuelve el estado de cada una. En la hoja se usa solo una línea | `packages/core/src/entry/quickEntry.ts` |
| Límite | 02 §3 dice que es obligatorio y mayor a cero. El formulario de E3 lo deja opcional y la base acepta nulo (`credit_limit numeric check (>= 0)`) | `src/lib/cardForm.ts`, `schema_v1.sql:54` |
| Favorita | Índice único parcial `cards_one_favorite_idx`: cambiar la favorita con dos updates choca si el orden sale mal | `schema_v1.sql:59` |
| Permisos | `authenticated` puede leer, cargar, editar y borrar en `cards`, `statement_payments` y `statement_overrides` (RLS por dueño) | `schema_v1.sql:562-571` |

## Decisiones tomadas en esta spec

| # | Decisión | Elección |
|---|---|---|
| D1 | Carga por texto del detalle | **Varias líneas**, con vista previa por línea, fichas para completar y "Guardar N gastos" |
| D2 | Gasto tarde + "Sí" | Función de la base `save_expense_with_payments`: el gasto y sus pagos en una transacción |
| D3 | Límite | **Obligatorio**, como 02 §3: formulario y base (las tarjetas nuevas y las editadas) |
| D4 | Recuperar una archivada | Toast con "Deshacer" y la sección "Archivadas" al final de la pestaña Tarjetas, con "Se borra en N días" y "Recuperar" |
| — | Cambiar la favorita | Función de la base `set_favorite_card(card_id)`: saca la marca de la anterior y la pone en la nueva en una sola transacción |
| — | Registrar un pago | `insert` directo en `statement_payments`, una fila por moneda (pesos y dólares van en el mismo `insert`, que es atómico) |
| — | Deshacer un pago | `update statement_payments set reverted_at = now()`. El pago deja de contar y la plata vuelve a la cuenta, porque `accountBalance` ignora los revertidos |
| — | Resumen que se abre | El más urgente de "A pagar" (`toPay[0]`); si no hay, el resumen en curso |
| — | "¿Ya lo pagaste?" en una tanda de varias líneas | Se pregunta **una sola vez** por tanda, con la lista de los resúmenes afectados |

## Hijas

| # | Título | Prioridad | Esfuerzo (vos solo / CC) | Depende de |
|---|---|---|---|---|
| D-1 | Base y core: funciones nuevas, límite obligatorio y `cardDetail` | Crítica | ~1 día / ~2 h | — |
| D-2 | Detalle de tarjeta (lectura) y archivadas que cuentan en el patrimonio | Crítica | ~1,5 días / ~3 h | D-1 |
| D-3 | Pagar resumen y deshacer pagos | Crítica | ~1 día / ~2 h | D-2 |
| D-4 | Corregir cierre, editar, favorita y archivar | Alta | ~1 día / ~2 h | D-1, D-2 |
| D-5 | Carga por texto de varias líneas en el detalle | Alta | ~1,5 días / ~3 h | D-2 |
| D-6 | "¿Ya lo pagaste?" en la hoja y en la carga por texto | Alta | ~1 día / ~2 h | D-1, D-5 |

```
D-1 Base y core ──┬──> D-2 Detalle ──┬──> D-3 Pagos
                  │                  ├──> D-4 Cierre, editar, favorita, archivar
                  │                  └──> D-5 Varias líneas ──┐
                  └───────────────────────────────────────────┴──> D-6 "¿Ya lo pagaste?"
```

**Por qué este orden:** D-1 va primero porque las funciones de la base se deployan aparte y `cardDetail` es lo que dibuja el detalle. D-3 va antes que D-6 porque la pregunta solo aparece con resúmenes pagados, y sin pagos no hay cómo probarla. D-5 va antes que D-6 porque la pregunta de la tanda vive en el componente de varias líneas.

---

### D-1. Base y core

**Migración `supabase/migrations/20261005130000_card_detail.sql`:**

```sql
-- Límite obligatorio (02 §3). NOT VALID: no revisa las filas viejas, pero sí cualquier insert o
-- update nuevo, así que editar una tarjeta sin límite obliga a cargarlo.
alter table public.cards
  add constraint cards_credit_limit_required check (credit_limit is not null and credit_limit > 0) not valid;

-- Una sola favorita, sin chocar con el índice único parcial.
create function public.set_favorite_card(card_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.cards c where c.id = card_id and c.archived_at is null) then
    raise exception 'card not found' using errcode = 'P0002';
  end if;
  update public.cards set is_favorite = false where is_favorite and id <> card_id;
  update public.cards set is_favorite = true where id = card_id;
end $$;

-- Gasto y pagos en una transacción ("¿Ya lo pagaste?" → Sí, 02 §3).
-- `expense`: las columnas de movements que manda la app (id del teléfono incluido).
-- `payments`: [{card_id, period, applies_to, amount, from_account_id, debited_amount, fx_card_rate, paid_at}].
-- Si el id ya existe (un reintento que había llegado), no hace nada y devuelve false.
create function public.save_expense_with_payments(expense jsonb, payments jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $$ … $$;

grant execute on function public.set_favorite_card(uuid) to authenticated;
grant execute on function public.save_expense_with_payments(jsonb, jsonb) to authenticated;
```

Las dos funciones son `security invoker`: las políticas por fila de siempre siguen valiendo, y nadie puede tocar tarjetas, cuentas ni pagos ajenos.

`save_expense_with_payments`:
- `insert into movements … on conflict (id) do nothing`;
- si insertó, inserta cada pago en `statement_payments`;
- si un pago falla (cuenta ajena, montos ≤ 0), la transacción entera vuelve atrás.

**Tests pgTAP `supabase/tests/14_card_detail.test.sql`:**
- **Límite:** una tarjeta nueva sin límite falla; una con límite 0 falla; editar una tarjeta vieja sin límite obliga a cargarlo.
- **`set_favorite_card`:** deja una sola favorita; con una tarjeta ajena da `P0002`.
- **`save_expense_with_payments`, el ejemplo de R3-3:** después de pagos de $60.000 desde Galicia y $40.000 desde Mercado Pago, el gasto de $12.000 más el pago desde Mercado Pago con fecha 6/10 deja Mercado Pago $12.000 más abajo.
- **Reintento:** llamar dos veces con el mismo id no duplica ni el gasto ni el pago.
- **Pago con cuenta ajena:** falla y tampoco queda el gasto.

**Core:** `cardDetail` en `packages/core/src/wallet/wallet.ts` (implementado el 5/10 junto a `wallet`, para no exportar sus funciones internas). Los movimientos traen `description`, así que no hace falta el parámetro `movementsMeta` de abajo.

```ts
export function cardDetail(input: WalletInput, cardId: string, movementsMeta: ReadonlyMap<string, { description: string; categoryId: string | null }>): CardDetail;
// CardDetail: card (nombre, banco, red, last4, expiry, color, favorita, archivada), statements (de cardState,
// con los ítems enriquecidos: descripción, categoría, "cuota 3/6"), defaultPeriod (toPay[0] o el en curso),
// futureInstallments: [{ period, closeDate, total }] (resúmenes después del en curso), minimumPayment
// (15% de la parte en pesos del pendiente, 02 §3), limit, limitUsed y available.
```

`wallet()` pasa a recibir también las tarjetas archivadas:
- su deuda cuenta en el patrimonio;
- no salen en `cards`;
- salen en `archivedCards`, con `deletesOn` = `archived_at` + 7 días.

**Criterios de aceptación de D-1:**
1. Pasan `npx supabase test db` y `db lint`, y las funciones quedan en `mangos` con la versión del archivo.
2. `cardDetail` reproduce los ejemplos de 02 §3 como tests:
   - el resumen de $200.000 con un pago de $120.000 queda en "Pago parcial" con $80.000;
   - un gasto de $30.000 en 3 cuotas aparece como $10.000 en noviembre y $10.000 en diciembre;
   - el pago mínimo de un resumen de $187.000 + US$ 50 es $28.050.
3. Con una tarjeta archivada que debe $50.000, el patrimonio baja $50.000 y la tarjeta no sale en la lista de la Billetera.

---

### D-2. Detalle de tarjeta (lectura)

**Ruta:** `(app)/tarjeta/[id].tsx` (pantalla, no hoja). La abren la fila de la Billetera y, más adelante, el aviso de cierre.

**Orden de 6A** (`docs/diseno-pantallas-v1.md:94-120`):
1. `‹ Billetera`.
2. **Plástico (`CreditCard` de DESIGN.md).** Lleva el degradado, el monograma del banco, el banco, la ★, el total del resumen elegido en `moneyCard` con la parte en dólares en `moneySm`, "Vence 6/11", "•••• 2337", la red y el vencimiento del plástico. Las capas de brillo y anillos quedan para cuando esté `react-native-svg`.
3. **Navegación:** `‹ Resumen de octubre ›` con la pastilla de estado: "En curso" `neutral`, "Cuotas futuras" `neutral`, "A pagar" `warning`, "Pago parcial" `warning`, "Pagado" `success` y "Vencido" `error`. Abajo, "Cierra 24/10 · Vence 6/11" y "Pago mínimo aprox. $28.050", este último solo si hay pendiente en pesos.
4. **Carga por texto** "¿Te falta cargar algo?": en D-2 lleva al FAB de la hoja con la tarjeta elegida; D-5 la reemplaza por la de varias líneas.
5. **"Pagar resumen"** (`primary`): solo si el resumen elegido ya cerró y tiene pendiente (A pagar, Pago parcial o Vencido). Lo implementa D-3.
6. **Cuotas que siguen:** "nov $120.000 · dic $95.000 · …", con hasta 6 meses y "+N".
7. **Consumos de este resumen · N:** filas con la grilla de `MovementRow`: descripción, "cuota 3/6", monto y categoría. Muestra 30 y "Ver todos (N)".
8. **Pagos de este resumen:** monto, cuenta y fecha, con "Deshacer". Lo implementa D-3.
9. **Límite de compra:** medidor con el % usado, "Usado $X · Disponible $Y".
10. **Configuración:** "Corregir cierre" · "Editar" · "Marcar como favorita" · "Archivar". Lo implementa D-4.

**Estados (8A):**
- Cargando: el plástico con los datos guardados y los montos en esqueleto.
- Resumen sin consumos: "No cargaste nada en este resumen.".
- Error: "No pudimos traer la tarjeta." con "Reintentar".

**Criterios de aceptación de D-2:**
1. Tocar la Visa en la Billetera abre su detalle, y "‹ Billetera" vuelve.
2. Con un resumen de septiembre "A pagar" y octubre en curso, el detalle abre en septiembre; con `›` pasa a octubre y a las cuotas futuras, y con `‹` vuelve hasta el primer resumen con consumos.
3. Los totales, estados y cuotas de la pantalla coinciden con `cardDetail` para los ejemplos de 02 §3, verificados contra la base local.
4. Cada monto tiene `accessibilityLabel` en palabras, y la pastilla de estado se lee junto al título del resumen.

---

### D-3. Pagar resumen y deshacer pagos

**Ruta:** `(app)/pagar/[cardId]/[period].tsx` (hoja `formSheet`).

**Campos:**
- **Pesos:** se propone el pendiente en pesos y se puede editar (total, mínimo o cualquier monto). Fichas "Total" y "Mínimo".
- **Cuenta para los pesos:** fichas con las cuentas en pesos, ninguna marcada.
- **Dólares:** solo si hay pendiente en dólares. Se propone el pendiente y se puede editar. Se elige la cuenta:
  - una cuenta en dólares: se descuenta tal cual;
  - una cuenta en pesos: "Se descuentan $X" con `fx_rate_on('tarjeta', fecha)`, editable, y se guarda `fx_card_rate`.
- **Fecha del pago:** hoy por defecto, con las mismas fichas y el campo dd/mm de la hoja de carga.

**Validaciones:**
- "Poné cuánto pagaste." (los dos montos en 0);
- "Elegí de qué cuenta salió.";
- los montos no pueden ser mayores que el pendiente: "No puede ser más que lo pendiente ($X).".

**Al guardar:**
- un `insert` con una fila por moneda;
- el toast "Pago registrado · quedan $X" o "Pago registrado · resumen pagado", con "Deshacer";
- vuelve al detalle y la Billetera se actualiza.

**Deshacer un pago** desde la lista del detalle o desde el toast:
- `update set reverted_at = now()`;
- toast "Pago deshecho · $X volvieron a Caja Galicia".

**Implementado el 5/10.** El selector de fecha de la hoja de carga pasó a un componente (`DateChooser`) que usan las dos hojas. Si lo descontado en pesos se corrige a mano, `fx_card_rate` guarda la cotización que corresponde a ese monto; si no, el dólar tarjeta de la fecha.

**Criterios de aceptación de D-3:**
1. Ejemplo de 02 §3: un resumen de $200.000 con un pago de $120.000 desde la caja queda "Pago parcial" con $80.000 pendientes, y la caja baja $120.000. Al deshacer, vuelve a $200.000 pendientes y la caja recupera los $120.000. Verificado en la base.
2. Pagar US$ 50 desde una caja en pesos con el dólar tarjeta a $2.028 descuenta $101.400 de la caja y guarda `fx_card_rate = 2028`.
3. Pagar todo lo pendiente pasa el resumen a "Pagado", saca la deuda del patrimonio y del límite usado.
4. Un monto mayor que el pendiente no se puede guardar.

---

### D-4. Corregir cierre, editar, favorita y archivar

- **Corregir cierre** (hoja):
  - pide la fecha real de cierre y de vencimiento del resumen elegido, con dd/mm y la estimada como texto de ayuda;
  - valida con `validateOverride`, con un mensaje por motivo: "Tiene que quedar a 10 días o menos del cierre estimado (24/10).", "Tiene que ser después del cierre anterior (24/9).", "Tiene que ser antes del cierre siguiente (24/11)." y "El vencimiento tiene que ser después del cierre.";
  - guarda con un upsert en `statement_overrides`;
  - "Volver a la fecha estimada" borra la corrección.
- **Editar** (hoja): el `CardForm` de E3 con los datos de la tarjeta. El límite pasa a ser obligatorio también en la bienvenida y en "Sumar tarjeta" (D3): "Poné el límite de compra.".
- **Marcar como favorita:** `rpc('set_favorite_card')`. No aparece si ya es la favorita.
- **Archivar:**
  - pide confirmación con el aviso de 02 §3: "Tiene 14 consumos. Deja de verse y se borra el 12/10, salvo que la recuperes antes. Su deuda sigue contando.";
  - `update cards set archived_at = now(), is_favorite = false`;
  - vuelve a la Billetera con el toast "Tarjeta archivada" y "Deshacer".
- **Archivadas** (al final de la pestaña Tarjetas, D4): `CardRow` con opacidad 0.5, la pastilla "Se borra en N días" y "Recuperar" (`archived_at = null`).

**Implementado el 6/10.**
- La fecha corregida se lee con `parseDateNear` de core: `dd/mm` toma el año más cercano a la fecha estimada, porque un cierre puede ser futuro.
- La confirmación de archivar va en la misma pantalla, no en un diálogo del sistema.
- Al recuperar una tarjeta archivada, no vuelve a ser favorita.

**Criterios de aceptación de D-4:**
1. Corregir el cierre de octubre al 27/10 pasa un gasto del 25/10 de noviembre a octubre en el detalle y en "Te vienen". Una corrección al 10/11 se rechaza con el mensaje de "10 días".
2. Marcar la Master como favorita deja una sola ★ y la Master pasa primera en la Billetera y en las fichas de la hoja.
3. Archivar la saca de la Billetera y de los medios de pago; el patrimonio no cambia. "Recuperar", o "Deshacer" en el toast, la devuelve igual.
4. No se puede guardar una tarjeta sin límite ni con límite 0, ni nueva ni editada.

---

### D-5. Carga por texto de varias líneas

**Componente nuevo:** `apps/mobile/src/components/QuickEntry.tsx` (`QuickEntry` de DESIGN.md:469-483). Lo usa el detalle, con `defaultCardId` = la tarjeta.

- **Plegado:** "¿Te falta cargar algo?". **Abierto:** hasta 4 líneas visibles.
- **Vista previa**, una fila por línea, con `parseQuickEntry`: descripción en `bodyStrong`, medio, cuotas y fecha en `caption`, y monto en `money`.
  - **Lista:** fila normal.
  - **Para revisar:** pastilla `warning` "Revisar". Tocarla confirma la línea, que pasa a "Lista".
  - **Incompleta:** fichas de medio de pago (las candidatas o las de `paymentChips`), o el campo de descripción. Lleva "Descartar".
  - **Sin monto:** pastilla `error` "Falta el monto".
- **Botón:** "Guardar 6 gastos", o "Guardar 6 · faltan 2" si quedan líneas sin completar. Guarda las listas y las confirmadas, de a una, con un id por línea, generado al aparecer la línea y estable mientras la línea no cambie.
- **Después:** las guardadas salen del campo y las demás quedan. Toast "Guardaste 6 gastos" con "Deshacer", que borra los 6.

**Criterios de aceptación de D-5:**
1. Pegar 8 líneas (6 completas, 1 sin medio y 1 sin monto) muestra "Guardar 6 · faltan 2". Guardar deja en el campo solo las 2 que faltan.
2. En el detalle de la Master, "12000 súper" se carga con la Master, y "12000 súper visa" con la Visa (R3-6).
3. Completar la línea sin medio tocando una ficha la pasa a "Lista".
4. Un corte de señal a mitad de la tanda deja en el campo las líneas que no se guardaron, y reintentar no duplica las que sí.

---

### D-6. "¿Ya lo pagaste?"

Usa `lateExpenseImpact` con los gastos y pagos de la tarjeta (de `loadWalletInput`) y el dólar tarjeta de hoy.

- **En la hoja de carga:** al tocar "Guardar gasto", si `askAlreadyPaid`, la hoja muestra en lugar del pie:
  - "¿Ya lo pagaste con el resumen de septiembre?";
  - la propuesta: "Pago de $12.000 desde Mercado Pago, 6/10", con el monto editable;
  - "Sí" (`primary`, por defecto) guarda con `save_expense_with_payments`;
  - "No" guarda solo el gasto;
  - con varias cuotas en resúmenes pagados, una sola pregunta y un pago por resumen.
- **En la tanda de varias líneas:** una sola pregunta para todas las líneas tarde, con la lista de los resúmenes afectados. Cada línea se evalúa contra los gastos de las líneas anteriores de la misma tanda.
- **El toast** suma "· pago de $12.000 registrado" cuando se contestó "Sí".

**Criterios de aceptación de D-6** (los ejemplos de 02 §3, verificados en la base):
1. Visa con cierre 30 y septiembre pagado completo ($100.000). Cargar "28/09 12000 farmacia visa":
   - con "Sí", el resumen queda en $112.000 "Pagado";
   - con "No", queda en "Pago parcial" con $12.000 pendientes.
2. R3-3: con pagos de $60.000 (Galicia, 3/10) y $40.000 (Mercado Pago, 6/10), "Sí" propone $12.000 desde Mercado Pago con fecha 6/10, y Mercado Pago baja $12.000.
3. R3-4: con US$ 50 pagados en pesos el 6/10 a $2.028, "29/09 usd 12 netflix visa" con "Sí" propone $24.336 desde Galicia.
4. Las cuotas: "15/07 60000 x6 visa" con julio, agosto y septiembre pagados pregunta una sola vez y registra 3 pagos.
5. Un gasto con fecha en el resumen en curso no pregunta nada: la carga común no suma pasos.

---

## Testing

| Capa | Qué | Cantidad |
|---|---|---|
| Unit (Vitest) | `cardDetail` (resumen por defecto, cuotas que siguen, mínimo, límite, ítems con descripción) y `wallet` con archivadas | +14 |
| pgTAP | `set_favorite_card`, `save_expense_with_payments` (R3-3, reintento, cuenta ajena) y el límite obligatorio | +12 |
| Contra la base local (script) | Los criterios de D-3, D-4 y D-6 con un usuario real | 1 script |
| Manual en el teléfono | Recorrer el detalle con datos reales; aviso de cierre → detalle → ponerse al día con varias líneas | 2 recorridos |

## Plan de vuelta atrás

- **App:** se revierte el merge.
- **Migración:** `drop function` de las dos funciones y `alter table cards drop constraint cards_credit_limit_required`. No borra datos.
- **Pagos ya registrados:** se deshacen pago por pago con `reverted_at`. Ningún pago se borra.

## Fuera de alcance

- El push del aviso de cierre y el link que abre el detalle desde la notificación (la ruta queda lista).
- Desarchivar desde Ajustes (T10). La sección "Archivadas" de la Billetera lo cubre mientras tanto.
- Editar o borrar un consumo desde el detalle.
- Las capas de brillo y anillos del plástico, y los íconos de categoría (falta `react-native-svg`).
- Intereses por el saldo que se arrastra (02 §3: la v1 no los calcula).
- La carga por texto de varias líneas en la hoja de carga (el componente queda listo para sumarlo).

## Definición de terminado

1. Los criterios de D-1 a D-6 se verificaron contra la base local y, en el teléfono de Fran, contra `mangos`.
2. `pnpm test`, `pnpm typecheck`, `npx supabase test db`, `db lint` y `npx expo export --platform web` están en verde.
3. `docs/03-modelo-de-datos.md` tiene las dos funciones y el check del límite, y las decisiones quedan en `docs/decisiones/2026-10-05-spec-detalle-de-tarjeta.md`.
