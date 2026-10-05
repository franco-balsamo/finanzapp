---
spec_kind: epic
status: approved
date: 2026-10-05
---

# Épica: primeras pantallas de la app (login, bienvenida, Billetera y hoja de carga)

## Contexto

El backend de la v1 está deployado en Supabase (proyecto `mangos`). Pasan 392 tests pgTAP y 167 de Vitest. La app todavía no tiene pantallas, así que nadie puede cargar un gasto y no se puede medir la meta de los 10 segundos ni el evento `expense_created`.

Esta épica es la primera tanda que recorre la app de punta a punta. Fran se loguea con su mail, hace la bienvenida, suma tarjetas y cuentas, carga un gasto en menos de 10 segundos y lo ve reflejado en la Billetera ("Te vienen" y patrimonio).

## Estado actual (verificado el 5/10/2026)

| Pieza | Estado | Dónde |
|---|---|---|
| Rutas de la app | `_layout.tsx` con un `<Stack />` vacío; `index.tsx` muestra `<Text>Mangos</Text>` | `apps/mobile/src/app/` |
| Web de invitados | Solo imprime el token y `CURRENCIES` | `apps/mobile/src/app/g/[token].tsx` |
| Cliente Supabase, sesión, fuentes y tokens | No existen. `package.json` no tiene `@supabase/supabase-js`, `expo-font` ni AsyncStorage | `apps/mobile/package.json` |
| Tokens de diseño | Escritos en `DESIGN.md` §"Tokens para React Native" (`palette`, `fonts`, `cardColors`…), sin pasar a código | `DESIGN.md:196-343` |
| Cálculos | `cardState`, `statementFor`, `accountBalance`, `netWorth`, `groupBalances`, `formatMoney`, `fromDbNumeric` y `toDbNumeric` | `packages/core/src/` |
| Parser de la carga por texto | **No existe** | — |
| Formato del campo Monto, orden de las fichas, categoría deducida y palabra que se aprende | **No existen** | — |
| Marca de "bienvenida hecha" | **No existe.** `user_settings` se crea sola al registrarse (`schema_v1.sql:328`) | `supabase/migrations/20261002120000_schema_v1.sql:11` |
| Tarjetas | Solo crédito. `bank`, `name`, `network` y `last4` son obligatorios; `expiry`, `color` y `credit_limit` son opcionales; hay una sola favorita (`cards_one_favorite_idx`) | `schema_v1.sql:41-60` |
| Movimientos | `id` lo puede mandar el teléfono. El check `movements_payment_method` exige tarjeta o cuenta, y `movements_installments_need_card` exige tarjeta si hay cuotas | `schema_v1.sql:227-271` |
| Grants | `authenticated` puede leer, cargar, editar y borrar en `accounts`, `cards`, `movements` y `category_keywords`. En `user_settings` puede editar `name`, `display_currency`, `fx_reference`, `theme`, `notify_push`, `quiet_*` y `goal` | `schema_v1.sql:562-573` |
| Mail con código | `otp_length = 6`, pero la plantilla por defecto de Supabase manda un link, no el código. Pasa en local y en `mangos` | `supabase/config.toml:220-235` |

## Decisiones tomadas en esta spec

| # | Decisión | Elección |
|---|---|---|
| D2 | Carga por texto | El parser completo va en `packages/core`. En la hoja hay **una sola línea**, que completa el formulario. La vista previa de varias líneas queda para la tanda siguiente |
| D3 | Alta de medios de pago | Alta de tarjeta de crédito y de cuenta. Editar, archivar y cambiar la favorita quedan para la tanda del detalle de tarjeta |
| D4 | Grupo en la hoja | Fuera de esta tanda. La línea plegada muestra solo fecha y cuotas |
| D5 | Marca de bienvenida | Columna nueva `user_settings.onboarded_at` |
| D6 | Pasos de la bienvenida | Los 3 de 01: (1) intro y objetivo, (2) dólar de referencia y moneda, (3) primera tarjeta, que es opcional |
| D7 | Hoja de carga | Ruta con `presentation: 'formSheet'` de Expo Router y `react-native-keyboard-controller` (`KeyboardStickyView`) para Guardar |
| — | Sesión | `@supabase/supabase-js` con `@react-native-async-storage/async-storage`, como en la guía de Supabase para Expo |
| — | Dónde va la lógica | Toda la lógica pura va en `packages/core`, con Vitest. Las pantallas se verifican con los criterios de aceptación, `pnpm typecheck` y `expo export`. Maestro sigue en T11 |
| — | Sin conexión | Si no hay conexión, Guardar falla con el toast "Sin conexión. Probá de nuevo." y la hoja queda abierta con los datos. El UUID se genera igual en el teléfono, para dejar listo T8 |

