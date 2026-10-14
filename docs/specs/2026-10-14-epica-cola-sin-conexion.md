---
spec_kind: epic
status: done
date: 2026-10-14
---

# Épica: Cola sin conexión (T5, decisión 7A)

## Contexto

Cargar un gasto tiene que llevar menos de 10 segundos, y el momento de cargarlo suele ser en la calle: en el subte, en un súper con mala señal o en la fila de un kiosco. Hoy, sin señal, la hoja ni siquiera abre. Y si la señal se corta antes de tocar "Guardar", el gasto no se guarda y queda el mensaje "Sin conexión. Probá de nuevo.". La persona tiene que acordarse de cargarlo después, que es justo lo que Mangos quiere evitar.

La decisión 7A (revisión de diseño, 1/10) y D6 (revisión técnica, 1/10) ya definieron cómo debe funcionar. El gasto se guarda en el teléfono con la pill "Pendiente" y se envía solo cuando vuelve la señal. El servidor completa la cotización con la fecha del gasto. Si el envío falla por otra causa, aparece "No se pudo guardar" con Reintentar o Editar. Es P1 antes de la beta (T5 en `docs/diseno-pantallas-v1.md`).

## Estado actual (verificado el 14/10/2026)

| Pieza | Qué hay | Dónde |
|---|---|---|
| Id del gasto | Lo genera el teléfono al abrir la hoja (`randomUUID()` de `expo-crypto`) | `apps/mobile/src/app/(app)/cargar.tsx:143` |
| Guardar sin duplicar | `saveExpense` hace `insert`. Si la base responde `23505` (el id ya existe), cuenta como guardado. Devuelve `'offline'` o `'failed'` | `apps/mobile/src/lib/entry.ts:219` |
| Qué cuenta como sin conexión | `isNetworkError`: "network request failed", "failed to fetch" y similares | `entry.ts:139` |
| Cotización | La completa la base al guardar con la fecha del gasto (02 §1). Sin historial, queda `fx_pending` y la completa una tarea | trigger de `movements` (03) |
| Hoja sin señal | `loadEntryContext()` trae tarjetas, cuentas, uso en 30 días, palabras de categoría y cierres corregidos. Si falla, la hoja muestra `loadFailed` y no deja cargar | `cargar.tsx:203`, `entry.ts:62` |
| Guardar sin señal | "Sin conexión. Probá de nuevo." y la hoja queda abierta | `cargar.tsx:660` |
| Carga por texto sin señal | `saveBatch` guarda línea por línea y se corta en la primera falla: "Sin conexión: las que quedan no se guardaron." | `apps/mobile/src/components/QuickEntry.tsx:148`, `entry.ts:296` |
| "¿Ya lo pagaste?" sin señal | `loadLateImpacts` devuelve `null` si falla la red, y se guarda sin preguntar | `entry.ts:175` |
| Cuenta en otra moneda | Lo descontado se propone con `cardRateOn` (red). Sin dólar tarjeta, la hoja pide escribirlo y la carga por texto deja la línea con "Falta el dólar tarjeta" | `entry.ts:120`, `QuickEntry.tsx:150` |
| Almacenamiento local | `@react-native-async-storage/async-storage` 2.2.0, ya usado para la sesión | `apps/mobile/src/lib/supabase.ts:2` |
| Detectar la red | No hay `netinfo` ni `expo-network`. `supabase.ts:26` ya escucha `AppState` para refrescar el token | `apps/mobile/package.json` |
| Inicio y listas sin señal | Muestran su estado de error (`failed`) | `(tabs)/index.tsx:169`, `movimientos.tsx` |

## Decisiones tomadas en esta spec (14/10, aprobadas por Fran)

