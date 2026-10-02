---
# gstack: design-md-format=spec
name: Mangos
description: Finanzas personales en pesos y dólares con verde bosque sobre gris verdoso, números en monoespaciada y tarjetas que parecen plástico real.
colors:
  bg: "#f3f5f2"
  surface: "#ffffff"
  surface-2: "#eef1ed"
  text: "#121a17"
  text-muted: "#56625c"
  text-faint: "#8a958f"
  line: "#dbe1dc"
  primary: "#1f5c4a"
  on-primary: "#ffffff"
  primary-soft: "#e3efe9"
  success: "#1d7a45"
  success-bg: "#e4f3ea"
  error: "#b3391f"
  error-bg: "#fbe9e4"
  warning: "#8a5a00"
  warning-bg: "#fdf1d8"
  cat-1: "#2a78d6"
  cat-2: "#eb6834"
  cat-3: "#1baf7a"
  cat-4: "#eda100"
  cat-5: "#e87ba4"
  cat-6: "#4a3aa7"
  dark-bg: "#0f1312"
  dark-surface: "#171c1a"
  dark-surface-2: "#1e2522"
  dark-text: "#eef2ef"
  dark-text-muted: "#a3aea8"
  dark-text-faint: "#77837d"
  dark-line: "#2b3430"
  dark-primary: "#86c9ae"
  dark-on-primary: "#0f1312"
  dark-primary-soft: "#1f2e28"
  dark-success: "#6fd39a"
  dark-success-bg: "#18301f"
  dark-error: "#f08c74"
  dark-error-bg: "#3a1f18"
  dark-warning: "#f0c060"
  dark-warning-bg: "#35290f"
  dark-cat-1: "#3987e5"
  dark-cat-2: "#d95926"
  dark-cat-3: "#199e70"
  dark-cat-4: "#c98500"
  dark-cat-5: "#d55181"
  dark-cat-6: "#9085e9"
typography:
  display:
    fontFamily: Schibsted Grotesk
    fontWeight: 700
    fontSize: 24px
    letterSpacing: -0.01em
  body:
    fontFamily: Schibsted Grotesk
    fontSize: 15px
    lineHeight: 1.5
  label:
    fontFamily: Schibsted Grotesk
    fontWeight: 500
    fontSize: 11.5px
    letterSpacing: 0.08em
  mono:
    fontFamily: IBM Plex Mono
    fontFeature: tnum
rounded:
  xs: 4px
  sm: 8px
  md: 10px
  lg: 14px
  xl: 16px
  card: 18px
  full: 9999px
spacing:
  "2xs": 2px
  xs: 4px
  sm: 6px
  md: 8px
  lg: 10px
  xl: 12px
  2xl: 14px
  3xl: 16px
  4xl: 18px
  5xl: 20px
  6xl: 22px
  7xl: 28px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    borderColor: "{colors.line}"
    rounded: "{rounded.sm}"
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    borderColor: "{colors.line}"
    rounded: "{rounded.full}"
  input:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.sm}"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
  panel:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.lg}"
---

# Mangos

Sistema visual extraído de `prototipo/mangos.html` (1 de octubre de 2026) para la app en React Native. **No cambia la dirección visual del prototipo.** Las inconsistencias están marcadas con ⚠ y juntas al final, en "Inconsistencias encontradas". Ninguna está resuelta: cada una necesita una decisión de Fran.

## Overview

**Creative North Star:** una herramienta de cuentas tranquila y precisa. Usa un verde bosque como único acento sobre grises levemente verdes y todos los montos van en monoespaciada, porque en esta app los números son el contenido.
**Producto:** finanzas personales para Argentina, con pesos y dólares, tarjetas en cuotas y gastos compartidos. Los usuarios tienen entre 22 y 40 años y usan varias tarjetas y billeteras. Ver `docs/producto-y-lanzamiento.md`.
**Modo de las pantallas:** son de uso (Operate), como Inicio, Billetera, Grupos y la carga de gastos. La bienvenida es la única pantalla que tiene que convencer.
**Rasgos:**
- Los montos se reconocen al instante: van siempre en IBM Plex Mono, con dígitos de ancho fijo.
- Hay un solo color de acción (`primary`). El resto del color se reserva para las categorías y para el estado (bien, mal, alerta).
- La tarjeta de crédito se dibuja como el plástico real, con el color del banco. Es el único elemento "decorado".
- Las superficies se separan con borde fino y tono, no con sombras. La sombra queda para lo que flota: hojas, FAB y toast.

## Colors

**Estrategia:** restringida. Un acento y neutros verdosos. Los seis colores de categoría (`cat-1` a `cat-6`) se usan solo para identificar categorías, integrantes de grupo y series de gráficos, nunca para acciones.
**Claro u oscuro:** se sigue el tema del sistema y en Ajustes se puede forzar uno. El oscuro no es una inversión del claro: el acento pasa a un verde claro (`#86c9ae`) con texto oscuro encima, y las superficies suben de tono (`bg` < `surface` < `surface-2`) para mantener la jerarquía.

