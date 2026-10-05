// Montos escritos a mano (02 §5 "Formato del monto" y diseño 11A): el punto separa miles y la coma, decimales.

import { money, type Currency, type Money } from '../money.ts';

export type AmountError = 'ambiguous' | 'invalid';

const SUFFIXES: Record<string, number> = { k: 1_000, mil: 1_000, m: 1_000_000 };
// "12.000", "1.234.567" o "12000", con hasta 2 decimales después de la coma.
const PLAIN = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;
const SUFFIXED = /^([\d.,]+)(k|mil|m)$/i;

function toMinor(intPart: string, fracPart: string): number | null {
  const minor = Number(intPart) * 100 + Number(fracPart.padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

/**
 * Monto en centavos. `12.5` es ambiguo (¿doce y medio o doce mil quinientos?) y nunca se adivina.
 * Sufijos: `k` y `mil` (miles) y `M` (millones), con decimales: `1,5k` = 1500.
 */
export function parseAmountMinor(text: string): { minor: number } | { error: AmountError } {
  const t = text.trim();
  const suffixed = SUFFIXED.exec(t);
  if (suffixed) {
    const [, base = '', suffix = ''] = suffixed;
    const inner = parseAmountMinor(base);
    if ('error' in inner) return inner;
    const minor = inner.minor * (SUFFIXES[suffix.toLowerCase()] ?? 1);
    return Number.isSafeInteger(minor) ? { minor } : { error: 'invalid' };
  }
  const plain = PLAIN.exec(t);
  if (plain) {
    const [, intPart = '', fracPart = ''] = plain;
    const minor = toMinor(intPart.replaceAll('.', ''), fracPart);
    return minor === null ? { error: 'invalid' } : { minor };
  }
  // Un punto que no separa grupos de 3 ("12.5", "1.50") o una coma con más de 2 decimales ("12,345").
  if (/^[\d.,]+$/.test(t) && /\d/.test(t)) return { error: 'ambiguous' };
  return { error: 'invalid' };
}

export function parseAmount(text: string, currency: Currency): { value: Money } | { error: AmountError } {
  const result = parseAmountMinor(text);
  return 'error' in result ? result : { value: money(result.minor, currency) };
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formatea el campo Monto mientras se escribe: "86500" → "86.500". Los puntos que llegan se toman
 * como separadores de miles (son los que puso el formato), salvo un punto recién tecleado al final
 * sin coma antes, que es la coma decimal de los teclados que no la tienen.
 * Admite como máximo 2 decimales: el tercero se descarta.
 * Para un texto pegado se usa `parseAmount`, que marca lo ambiguo.
 */
export function formatAmountInput(raw: string): { text: string; minor: number | null } {
  let s = raw.replace(/[^\d.,]/g, '');
  if (!s.includes(',') && s.endsWith('.')) s = `${s.slice(0, -1)},`;
  s = s.replaceAll('.', '');

  const comma = s.indexOf(',');
  let intDigits = comma === -1 ? s : s.slice(0, comma);
  const fracDigits = comma === -1 ? null : s.slice(comma + 1).replaceAll(',', '').slice(0, 2);

  intDigits = intDigits.replace(/^0+(?=\d)/, '');
  if (intDigits === '' && fracDigits !== null) intDigits = '0';
  if (intDigits === '') return { text: '', minor: null };

  const text = groupThousands(intDigits) + (fracDigits === null ? '' : `,${fracDigits}`);
  const minor = toMinor(intDigits, fracDigits ?? '');
  return { text, minor };
}
