# Épica: base de `packages/core` (T1 + T2 + T3 + T4)

Spec aprobado por Fran el 2/10/2026 con `/spec`. Fuente de verdad de las reglas: `docs/02-reglas-de-negocio.md` y `docs/03-modelo-de-datos.md`. Decisiones técnicas: `docs/05-plan-tecnico.md` (D1, D4, D8 a D11, D14) e informe de eng review (`docs/decisiones/2026-10-01-eng-review-informe.md`, tareas T1 a T4).

## Contexto

`packages/core` concentra los cálculos que usan la app (también sin conexión) y las Edge Functions (D4), así los números coinciden en todos lados. Al 2/10/2026 no hay código: no existen el repo git, `package.json`, `apps/` ni `packages/`. Antes de cualquier pantalla hacen falta el dinero sin errores de redondeo (D8), las reglas de tarjetas (02 §3), las de grupos, gasto por categoría, saldo de cuentas y patrimonio (02 §2, §6, §7 y §8). Las firmas de core se fijan primero porque las usan los dos carriles, app y base.

## Hijos

| # | Título | Prioridad | Esfuerzo (vos solo / CC) | Depende de |
|---|---|---|---|---|
| 1 | Monorepo, `Money` y `convert()` | P1 | ~1 día / ~1 h | — |
| 2 | Tarjetas de crédito (02 §3) | P1 | ~3 días / ~3 h | #1 |
| 3 | Grupos, gasto por categoría, saldo de cuentas y patrimonio | P1 | ~2,5 días / ~2,5 h | #1, #2 |

```
#1 Monorepo + Money ──> #2 Tarjetas ──> #3 Grupos, categorías, cuentas y patrimonio
```

**Por qué este orden:** #2 usa `Money`, `convert()` y `Rate`; #3 usa `installmentSchedule` (cuotas en el gasto por categoría) y `cardState` (deuda de tarjetas en el patrimonio). Invertirlo obliga a inventar firmas provisorias.

## Convenciones de todo el paquete

- TypeScript puro, sin dependencias de runtime. Ninguna función lee el reloj, la red ni la base: `today` y las cotizaciones entran como parámetros.
- Montos siempre como `Money` (centavos enteros). Toda conversión de moneda pasa por `convert()`.
- Fechas: `ISODate = 'YYYY-MM-DD'` sin hora ni zona horaria. Resumen: `Period = 'YYYY-MM'` (mes de cierre). La app calcula `today` en hora de Argentina; en el borde con la base, `period` se guarda como el día 1 del mes (03).
- Entradas inválidas tiran `RangeError` (valores fuera de rango) o `TypeError` (tipos o monedas que no coinciden). Nunca se devuelve un resultado parcial.

---

## #1: monorepo, `Money` y `convert()`

### Qué cambia

1. `git init` con `.gitignore`: `node_modules/`, `dist/`, `.expo/`, `.gstack/`, `.claude/skills/gstack/` (pesa 879 MB). Primer commit con los docs, el prototipo, `CLAUDE.md`, `DESIGN.md`, `README.md`, `TODOS.md` y `estado-y-proximos-pasos.md`.
2. Raíz:
   - `package.json` privado con scripts `test` (Vitest en core) y `typecheck` (`tsc --noEmit` en los dos paquetes).
   - `pnpm-workspace.yaml` con `apps/*` y `packages/*`.
   - `.npmrc` con `node-linker=hoisted`.
   - `tsconfig.base.json` con `strict: true` y `noUncheckedIndexedAccess: true`.
3. `packages/core` (`@mangos/core`): sin dependencias de runtime; de desarrollo, `typescript` y `vitest`. `"main": "src/index.ts"`, sin build.
4. `apps/mobile` (`@mangos/mobile`): template default de `create-expo-app@latest` sin las pantallas de demo. `app.json` con `web.output: "static"`. Rutas: `app/_layout.tsx` (Stack), `app/index.tsx` (texto "Mangos") y `app/g/[token].tsx`, que muestra el token y `CURRENCIES` importado de `@mangos/core`. Sin estilos de `DESIGN.md`. Sin ESLint ni Prettier.

### API (`packages/core/src/money.ts`)

