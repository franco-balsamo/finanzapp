---
spec_kind: epic
status: ready
date: 2026-10-08
---

# Épica: Inicio (patrimonio, vencimientos, gastos del mes, grupos y avisos)

## Contexto

Inicio es la quinta pieza de la v1 (01-alcance §5) y la única de las pantallas principales que falta. Hoy la app abre en la Billetera, que muestra el patrimonio como un número suelto. Lo que más le importa a la persona día a día está repartido en varias pantallas o no se ve en ningún lado:
- cuánto vence y cuándo;
- cuánto gastó este mes y en qué;
- quién le debe;
- qué le avisó Mangos.

En concreto, el gasto por categoría ya está en core, pero la app no lo usa. Los avisos de cierre, de vencimiento y de grupo se guardan en `notifications`, pero la app no los lee: si no llega el push, que todavía no se manda, la persona no se entera.

Esta épica agrega:
- la pestaña Inicio, primera y pantalla de entrada;
- el patrimonio con su desglose;
- el dólar del día;
- los próximos vencimientos;
- los gastos del mes por categoría con sus íconos;
- los saldos de grupos;
- la tarjeta "Cerró tu Visa" hasta el vencimiento;
- los avisos recientes.

## Estado actual (verificado el 8/10/2026)

| Pieza | Estado | Dónde |
|---|---|---|
| Pestañas | Billetera (`index`) y Grupos, con íconos dibujados con `View` | `apps/mobile/src/app/(app)/(tabs)/_layout.tsx` |
| Patrimonio | En la Billetera: número grande con el chip AR$/US$ (`display_currency`) y "Dólar de las HH:MM" si la cotización tiene más de una hora. Calculado por `wallet()` → `netWorth` (cuentas, grupos, tarjetas, total) | `(tabs)/index.tsx:122`, `packages/core/src/wallet/wallet.ts:279` |
| Filas de la app | `loadWalletInput` trae tarjetas (también archivadas), cuentas, movimientos, pagos, cierres corregidos, grupos y cotizaciones. Devuelve solo la del dólar de referencia y la tarjeta | `apps/mobile/src/lib/wallet.ts:92` |
| Cotizaciones | `latestRates()` devuelve la última venta y hora de MEP, oficial, blue y tarjeta | `apps/mobile/src/lib/fx.ts` |
| Vencimientos | `cardState` da `statements` (con estado, cierre, vencimiento, pendiente) y `toPay` (cerrados con saldo, el más próximo primero). `WalletCard` solo expone `currentTotal` y `closeDate` | `packages/core/src/cards/state.ts:26`, `wallet.ts:136` |
| Gasto por categoría | `categorySpend({movements, cards, month, reference, todayRate})` con tests. No se usa en la app | `packages/core/src/personal/categorySpend.ts` |
| Categorías | 6 fijas con nombre (`CATEGORIES`). Sin íconos: falta `react-native-svg` y `CategoryIcon` | `apps/mobile/src/lib/categories.ts`, DESIGN.md "Ícono de categoría" |
| Saldo de grupos | `myGroupBalance` por grupo dentro de `wallet()`; no se expone por grupo | `wallet.ts:183` |
| Avisos | `notifications` (title, body, kind `card_closing`/`card_due`/nulo en grupo, `data.card_ids`, `read_at`). RLS `own_rows`; `authenticated` tiene `select`, `update (read_at)` y `delete`. La app no la lee | `schema_v1.sql:574,626` |
| Detalle de tarjeta | Ya tiene `QuickEntry` con la tarjeta elegida: alcanza con abrirlo para "¿Te falta cargar algo?" | `(app)/tarjeta/[id].tsx:219` |

## Decisiones tomadas en esta spec (8/10)