## Hijas

| # | Título | Prioridad | Esfuerzo (vos solo / CC) | Depende de |
|---|---|---|---|---|
| E1 | Base de la app: Supabase, sesión, tema, fuentes, login con código y `onboarded_at` | Crítica | ~2 días / ~3 h | — |
| E2 | Core: parser de texto, campo Monto, fichas, categoría y toast | Crítica | ~2 días / ~3 h | — |
| E3 | Bienvenida y alta de tarjeta y de cuenta | Alta | ~1,5 días / ~2 h | E1 |
| E4 | Billetera: Tarjetas, Cuentas y patrimonio | Alta | ~1,5 días / ~3 h | E1 (y E3 para probar con datos) |
| E5 | Hoja de carga | Crítica | ~2,5 días / ~4 h | E1, E2 y E3 |

### Grafo de dependencias

```
E1 Base ──┬──> E3 Bienvenida + altas ──┬──> E5 Hoja de carga
          ├──> E4 Billetera            │
          │                            │
E2 Core (en paralelo con E1) ──────────┘
```

**Por qué este orden:** E1 va primero porque sin sesión no hay datos (RLS). E2 es TypeScript puro y no depende de nada, así que va en paralelo. E3 va antes de E5 porque la hoja necesita medios de pago para cargar algo. E4 puede ir antes o después de E5, pero conviene antes, para ver dónde impacta el gasto.

---

### E1. Base de la app

**Dependencias nuevas** (con `npx expo install` en `apps/mobile`):
- `@supabase/supabase-js`
- `@react-native-async-storage/async-storage`
- `react-native-url-polyfill`
- `expo-font`, `@expo-google-fonts/schibsted-grotesk` y `@expo-google-fonts/ibm-plex-mono`
- `react-native-keyboard-controller`
- `expo-crypto` (para `randomUUID`)

**Configuración:**
- `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` en `apps/mobile/.env` (en `.gitignore`), más `apps/mobile/.env.example` commiteado.
- Para local, la URL de `npx supabase status`. Para `mangos`, la URL y la publishable key del proyecto.
- La service role key **nunca** va a la app.

**Archivos:**

| Archivo | Cambio |
|---|---|
| `apps/mobile/src/lib/supabase.ts` | `createClient` con AsyncStorage, `autoRefreshToken`, `persistSession` y `detectSessionInUrl: false`. Refresca al volver a primer plano (`AppState`), como en la guía de Supabase |
| `apps/mobile/src/theme/tokens.ts` | Copia literal del bloque de tokens de `DESIGN.md:196-343` |
| `apps/mobile/src/theme/useTheme.ts` | Elige `light` o `dark` según `user_settings.theme` (si es `system`, `useColorScheme`) |
| `apps/mobile/src/app/_layout.tsx` | Carga las fuentes (con el splash hasta que estén), `KeyboardProvider` y `SessionProvider` |
| `apps/mobile/src/app/(auth)/ingresar.tsx` | Pide el mail y llama a `signInWithOtp({ email, options: { shouldCreateUser: true } })` |
| `apps/mobile/src/app/(auth)/codigo.tsx` | Pide el código de 6 dígitos y llama a `verifyOtp({ email, token, type: 'email' })`. "Reenviar código" se habilita a los 60 s |
| `apps/mobile/src/app/(app)/_layout.tsx` | Sin sesión redirige a `/ingresar`. Con sesión y `onboarded_at` nulo redirige a `/bienvenida` |
| `supabase/migrations/20261005120000_onboarded_at.sql` | `alter table public.user_settings add column onboarded_at timestamptz;` y suma `onboarded_at` al `grant update (...)` de `authenticated` |
| `supabase/tests/<n>_onboarded_at.test.sql` | El dueño puede escribir `onboarded_at`; otro usuario no puede |
| `supabase/templates/magic_link.html` y `config.toml` (`[auth.email.template.magic_link]`) | Plantilla en castellano con `{{ .Token }}`: "Tu código para entrar a Mangos es 123456. Vence en 1 hora." |
| `supabase/templates/confirmation.html` | Igual, para el primer registro |
| Proyecto `mangos` | Las mismas plantillas, por Management API o desde el panel. Se anota en `docs/decisiones` |
| `docs/03-modelo-de-datos.md` | Suma `onboarded_at` a la tabla de `user_settings` |