```ts
export type Currency = 'ARS' | 'USD';
export const CURRENCIES: readonly Currency[] = ['ARS', 'USD'];
export interface Money { readonly minor: number; readonly currency: Currency } // minor: entero seguro
export type Rate = string & { readonly __brand: 'Rate' };           // '2028.00': hasta 6 decimales, > 0
export type DbNumeric = string & { readonly __brand: 'DbNumeric' }; // numeric(14,2) tal cual viene de la base

money(minor: number, currency: Currency): Money          // TypeError si minor no es entero seguro
rate(s: string): Rate                                    // RangeError si no cumple /^\d+(\.\d{1,6})?$/ o vale 0
zero(currency: Currency): Money
add(a: Money, b: Money): Money                           // TypeError si difieren las monedas
subtract(a: Money, b: Money): Money
negate(m: Money): Money
convert(m: Money, r: Rate, to: Currency): Money          // USD→ARS multiplica, ARS→USD divide; misma moneda devuelve el mismo monto
fromDbNumeric(s: DbNumeric | string, c: Currency): Money // '86500.00' → 8650000; más de 2 decimales: RangeError
toDbNumeric(m: Money): DbNumeric                         // siempre 2 decimales: -5 → '-0.05'
```

- `convert()` calcula con `bigint` sobre la cotización escalada (sin `number` en el medio) y redondea al centavo con half-up **alejándose del cero** (−15,075 → −15,08), así un reintegro redondea igual que el gasto.
- `convert()` es la única función que convierte entre monedas.

### Criterios de aceptación

1. `pnpm install && pnpm test && pnpm typecheck` en la raíz sale con código 0.
2. **T-23:**
   - US$ 10,05 × `'1.5'` = $15,08.
   - $10,05 ÷ `'2'` = US$ 5,03.
   - −US$ 10,05 × `'1.5'` = −$15,08.
   - $1,00 × `'1.005'` = $1,01 (con `number` daría $1,00).
   - $10,00 ÷ `'3'` = US$ 3,33.
   - Misma moneda: devuelve el mismo monto.
3. **T-24:** `'86500.00'` ↔ 8650000, `'0.00'`, `'-0.05'` y `'999999999999.99'` hacen la ida y vuelta exacta; `'1.005'` tira `RangeError`.
4. `money(1.5, 'ARS')`, `rate('0')` y `add` entre ARS y USD tiran error.
5. `pnpm --filter @mangos/mobile exec expo export --platform web` sale con 0 y existe `apps/mobile/dist/g/[token].html`, con el import de `@mangos/core` resuelto.

### Tests

~14 unitarios en `packages/core/src/money.test.ts`.

---

## #2: tarjetas de crédito (02 §3)

### Tipos (`packages/core/src/cards/types.ts`)

```ts
type ISODate = string;  // 'YYYY-MM-DD'
type Period = string;   // 'YYYY-MM', mes de cierre
interface CreditCard { id: string; closeDay: number; dueDay: number; creditLimit: Money } // días 1 a 31; límite en ARS
interface StatementOverride { period: Period; closeDate: ISODate; dueDate: ISODate }
interface CardExpense { id: string; date: ISODate; amount: Money; installments: number }    // 1 a 24
interface StatementPayment {
  id: string; period: Period; appliesTo: Currency; amount: Money;  // amount.currency === appliesTo
  fromAccountId: string; debitedAmount: Money; fxCardRate: Rate | null;
  paidAt: ISODate; revertedAt: ISODate | null;
}
type StatementStatus = 'current' | 'future' | 'to_pay' | 'partial' | 'paid' | 'overdue';
```

### Funciones (`packages/core/src/cards/`)

| Función | Regla |
|---|---|
| `closeDate(card, period, overrides)` | Si hay corrección, manda. Si no, `min(closeDay, último día del mes)` |
| `dueDate(card, period, overrides)` | Si hay corrección, manda. Si no: con `dueDay > closeDay` (días configurados) vence ese mes; si no, el siguiente. Día = `min(dueDay, último día de ese mes)` (D11) |
| `statementFor(card, date, overrides)` | Prueba en orden el mes anterior, el de la fecha y el siguiente; devuelve el primer `p` con `closeDate(p−1) < date ≤ closeDate(p)`. Funciona aunque una corrección corra el cierre al mes siguiente |
| `validateOverride(card, period, override, overrides)` | `{ok: true}` o `{ok: false, reason}` con `reason` = `'out_of_range'` (más de ±10 días del estimado), `'not_after_previous'`, `'not_before_next'` o `'due_before_close'` (D10) |
| `installmentSchedule(card, expense, overrides)` | Cuota k (0..N−1) va a `statementFor(date) + k` meses (no a fecha + k meses). Monto: `floor(total/N)` centavos y el resto a la primera (D9). Devuelve `{index, of, period, amount}[]` |
| `cardState(input)` | Ver abajo |
| `lateExpenseImpact(input)` | Ver abajo |

