// Categoría deducida de la descripción y aprendizaje de correcciones (02 §5).

/** Las 6 categorías fijas de la beta, con sus UUID de la base (03 §categories). */
export const SYSTEM_CATEGORY_IDS = {
  supermercado: '00000000-0000-4000-8000-000000000001',
  salidas: '00000000-0000-4000-8000-000000000002',
  transporte: '00000000-0000-4000-8000-000000000003',
  servicios: '00000000-0000-4000-8000-000000000004',
  suscripciones: '00000000-0000-4000-8000-000000000005',
  otros: '00000000-0000-4000-8000-000000000006',
} as const;

const DEFAULT_KEYWORDS: Record<string, readonly string[]> = {
  [SYSTEM_CATEGORY_IDS.supermercado]: ['super', 'coto', 'carrefour', 'jumbo', 'disco', 'chino', 'verduleria'],
  [SYSTEM_CATEGORY_IDS.salidas]: ['delivery', 'rappi', 'pedidosya', 'resto', 'bar', 'birra', 'cafe'],
  [SYSTEM_CATEGORY_IDS.transporte]: ['nafta', 'ypf', 'shell', 'uber', 'cabify', 'sube', 'peaje'],
  [SYSTEM_CATEGORY_IDS.servicios]: ['luz', 'gas', 'agua', 'internet', 'celu', 'edenor', 'edesur', 'metrogas'],
  [SYSTEM_CATEGORY_IDS.suscripciones]: ['netflix', 'spotify', 'disney'],
};

const DEFAULT_MAP: ReadonlyMap<string, string> = new Map(
  Object.entries(DEFAULT_KEYWORDS).flatMap(([categoryId, words]) => words.map((w) => [w, categoryId] as const)),
);

// Palabras que nunca se aprenden (02 §5, R3-5). Los bancos y las redes del usuario se suman aparte.
const NOT_LEARNABLE = new Set([
  'compra', 'pago', 'gasto', 'cosas', 'varios', 'de', 'el', 'la', 'en', 'con', 'para', 'por', 'y', 'cuotas', 'cuota',
]);

/** Minúsculas y sin acentos: "Súper" → "super". */
export function normalizeWord(word: string): string {
  return word.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Palabras completas, normalizadas, en orden. */
export function words(text: string): string[] {
  return normalizeWord(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Gana la primera palabra que coincide, sea una corrección del usuario o la lista inicial.
 * Las correcciones mandan sobre la lista inicial para la misma palabra. Sin coincidencias, "Otros".
 * `userKeywords`: palabra normalizada → `category_id` (tabla `category_keywords`).
 */
export function deduceCategory(description: string, userKeywords: ReadonlyMap<string, string> = new Map()): string {
  for (const word of words(description)) {
    const categoryId = userKeywords.get(word) ?? DEFAULT_MAP.get(word);
    if (categoryId) return categoryId;
  }
  return SYSTEM_CATEGORY_IDS.otros;
}

/**
 * La palabra que se asocia a la categoría corregida: la primera que no esté en la lista que no enseña,
 * que no sea un número ni las cuotas ("x3") y que no nombre un medio de pago del usuario.
 * `paymentWords`: palabras de los bancos, redes y cuentas del usuario (ver `paymentMethodWords`).
 */
export function learnableWord(description: string, paymentWords: readonly string[]): string | null {
  const payment = new Set(paymentWords.map(normalizeWord));
  for (const word of words(description)) {
    if (NOT_LEARNABLE.has(word) || payment.has(word)) continue;
    if (/^\d+$/.test(word) || /^x\d+$/.test(word) || /^\d+c$/.test(word)) continue;
    return word;
  }
  return null;
}