- `primary`: botón principal, chip o ícono elegido, link, interruptor encendido, barra del mes actual y foco.
- `primary-soft`: el fondo que destaca un dato, por ejemplo la caja del total del resumen.
- `text-muted`: texto secundario, etiquetas y subtítulos de las filas.
- `text-faint`: solo íconos decorativos, flechas y puntos del carrusel. ⚠ No alcanza contraste para texto (ver I-6).
- `success`, `error`, `warning`, cada uno con su `-bg`: las pastillas de estado y los montos positivos o negativos (`success` o `error` sobre la superficie).
- **Colores de tarjeta** (no cambian con el tema, porque son el color del plástico): crédito `#23262b`, `#3a2f52`, `#5c2330`, `#1e4d3f` y `#2e3f5c`; débito y prepaga `#0d5c7a`, `#1d6b58`, `#3d4f7a` y `#6a4b1f`. El texto va siempre en blanco.

## Typography

- **Schibsted Grotesk** (400, 500 y 700) para toda la interfaz: títulos, texto y botones. Es una grotesca de origen editorial, firme sin ser fría.
- **IBM Plex Mono** (400 y 500) para montos, fechas cortas, últimos 4 números, vencimientos y cotizaciones.
- **Origen y licencia:** las dos están en Google Fonts con licencia OFL. El prototipo las carga de ahí. En React Native se cargan con `expo-font`, una familia por peso, porque en Android `fontWeight` no elige el archivo de una fuente propia. Los nombres de abajo siguen la convención de `@expo-google-fonts`; hay que confirmarlos al instalar el paquete.
- ⚠ El prototipo usa el peso 600 en dos lugares, pero no lo carga (ver I-1).

| Rol | Fuente y peso | Tamaño / interlineado | Dónde |
|---|---|---|---|
| `display` | Schibsted 700, -0.01em | 24 / 1.2 | Título de pantalla |
| `displayOnb` | Schibsted 700 | 28 / 1.2 | Título de la bienvenida |
| `title` | Schibsted 700 | 17 / 1.3 | Título de panel y de hoja |
| `subtitle` | Schibsted 700 | 15 / 1.4 | h3 |
| `body` | Schibsted 400 | 15 / 1.5 | Texto general, inputs |
| `bodyStrong` | Schibsted 500 | 15 / 1.5 | Título de fila (`.row .t`) |
| `button` | Schibsted 500 | 14 / 1.2 | Botones |
| `small` | Schibsted 400 | 13 / 1.4 | Chips, textos de ayuda cortos |
| `caption` | Schibsted 400 | 12.5 / 1.4 | Subtítulo de fila, hint, error |
| `pill` | Schibsted 500 | 12 / 1.3 | Pastillas de estado |
| `label` | Schibsted 500, mayúsculas, 0.08em | 11.5 / 1.3 | Etiqueta sobre un dato (`.eyebrow`) |
| `moneyHero` | Plex Mono 500, -0.02em | 38 (30 en pantallas angostas) / 1.1 | Patrimonio en Inicio |
| `moneyLg` | Plex Mono 400 | 32 / 1.1 | Total del detalle de tarjeta y de grupo |
| `moneyInput` | Plex Mono 400 | 28 | Monto en la hoja de carga |
| `moneyCard` | Plex Mono 400 | 24 / 1.15 | Monto en la tarjeta |
| `moneyMd` | Plex Mono 400 | 20 | Saldo de grupo, cotización |
| `money` | Plex Mono 400 | 15 | Monto en las filas |
| `moneySm` | Plex Mono 400 | 13 | Partes de un gasto, valores de gráfico |

## Layout

- **Teléfono (el destino de la v1):** margen lateral de 16, barra de pestañas abajo con 5 ítems y FAB "+ Gasto" a la derecha, 76 por encima de la barra. Hay que respetar las áreas seguras con `react-native-safe-area-context`.
- **Ritmo:** 18 entre bloques de una pantalla, 14 dentro de un panel, 10 a 12 entre elementos de una fila, y 6 a 8 entre chips o íconos.
- **Densidad:** media. Las filas miden unos 58 de alto (ícono de 36 más 11 arriba y 11 abajo).
- La versión de escritorio del prototipo (menú lateral de 232 y ancho máximo de 1040) no aplica a React Native.

## Elevation & Depth

- **Nivel 0:** `bg`.
- **Nivel 1:** `surface` con borde `line` de 1. Así son los paneles, las filas y los inputs. Sin sombra.
- **Nivel 2:** lo que flota (hoja inferior, FAB, toast) usa la sombra `float` sobre un fondo oscurecido.
- **Tarjeta de crédito:** tiene una sombra propia en dos capas que imita un objeto físico.
- No hay brillos de borde ni sombras sin desplazamiento.

## Shapes