### `cardState({card, expenses, payments, overrides, today, fxCard})`

```ts
{
  currentPeriod: Period;            // statementFor(card, today)
  statements: StatementView[];      // de menor a mayor: todo período con cuotas o pagos, más el en curso siempre
  toPay: StatementView[];           // cerrados con pendiente > 0, por dueDate ascendente
  limitUsed: Money;                 // ARS: Σ pendiente ARS + convert(Σ pendiente USD, fxCard, 'ARS'), una sola conversión
  available: Money;                 // max(0, creditLimit − limitUsed)
}
StatementView {
  period: Period; closeDate: ISODate; dueDate: ISODate; status: StatementStatus;
  total, paid, pending, overpaid: { ARS: Money; USD: Money };  // paid ignora revertidos; pending = max(0, total − paid); overpaid = max(0, paid − total)
  items: { expenseId: string; index: number; of: number; amount: Money }[];
}
```

Estado, en este orden:
1. `period > currentPeriod` → `future`.
2. `period === currentPeriod` → `current` (incluye el día de cierre; pasa a cerrado desde el día siguiente).
3. Cerrado y `pending` de las dos monedas en 0 → `paid` (incluye resúmenes de $0).
4. `today > dueDate` → `overdue` (el día del vencimiento todavía no).
5. Sin pagos vigentes en ninguna moneda → `to_pay`.
6. Si no → `partial`.

El excedente (`overpaid`) se informa pero en la v1 **no** pasa como saldo a favor al resumen siguiente.

### `lateExpenseImpact({card, expense, expenses, payments, overrides, today, fxCard})`

```ts
{
  isLate: boolean;           // alguna cuota cae en un resumen con closeDate < today
  askAlreadyPaid: boolean;   // alguno de esos resúmenes estaba 'paid' antes del gasto; se pregunta una sola vez
  proposedPayments: {        // uno por resumen pagado afectado; se guardan solo si la persona contesta "Sí"
    period: Period; appliesTo: Currency; amount: Money;
    fromAccountId: string; debitedAmount: Money; fxCardRate: Rate | null; paidAt: ISODate;
  }[];
}
```

- `amount` = suma de las cuotas del gasto que caen en ese resumen.
- Último pago = el pago vigente de ese resumen con la misma `appliesTo` y `paidAt` más reciente; si hay empate, el último del array.
- ARS: misma cuenta y misma fecha que el último pago; `debitedAmount` = `amount`; `fxCardRate: null`.
- USD pagado desde cuenta en USD (`debitedAmount.currency === 'USD'`): mismo monto en US$, misma cuenta y fecha, `fxCardRate: null`.
- USD pagado en pesos: `debitedAmount = convert(amount, último.fxCardRate, 'ARS')`, misma cuenta y fecha, mismo `fxCardRate`.
- USD sin pago anterior en USD en ese resumen: cuenta y fecha del último pago del resumen (cualquier moneda); `debitedAmount = convert(amount, fxCard, 'ARS')` y `fxCardRate = fxCard` (dólar tarjeta de hoy). Se agrega a 02 §3.

### Criterios de aceptación (Vitest)

Tarjeta A: cierre 24, vencimiento 6. Tarjeta B: cierre 30, vencimiento 10. Tarjeta C: cierre 25, vencimiento 8. Los días de B y C se anotan en 02 §3 junto a sus ejemplos.