**Textos:**
- Pantalla del mail: "Entrá con tu mail", "Te mandamos un código de 6 números".
- Pantalla del código: "Revisá tu mail", "Escribí el código que te mandamos a fran@…".

**Errores:**
- Código incorrecto o vencido: "El código no es válido o ya venció."
- Mail inválido: "Revisá el mail."
- Límite de envíos: "Esperá un minuto antes de pedir otro código."

**Criterios de aceptación de E1:**
1. Con Supabase local, al pedir el código con un mail nuevo llega a Mailpit un mail con un código de 6 dígitos (no un link).
2. Con ese código se entra y queda creada la fila de `user_settings`.
3. Al cerrar y abrir la app sigue la sesión. "Cerrar sesión" (en el menú de la Billetera) vuelve a `/ingresar`.
4. Un código incorrecto muestra "El código no es válido o ya venció." y no navega.
5. Con `onboarded_at` nulo, la app abre `/bienvenida`. Con fecha, abre la Billetera.
6. La migración pasa `npx supabase db reset`, `npx supabase test db` y `npx supabase db lint`, y se aplica en `mangos`.
7. El texto usa Schibsted Grotesk y los montos, IBM Plex Mono, en iOS, Android y la web.

---

### E2. Core: lógica pura de la hoja

Todo va en `packages/core/src/entry/`, con imports relativos con `.ts`, exportado desde `index.ts` y con tests Vitest.

Implementado el 5/10 (las firmas reales están en el código; acá va lo que cada una decide):

```ts
// entry/amount.ts
export function parseAmountMinor(text: string): { minor: number } | { error: 'ambiguous' | 'invalid' };
export function parseAmount(text: string, currency: Currency): { value: Money } | { error: 'ambiguous' | 'invalid' };
// Reglas de 02 §5: "12.000" y "12.000,50" están bien; "12.5" es ambiguo; sufijos k, mil y M. Para lo pegado en Monto.
export function formatAmountInput(raw: string): { text: string; minor: number | null };
// Teclado: "86500" → "86.500"; como máximo 2 decimales (el tercero se descarta); un "." recién tecleado al final es la coma.

// entry/categories.ts
export const SYSTEM_CATEGORY_IDS; // supermercado … otros, con los UUID de la base
export function deduceCategory(description: string, userKeywords?: ReadonlyMap<string, string>): string;
// La primera palabra que coincide; la corrección del usuario manda sobre la lista inicial. Sin coincidencia, "Otros".
export function learnableWord(description: string, paymentWords: readonly string[]): string | null; // R3-5, normalizada sin acentos

// entry/paymentMethods.ts
export type PaymentMethod =
  | { kind: 'card'; id; bank; network: 'VISA' | 'MC' | 'AMEX' | 'CABAL'; last4; isFavorite }
  | { kind: 'account'; id; name };
export function paymentChips(methods, uses: { methodId; date }[], today): PaymentMethod[];
// La favorita y los 2 más usados en 30 días (con empate, el más reciente). Si no llegan a 3, se completan
// con el orden de `orderedMethods` (favorita, tarjetas, cuentas). "Otro…" lo suma la pantalla.
export function orderedMethods(methods): PaymentMethod[];      // lista de "Otro…"
export function paymentMethodLabel(method): string;            // "Master ·· 0763" o "Mercado Pago"
export function paymentMethodWords(methods): string[];         // para learnableWord

// entry/quickEntry.ts
export function parseQuickEntry(text: string, ctx: QuickEntryContext): ParsedLine[];
export function parseQuickEntryLine(text: string, ctx: QuickEntryContext): ParsedLine;
// ctx: { today, methods, uses, keywords, defaultCardId? }. Implementa 02 §5 "Carga por texto" completo.
// ParsedLine: status (ready | review | incomplete | no_amount), date, amount, currency, installments,
// requestedInstallments, methodId, candidates, description, categoryId y warnings.

// entry/toast.ts
export function savedToastText(input: { kind: 'card'; closeDate; statementTotal: ByCurrency } | { kind: 'account'; accountName }): string;
// "Guardado · entra en el resumen del 24/10 (te vienen $273.500)" / "Guardado · se descontó de Mercado Pago"
```