- **D1. Inicio es la primera pestaña y la pantalla de entrada.** `(tabs)/index.tsx` pasa a ser Inicio y la Billetera se mueve a `(tabs)/billetera.tsx`. Orden de las pestañas: Inicio, Billetera, Grupos.
- **D2. El patrimonio vive solo en Inicio.** La Billetera pierde el número grande y el chip, y queda con su título, el menú ⋯, las pestañas Tarjetas y Cuentas, y las archivadas. Así un mismo número no aparece en dos pantallas. El chip AR$/US$ y "Dólar de las HH:MM" pasan a Inicio sin cambios. 02 §8 se actualiza: el chip está en Inicio.
- **D3. Próximos vencimientos como el prototipo.** Por cada tarjeta no archivada:
  - cada resumen de `toPay` (cerrado con saldo, vencido o no);
  - el resumen en curso, con "En curso, cierra el 24/10", **solo si tiene algo cargado**, para no llenar la lista de $0.

  Se ordenan por vencimiento y se muestran como máximo 4. Vencido: `Pill` `error` "Vencido". Vence en 3 días o menos: etiqueta "Vence hoy", "Vence mañana" o "Vence en N días" (`Pill` `error` si es hoy o mañana, `warning` si no). Si no, "Vence 24/10" en texto.
- **D4. Gastos del mes: solo el mes calendario en curso**, sin elegir otro mes. Usa `categorySpend` con la regla de 02 §6: tu parte, una cuota en el mes de cierre de su resumen, en pesos. Arriba va el total. Por categoría con gasto: ícono `md`, nombre, monto y una barra de su parte del total, sin topes ni presupuestos. Si `approximate`, se suma "Aproximado: algún gasto en dólares usa el dólar de hoy". Las categorías van de mayor a menor, y las que están en cero no aparecen.
- **D5. Los íconos de categoría entran en esta épica** (I-1): `react-native-svg`, `CategoryIcon` con los 6 glifos de la v1 y el ícono de la pestaña Inicio. Los otros 14 glifos quedan para cuando haya categorías propias.
- **D6. "Cerró tu Visa" hasta el vencimiento.** Una tarjeta arriba de todo por cada aviso `card_closing` que siga vigente. Un aviso está vigente mientras alguna de sus tarjetas (`data.card_ids`) cumpla las tres condiciones:
  - no está archivada;
  - tiene un resumen cerrado que cerró en la fecha del aviso o antes (el último);
  - ese resumen no está pagado y hoy es su vencimiento o un día anterior.

  El texto es el `body` del aviso, tal cual. Tocarla abre `/tarjeta/[id]` de la primera tarjeta vigente y marca el aviso leído. No tiene botón de cerrar: se va sola al pagar o al vencer.
- **D7. Avisos recientes: los últimos 3** de `notifications` por `created_at`, leídos o no. El no leído lleva un punto `primary` a la izquierda. Tocar un aviso pone `read_at = now()` si estaba en nulo y, si tiene `data.card_ids`, abre el detalle de la primera tarjeta no archivada. Un aviso de grupo solo se marca leído. No hay campanita, pantalla de Alertas ni "Ver todos": van con Ajustes.
- **D8. Dólar del día:** una fila con las ventas de MEP, oficial, blue y tarjeta en Plex Mono, y debajo "Actualizado a las HH:MM" (la hora más reciente de las cuatro). No hay flecha de variación. Si un tipo no tiene cotización, muestra "—". La app solo lee `fx_rates`.
- **D9. Grupos:** hasta 3 grupos con saldo distinto de cero (`displayBalance`), ordenados por el valor absoluto del saldo. Cada fila muestra el nombre y "Te deben $X" o "Debés $X", en la moneda del grupo. Tocar una fila abre `/grupo/[id]`.
  - Si hay grupos pero ninguno tiene saldo: "Estás al día en todos tus grupos."
  - Sin grupos, la sección no aparece.
- **D10. Una sola carga.** Inicio usa `loadWalletInput` (más `notifications`) y calcula todo en core con una función nueva, `home(input, notices)`. No hay consultas nuevas por sección ni vistas en la base.

## Orden de lectura de la pantalla