1. **T-01** (A): 20/9 → `sep` (cierra 24/9, vence 6/10); 24/9 → `sep`; 25/9 → `oct` (24/10, 6/11); 28/12 → `ene` del año siguiente (24/1, 6/2).
2. **T-02** (A): $30.000 en 3 cuotas el 25/9 → $10.000 en oct, nov y dic, que vencen 6/11, 6/12 y 6/1.
3. **T-03:** $100.000 en 3 → 3.333.334 + 3.333.333 + 3.333.333 centavos.
4. **T-07:** cierre 31 → 28/2/2026, 29/2/2028 y 30/4. Cierre 31 y vencimiento 30 → febrero cierra 28/2 y vence 30/3.
5. **T-08:** cierre corregido al 27/10 y compra del 26/10 → `oct`. Corrección a +15 días → `out_of_range`. Corrección del cierre de oct al 2/11 → la compra del 1/11 entra en `oct`.
6. **T-04** (lado tarjeta): resumen de $200.000 y pago de $120.000 → `partial` con $80.000 pendientes; pasado el vencimiento → `overdue` con $80.000; con el pago revertido antes del vencimiento → `to_pay` con $200.000.
7. **T-05:** un resumen por estado → `current`, `future`, `to_pay` y `paid`.
8. **T-06:** límite usado con un vencido, el en curso, cuotas futuras y US$ 50 a dólar tarjeta `'2028.00'` → suma exacta; `available` nunca negativo (con un límite chico da 0).
9. Resumen cerrado en $0 → `paid`. Pago de $210.000 sobre $200.000 → `paid` con `overpaid.ARS` = $10.000. Pesos pagados y dólares no → `partial`.
10. `toPay` con dos resúmenes cerrados con pendiente sale ordenado por vencimiento.
11. **Gasto tarde simple** (B): septiembre cerró en $100.000, pagado; hoy 5/10 se carga "28/09 $12.000" → `isLate` y `askAlreadyPaid` en true; el resumen pasa a $112.000; sin el pago propuesto queda `partial` con $12.000.
12. **R3-3** (B): pagos de $60.000 (Galicia, 3/10) y $40.000 (MP, 6/10); hoy 8/10 → propuesta de $12.000 desde MP con fecha 6/10; aplicada, el resumen queda `paid`; revertida, `partial` con $12.000.
13. **R3-4** (B): la parte USD (US$ 50) se pagó en pesos el 6/10 a `'2028.00'`; se carga "29/09 US$ 12" → propuesta de US$ 12 con `debitedAmount` $24.336 desde Galicia con fecha 6/10. Si se hubiera pagado desde una cuenta en USD → US$ 12 desde esa cuenta, `fxCardRate: null`. Si nunca se pagó la parte USD → cuenta del último pago y `fxCard` de hoy.
14. **Cuotas tarde** (C): hoy 5/10 se carga "15/07 $60.000 x6"; julio, agosto y septiembre pagados → `askAlreadyPaid` true y 3 pagos propuestos de $10.000, cada uno con la cuenta y fecha de su resumen; octubre `current`; noviembre y diciembre `future`.
15. Un gasto que no es tarde → `isLate: false` y `proposedPayments: []`.

### Tests

~30 unitarios en `packages/core/src/cards/*.test.ts`.

---

## #3: grupos, gasto por categoría, saldo de cuentas y patrimonio (02 §2, §6, §7, §8)

### Tipos (`packages/core/src/groups/types.ts` y `packages/core/src/personal/types.ts`)

```ts
interface GroupMember { id: string; name: string }   // en orden de joined_at
interface Group { id: string; currency: Currency; members: GroupMember[] }
interface GroupExpense {
  id: string; amount: Money; fxRate: Rate | null;    // fxRate obligatoria si amount.currency !== group.currency
  payerMemberId: string; splitMode: 'equal' | 'exact';
  parts: { memberId: string; value: Money | null }[]; // excluido = no aparece; equal → value null; exact → en la moneda del gasto
}
interface GroupPayment { id: string; fromMemberId: string; toMemberId: string; amount: Money } // moneda del grupo

type FxReference = 'mep' | 'oficial' | 'blue';
interface Account { id: string; currency: Currency; openingBalance: Money }
interface Movement {
  id: string; type: 'expense' | 'income' | 'transfer' | 'adjustment' | 'card_payment';
  date: ISODate; amount: Money; categoryId: string | null;
  cardId: string | null; accountId: string | null; toAccountId: string | null; installments: number;
  myShare: Money | null; groupExpenseId: string | null;
  fx: Record<FxReference, Rate | null>; fxPending: boolean;
  debitedAmount: Money | null;
}
```

### Funciones