**Criterios de aceptación de E2:**
1. Todos los ejemplos de 02 §5 son tests: "28/09 4532 12000 súper x3", "4532 súper visa", "súper master" con favorita Visa, "12000 visa" incompleta, "12.5" para revisar, "3 cuotas" con una cuenta y "visa" con dos Visa (favorita, más usada o empate).
2. `formatAmountInput("86500")` da `"86.500"` y `formatAmountInput("12,345")` da `"12,34"`.
3. `paymentChips` no repite la favorita entre las más usadas y devuelve como máximo 3.
4. `learnableWord("compra coto", ["visa"])` da `"coto"`; `learnableWord("pago visa", ["visa"])` da `null`.
5. `pnpm test` y `pnpm typecheck` en verde, y las Edge Functions siguen importando core (sin imports sin `.ts`).

---

### E3. Bienvenida y alta de tarjeta y de cuenta

**Rutas:**
- `(app)/bienvenida.tsx`: 3 pasos con barra de progreso, como el prototipo (`prototipo/mangos.html:1721-1810`), menos el paso de cuentas.
- `(app)/tarjeta-nueva.tsx` y `(app)/cuenta-nueva.tsx`: hojas (`formSheet`).

**Pasos de la bienvenida:**
1. "Toda tu plata en un solo lugar" con las opciones de objetivo (`Option`). Guarda `goal` (`control`, `save` o `invest`).
2. "¿Con qué dólar querés ver tus números?" con MEP, oficial y blue, más la venta de hoy de `fx_rates`, y el `Segmented` Pesos o Dólares. Guarda `fx_reference` y `display_currency`.
3. "¿Usás tarjeta de crédito?" con el formulario de tarjeta. Es opcional: "¿No usás? Tocá Listo."

Al tocar "Listo" se guarda la tarjeta, si se cargó, con `is_favorite = true`, y se escribe `onboarded_at = now()`.

**Formulario de tarjeta** (el mismo componente en la bienvenida y en la Billetera):
- Campos: banco (texto con sugerencias de la lista del prototipo), nombre, red (`Segmented` Visa, Mastercard, Amex o Cabal), últimos 4, vencimiento MM/AA (opcional), día de cierre, día de vencimiento y límite (opcional, en pesos).
- Valida con `validateCardDays` de core.
- El color se asigna solo: el primer `cardColors.credit` que no usa otra tarjeta activa, en orden.
- La primera tarjeta del usuario queda favorita.
- Texto de ayuda: "Solo guardamos los últimos 4 números, nunca la tarjeta completa."

**Formulario de cuenta:** nombre, tipo (`bank`, `wallet` o `cash`: "Banco", "Billetera virtual" o "Efectivo"), moneda y saldo de hoy (`opening_balance`, puede ser 0).

**Errores en voseo:**
- "Poné los últimos 4 números de la tarjeta."
- "El vencimiento tiene que quedar al menos 5 días después del cierre."
- "A la cuenta ponele un nombre."