1. **La hoja abre sin señal (D1).** `loadEntryContext` guarda en el teléfono lo último que trajo. Si la red falla, usa esa copia. Con la copia, la fecha de hoy se recalcula al abrir, no se toma la guardada.
2. **Dónde se ven (D2).** Los gastos sin enviar se ven arriba de `/movimientos`, en una sección "Sin enviar". Inicio muestra una línea "N gastos sin enviar" que lleva ahí. No suman a saldos, resúmenes ni patrimonio hasta que llegan a la base. Las dos cosas se ven aunque la pantalla no haya podido cargar lo demás.
3. **Qué entra en la cola (D3).** Solo gastos personales nuevos, desde la hoja y desde la carga por texto. Editar, borrar, los gastos de grupo, los pagos y los ajustes siguen pidiendo señal, como hoy. Los grupos sin conexión quedan para la fase 2 (01).
4. **Reintento sin dependencias (D4).** La app intenta enviar en cinco momentos: al abrir la app, al iniciar sesión, al volver al primer plano (`AppState` `active`), cada 30 s mientras haya pendientes y después de cualquier guardado que salió bien.
5. **"¿Ya lo pagaste?" sin señal (D5).** No se pregunta. El gasto se envía como un gasto tarde que se contestó "No": el resumen queda en "Pago parcial" o "Vencido", con la diferencia pendiente. La fila de la tarjeta en la Billetera ya muestra "A pagar" o "Vencido" cuando queda saldo, y el pago se registra desde el detalle de la tarjeta, como cualquier otro. Hay que sumarlo a 02 §3.
6. **Cuenta en otra moneda sin señal.** Sin señal no hay dólar tarjeta para proponer. En la hoja, la persona escribe lo descontado (el campo ya lo pide). En la carga por texto, esa línea queda en el campo con "Falta el dólar tarjeta", como hoy. Nunca se encola un gasto sin `debited_amount` cuando hace falta.
7. **Qué falla y qué espera.** Quedan **pendientes** y se reintentan: los errores de red, las respuestas 5xx y los errores de sesión (401 o JWT vencido). Quedan como **"No se pudo guardar"**: los demás 4xx, por ejemplo una tarjeta archivada desde otro teléfono, una cuenta borrada, un `check` o RLS. `23505` cuenta como enviado.
8. **Una cola por usuario.** Va en AsyncStorage con la clave `mangos.pending.<userId>`. Cerrar sesión no la borra: se envía la próxima vez que entre esa misma cuenta. Borrar la cuenta (A-6) sí la borra.
9. **Deshacer.** El "Deshacer" del toast saca el gasto de la cola. Si justo se había enviado, lo borra de la base con `deleteExpense(id)`, como hoy.
10. **La categoría aprendida** (02 §5, "Aprendizaje de categorías") no se encola: sin señal no se aprende. Es un dato de conveniencia y no toca plata.

## Comportamiento

### Guardar sin señal (hoja)

1. Tocar "Guardar". `saveExpense` devuelve `'offline'` (o un 5xx o 401).
2. El borrador queda en la cola con estado `pending`. La hoja se cierra.
3. Toast de 5 s: "Guardado en el teléfono · se envía cuando tengas señal", con "Deshacer".
4. Si la hoja abrió con la copia guardada, el gasto va directo a la cola sin intentar enviarlo. Ese intento lo hace el envío automático.

Si la hoja abrió con la copia, muestra debajo del título, en `caption` `textMuted`, "Sin conexión: se guarda en el teléfono". Es solo informativo: no suma pasos.

### Carga por texto sin señal

"Guardar N gastos" guarda las líneas que puede. Las que fallan por la red pasan a la cola. Las que necesitan dólar tarjeta y no lo tienen quedan en el campo (decisión 6). Toast: "3 gastos guardados · 2 en el teléfono, se envían cuando tengas señal". Si todas van a la cola: "2 gastos guardados en el teléfono · se envían cuando tengas señal". "Deshacer" saca de la cola los encolados y borra los guardados.

### Envío automático