1. Encabezado: "Hola, Fran" (`display`) y la fecha larga ("jueves 8 de octubre") en `caption` `textMuted`. Sin nombre: "Hola".
2. Tarjetas "Cerró tu Visa" vigentes (D6).
3. Patrimonio: etiqueta, chip, número en `moneyHero` (30 a menos de 360 de ancho) y tres filas de desglose: "Cuentas", "Tarjetas (lo que falta pagar)" en negativo y "Grupos (neto)". Si la cotización tiene más de una hora: "Dólar de las HH:MM".
4. Dólar del día (D8).
5. Próximos vencimientos (D3), con el link "Ver tarjetas" a la Billetera.
6. Gastos del mes (D4).
7. Grupos (D9), con el link "Ver grupos".
8. Avisos recientes (D7).
9. FAB de carga, como en la Billetera y Grupos.

Cada sección es un panel (DESIGN.md "Otros componentes"), sin paneles anidados. Hay un solo `primary` por pantalla: el FAB.

## Estados

| Estado | Qué se ve |
|---|---|
| Cargando | Esqueleto del número de patrimonio y 3 filas grises por panel, como la Billetera |
| Falló la carga | "No pudimos traer tus datos." y "Reintentar" en lugar de los paneles. Si falla solo `notifications`, el resto se muestra y los avisos dicen "No pudimos traer tus avisos." |
| Falta la cotización | "Falta la cotización del dólar para calcular el patrimonio." (igual que hoy). Los gastos del mes se muestran si no hay gastos en dólares sin cotización guardada; si los hay, "Falta la cotización del dólar para sumar los gastos en dólares." |
| Sin tarjetas | Vencimientos: "Sumá una tarjeta de crédito para ver cuándo vence." con link "Sumar tarjeta" |
| Tarjetas sin nada por vencer | "No tenés vencimientos próximos." |
| Sin gastos este mes | "Todavía no cargaste gastos este mes." |
| Sin avisos | "Acá van a aparecer los avisos de cierre y vencimiento de tus tarjetas." |

## Hijas

```
I-1 Íconos (svg) ──┐
I-2 Core: home() ──┼─> I-4 Pantalla Inicio ──> I-5 Avisos y "Cerró tu Visa"
I-3 Pestañas ──────┘
```

I-1, I-2 e I-3 son independientes. I-4 necesita las tres. I-5 se apoya en la pantalla, y la lectura de `notifications` se prueba sola. La lógica (I-2) va primero porque los montos se prueban en Vitest y no en el teléfono.

### I-1. `react-native-svg` y `CategoryIcon`

- `npx expo install react-native-svg` (la versión del SDK actual).
- `apps/mobile/src/components/CategoryIcon.tsx`: props `categoryId: string | null`, `size: 'md' | 'sm' | 'xs' | 'inline'`. Usa la tabla de DESIGN.md (lado, radio, glifo %), fondo `tint16` del color y trazo 1.9 con puntas redondeadas. Los paths de `cart`, `food`, `bus`, `bolt`, `play` y `box` se copian tal cual de `CAT_ICONS` (`prototipo/mangos.html:889`). Si el id es desconocido o nulo, usa `box` con `cat[5]`. Lleva `accessible={false}`, porque el nombre de la categoría va al lado.
- En `categories.ts` se suma `icon` y `colorIndex` a cada categoría, según la tabla de DESIGN.md.
- Ícono de la pestaña Inicio: el `home` del prototipo (línea 1073) con `react-native-svg`. Billetera y Grupos siguen como están.

### I-1 a I-5: implementado el 8/10

**Implementado el 8/10.** Notas:
- `CategoryIcon` arma el svg con `SvgXml` a partir de los paths del prototipo, tal cual. Tiene una prop `color` opcional para `inline`.
- `home()` usa tres helpers de `wallet.ts`: `activeCardStates`, `coreMovementsAndCards` y `myGroupBalance`. El resumen en curso entra en vencimientos si le falta pagar algo (`pending`), no solo si tiene consumos.
- "Cerró tu Visa" también se ve si el resumen cerró sin consumos: el aviso pregunta si falta cargar algo. Solo se va al pagarlo o al vencer.
- `spend` es null solo si no hay cotización de hoy y algún gasto en dólares del mes no tiene la suya. Los gastos sin categoría se muestran como "Otros".
- Los grupos se ordenan por los centavos absolutos, sin convertir: un grupo en dólares compite con los de pesos por su número.
- `markNoticeRead` pone la hora del teléfono en `read_at`.
- 17 tests en `home.test.ts`. Probado en Chrome headless a 320 y 390, en claro y oscuro, contra la base local: tocar un aviso le pone `read_at` y el banner abre la tarjeta. Falta probarlo en el teléfono contra `mangos`.