**Criterios de aceptación de E3:**
1. Un usuario nuevo pasa los 3 pasos y queda con `goal`, `fx_reference`, `display_currency` y `onboarded_at` guardados.
2. Si cargó una tarjeta en el paso 3, la tarjeta queda con `is_favorite = true`.
3. Si saltea la tarjeta, entra a la Billetera vacía, y al volver a abrir la app no ve otra vez la bienvenida.
4. Los últimos 4 aceptan solo 4 dígitos, y el número completo de una tarjeta nunca se pide ni se guarda.
5. Cierre 28 y vencimiento 1 se rechazan con el texto de `validateCardDays`; cierre 24 y vencimiento 6 se aceptan.
6. Desde la Billetera se suma una segunda tarjeta, que no queda favorita, y una cuenta en dólares con saldo de US$ 1.000.

---

### E4. Billetera

**Rutas:** `(app)/index.tsx`. Implementado el 5/10 sin barra de pestañas: con una sola pestaña no aporta, y se suma con `(tabs)` cuando lleguen Inicio, Grupos y Ajustes. El cálculo está en core (`wallet`), con el ejemplo de 02 §8 como test.

**Encabezado:**
- Patrimonio en `moneyHero`, en la moneda de `display_currency` y calculado con `netWorth`.
- Las cuentas se calculan con `accountBalance` (movimientos y `statement_payments` de la cuenta).
- Las tarjetas usan el `pendingTotal` de `cardState`.
- Los grupos usan tu saldo, calculado con `groupBalances` sobre los grupos donde sos integrante activo (lectura por RLS). Sin grupos, cero.
- Cotizaciones: la última venta de `fx_rates` para `fx_reference` y para `tarjeta`. Si la cotización tiene más de 1 hora, debajo va "Dólar de las HH:MM".
- Menú ⋯ con "Cerrar sesión".

**Pestaña Tarjetas:**
- `CardRow` según `DESIGN.md:493-498` y 5A, con la favorita primero.
- A la derecha, el total del resumen en curso, según `cardState`. Debajo, "cierra 24/10".
- Al final, el botón "Sumar tarjeta".
- Tocar una fila no hace nada en esta tanda. El detalle va con la tanda del detalle de tarjeta.

**Pestaña Cuentas:** una fila por cuenta con nombre, tipo y saldo en su moneda, y el botón "Sumar cuenta".

**FAB "+ Gasto"** abajo a la derecha, que abre `/cargar`. Se suma en E5, junto con la ruta.

**Estados (8A):**

| Estado | Qué se ve |
|---|---|
| Cargando | 3 filas esqueleto en `surface2` |
| Sin tarjetas | "Sumá tu primera tarjeta de crédito para saber cuánto te viene." con un botón `primary` |
| Sin cuentas | "Sumá tu cuenta del banco, tu billetera o tu efectivo." con un botón `primary` |
| Error | "No pudimos traer tus tarjetas." con "Reintentar" |
| Nombre largo | Se corta con "…" |

**Criterios de aceptación de E4:**
1. Usá el ejemplo de 02 §8: cuentas por $ 500.000 y US$ 1.000, y una tarjeta que debe $ 187.000 + US$ 50, con dólar tarjeta a $ 2.028 y MEP a $ 1.500, sin grupos. La Billetera en pesos muestra **$ 1.711.600**: $ 2.000.000 − $ 288.400, porque en este caso no hay grupos y el $ 60.000 del ejemplo no está.
2. Con 4 tarjetas, las 4 filas se ven sin scroll en 390 × 844.
3. La favorita aparece primera y con ★.
4. Cada monto tiene un `accessibilityLabel` en palabras ("ciento ochenta y siete mil pesos").
5. Con la base apagada se ve el estado de error y "Reintentar" vuelve a cargar.

---

### E5. Hoja de carga

**Ruta:** `(app)/cargar.tsx` con `presentation: 'formSheet'`. El orden es el de 2A (`docs/diseno-pantallas-v1.md:9-30`):