- Manda la cola en orden, de a un gasto, con `saveExpense`. Tiene un solo envío en curso a la vez: si ya hay uno, no arranca otro.
- Si un gasto da error de red, corta la vuelta y espera al próximo disparo. No sigue con los demás, porque fallarían igual.
- Enviado (o `23505`): sale de la cola y se avisa con `walletChanged()`, así Inicio, la Billetera y las listas se recargan.
- Error definitivo (decisión 7): el gasto queda con `failed` y el mensaje de error, y la vuelta sigue con el siguiente.

### En `/movimientos`: sección "Sin enviar"

Va arriba de todo, antes del primer día. No depende del mes ni de la búsqueda, y se ve aunque la lista no haya cargado. Usa la misma fila de movimiento (`DESIGN.md`, "Fila de movimiento") con `CategoryIcon`, la descripción y el medio de pago (nombre tomado de la copia del contexto) y el monto con su moneda.

| Estado | Cómo se ve | Al tocar |
|---|---|---|
| `pending` | Pill `neutral` "Pendiente" en lugar de la categoría | Nada (`accessibilityRole` text) |
| `failed` | Texto `error` "No se pudo guardar" en lugar de la categoría, con dos botones `link` debajo: "Reintentar" y "Editar" | Reintentar: vuelve a `pending` y dispara el envío. Editar: abre la hoja con ese borrador |

En la hoja, al editar un borrador de la cola, "Guardar cambios" reemplaza el borrador (mismo id), lo deja `pending` y dispara el envío. "Borrar gasto" lo saca de la cola, con la misma confirmación de 02 §5.

### En Inicio

Si la cola tiene gastos, se ve una fila arriba de los avisos: "2 gastos sin enviar" (o "1 gasto sin enviar") en `body`. Si alguno falló, dice "1 gasto no se pudo guardar" en `error`. Tocarla abre `/movimientos`. Se ve aunque Inicio no haya cargado lo demás.

## Hijas

```
C-1 Docs ──> C-2 Core: cola pura ──> C-3 App: almacenamiento, envío y copia del contexto ──┬─> C-4 Hoja y carga por texto
                                                                                           └─> C-5 Movimientos e Inicio
```

C-1 va primero porque 02 manda: la regla de "¿Ya lo pagaste?" sin señal tiene que estar escrita antes del código. C-2 deja la lógica de estados testeada sin red. C-4 y C-5 son independientes entre sí.

### C-1. Docs

- `docs/02-reglas-de-negocio.md` §5, "Sin conexión": decisiones 3, 6, 7, 8, 9 y 10.
- 02 §3, "Gastos que se cargan tarde": la decisión 5, con un ejemplo. *Ejemplo: la Visa cierra el 30 y septiembre se pagó completo ($100.000). Sin señal cargás "28/09 12000 farmacia visa". Al enviarse, septiembre pasa a $112.000 en "Pago parcial", con $12.000 pendientes, y no se pregunta nada.*
- `DESIGN.md`, "Fila de movimiento": los estados `pending` y `failed`, y la fila de Inicio.

### C-2. Core: `packages/core/src/entry/pendingQueue.ts`

Funciones puras, sin AsyncStorage ni red. Con test-first (`tdd`).

```ts
export type PendingStatus = 'pending' | 'failed';

export interface PendingExpense {
  /** El mismo id que va a tener el movimiento (D6). */
  id: string;
  /** La fila tal como la manda `saveExpense` (montos como texto numeric, nunca float). */
  row: PendingRow;
  status: PendingStatus;
  /** Solo con `failed`: el mensaje de la base, para depurar (no se muestra). */
  error: string | null;
  queuedAt: string; // ISO con hora
}

export type SendOutcome = 'sent' | 'retry' | 'failed';

export function enqueue(queue: readonly PendingExpense[], item: PendingExpense): PendingExpense[]; // mismo id: reemplaza en su lugar
export function nextToSend(queue: readonly PendingExpense[]): PendingExpense | null;             // el primer `pending`, por orden de llegada
export function applyOutcome(queue: readonly PendingExpense[], id: string, outcome: SendOutcome, error?: string): PendingExpense[];
export function retry(queue: readonly PendingExpense[], id: string): PendingExpense[];           // `failed` → `pending`
export function remove(queue: readonly PendingExpense[], id: string): PendingExpense[];
export function pendingSummary(queue: readonly PendingExpense[]): { count: number; failed: number };
export function classifySaveError(input: { status?: number; code?: string; network: boolean }): SendOutcome;
```

