---
spec_kind: epic
status: ready
date: 2026-10-08
---

# Épica: Lista de movimientos (con editar, borrar y completar los "Sin medio de pago")

## Contexto

La persona carga gastos, pero después no los puede ver juntos ni arreglarlos. Si se equivocó en un monto, una fecha o una tarjeta, hoy no hay forma de corregirlo: solo existe el "Deshacer" del toast, justo después de guardar. Los gastos que entran al reclamar un lugar en un grupo ("Sin medio de pago", 02 §7) cuentan en la categoría pero no aparecen en ninguna pantalla, así que nunca se pueden completar (decisión D4 de la épica de la web de invitados: "con la lista de movimientos").

01-alcance pone "Movimientos con filtros" en la Billetera (tabla de pantallas). Esta épica agrega:
- la pantalla de movimientos, con mes, búsqueda y la ficha "Sin medio de pago";
- editar y borrar un gasto personal desde la lista;
- completar el medio de pago de un "Sin medio de pago".

## Estado actual (verificado el 8/10/2026)

| Pieza | Qué hay | Dónde |
|---|---|---|
| Lista de movimientos | No existe. Los consumos de una tarjeta se ven solo en su detalle | `apps/mobile/src/app/(app)/tarjeta/[id].tsx` |
| Editar un gasto personal | No existe. `saveExpense` hace `insert` y toma el `23505` como "ya guardado" | `apps/mobile/src/lib/entry.ts:202` |
| Editar un gasto de grupo | Existe: `/cargar?groupExpenseId=…`, con el gasto personal vinculado | `apps/mobile/src/app/(app)/cargar.tsx:127`, `lib/groupExpense.ts:78` |
| Borrar | Solo el "Deshacer" del toast (`deleteExpenses`) | `apps/mobile/src/lib/entry.ts:302` |
| "¿Ya lo pagaste?" | `save_expense_with_payments` hace `insert … on conflict (id) do nothing` y, si no insertó, no guarda pagos: no sirve para editar | `supabase/migrations/20261006120000_expense_payment_ids.sql` |
| Cálculo del impacto tarde | `lateImpacts(input, drafts)` en core | `packages/core/src/wallet/wallet.ts:529` |
| Columnas que lee la app | `MOVEMENT_COLUMNS` no trae `origin` ni `group_payment_id` | `apps/mobile/src/lib/wallet.ts:23` |
| Restricción de medio de pago | Sin tarjeta ni cuenta solo pueden quedar los ajustes y los `origin = claim` | `supabase/migrations/20261002120000_schema_v1.sql:259` |
| RLS | `own_rows` sobre `movements` para todo (`for all`) | `schema_v1.sql:622` |
| Reclamo | `claim_member` crea los "Sin medio de pago" con `origin = claim`, `my_share` y `group_expense_id` | `20261002130000_group_functions.sql:225` |
| Componentes | `CategoryIcon`, `dateLabel`, `Chip`, `Segmented`, `TextField`, `Screen`, `Sheet` | `apps/mobile/src/components/` |
| Prototipo | Panel "Movimientos": filtros, total, reparto y lista agrupada por día | `prototipo/mangos.html:496` y `:1285-1318` |

## Decisiones tomadas en esta spec (8/10, aprobadas por Fran)

| # | Tema | Decisión |
|---|---|---|
| L1 | Dónde vive | Pantalla `/movimientos` (push, no pestaña). Se abre con "Ver movimientos" desde la Billetera y desde "Gastos del mes" de Inicio (con el mes en curso elegido). La barra sigue con 3 pestañas |
| L2 | Tocar una fila | Abre la hoja de carga en modo editar, con "Eliminar gasto" |
| L3 | Filtros | Mes (por defecto el mes en curso, con "Todos los meses"), búsqueda y ficha "Sin medio de pago" (solo si hay alguno). Total del filtro. Sin filtros por medio ni categoría, sin barra de reparto |
| L4 | Qué entra | Todos los `movements` de la persona: gastos, ingresos, ajustes, los que generan los pagos de grupo y los pagos de tarjetas purgadas. Los `statement_payments` no entran: están en el detalle de la tarjeta |
| L5 | Completar un "Sin medio de pago" | Hoja de carga con todo completo y el medio de pago vacío y obligatorio. Cuotas solo con tarjeta de crédito. Si cae en un resumen cerrado y pagado, "¿Ya lo pagaste?" como siempre |

Decisiones derivadas (para que no queden en manos de quien implementa):