`xs` 4 (barras de gráfico, pista del medidor) · `sm` 8 (botones, inputs, segmentado) · `md` 10 (cajas, ícono de fila, toast) · `lg` 14 (paneles, tarjetas de grupo) · `xl` 16 (hoja inferior y encabezados de detalle) · `card` 18 (tarjeta de crédito) · `full` (chips, pastillas, FAB, avatares).
Si un elemento redondeado va adentro de otro, el radio de adentro es el de afuera menos el espacio entre los dos. ⚠ Hay radios fuera de esta escala (ver I-3).

## Tokens para React Native

Archivo sugerido: `src/theme/tokens.ts`. Los valores salen del CSS del prototipo. `color-mix()` no existe en React Native, así que los tonos derivados ya están calculados.

```ts
// src/theme/tokens.ts
// Source: prototipo/mangos.html (:root and dark theme). Keep in sync with DESIGN.md front matter.

export const palette = {
  light: {
    bg: '#f3f5f2',
    surface: '#ffffff',
    surface2: '#eef1ed',
    text: '#121a17',
    textMuted: '#56625c',
    textFaint: '#8a958f',
    line: '#dbe1dc',
    primary: '#1f5c4a',
    onPrimary: '#ffffff',
    primarySoft: '#e3efe9',
    success: '#1d7a45',
    successBg: '#e4f3ea',
    error: '#b3391f',
    errorBg: '#fbe9e4',
    warning: '#8a5a00',
    warningBg: '#fdf1d8',
    cat: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7'],
    scrim: 'rgba(10,14,12,0.42)',
  },
  dark: {
    bg: '#0f1312',
    surface: '#171c1a',
    surface2: '#1e2522',
    text: '#eef2ef',
    textMuted: '#a3aea8',
    textFaint: '#77837d',
    line: '#2b3430',
    primary: '#86c9ae',
    onPrimary: '#0f1312',
    primarySoft: '#1f2e28',
    success: '#6fd39a',
    successBg: '#18301f',
    error: '#f08c74',
    errorBg: '#3a1f18',
    warning: '#f0c060',
    warningBg: '#35290f',
    cat: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'],
    scrim: 'rgba(10,14,12,0.42)', // prototype uses the same scrim in both themes
  },
} as const;

export type ThemeName = keyof typeof palette;
export type Palette = (typeof palette)[ThemeName];

// Plastic colors: theme-independent. `end` = base mixed 52% with black (the CSS gradient's second stop).
export const cardColors = {
  credit: [
    { base: '#23262b', end: '#121416' },
    { base: '#3a2f52', end: '#1e182b' },
    { base: '#5c2330', end: '#301219' },
    { base: '#1e4d3f', end: '#102821' },
    { base: '#2e3f5c', end: '#182130' },
  ],
  debit: [
    { base: '#0d5c7a', end: '#07303f' },
    { base: '#1d6b58', end: '#0f382e' },
    { base: '#3d4f7a', end: '#20293f' },
    { base: '#6a4b1f', end: '#372710' },
  ],
  onCard: '#ffffff',
  favoriteStar: '#f6b73c', // hardcoded in the prototype, see I-7
} as const;

// Category icon tile background = category color at 16% opacity.
export const tint16 = (hex: string) => `${hex}29`;

export const fonts = {
  regular: 'SchibstedGrotesk_400Regular',
  medium: 'SchibstedGrotesk_500Medium',
  bold: 'SchibstedGrotesk_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

const mono = { fontVariant: ['tabular-nums'] as const };

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 29, letterSpacing: -0.24 },
  displayOnb: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.28 },
  title: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.17 },
  subtitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, letterSpacing: -0.15 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  button: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17 },
  pill: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, letterSpacing: 0.92, textTransform: 'uppercase' as const },
  moneyHero: { fontFamily: fonts.monoMedium, fontSize: 38, lineHeight: 42, letterSpacing: -0.76, ...mono },
  moneyHeroCompact: { fontFamily: fonts.monoMedium, fontSize: 30, lineHeight: 33, letterSpacing: -0.6, ...mono },
  moneyLg: { fontFamily: fonts.mono, fontSize: 32, lineHeight: 35, ...mono },
  moneyInput: { fontFamily: fonts.mono, fontSize: 28, lineHeight: 34, ...mono },
  moneyCard: { fontFamily: fonts.mono, fontSize: 24, lineHeight: 28, ...mono },
  moneyMd: { fontFamily: fonts.mono, fontSize: 20, lineHeight: 26, ...mono },
  money: { fontFamily: fonts.mono, fontSize: 15, lineHeight: 22, ...mono },
  moneySm: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18, ...mono },
} as const;

export const radius = { xs: 4, sm: 8, md: 10, lg: 14, xl: 16, card: 18, full: 999 } as const;

export const space = {
  '2xs': 2, xs: 4, sm: 6, md: 8, lg: 10, xl: 12, '2xl': 14, '3xl': 16, '4xl': 18, '5xl': 20, '6xl': 22, '7xl': 28,
} as const;

export const layout = {
  gutter: 16,
  sectionGap: 18,
  panelPadding: 18,
  rowIcon: 36,
  rowPaddingV: 11,
  tabBarIconGap: 3,
  fabOffsetFromTabBar: 76,
  minTouch: 44,
} as const;

// CSS blur ≈ 2 × RN shadowRadius. Android uses `elevation`.
export const shadow = {
  float: { shadowColor: '#121a17', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 15, elevation: 8 },
  floatDark: { shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 8 },
  card: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 11, elevation: 5 },
  segmentSelected: { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 1, elevation: 1 },
} as const;

export const motion = {
  micro: 150,      // switch, chips, card hover
  sheetIn: 180,    // bottom sheet: translateY 12 → 0, opacity 0.6 → 1, ease-out
  short: 200,      // carousel dots, chevron rotate
  panelDrop: 220,  // statement panel: translateY -6 → 0, ease-out
  carousel: 280,   // inactive card: scale 0.88, opacity 0.5
  bars: 300,       // chart bars and meters
  spinner: 800,    // one full turn, linear
} as const;

export const iconStroke = { category: 1.9, ui: 1.8 } as const; // UI value pending, see I-8
```