`classifySaveError`: `network` o `status >= 500` o `status === 401` → `retry`; `code === '23505'` → `sent`; lo demás → `failed`.

`PendingRow` es el tipo de la fila de `expenseRow` (`entry.ts:197`): pasa a exportarse desde core o se define acá y `entry.ts` lo usa.

### C-3. App: `apps/mobile/src/lib/pending.ts` y copia del contexto

- `loadQueue(userId)` y `saveQueue(userId, queue)` con AsyncStorage, clave `mangos.pending.<userId>`. Si el JSON está roto, se loguea y se trata como cola vacía, sin borrar la clave (para no perder gastos por un bug).
- `enqueueExpense(userId, draft)`: arma la fila con `expenseRow`, la encola y avisa con `pendingChanged()` (mismo patrón que `walletChanged` en `lib/events.ts`).
- `flushPending(userId)`: un solo envío en curso (una promesa compartida). Usa `nextToSend`, `saveExpense` y `applyOutcome`. Si envió algo, llama a `walletChanged()`.
- `saveExpense` devuelve además el `status` y el `code` de la respuesta para `classifySaveError`. Hoy los callers solo miran `'offline' | 'failed' | null`: mantener esa salida y sumar lo nuevo sin romperlos.
- Disparos (decisión D4): en `SessionProvider` (`lib/session.tsx`), al tener sesión; un listener de `AppState` `active`; un `setInterval` de 30 s que corre solo si `pendingSummary().count > 0`; y después de cada `saveExpense` que salió bien.
- `loadEntryContext`: si sale bien, guarda `{ methods, cards, accounts, keywords, overrides }` en `mangos.entryContext.<userId>`. Si falla por la red, lee la copia y recalcula `today` con `todayInArgentina()`. Devuelve además `fromCache: boolean`. Sin copia y sin red: sigue `loadFailed`, como hoy.
- Borrar la cuenta (`borrar-cuenta.tsx`): después de `delete_account()`, borra las dos claves.

### C-4. Hoja y carga por texto

- `cargar.tsx`, gasto personal nuevo: con `'offline'` o `retry`, encola, cierra y muestra el toast. Con `ctx.fromCache`, encola sin intentar. Editar, gasto de grupo y "Completar" siguen igual.
- `cargar.tsx?pendingId=<id>`: abre en modo editar un borrador de la cola (lee la fila de la cola, no de la base). "Guardar cambios" usa `enqueue` y dispara el envío. "Borrar gasto" usa `remove`.
- "¿Ya lo pagaste?": con `ctx.fromCache` o si `loadLateImpacts` devuelve `null`, no se pregunta (decisión 5).
- `QuickEntry.tsx` y `saveBatch`: las líneas que fallan con `'offline'` o `retry` se encolan, en vez de quedar en el campo. Textos del toast como dice "Carga por texto sin señal". Las nuevas funciones de texto (`queuedToastText(saved, queued)`) van en `packages/core/src/entry/toast.ts`, con sus tests.
- `toastFor` y los textos de 02 no cambian para lo que se guarda con señal.

### C-5. Movimientos e Inicio

- `movimientos.tsx`: sección "Sin enviar" arriba, con la cola y los nombres de medio de pago de la copia del contexto. Se ve con la lista cargada o en error. Escucha `onPendingChanged`.
- `(tabs)/index.tsx`: la fila de Inicio, también en el estado `failed` de la pantalla.
- `accessibilityLabel` de cada fila: "Coto súper, Visa ·· 4532, doce mil pesos, pendiente de envío" o "…, no se pudo guardar".

## Estados