| Función | Regla |
|---|---|
| `shares(group, expense)` | `Record<memberId, Money>` en la moneda del grupo. **Iguales:** convierte el total una vez con `fxRate`, divide con `floor` y el resto va al que pagó (o al primer incluido, por orden de `members`, si el que pagó quedó excluido). **Exactos:** valida \|Σ partes − total\| ≤ 50 centavos en la moneda del gasto (ARS y USD); si no, `RangeError`. La diferencia va al que pagó o al primer incluido. Si el gasto está en otra moneda, convierte el total y cada parte con `convert()` y el resto de redondeo va al mismo integrante. Sin incluidos → `RangeError` |
| `groupBalances(group, expenses, payments)` | Saldo exacto por integrante: + total convertido al que pagó, − cada parte, + pagos hechos, − pagos recibidos. Suman 0 exacto |
| `displayBalance(m)` | 0 si \|m\| < 100 centavos en ARS o < 1 centavo en USD (D14) |
| `simplifyDebts(group, balances)` | Lleva a 0 los saldos bajo el umbral. Deudores y acreedores de mayor a menor; empates por el orden de `members`. Cruza hasta vaciar un lado y descarta el sobrante si es menor al umbral. Devuelve `{fromMemberId, toMemberId, amount}[]`, como máximo N−1 |
| `accountBalance(account, movements, payments)` | `openingBalance`; `expense` y `card_payment` con `accountId` igual restan `debitedAmount ?? amount`; `income` suma `debitedAmount ?? amount`; `adjustment` suma `amount` con su signo; `transfer`: `accountId` resta `debitedAmount ?? amount` y `toAccountId` suma `amount`; cada `StatementPayment` no revertido con `fromAccountId` igual resta `debitedAmount`. Moneda distinta sin `debitedAmount` → `RangeError` |
| `categorySpend({movements, cards, month, reference, todayRate})` | Solo `expense`. Base = `myShare` si hay `groupExpenseId` y `myShare`; si no, `amount`. Con tarjeta: `installmentSchedule` sobre la base y cuenta lo que cae en `period === month`. Con cuenta o sin medio de pago: el mes de `date`. USD → ARS con `fx[reference]` del movimiento; si falta o `fxPending`, con `todayRate` y `approximate: true`. `cards` = `{card, overrides}[]`. Devuelve `{byCategory: Record<categoryId, Money>, total: Money, approximate: boolean}` en ARS |
| `netWorth({display, referenceRate, accountBalances, myGroupBalances, cardDebts})` | `cardDebts` = `limitUsed` de cada `cardState`. Por bloque (cuentas, grupos, tarjetas) suma ARS y USD por separado y convierte una vez la parte que no está en `display` con `referenceRate`. Devuelve `{accounts, groups, cards, total}` en `display`, con total = cuentas + grupos − tarjetas |

En una transferencia, `amount`/`currency` es lo que entra a `toAccountId` y `debitedAmount` lo que sale de `accountId` en la moneda de esa cuenta. Se agrega a 03.

### Criterios de aceptación (Vitest)