| # | Tema | Decisión |
|---|---|---|
| L6 | Qué abre cada fila | `origin = claim` → hoja de edición personal (L5), aunque tenga `group_expense_id`. Otro con `group_expense_id` → la edición de grupo que ya existe (`/cargar?groupExpenseId=`). `type = expense` sin grupo → hoja de edición personal. Ingresos, ajustes, los que tienen `group_payment_id` y `card_payment` → fila sin acción (`accessibilityRole` text) |
| L7 | Qué se puede cambiar de un "Sin medio de pago" | Medio de pago, cuotas, descripción y categoría. Monto, moneda y fecha quedan bloqueados, porque copian el gasto del grupo (se cambian desde el grupo, 02 §7). `origin` sigue en `claim`: si se deshace el reclamo, se borra igual (02 §7) |
| L8 | Editar y "¿Ya lo pagaste?" | El impacto se calcula **sin el propio gasto** en los guardados (`lateImpacts` sobre un `WalletInput` que lo excluye). Así, cambiar solo la descripción de un gasto en un resumen pagado no pregunta nada, y subir de $12.000 a $15.000 propone un pago de $3.000 |
| L9 | Borrar y pagos | Borrar un gasto **no toca ningún pago**, igual que cargarlo tarde (02 §3). Si el resumen queda con pagos mayores al total, figura "Pagado" y no se muestra saldo a favor (en la v1 no se registra) |
| L10 | Borrar: confirmación | Confirmación en línea en la hoja ("¿Borrás este gasto? No se puede deshacer."), igual que al borrar un gasto de grupo. Sin "Deshacer" en el toast |
| L11 | Mes | Por la **fecha del gasto**, como el prototipo, no por el resumen. Una compra en cuotas aparece una vez, en el mes de compra, con "N cuotas de $X" |
| L12 | Total del filtro | Solo los gastos (`type = expense`), por moneda: "12 movimientos · $ 245.300 + US$ 30". Usa el monto completo, no "tu parte". Los ingresos y ajustes se listan pero no suman |
| L13 | Signo y color | Gastos sin signo en `text`. Ingresos "+ $ X" en `success`. Ajustes con su signo: positivo en `success`, negativo en `error` |
| L14 | Búsqueda | Por descripción (sin acentos ni mayúsculas, con `normalizeWord`) o por monto (los dígitos del monto sin puntos). Sin botón: filtra mientras se escribe |
| L15 | Datos | Reusa `loadWalletInput` (ya trae todos los movimientos, tarjetas y pagos). `shortcut:` la lista se arma con todos los movimientos en memoria; paginar por mes cuando una persona pase los ~5.000 |

**Primero se actualiza `docs/02`** (L-1): editar y borrar un gasto no están escritos en las reglas.

## Orden de lectura de la pantalla

```
┌──────────────────────────────────────┐
│ ←  Movimientos                       │
│ [🔍 Buscar por descripción o monto ] │
│ [Octubre 2026 ▾]  [Sin medio de pago 2] │
│ 12 movimientos · $ 245.300 + US$ 30  │
│ HOY                                  │
│ [🛒] Coto                  $ 12.000  │
│      Visa ·· 2337          Supermerc.│
│ AYER                                 │
│ [🍴] Asado                 $ 48.000  │
│      Sin medio de pago · tu parte $16.000 │
│                       Grupo · Salidas│
│ [▢] Cobro de Juan        + $ 16.000  │
│      Caja de Ahorros       Otros     │
└──────────────────────────────────────┘
```

- Fila: `MovementRow` de `DESIGN.md` con `CategoryIcon` `md`. Subtítulo, en este orden y con " · ": medio de pago ("Visa ·· 2337", nombre de la cuenta o **"Sin medio de pago"** en `warning`), "cuota k/N" o "N cuotas de $X" (L11), "tu parte $X" si tiene `group_expense_id` y `my_share`.
- Encabezado de día: `DayHeader` con `dateLabel` ("Hoy", "Ayer", "jueves 1 de octubre").
- Mes: `Chip` que abre una hoja con los meses que tienen movimientos, más "Todos los meses".
- Ficha "Sin medio de pago N": `Chip`; elegida, muestra solo esos (en todos los meses).

## Estados

| Estado | Qué se ve |
|---|---|
| Cargando | Igual que la Billetera (mismo indicador) |
| Error | "No pudimos cargar tus movimientos." + Reintentar |
| Sin movimientos | "Todavía no cargaste gastos. Tocá + Gasto para empezar." |
| Filtro sin resultados | "No hay movimientos con este filtro." + "Limpiar filtros" |
| Después de editar o borrar | Vuelve a la lista, recarga y muestra el toast ("Guardaste los cambios" o "Borraste el gasto") |

## Hijas