| Situación | Qué pasa |
|---|---|
| Sin señal y sin copia del contexto (primer uso offline) | La hoja muestra el error de hoy (`loadFailed`) |
| La copia del contexto tiene una tarjeta que se eliminó en otro teléfono | El envío da 4xx (`23503`): "No se pudo guardar". Editar permite elegir otro medio de pago. Una tarjeta solo archivada acepta el gasto (verificado el 14/10) |
| Mismo gasto enviado dos veces (corte después de que llegó) | `23505`: cuenta como enviado y sale de la cola |
| Se envía mientras la persona toca "Deshacer" | Si ya llegó, `deleteExpense(id)`; si no, sale de la cola |
| La sesión venció sin señal | 401: queda `pending`. Al volver la señal, supabase-js refresca el token y se envía |
| La persona cierra sesión con pendientes | La cola queda en el teléfono y se envía cuando entre de nuevo con la misma cuenta |
| Otra cuenta entra en el mismo teléfono | Ve solo su cola (clave por usuario) |
| Un gasto sin historial de cotización para su fecha | Lo resuelve la base, como hoy: `fx_pending` y la tarea diaria |

## Testing

| Capa | Qué | Cantidad |
|---|---|---|
| Vitest (core) | `enqueue` (nuevo y reemplazo), `nextToSend` (orden, salta `failed`), `applyOutcome` (los 3 resultados), `retry`, `remove`, `pendingSummary`, `classifySaveError` (red, 500, 401, 23505, 400, 403) | +14 |
| Vitest (core) | `queuedToastText` (todo encolado, mezcla, 1 y varios) | +4 |
| App (sin Vitest en `apps/mobile`) | `saveBatch` encola las líneas que fallan por red y deja en el campo las que piden dólar tarjeta: se prueba en el recorrido headless | — |
| pgTAP | Sin cambios en la base. T-20 (mismo UUID dos veces) ya cubre el reenvío | 0 |
| Headless (Chrome, base local) | Con el backend local apagado (`docker stop` de Kong): abrir la hoja con la copia, guardar, ver la sección en `/movimientos` y la fila en Inicio. Prenderlo: se envía en ≤30 s y la pill desaparece | 1 recorrido |
| Teléfono contra `mangos` (E-2) | Modo avión, cargar un gasto y 3 líneas por texto, reconectar: 4 gastos, cada uno con su cotización y sin duplicados | 1 recorrido |

## Plan de vuelta atrás

No toca la base. Se revierte el commit. Los gastos que hayan quedado en colas de teléfonos se pierden con la versión vieja, porque no lee la clave. En la beta los usuarios son pocos: antes de revertir, avisar que abran la app con señal para vaciar la cola.

## Esfuerzo

C-1 docs: 30 min · C-2 core con tests: 1 h · C-3 cola, envío y copia: 2 h · C-4 hoja y carga por texto: 2 h · C-5 listas: 1 h · pruebas headless y en el teléfono: 1 h. Total con CC: unas 7 h (el plan decía de 3 a 4 días para una persona sola).

## Archivos

| Archivo | Cambio |
|---|---|
| `docs/02-reglas-de-negocio.md` §3 y §5 | Reglas sin conexión y "¿Ya lo pagaste?" |
| `DESIGN.md` "Fila de movimiento" | Estados `pending` y `failed`, fila de Inicio |
| `packages/core/src/entry/pendingQueue.ts` (+ test) | Nuevo |
| `packages/core/src/entry/toast.ts` (tests en `entry.test.ts`) | `queuedToastText` |
| `apps/mobile/src/lib/pending.ts` | Nuevo: almacenamiento, envío y disparos |
| `apps/mobile/src/lib/entry.ts:62` | Copia del contexto y `fromCache` |
| `apps/mobile/src/lib/entry.ts:219` | `saveExpense` devuelve `status` y `code` |
| `apps/mobile/src/lib/entry.ts:296` | `saveBatch` encola |
| `apps/mobile/src/lib/events.ts` | `pendingChanged` / `onPendingChanged` |
| `apps/mobile/src/lib/session.tsx` | Disparos del envío |
| `apps/mobile/src/app/(app)/cargar.tsx` | Encolar, `pendingId`, aviso "Sin conexión" |
| `apps/mobile/src/components/QuickEntry.tsx` | Textos con encolados |
| `apps/mobile/src/app/(app)/movimientos.tsx` | Sección "Sin enviar" |
| `apps/mobile/src/app/(app)/(tabs)/index.tsx` | Fila "N gastos sin enviar" |
| `apps/mobile/src/app/(app)/borrar-cuenta.tsx` | Borrar las claves locales |