**Cómo se usa el tema:** con `useColorScheme()` más la preferencia de Ajustes ("sistema", "claro" u "oscuro") se elige `palette.light` o `palette.dark`, y se reparte por contexto. Respetar "reducir movimiento" con `AccessibilityInfo.isReduceMotionEnabled()`: cuando está activo, no hay transiciones de escala ni de desplazamiento.

## Components

Los estados de hover del prototipo pasan a ser **presionado** (`Pressable` con `pressed`). El foco visible pasa a los props de accesibilidad (`accessibilityRole`, `accessibilityState`, `accessibilityLabel`). Todo lo que se toca mide al menos 44 × 44, aunque se vea más chico (`hitSlop`).

### Botón (`Button`)

| Variante | Reposo | Presionado | Deshabilitado | Cargando |
|---|---|---|---|---|
| `default` | `surface`, borde `line`, texto `text`, `button`, padding 8 × 13, radio `sm` | borde `textMuted` | opacidad 0.45 | spinner de 14 en lugar del ícono; mismo ancho |
| `primary` | `primary`, borde `primary`, texto `onPrimary` | el prototipo aclara con brillo ×1.08; en RN, opacidad 0.9 | opacidad 0.45 | igual que default |
| `ghost` | sin fondo ni borde, texto `textMuted`, padding 5 × 9 | texto `text`, borde `line` | opacidad 0.45 | — |
| `icon` | sin fondo, ícono `textMuted`, padding 7 | fondo `surface2`, ícono `text` | opacidad 0.45 | — |
| `fab` | `primary`, radio `full`, padding 12 × 18, sombra `float`; texto "+ Gasto" | opacidad 0.9 | — | — |
| `link` | texto `primary` 13 / 500, sin fondo | subrayado | — | — |
| `add` | 52 × 52, radio `lg`, borde punteado de 1.5 en `primary`, ícono `primary` | fondo `primarySoft` | — | — |

- `icon` puede llevar un punto de aviso: 8 × 8 en `error`, con borde de 2 en `bg`.
- En las hojas, los botones van al final y a la derecha: primero "Cancelar" (`default`) y después la acción (`primary`, con el verbo: "Guardar gasto", "Confirmar pago").
- ⚠ React Native no admite bordes punteados con `borderStyle: 'dashed'` en todos los casos. Para `add` hay que probarlo en Android.

### Tarjeta de crédito (`CreditCard`)

Imita el plástico. En la v1 se usa como encabezado del detalle de la tarjeta y como ítem de la lista. **El carrusel salió de la v1** (C4, `TODOS.md`), pero la tarjeta se mantiene.

- **Forma:** proporción 1.586 : 1, radio `card`, sombra `card`, texto `onCard`.
- **Fondo:** degradado lineal a 140° de `base` a `end` (`expo-linear-gradient`). Encima van dos capas: un brillo radial arriba a la derecha (blanco al 16%) y anillos finos abajo a la izquierda (blanco al 7.5%). Esas capas hay que hacerlas con `react-native-svg` o con una imagen PNG; el degradado solo ya da el aspecto base.
- **Contenido** (padding 18 × 20, con un bloque arriba y otro abajo):
  - **Arriba a la izquierda:** el monograma del banco (26 × 26, radio 8, fondo blanco al 92%, iniciales en el color `base`, 11 / 700) y el nombre del banco (14).
  - **Arriba a la derecha:** la estrella de favorita (`favoriteStar`) y las acciones (círculos de 34, fondo blanco al 16%, ícono de 16 con trazo 1.9).
  - **Centro:** el monto en `moneyCard` y la parte en dólares en `moneySm`. Debajo, "Vence 6/10" (12, opacidad 0.82).
  - **Abajo a la izquierda:** el tipo (`label`, opacidad 0.85) y "•••• 2337" (Plex Mono 16, espaciado 0.04em).
  - **Abajo a la derecha:** la red (17 / 700, espaciado 0.06em) y el vencimiento del plástico (Plex Mono 14 con la etiqueta 9.5 en mayúsculas).