| # | Título | Prioridad | Esfuerzo (humano / CC) | Depende de |
|---|---|---|---|---|
| L-1 | Reglas: editar y borrar un gasto en `docs/02` §5 | Crítica | 1 h / 5 min | — |
| L-2 | Core: `movementList()` | Alta | 1 día / 30 min | L-1 |
| L-3 | Base: `update_expense_with_payments` | Alta | 1 día / 30 min | L-1 |
| L-4 | Pantalla `/movimientos` y entradas | Alta | 1 día / 40 min | L-2 |
| L-5 | Hoja de carga en modo editar, borrar y completar | Alta | 2 días / 1 h | L-3, L-4 |

```
L-1 ─┬─> L-2 ──> L-4 ──┐
     └─> L-3 ──────────┴─> L-5
```

L-1 va primero porque 02 manda: editar y borrar no tienen reglas escritas. L-2 y L-3 son independientes. L-5 necesita la pantalla para abrirse y la función de la base para guardar.

### L-1. Reglas en `docs/02` §5

Agregar "Editar y borrar un gasto" con L5 a L9 y dos ejemplos numéricos:
- *Resumen de septiembre de la Visa: $100.000, pagado completo. Editás "farmacia" de $12.000 (dentro de esos $100.000) a $15.000 → el resumen pasa a $103.000 y se pregunta "¿Ya lo pagaste?" por $3.000.*
- *Mismo resumen. Borrás "farmacia" ($12.000) → el resumen pasa a $88.000 con $100.000 pagados: figura "Pagado" y los pagos no cambian.*

### L-2. Core: `movementList()`

En `packages/core/src/wallet/` (junto a `home()`), con tests Vitest:

```ts
export interface MovementFilter {
  month: Period | 'all';      // por fecha del gasto (L11)
  query: string;              // L14
  missingMethodOnly: boolean; // ficha "Sin medio de pago": ignora month
}

export type MovementAction = 'edit' | 'complete' | 'group' | 'none'; // L6

export interface MovementListRow {
  id: string;
  date: ISODate;
  description: string;
  amount: Money;
  sign: 'none' | 'plus' | 'minus';      // L13
  categoryId: string | null;
  methodLabel: string | null;           // null = "Sin medio de pago"
  installmentsLabel: string | null;     // "cuota 3/6" o "6 cuotas de $10.000"
  myShare: Money | null;
  isGroup: boolean;
  action: MovementAction;
  groupExpenseId: string | null;
}

export interface MovementList {
  days: { date: ISODate; rows: MovementListRow[] }[]; // de más nuevo a más viejo
  count: number;
  totals: { ARS: Money; USD: Money | null };          // L12
  months: Period[];                                   // con movimientos, de más nuevo a más viejo
  missingMethodCount: number;
}

export function movementList(input: WalletInput, filter: MovementFilter): MovementList;
```

- `DbWalletMovement` suma `origin` y `group_payment_id`; `MOVEMENT_COLUMNS` (`apps/mobile/src/lib/wallet.ts:23`) también.
- "cuota k/N" usa el mismo cálculo que el detalle de la tarjeta (resumen en curso contra el de la compra), con `k` entre 1 y N. Si todas las cuotas ya cerraron, "N cuotas de $X".
- Las tarjetas archivadas siguen dando nombre ("Visa ·· 2337").

### L-3. Base: `update_expense_with_payments(expense jsonb, payments jsonb)`

Migración nueva `20261009120000_update_expense.sql`, `security invoker`, `search_path = ''`, con tests pgTAP:
- Actualiza la fila `expense ->> 'id'` de la persona (RLS) solo si `type = 'expense'` y `origin <> 'purge'`. Si no la encuentra, `raise exception … using errcode = 'P0002'`.
- Si `origin = 'claim'`: actualiza solo `card_id`, `account_id`, `installments`, `description`, `category_id` y `debited_amount` (L7). Si no: también `date`, `amount` y `currency`.
- `card_id` y `account_id` se reemplazan siempre los dos (pasar de tarjeta a cuenta deja `card_id` en null).
- Inserta los pagos igual que `save_expense_with_payments`, con `on conflict (id) do nothing`, así un reintento no los duplica.
- El trigger `movements_fx` recalcula las cotizaciones si cambia la fecha (ya corre `before update`). Verificarlo con un test.
- Todo en una transacción: si falla un pago, el gasto no cambia.

### L-4. Pantalla `/movimientos`

- Ruta `apps/mobile/src/app/(app)/movimientos.tsx`, push normal. Param opcional `month`.
- Carga con `loadWalletInput` y `useFocusEffect` (recarga al volver de la hoja).
- Entradas: "Ver movimientos" (`Button` `link`) en la Billetera, arriba de las tarjetas; y en Inicio, en el encabezado de "Gastos del mes", con `month` = mes en curso.
- Tocar una fila según `action`: `edit` y `complete` → `/cargar?movementId=…`; `group` → `/cargar?groupExpenseId=…`; `none` → nada.

### L-5. Hoja de carga en modo editar