### I-2. Core: `home()`

`packages/core/src/wallet/home.ts`, exportado en el index:

```ts
export interface DbNotification {
  id: string;
  title: string;
  body: string;
  kind: 'card_closing' | 'card_due' | null;
  data: { card_ids?: string[] } | null;
  created_at: string; // timestamptz
  read_at: string | null;
}

export interface HomeDue {
  cardId: string;
  cardName: string;
  network: CardNetwork;
  color: string | null;
  period: Period;
  kind: 'closed' | 'current';
  /** Solo en 'current'. */
  closeDate: ISODate | null;
  dueDate: ISODate;
  pending: ByCurrency;
  overdue: boolean;
  /** Días de hoy al vencimiento (negativo si venció). */
  daysToDue: number;
}

export interface HomeGroup { id: string; name: string; balance: Money } // en la moneda del grupo, ≠ 0

export interface HomeNotice {
  id: string; title: string; body: string; createdAt: string; read: boolean;
  /** Primera tarjeta no archivada de data.card_ids, o null. */
  cardId: string | null;
}

export interface Home {
  netWorth: NetWorth | null;          // el mismo de wallet()
  dues: HomeDue[];                     // D3, máx. 4
  spend: CategorySpend | null;         // D4; null si falta una cotización necesaria
  groups: HomeGroup[];                 // D9, máx. 3
  hasGroups: boolean;
  closingBanners: HomeNotice[];        // D6
  recentNotices: HomeNotice[];         // D7, máx. 3
}

export function home(input: WalletInput, notifications: readonly DbNotification[]): Home;
```

- Reusa `wallet()` y `cardState` sin duplicar la conversión desde la base. Si hace falta, se extrae de `wallet.ts` un helper interno que ya calcula `cardState` por tarjeta.
- `spend` usa `month = periodOf(input.today)`, `reference` = el `fx_reference` de la persona (se suma `reference: FxReference` a `WalletInput`) y `todayRate = input.referenceRate`. Si `referenceRate` es null y hay algún gasto en dólares del mes, `spend` es null.
- `closingBanners` y `recentNotices` reciben las filas de `notifications` y no consultan nada.

### I-3. Pestañas y rutas

- `git mv '(tabs)/index.tsx' '(tabs)/billetera.tsx'`, y `index.tsx` nuevo para Inicio.
- `_layout.tsx` de pestañas: Inicio (`index`), Billetera (`billetera`), Grupos (`grupos`).
- La Billetera pierde el bloque `hero` (patrimonio, chip, `staleRate`) y `toggleCurrency` (D2). Sigue llamando a `loadWalletInput` para tarjetas y cuentas.
- Regenerar `.expo/types/router.d.ts` (levantar `npx expo start` unos segundos) antes del typecheck.
- Revisar que no haya navegación que espere la Billetera en `/`. Al 8/10, `grep` no encontró ninguna.

### I-4. Pantalla Inicio

- `apps/mobile/src/app/(app)/(tabs)/index.tsx`, con el orden y los estados de arriba.
- `loadHome(userId, settings)` en `apps/mobile/src/lib/home.ts`: llama a `loadWalletInput` y a `notifications` en paralelo (`select id, title, body, kind, data, created_at, read_at`, `order created_at desc`, `limit 30`), y devuelve también `latestRates` completo para D8. `loadWalletInput` pasa a devolver `rates` además de `referenceRate`, para no pedir dos veces.
- Se recarga con `useFocusEffect` y `onWalletChanged`, como la Billetera. El chip de moneda recalcula sin volver a pedir las filas (mismo patrón que hoy).
- Montos en Plex Mono (`Mono`, `type.money*`) y montos negativos en `error`. Cada fila tocable tiene `accessibilityLabel` con el monto en palabras (`moneyInWords`).

### I-5. Avisos y "Cerró tu Visa"