| Estado | Cómo se ve |
|---|---|
| Reposo | Como arriba |
| Presionada | Escala 0.98 durante `micro`. El prototipo la sube 2 con hover; en un teléfono no hay hover |
| Abierta (resumen visible) | Doble anillo: 3 en `bg` y 2 en `text`. El chevrón gira 180° |
| Favorita | Estrella rellena; la tarjeta aparece primera en la lista |
| Archivada (borra en 7 días) | Falta definir (ver I-11) |
| Texto largo | El nombre del banco y el titular se cortan con "…" (`numberOfLines={1}`) |

### Fila de movimiento (`MovementRow`)

Una grilla de 3 columnas: ícono de categoría de 36, texto que se estira y un bloque a la derecha. Padding vertical 11, espacio de 12 entre columnas y un separador `line` de 1 abajo (la última fila no lo lleva).

- **Título:** `bodyStrong`, una línea con "…". Por ejemplo, "Supermercado Coto".
- **Subtítulo:** `caption` `textMuted`, una línea, con las partes separadas por " · ": medio de pago, "cuota 3/6", "tu parte $X" y "ver comprobante" (este último no va en la v1).
- **Derecha:** el monto en `money`, alineado a la derecha, y debajo la categoría en `caption`. Si es de un grupo, va "Grupo · Salidas".
- **Montos con signo:** positivo en `success` y negativo en `error`.
- **Encabezado de día** (`DayHeader`): 12 / 500, mayúsculas, espaciado 0.06em, `textMuted`, padding 14 arriba y 4 abajo, con borde inferior. ⚠ Usa un espaciado distinto al de `label` (ver I-5).

| Estado | Cómo se ve |
|---|---|
| Reposo | Fondo transparente |
| Presionada | Fondo `surface2` |
| Sin acción | Sin cambio al presionar; `accessibilityRole` text |
| Lista vacía | Texto `textMuted` 14, padding 16 × 4, que dice qué cargar: "Todavía no tenés cuentas. Sumá tu banco, tu billetera virtual o el efectivo." |
| Cargando | Falta definir (ver I-11) |
| Recién guardada | El prototipo no lo tiene. Sugerencia: un destello de `primarySoft` de 1,4 s, como el `.filled` del formulario |

**Otras filas** que comparten esta grilla con medidas distintas: alerta (ícono de 28, padding 12), integrante (32 y 8), categoría (30 y 8), cómo saldar (sin ícono, 10) y ajustes (sin ícono, 12). ⚠ Ver I-4.

### Ícono de categoría (`CategoryIcon`)

- Un cuadrado redondeado con el color de la categoría al 16% de fondo (`tint16`) y el trazo en el color de la categoría. Usa SVG de 24 × 24 sin relleno, trazo 1.9 y puntas redondeadas (`react-native-svg`).
- **Tamaños:**

| Tamaño | Lado | Radio | Glifo | Uso |
|---|---|---|---|---|
| `md` | 36 | 10 | 55% | Filas |
| `sm` | 30 | 8 | 62% | Ajustes |
| `xs` | 18 | 5 | 100% | Leyendas |
| `inline` | 16 | 0 | 100% | Adentro de un chip, sin fondo y en el color del chip |

- **Los 20 glifos** del prototipo (`CAT_ICONS`): `cart`, `food`, `bus`, `car`, `bolt`, `play`, `box`, `home`, `health`, `pet`, `book`, `shirt`, `gift`, `plane`, `gym`, `phone`, `coffee`, `baby`, `tool`, `money`. Los paths se copian tal cual.
- **Las 6 categorías fijas de la v1:**

| Categoría | Ícono | Color |
|---|---|---|
| Supermercado | `cart` | `cat[0]` |
| Salidas | `food` | `cat[1]` |
| Transporte | `bus` | `cat[2]` |
| Servicios | `bolt` | `cat[3]` |
| Suscripciones | `play` | `cat[4]` |
| Otros | `box` | `cat[5]` |

- Si no se encuentra el ícono, se usa `box` con `cat[5]`.
- ⚠ En claro, el amarillo (`cat[3]`) sobre su propio tinte no llega a 3:1 (ver I-6).

### Hoja inferior (`BottomSheet`)

- **Fondo:** `scrim` sobre la pantalla. Tocarlo cierra la hoja, salvo cuando hay cambios sin guardar.
- **Hoja:** `surface`, radio `xl` solo arriba, padding 20 (más el área segura abajo), espacio de 14 entre bloques y alto máximo del 100% menos 32. Si no entra, hace scroll por dentro.
- **Encabezado:** título `title` a la izquierda y botón `ghost` "✕" (con etiqueta "Cerrar") a la derecha.
- **Formulario:**
  - Grilla de 2 columnas con espacio de 12; algunos campos ocupan el ancho completo.
  - Las etiquetas van en 12.5 `textMuted`, con 5 de espacio sobre el input.
  - El monto va primero, en `moneyInput`, con padding 10 × 12.