1. **Carga por texto, una línea:** plegada con "Escribí: 12000 súper visa", sin tomar el foco.
   - Al escribir, `parseQuickEntry` completa el formulario: monto, moneda, medio, descripción, categoría, fecha y cuotas.
   - Si la línea queda `review` o `incomplete`, el campo que falta queda marcado y se completa en el formulario.
   - Con texto, el gasto se guarda con `origin = 'text'`.
2. **Monto:** toma el foco al abrir, con `keyboardType="decimal-pad"` y `formatAmountInput`. El `Segmented` $ o US$ va al lado.
3. **Medio de pago:**
   - Las fichas salen de `paymentChips` (los "más usados" salen de los movimientos de los últimos 30 días), más "Otro…".
   - Ninguna viene marcada.
   - "Otro…" abre una hoja con Tarjetas y Cuentas. La elegida reemplaza a la tercera ficha mientras dura la carga.
   - Sin medios de pago va el botón "Sumá una tarjeta o una cuenta", que abre `/tarjeta-nueva`.
4. **Cuotas:** si el medio es una tarjeta de crédito, aparecen debajo del medio con fichas 1, 3, 6 y 12 y un campo de 1 a 24.
5. **Descripción:** obligatoria, de 60 caracteres como máximo. Mientras se escribe, la categoría se deduce con `deduceCategory` (se transiciona con `motion.micro`).
6. **Categoría:** las 6 fichas, sin ninguna preseleccionada hasta que se deduce. Si la persona la corrige, al guardar se hace un upsert de `category_keywords(word = learnableWord(...))`.
7. **Línea plegada:** "▸ Hoy · 1 cuota". Se abre en fecha (con un selector) y cuotas.
8. **Lo descontado:** si la moneda del gasto difiere de la moneda de la cuenta, aparece "Se descuentan" con `fx_rate_on('tarjeta', fecha)` × monto, que se puede editar (02 §2).
9. **Texto de ayuda:** con una tarjeta de crédito, "Entra en el resumen que cierra el 24/10", según `statementFor`.
10. **Botones:** "Cancelar" y "Guardar gasto" en `KeyboardStickyView`, siempre arriba del teclado.

**Al guardar:**
- `insert` en `movements` con:
  - `id = Crypto.randomUUID()`, generado al abrir la hoja;
  - `type = 'expense'`, `origin` `manual` o `text`;
  - `date`, `description`, `amount` (con `toDbNumeric`) y `currency`;
  - `card_id` o `account_id`;
  - `installments`, `category_id` y `debited_amount`.
- Si vuelve `23505` (el id ya existe), se trata como guardado.
- Validaciones con los textos del prototipo:
  - "Poné un monto mayor a cero."
  - "Escribí una descripción."
  - "Elegí con qué pagaste."
- Después de guardar, la hoja se cierra y aparece el toast (9A) de 5 segundos con `savedToastText` y "Deshacer".
- "Deshacer" hace `delete from movements where id = …` y muestra "Gasto borrado".
- La Billetera se actualiza sin recargar a mano.

**Criterios de aceptación de E5:**
1. Al abrir la hoja, el foco está en Monto, el teclado decimal está abierto y "Guardar gasto" se ve sin bajar, en un iPhone de 390 × 844 y en un Android de 360 × 800.
2. Ninguna ficha de medio de pago ni de categoría viene marcada al abrir.
3. Tecleando 86500 se ve "86.500" y se guarda `amount = 86500.00` (verificado en la base).
4. "12000 súper visa 3 cuotas", con una Visa favorita, completa: $ 12.000, Visa, 3 cuotas, "súper" y Supermercado. Guardado, queda `origin = 'text'`.
5. Un gasto de $ 30.000 en 3 cuotas con la Visa (cierre 24) del 25/9 muestra "Guardado · entra en el resumen del 24/10 (te vienen $ …)", y el total de la fila de la Visa en la Billetera sube $ 10.000.
6. Un gasto con una cuenta muestra "Guardado · se descontó de Mercado Pago" y el saldo de la cuenta baja ese monto.
7. "Deshacer" dentro de los 5 segundos borra la fila de `movements` y la Billetera vuelve al total anterior.
8. Si la categoría deducida se cambia de Otros a Salidas en "birrería La Birra", queda `category_keywords('birrería' → Salidas)`. La próxima "birrería" se deduce como Salidas.
9. Con el modo avión, Guardar muestra "Sin conexión. Probá de nuevo.", la hoja queda abierta y no se pierde nada.
10. Una carga típica (FAB, monto, ficha, descripción y Guardar) lleva menos de 10 s, cronometrada 5 veces por Fran en su teléfono.
11. Todo lo que se toca mide al menos 44 × 44 (con `hitSlop`) y las fichas anuncian `selected`.