En `cargar.tsx`, con el param nuevo `movementId`:
- Título "Editar gasto". Sin carga por texto y sin selector de grupo.
- Precarga monto, moneda, descripción, fecha, categoría, medio de pago y cuotas desde la fila. Si es `complete`, el medio de pago empieza vacío y el error "Elegí con qué pagaste." sale al guardar sin elegir. Monto, moneda y fecha bloqueados (L7).
- En las fichas de medio de pago, el medio actual aparece aunque no sea la favorita ni uno de los dos más usados.
- Guardar: arma el `LateDraft` y llama a `lateImpacts` con el input **sin** el propio gasto (L8). Si pregunta, el mismo "¿Ya lo pagaste?" de la carga. Guarda con `update_expense_with_payments`. La categoría corregida enseña la palabra igual que al cargar (R3-5).
- "Eliminar gasto" (`Button` `ghost` con texto `error`) → confirmación en línea (L10) → `delete` de esa fila → vuelve y toast.
- Sin conexión al guardar o borrar: toast "Sin conexión. Probá de nuevo." y la hoja queda abierta con lo escrito (la cola sin conexión es la T8).

## Testing

| Capa | Qué | Cantidad |
|---|---|---|
| Vitest | `movementList`: filtro por mes, "Todos", búsqueda por texto con acentos, búsqueda por monto, ficha "Sin medio de pago" (ignora el mes), total por moneda que no suma ingresos ni ajustes, signos, "cuota k/N" y "N cuotas de $X", `action` de cada tipo (claim con grupo → `complete`), tarjeta archivada | +12 |
| Vitest | `lateImpacts` sin el propio gasto: solo descripción → no pregunta; $12.000 → $15.000 → propone $3.000; cambio de tarjeta a un resumen pagado → pregunta por el total | +3 |
| Vitest | Borrar en un resumen pagado: queda "Pagado" con los pagos mayores al total (L9) | +1 |
| pgTAP | `update_expense_with_payments`: edita, claim solo cambia lo permitido, claim sin medio → con tarjeta pasa la restricción, tarjeta → cuenta deja `card_id` null, otro usuario no la ve, `adjustment` y `purge` fallan, pagos sin duplicar en un reintento, fecha nueva recalcula `fx_*`, un pago inválido no deja el gasto cambiado | +9 |
| Manual | Chrome headless contra la base local (320 y 390, claro y oscuro) y después el teléfono contra `mangos` | — |

## Plan de vuelta atrás

- App: revertir los commits. La pantalla y la hoja no cambian datos existentes.
- Base: la función es nueva. `drop function public.update_expense_with_payments(jsonb, jsonb);` y borrar la fila de `supabase_migrations.schema_migrations`.
- Un gasto mal editado no se recupera solo: los gastos editados quedan con `updated_at` para encontrarlos.

## Fuera de alcance

- Filtros por medio de pago y por categoría, y la barra de reparto del prototipo.
- Editar ingresos, ajustes, pagos de grupo o pagos de tarjetas purgadas.
- "Deshacer" después de editar o borrar.
- Cola sin conexión (T8).
- Exportar movimientos.
- "Saldo a favor" de un resumen con pagos de más.
- Paginación (L15).

## Definición de terminado

1. `docs/02` §5 tiene "Editar y borrar un gasto" con los dos ejemplos de L-1.
2. "Ver movimientos" abre la lista desde la Billetera y desde Inicio. Desde Inicio, con el mes en curso elegido.
3. La lista agrupa por día, de más nuevo a más viejo, con `CategoryIcon`, medio de pago, cuotas y "tu parte".
4. Cambiar el mes, buscar "cafe" (encuentra "Café") y buscar "12000" (encuentra $12.000) filtran la lista y el total.
5. Con un "Sin medio de pago" en la cuenta, aparece la ficha con su número. Elegida, muestra solo esos.
6. Tocar un gasto personal abre "Editar gasto" con todo precargado. Cambiar el monto y guardar actualiza la lista y el detalle de la tarjeta.
7. Editar a $15.000 un gasto de $12.000 en un resumen pagado pregunta "¿Ya lo pagaste?" por $3.000. Con "Sí", el resumen queda "Pagado".
8. Completar un "Sin medio de pago" con una tarjeta: deja de figurar en la ficha y suma en el resumen que le toca. Monto, moneda y fecha no se pueden cambiar.
9. Tocar un gasto de grupo propio abre la edición de grupo que ya existe. Un ingreso o un ajuste no hacen nada al tocarlos.
10. Borrar pide confirmación, saca el gasto de la lista y no cambia ningún pago.
11. Pasan los tests nuevos y los existentes (458 pgTAP y 343 Vitest a hoy) y el typecheck.
12. Probado en Chrome headless contra la base local y en el teléfono contra `mangos`.
