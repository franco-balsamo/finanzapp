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

const mono = { fontVariant: ['tabular-nums'] as ('tabular-nums')[] };

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