- `markNoticeRead(id)` en `lib/home.ts`: `update notifications set read_at = now() where id = $1 and read_at is null`. Si falla, no se avisa: la navegación sigue igual y el punto queda.
- Las tarjetas "Cerró tu Visa" usan `closingBanners`; los avisos, `recentNotices`. Las dos navegan con `router.push({ pathname: '/tarjeta/[id]', params: { id } })`.
- Prueba en local: `notifications` insertadas con `card-closing-notices` (la Edge Function) contra la base local, o con un `insert` directo en la prueba.

## Testing

| Capa | Qué | Cuántos |
|---|---|---|
| Vitest (core) | `home()`: vencimientos (orden, máximo 4, en curso solo con monto, vencido, `daysToDue` 0/1/3/4), el ejemplo de 02 §6 ($30.000 en 3 cuotas cuenta $10.000 en octubre y nada en septiembre), parte de grupo, `spend` null sin cotización con gasto en USD, grupos (máximo 3, orden por valor absoluto, sin los de saldo cero por `displayBalance`), banners (vigente, pagado, vencido, archivada, varias tarjetas) y avisos (máximo 3, `cardId` salteando archivadas) | +18 |
| Vitest (core) | `patrimonio` sigue dando el ejemplo de 02 §8 a través de `home()` | +1 |
| pgTAP | Nada nuevo: `update (read_at)` y RLS de `notifications` ya están cubiertos. Si no lo están, +2 en `supabase/tests/` (actualizar solo `read_at` propio, no el de otro) | 0–2 |
| Manual | Chrome headless a 320 y 390 contra la base local con datos de la revisión de diseño: los 7 estados de la tabla. Después, en el teléfono contra `mangos` con los datos de Fran | 1 recorrido |

## Plan de vuelta atrás

Solo cambia la app y core; la base no cambia. Revertir el commit vuelve a la Billetera como pantalla de entrada con su patrimonio. `react-native-svg` se puede dejar instalado aunque se revierta.

## Fuera de alcance

- Presupuestos, topes y "Editar presupuestos" (fuera de la v1, 02 §6).
- Inversiones, la cinta de mercado, el riesgo país y la variación del dólar.
- Elegir otro mes en los gastos del mes, o tocar una categoría para ver sus movimientos (va con la Lista de movimientos).
- La pantalla de Alertas, la campanita con contador y borrar avisos (van con Ajustes).
- El envío del push y abrir Inicio o el detalle desde la notificación del sistema.
- Los 14 glifos que no usa la v1 y los íconos svg de Billetera y Grupos.
- El diseño de escritorio de Inicio (después de la beta).

## Definición de terminado

1. Al abrir la app con sesión iniciada, la primera pantalla es Inicio. Las pestañas son Inicio, Billetera y Grupos, en ese orden.
2. La Billetera no muestra el patrimonio ni el chip de moneda.
3. Con los datos del ejemplo de 02 §8, Inicio muestra $1.771.600 en pesos y US$ 1.198,66 en dólares. El chip cambia la moneda y la elección queda guardada.
4. Una tarjeta con un resumen cerrado con saldo y uno en curso con consumos aparece dos veces en vencimientos, ordenada por fecha. Con 5 resúmenes, se ven 4.
5. Una compra de $30.000 en 3 cuotas del 25/9 con cierre el 24 suma $10.000 en su categoría en octubre, y no aparece en septiembre.
6. Un gasto de grupo de $90.000 dividido entre 3, que pagaste vos, suma $30.000 en su categoría.
7. Con un aviso `card_closing` del 24/10 y el resumen sin pagar, la tarjeta "Cerró tu Visa" se ve hasta el día de su vencimiento, inclusive. Desaparece al registrar el pago total.
8. Tocar un aviso no leído le pone `read_at` en la base y le saca el punto.
9. Los 6 íconos de categoría se ven en claro y en oscuro como en DESIGN.md.
10. A 320 de ancho no hay nada cortado ni que se salga de la pantalla: montos, nombres de tarjeta o la fila del dólar.
11. Pasan Vitest, pgTAP y el typecheck.
12. Probado en el teléfono contra `mangos`.