1. **T-10:** Vos pagás $90.000 iguales; Ana paga $30.000 exactos (Ana $10.000, Juan $20.000) → Vos +60.000, Ana −10.000, Juan −50.000; suman 0.
2. **T-11:** Juan → Vos $50.000 y Ana → Vos $10.000 (2 transferencias).
3. **T-12:** $100 entre 3, pagó Ana → Ana $33,34, Juan $33,33, Vos $33,33. Si Ana pagó y quedó excluida, el resto va al primer incluido.
4. **T-13:** total $1.000, partes $600 (pagador) + $399,60 → pagador $600,40. Diferencia de $0,60 → `RangeError`.
5. **T-14:** grupo ARS con saldo $0,80 → `displayBalance` 0 y sin transferencia; grupo USD con US$ 0,80 → aparece.
6. US$ 100 a `'1500.00'` en grupo en pesos, entre 3 → total $150.000 y partes de $50.000 que suman exacto.
7. Después de T-10, Juan le paga $50.000 a Vos → Vos +10.000, Juan 0, Ana −10.000.
8. **T-09** (02 §6): $30.000 en 3 cuotas el 25/9 con cierre 24 → sep $0; oct, nov y dic $10.000. Con débito, todo en el mes de la fecha.
9. Gasto de grupo de $90.000 en 3 cuotas con `myShare` $30.000 → $10.000 en el mes de cierre de cada resumen.
10. Gasto "Sin medio de pago" de un reclamo → su `myShare` cuenta en el mes de la fecha.
11. US$ 10 con `fx.mep` `'1400.00'` y referencia MEP → $14.000, `approximate: false`. Con `fxPending` y `todayRate` `'1500.00'` → $15.000, `approximate: true`.
12. Mismo movimiento con `groupExpenseId: null` (grupo eliminado) → cuenta el `amount` completo.
13. **T-15** (integración, `packages/core/src/integration.test.ts`): pagaste $90.000 con tarjeta, 3 iguales → `cardState` total $90.000, `categorySpend` $30.000, `groupBalances` +$60.000. Si pagó otro: sin movimiento personal y saldo −$30.000. Con "No sumarlo": sin movimiento y saldo +$60.000.
14. **T-18 y T-04** (lado caja): US$ 12 con `debitedAmount` $24.336 desde caja en pesos → la caja baja $24.336. Pago de $120.000 → la caja baja $120.000; al revertirlo, vuelve.
15. Compra de dólares: transferencia de US$ 100 con `debitedAmount` $142.000 → caja en pesos −$142.000, cuenta en dólares +US$ 100.
16. **T-16:** cuentas $500.000 y US$ 1.000; grupo +$60.000; tarjeta con $187.000 + US$ 50 a `'2028.00'` (deuda $288.400); MEP `'1500.00'`. En ARS: cuentas $2.000.000, grupos $60.000, tarjetas $288.400, total $1.771.600. En USD: cuentas US$ 1.333,33, grupos US$ 40,00, tarjetas US$ 192,27, total US$ 1.181,06.

### Tests

~30 unitarios y 1 de integración.

---

## Archivos

| Archivo | Hijo | Qué |
|---|---|---|
| `.gitignore`, `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `tsconfig.base.json` | #1 | Monorepo |
| `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts` | #1 | Paquete y exports públicos |
| `packages/core/src/money.ts`, `money.test.ts` | #1 | `Money`, `convert`, borde de la base |
| `apps/mobile/` (`app.json`, `app/_layout.tsx`, `app/index.tsx`, `app/g/[token].tsx`) | #1 | App mínima con export web |
| `packages/core/src/dates.ts`, `dates.test.ts` | #2 | Último día del mes, sumar meses a un `Period`, comparar `ISODate` |
| `packages/core/src/cards/{types,schedule,state,late}.ts` y `*.test.ts` | #2 | Tarjetas |
| `packages/core/src/groups/{types,shares,balances,simplify}.ts` y `*.test.ts` | #3 | Grupos |
| `packages/core/src/personal/{types,accountBalance,categorySpend,netWorth}.ts` y `*.test.ts` | #3 | Finanzas personales |
| `packages/core/src/integration.test.ts` | #3 | T-15 |
| `docs/02-reglas-de-negocio.md` §3 | #2 | Gasto tarde en USD sin pago anterior; días de las tarjetas de los ejemplos |
| `docs/03-modelo-de-datos.md` §`movements` y §"Cálculos" | #3 | Semántica de `transfer`; firmas reales de la épica |

## Definition of Done

1. `pnpm install && pnpm test && pnpm typecheck` en la raíz sale con 0.
2. Pasan T-01 a T-08, T-09, T-10 a T-16, T-18, T-23 y T-24 (T-04 completo, lado tarjeta y lado caja) y los criterios propios de cada hijo.
3. `expo export --platform web` genera `dist/g/[token].html` con `@mangos/core` importado.
4. `packages/core/package.json` no tiene `dependencies`.
5. 02 y 03 actualizados como dice la tabla de archivos.

## Plan de rollback

No hay datos ni producción: se revierte el commit de cada hijo.

## Fuera del alcance

- Pantallas reales, estilos de `DESIGN.md`, formato de montos para mostrar.
- Supabase, migraciones, Edge Functions y la prueba T9.
- Pago mínimo, aviso de cierre, saldo a favor que pasa al resumen siguiente.
- Porcentaje y Partes (fase 2), permisos de grupo, cambio de dueño, invitaciones y reclamo.
- Presupuestos.
- ESLint, Prettier, CI y EAS.
