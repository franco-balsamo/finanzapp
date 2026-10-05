// Medios de pago de la hoja de carga (02 §5 y diseño 3A): orden, fichas y palabras que los nombran.

import { addDays, type ISODate } from '../dates.ts';
import { normalizeWord, words } from './categories.ts';

export type CardNetwork = 'VISA' | 'MC' | 'AMEX' | 'CABAL';

export type PaymentMethod =
  | { kind: 'card'; id: string; bank: string; network: CardNetwork; last4: string; isFavorite: boolean }
  | { kind: 'account'; id: string; name: string };

/** Un gasto anterior con ese medio, para "los más usados en 30 días". */
export interface PaymentUse {
  methodId: string;
  date: ISODate;
}

const NETWORK_LABELS: Record<CardNetwork, string> = { VISA: 'Visa', MC: 'Master', AMEX: 'Amex', CABAL: 'Cabal' };

const NETWORK_WORDS: Record<CardNetwork, readonly string[]> = {
  VISA: ['visa'],
  MC: ['master', 'mastercard', 'mc'],
  AMEX: ['amex', 'american'],
  CABAL: ['cabal'],
};

// No identifican un banco ni una cuenta: "Banco Galicia" se nombra con "galicia".
const GENERIC_WORDS = new Set([
  'banco', 'caja', 'ahorro', 'cuenta', 'corriente', 'de', 'del', 'la', 'el', 'en', 'pesos', 'dolares', 'usd', 'ars', 'pago',
]);

/** "Visa ·· 2337" o el nombre de la cuenta ("Mercado Pago"). */
export function paymentMethodLabel(method: PaymentMethod): string {
  return method.kind === 'card' ? `${NETWORK_LABELS[method.network]} ·· ${method.last4}` : method.name;
}

/** Palabras con las que el texto nombra a este medio: la red y el banco de una tarjeta, o el nombre de una cuenta. */
export function methodWords(method: PaymentMethod): string[] {
  if (method.kind === 'card') {
    return [...NETWORK_WORDS[method.network], ...words(method.bank).filter((w) => !GENERIC_WORDS.has(w))];
  }
  const own = words(method.name).filter((w) => !GENERIC_WORDS.has(w));
  return normalizeWord(method.name).includes('mercado pago') ? [...own, 'mp'] : own;
}

/** Todas las palabras de los medios del usuario. Ninguna se aprende como categoría (R3-5). */
export function paymentMethodWords(methods: readonly PaymentMethod[]): string[] {
  return [...new Set(methods.flatMap(methodWords))];
}

/** Orden de la lista completa ("Otro…"): la favorita, las demás tarjetas y al final las cuentas. */
export function orderedMethods(methods: readonly PaymentMethod[]): PaymentMethod[] {
  const rank = (m: PaymentMethod) => (m.kind === 'card' ? (m.isFavorite ? 0 : 1) : 2);
  return [...methods].sort((a, b) => rank(a) - rank(b));
}

/** Cuántas veces se usó cada medio en los últimos 30 días, contando hoy. */
export function usageCounts(uses: readonly PaymentUse[], today: ISODate): Map<string, { count: number; last: ISODate }> {
  const from = addDays(today, -29);
  const counts = new Map<string, { count: number; last: ISODate }>();
  for (const use of uses) {
    if (use.date < from || use.date > today) continue;
    const prev = counts.get(use.methodId);
    counts.set(use.methodId, {
      count: (prev?.count ?? 0) + 1,
      last: prev && prev.last > use.date ? prev.last : use.date,
    });
  }
  return counts;
}

/**
 * Las fichas de la hoja, sin "Otro…" (lo suma la pantalla): la favorita y después los dos medios más
 * usados en 30 días, sin repetir. Si no llegan a 3, se completan con el orden de `orderedMethods`.
 * Ninguna viene marcada: eso lo decide la pantalla, que arranca sin selección.
 */
export function paymentChips(methods: readonly PaymentMethod[], uses: readonly PaymentUse[], today: ISODate): PaymentMethod[] {
  const ordered = orderedMethods(methods);
  const counts = usageCounts(uses, today);
  const chips: PaymentMethod[] = [];
  const favorite = ordered.find((m) => m.kind === 'card' && m.isFavorite);
  if (favorite) chips.push(favorite);

  const used = ordered
    .filter((m) => m !== favorite && counts.has(m.id))
    .sort((a, b) => {
      const ca = counts.get(a.id)!;
      const cb = counts.get(b.id)!;
      return cb.count - ca.count || (cb.last > ca.last ? 1 : cb.last < ca.last ? -1 : 0);
    });
  for (const m of used) {
    if (chips.length >= 3) break;
    chips.push(m);
  }
  for (const m of ordered) {
    if (chips.length >= 3) break;
    if (!chips.includes(m)) chips.push(m);
  }
  return chips;
}