- **Botones:** al final, alineados a la derecha.
- **Animación de entrada:** sube 12 y pasa de opacidad 0.6 a 1 en `sheetIn` (ease-out). Con "reducir movimiento", aparece sin animar.
- **Teclado:** la hoja sube con el teclado (`KeyboardAvoidingView`). El foco inicial va al monto, por la regla de los 10 segundos.

| Estado | Cómo se ve |
|---|---|
| Abierta | Como arriba |
| Enviando | El botón principal muestra el spinner; la hoja no se puede cerrar |
| Error de validación | Texto `error` en 12.5 debajo del campo (`.err`); el foco va al primer campo con error |
| Error al guardar | Un toast con el motivo; la hoja queda abierta con los datos |
| Arrastrar para cerrar | El prototipo no lo tiene; ver I-10 |

### Chips y selectores

| Componente | Reposo | Elegido | Uso |
|---|---|---|---|
| `Chip` | `surface`, borde `line`, texto `textMuted`, 13, padding 5 × 11, radio `full` | `primary` de fondo y de borde, texto `onPrimary` | Categoría en la hoja de carga, filtros |
| `Segmented` | contenedor `surface2`, padding 3, radio `sm`; opción transparente con texto `textMuted` 13 y padding 5 × 10 | la opción pasa a `surface` con texto `text` y sombra `segmentSelected` | ARS / USD, modo de división |
| `Tabs` (Billetera) | `surface2`, texto `textMuted` 14 / 600, mayúsculas, 0.04em, padding 10 × 20, radio `full` | fondo `text`, texto `bg` | Tarjetas / Cuentas |
| `Option` (bienvenida) | `surface`, borde `line`, radio `md`, padding 14 | borde `primary` de 1 más un anillo de 1 | Opciones de la bienvenida |
| `Pill` (estado, sin interacción) | 12 / 500, padding 2 × 9, radio `full`, en las variantes `success`, `error`, `warning` y `neutral` (`surface2` con `textMuted`), cada una con su `-bg` | — | "A pagar", "Vencido", "Pagado" |
| `Switch` | 40 × 22, pista `line`, perilla blanca de 16 | pista `primary`, la perilla se corre 18 en `micro` | Notificaciones |

- Todos los selectores marcan el estado con `accessibilityState={{ selected }}` o `checked`.
- ⚠ Hay tres formas distintas de marcar "elegido" (ver I-9).

### Carga por texto (`QuickEntry`)

Se definió en `/plan-design-review` (1/10). La ubicación y el comportamiento están en `docs/diseno-pantallas-v1.md`.

- **Plegada:** una línea con el aspecto de `Input`: `surface`, borde `line`, radio `sm`, padding 9 × 10. Muestra el texto de ejemplo "Escribí: 12000 súper visa" en `textMuted` y no se lleva el foco al abrir la hoja.
- **Abierta:** el campo pasa a ocupar hasta 4 líneas en `body`. Debajo aparece la lista de lo que entendió, una fila por línea: descripción en `bodyStrong`, medio y cuotas en `caption` y monto en `money`.

| Estado de cada línea | Cómo se ve |
|---|---|
| Lista | Fila normal |
| Para revisar | `Pill` `warning` "Revisar" a la derecha; tocarla abre ese gasto para confirmarlo |
| Sin monto | `Pill` `error` "Falta el monto"; la línea queda en el campo después de guardar |

- El botón `primary` dice "Guardar 8 gastos". Si quedan líneas sin guardar, suma "· quedan 2 sin guardar" en `caption`.
- Si no hay ninguna línea lista, el botón queda deshabilitado (opacidad 0.45).

### Fichas de medio de pago (`PaymentMethodChips`)

- Son `Chip` con el nombre y los últimos 4: "Visa ·· 2337". Los números van en IBM Plex Mono 13.
- Orden: la favorita (con ★), los dos medios más usados y "Otro…". **Ninguna viene marcada.**
- Elegida: `primary` con texto `onPrimary`, como el resto de las fichas.
- Las fichas miden menos de 44 de alto, así que llevan `hitSlop` vertical de 8 para que se puedan tocar bien.
- Con error de validación, el título "Medio de pago" pasa a `error` y aparece "Elegí con qué pagaste." debajo, en `caption`.

### Fila de tarjeta (`CardRow`)