---

## Testing

| Capa | Qué | Cantidad |
|---|---|---|
| Unit (Vitest) | `parseQuickEntry`, con todos los ejemplos de 02 §5 y R3-1, R3-2 y R3-6 | +25 |
| Unit (Vitest) | `formatAmountInput` y `parseAmount` | +12 |
| Unit (Vitest) | `paymentChips`, `deduceCategory`, `learnableWord` y `savedToastText` | +14 |
| pgTAP | `onboarded_at`: el dueño escribe y otro usuario no | +3 |
| Manual en un dispositivo | Los criterios de E1, E3, E4 y E5, en iOS (Expo Go o build de desarrollo) y en Android | 5 recorridos |
| Build | `pnpm typecheck`, `pnpm test` y `npx expo export --platform web` (sigue exportando `/g/[token]`) | — |

## Plan de vuelta atrás

- **App:** se revierte el merge. No hay usuarios en la beta todavía.
- **Migración `onboarded_at`:** es aditiva y nullable. Para volver atrás, `alter table user_settings drop column onboarded_at` en una migración nueva, sin borrar datos de otras tablas.
- **Plantillas de mail:** se vuelve a la plantilla anterior desde el panel. Afecta solo cómo llega el código.

## Fuera de alcance

- La carga por texto de varias líneas, con su vista previa y "Guardar N gastos" (la tanda siguiente; el parser ya queda hecho).
- Asignar un gasto a un grupo, la hoja de gasto de grupo, Grupos y el detalle de grupo.
- El detalle de tarjeta, los pagos de resumen, la corrección del cierre, editar, archivar y cambiar la favorita.
- **"¿Ya lo pagaste?" de un gasto cargado tarde** (`lateExpenseImpact`, R3-3 y R3-4). Un gasto con fecha en un resumen ya cerrado se guarda sin preguntar. Va con el detalle de tarjeta, que es donde están los pagos.
- La cola sin conexión (T8), las pastillas "Pendiente" y "No se pudo guardar", y el toast "Guardado en el teléfono".
- Inicio, Ajustes, borrar la cuenta y exportar (T10), y los avisos y el permiso de notificaciones.
- La lista de movimientos con filtros en la Billetera.
- Editar o borrar un gasto después del toast.
- El SMTP propio de producción. En esta tanda se usa el de Supabase, con su límite de envíos por hora.

## Riesgos

- **El SMTP de Supabase tiene un límite bajo de mails por hora.** Para la beta hace falta SMTP propio (ya está en "Antes de la beta").
- **`react-native-keyboard-controller` es nativa.** Si Expo Go no la trae en SDK 57, hace falta un build de desarrollo (`npx expo run:ios` o `run:android`). Hay que verificarlo al instalar.
- **Mismo id de movimiento al reintentar:** si se genera un id nuevo por intento, se duplica. Por eso se genera uno solo al abrir la hoja.

## Definición de terminado

1. Los criterios de E1 a E5 se verificaron en el teléfono de Fran contra el proyecto `mangos`.
2. `pnpm test`, `pnpm typecheck`, `npx supabase test db` y `npx expo export --platform web` están en verde.
3. `docs/03-modelo-de-datos.md` tiene `onboarded_at`, y las decisiones de esta spec quedan en `docs/decisiones/2026-10-05-spec-primeras-pantallas.md`.
4. `estado-y-proximos-pasos.md` está al día.