## Fuera de alcance

- Gastos de grupo, editar, borrar, pagos, ajustes y transferencias sin señal.
- Ver Inicio, la Billetera o las listas sin señal con los datos de la última vez.
- Sumar los pendientes a saldos, resúmenes o patrimonio.
- Preguntar "¿Ya lo pagaste?" después, cuando el gasto se envía.
- Encolar la categoría aprendida.
- `netinfo` o `expo-network`.

## Implementado el 14/10

C-1 a C-5 en `main`. Probado en Chrome headless contra la base local (390, claro), cortando la red con la intercepción de pedidos de puppeteer en lugar de apagar Kong: 20 de 20 chequeos (`offline.mjs` en el scratchpad de la sesión). Diferencias con lo de arriba:

- **Una tarjeta archivada no rechaza el gasto:** la base no lo impide y la deuda sigue contando (02 §3). El rechazo real es una tarjeta o cuenta que ya no existe (`23503`). Se corrigieron 02 §5 y los ejemplos de esta spec.
- **Arranque en frío sin red:** la app cerrada y abierta sin señal iba a la bienvenida (no podía leer `user_settings`) o, con el token vencido, quedaba en blanco hasta 30 s y después iba al login. Ahora `SessionProvider` arranca con la sesión guardada (solo `SIGNED_OUT` la saca) y con una copia de los ajustes (`mangos.settings.<userId>`, que borrar la cuenta también borra).
- **Sin reintentos en las lecturas de la hoja y de los ajustes** (`.retry(false)`): postgrest-js reintenta los GET 7 s cuando falla la red. Además, el contexto de la hoja espera como máximo 5 s antes de usar la copia (con el token vencido, supabase-js espera el refresco).
- **"¿Ya lo pagaste?" contestado "Sí" y la señal se corta al guardar:** no va a la cola, porque la cola no guarda pagos. La hoja queda abierta con "Sin conexión. Probá de nuevo." y, en la carga por texto, esas líneas quedan en el campo.
- **`saveExpense`:** los 5xx y 401 ahora cuentan como `'offline'` (la hoja los encola).
- **Inicio** cuenta los que fallaron: "2 gastos no se pudieron guardar".

E-2 probado en el teléfono contra `mangos` el 14/10: un gasto desde la hoja (deshecho) y 3 líneas por texto, que llegaron una vez cada una y con su cotización.

## Definición de terminado

1. Con el backend apagado y la copia del contexto guardada, la hoja abre, guarda y muestra el toast "Guardado en el teléfono · se envía cuando tengas señal".
2. Ese gasto aparece en "Sin enviar" con "Pendiente", y en Inicio se ve "1 gasto sin enviar", aunque las dos pantallas estén en error.
3. Al prender el backend, a los ≤30 s el gasto está en `movements` con su cotización, una sola vez, y desaparece de "Sin enviar".
4. Un gasto que la base rechaza (tarjeta eliminada) queda "No se pudo guardar". Reintentar lo vuelve a mandar y Editar abre la hoja con sus datos.
5. "Deshacer" saca el gasto de la cola, o lo borra de la base si ya llegó.
6. 02 §3 y §5 y `DESIGN.md` actualizados antes del código.
7. Pasan Vitest, pgTAP y el typecheck. E-2 probado en el teléfono contra `mangos`.