- Usa la misma grilla que `MovementRow`. En lugar del ícono va una **miniatura del plástico** de 56 × 36, radio `xs`, con el degradado `base` → `end` de `cardColors` y sin el patrón de anillos.
- Al medio: nombre de la tarjeta en `bodyStrong` (con ★ si es la favorita) y "·· 2337" en `moneySm` `textMuted`.
- A la derecha: lo que viene en el resumen en curso, en `money`, y debajo "cierra 24/10" en `caption`.
- Estados: los de `MovementRow` (presionada en `surface2`). Una tarjeta archivada se ve con opacidad 0.5 y la pastilla "Se borra en N días" (I-11).

### Toast con acción

- Es el `Toast` de "Otros componentes" con un botón de texto a la derecha: "Deshacer", en 14 / 500 y color `primarySoft`.
- Dura 5 segundos (los toasts sin acción, 3). Si la persona toca el botón, se cierra en el momento.
- El botón tiene que tener al menos 44 de alto (con `hitSlop`) y `accessibilityRole` button. El lector de pantalla anuncia el texto completo del toast.

### Otros componentes

- **Panel:** `surface`, borde `line`, radio `lg`, padding 18, espacio de 14 entre bloques. No se anidan paneles.
- **Input:** `surface`, borde `line`, radio `sm`, padding 9 × 10, `body`. Los numéricos van en `money`. En foco, borde `primary` de 2. Con error, borde `error` y el mensaje debajo.
- **Toast:** fondo `text`, texto `bg`, 14, padding 10 × 16, radio `md`, sombra `float`. Va 84 sobre el borde inferior para no tapar la barra de pestañas.
- **Barra de pestañas:** `surface` con borde superior `line`. Cada ítem tiene ícono y texto de 11, en `textMuted`; el activo va en `primary`. El aviso es un `error` de 18 de alto con texto blanco 11 / 500.
- **Medidor:** pista de 8 en `surface2`, radio `xs`, relleno `primary`.

## Do's and Don'ts

- **Do:** todo monto, fecha corta, número de tarjeta o cotización en Plex Mono con `tabular-nums`, para que las columnas queden alineadas.
- **Do:** un solo botón `primary` por pantalla u hoja, con el verbo de lo que hace.
- **Do:** separar con borde `line` y tono de superficie. La sombra queda para lo que flota.
- **Do:** diseñar el estado vacío de cada lista con un texto que diga qué cargar, como hace el prototipo.
- **Do:** usar los colores de categoría solo para categorías, integrantes y gráficos.
- **Don't:** usar `primary` como color decorativo o de categoría; pierde su significado de acción.
- **Don't:** poner texto blanco sobre `cat[1]` a `cat[4]` en modo claro (ver I-6).
- **Don't:** agregar sombras a los paneles ni anidar un panel dentro de otro.
- **Don't:** usar el peso 600 hasta resolver I-1.
- **Don't:** recomendar comprar o vender en ningún texto de la interfaz (regla del proyecto).

## Motion

- **Enfoque:** solo lo funcional. Las transiciones explican un cambio (se abre la hoja, se elige un chip) y no adornan.
- **Curvas:** entrada ease-out, salida ease-in, desplazamiento ease-in-out. El spinner es lineal.
- **Duraciones:** ver `motion` en los tokens; van de 150 a 300.
- **Lo que se mueve:** la tarjeta, al abrir su resumen (anillo y chevrón, y el panel baja 6 en `panelDrop`).
- Con "reducir movimiento", todo pasa a un cambio instantáneo.

## Inconsistencias encontradas

No se corrigió ninguna. Cada una espera una decisión.

| # | Qué | Dónde en el prototipo | Impacto | Propuesta, sin cambiar la dirección |
|---|---|---|---|---|
| I-1 | Se usa el peso 600, pero solo se cargan 400, 500 y 700 | `.ccard .bank`, `.wtabs button` | El navegador sintetiza o redondea el peso. En RN no hay archivo de 600 | Usar 500 en `.bank` y 700 en las pestañas, o cargar el 600 |
| I-2 | Hay 22 tamaños de letra distintos, incluidos 9.5, 11.5, 12.5, 13.5 y 14.5 | Todo el CSS | La escala es difícil de mantener | Usar la tabla de Typography como escala cerrada. Los tamaños sueltos (13.5, 14.5, 16, 19, 22) pasan al más cercano |
| I-3 | Hay radios fuera de los tokens: 2, 5, 6, 9, 11 y 12 | `.attach` y `.welcome-art` (12), `.logo` y `.badge` (9), `.seg button` (6) | Bordes apenas distintos entre componentes parecidos | Pasar el 12 a `md` (10) o sumar `md2: 12`; el 9 a `sm` y el 6 a `sm - 2` dentro del segmentado |
| I-4 | Las filas de lista tienen 6 variantes con íconos de 28, 30, 32 y 36 y padding de 8, 10, 11 y 12 | `.row`, `.alert-row`, `.mrow`, `.cat-row`, `.settle`, `.set-row` | Las listas se ven con alturas distintas entre pantallas | Usar un solo `ListRow` con dos densidades: normal (36 y 11) y compacta (30 y 8) |
| I-5 | Las etiquetas en mayúsculas usan tres espaciados: 0.08, 0.06 y 0.04em | `.eyebrow` y `.kind`, `.dgroup`, `.wtabs` | Etiquetas parecidas con distinto ritmo | Usar 0.08em para todas, o 0.06 para los encabezados de día |
| I-6 | Hay pares de color que no alcanzan el contraste mínimo | Ver la lista de abajo | Lectura difícil en exteriores; no cumple WCAG AA | Para texto e íconos sobre colores de categoría, usar `text` (oscuro) en lugar de blanco, u oscurecer esos colores al 70% solo cuando llevan texto |
| I-7 | Hay colores fijos fuera de los tokens: `#fff`, la estrella `#f6b73c` y sombras en `rgba` | `.badge`, `.face`, `.row .ic`, `.switch`, `.ccard .star` | No cambian con el tema; el aviso en oscuro queda ilegible | Pasarlos a tokens: `onCard`, `favoriteStar` y `onError` por tema |
| I-8 | Los íconos usan cinco grosores de trazo: 1.6, 1.7, 1.8, 1.9 y 2 | Íconos de interfaz contra íconos de categoría | El mismo set se ve desparejo | Usar 1.9 para categorías y 1.8 para la interfaz (el promedio de lo que hay), o 1.9 para todos |
| I-9 | Se marca "elegido" de tres maneras: relleno `primary` (chip, ícono), relleno `text` (pestañas, puntos del carrusel) y superficie elevada (segmentado) | `.chip`, `.icons`, `.wtabs`, `.car-dots`, `.seg` | Controles que hacen lo mismo se ven distintos | Dejar `text` solo para la navegación (pestañas) y `primary` para elegir valores. Así queda documentado; decidir si se mantiene |
| I-10 | El prototipo no tiene asa ni gesto para cerrar la hoja arrastrando | `.sheet` | En un teléfono se espera poder cerrarla así | Sumar un asa de 36 × 4 en `line` y cerrar arrastrando. Es lo esperable en la plataforma, no un cambio de estética |
| I-11 | Faltan estados en el prototipo: carga de listas, tarjeta archivada, error de red | Todas las pantallas | Solo está diseñado el camino feliz | Definirlos antes de construir: esqueletos en `surface2`, tarjeta archivada con opacidad 0.5 y la pastilla "Se borra en N días" |
| I-12 | Los tokens de oscuro están repetidos dos veces | `@media (prefers-color-scheme)` y `[data-theme="dark"]` | Hay riesgo de que se desincronicen | En RN hay una sola fuente (`palette.dark`) |
| I-13 | Hay una variable sin definir, `var(--sans,inherit)` | `.ccard .cexp span` | Sin efecto; cae en `inherit` | Borrarla del prototipo |
| I-14 | Hay estilos en línea que pisan tokens, como `font-size:22px` o `padding:14px 16px` en las cajas de cuentas | Por ejemplo, la línea 1197 | Valores que no están en ninguna escala | Pasarlos a `moneyMd` y a un `panelCompact` (padding 14 × 16) |

**Detalle de I-6** (contraste medido):

| Par | Contraste | Mínimo | Dónde |
|---|---|---|---|
| `textFaint` sobre `bg`, claro | 2.83 | 3 (UI) / 4.5 (texto) | Ícono de búsqueda, flechas, puntos |
| Blanco sobre `cat[3]` `#eda100`, claro | 2.17 | 4.5 | Inicial de un integrante, ícono "$" de efectivo |
| Blanco sobre `cat[4]` `#e87ba4`, claro | 2.69 | 4.5 | Inicial de un integrante |
| Blanco sobre `cat[2]` `#1baf7a`, claro | 2.82 | 4.5 | Ícono "APP" de billetera, inicial |
| Blanco sobre `cat[1]` `#eb6834`, claro | 3.20 | 4.5 | Inicial de un integrante |
| Blanco sobre `error` `#f08c74`, oscuro | 2.41 | 4.5 | Aviso de la barra de pestañas |
| `cat[3]` sobre su tinte del 16%, claro | 1.92 | 3 | Ícono de Servicios |

Pasan: `textMuted` sobre `bg` (5.81), blanco sobre `primary` (7.81), `onPrimary` sobre `primary` en oscuro (9.78), y las tres pastillas de estado en claro (de 4.67 a 5.29).

## Decisions Log

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-10-01 | Se creó el sistema extrayendo los valores de `prototipo/mangos.html` | Fran pidió no cambiar la dirección visual y marcar solo las inconsistencias |
| 2026-10-01 | El carrusel se documenta, pero no entra en la v1 | Recorte C4 (`docs/decisiones/2026-10-01-ceo-review.md`). La tarjeta se usa en la lista y en el detalle |
| 2026-10-01 | Se agregan QuickEntry, PaymentMethodChips, CardRow y Toast con acción | `/plan-design-review`, decisión 10A. Salen de las decisiones 2A, 3A, 5A y 9A (`docs/diseno-pantallas-v1.md`) |
