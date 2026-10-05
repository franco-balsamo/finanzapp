// Montos en palabras para el lector de pantalla (diseño 12A): "ochenta y seis mil quinientos pesos".

import type { Money } from '../money.ts';

const UNITS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete',
  'veintiocho', 'veintinueve',
];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos',
  'ochocientos', 'novecientos',
];

/** 0 a 999. */
function upTo999(n: number): string {
  if (n === 100) return 'cien';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]!);
  if (rest < 30) {
    if (rest || !h) parts.push(UNITS[rest]!);
  } else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    parts.push(u ? `${TENS[t]} y ${UNITS[u]}` : TENS[t]!);
  }
  return parts.join(' ');
}

/** "uno" pasa a "un" delante de un sustantivo: "veintiún mil", "un millón", "treinta y un pesos". */
function apocope(words: string): string {
  return words.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
}

/** Número entero no negativo en palabras. */
export function integerInWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`Número inválido: ${n}`);
  if (n < 1000) return upTo999(n);
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const head = thousands === 1 ? 'mil' : `${apocope(upTo999(thousands))} mil`;
    return rest ? `${head} ${upTo999(rest)}` : head;
  }
  const millions = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  const head = millions === 1 ? 'un millón' : `${apocope(integerInWords(millions))} millones`;
  return rest ? `${head} ${integerInWords(rest)}` : head;
}

/** "ochenta y seis mil quinientos pesos", "un dólar con cincuenta centavos", "menos mil pesos". */
export function moneyInWords(m: Money): string {
  const abs = Math.abs(m.minor);
  const units = Math.floor(abs / 100);
  const cents = abs % 100;
  const [one, many] = m.currency === 'ARS' ? ['peso', 'pesos'] : ['dólar', 'dólares'];
  // "un millón de pesos", "dos millones de pesos".
  const unitWords = units === 1 ? `un ${one}` : `${apocope(integerInWords(units))}${units % 1_000_000 === 0 && units ? ' de' : ''} ${many}`;
  const centWords = cents ? ` con ${cents === 1 ? 'un centavo' : `${apocope(integerInWords(cents))} centavos`}` : '';
  return `${m.minor < 0 ? 'menos ' : ''}${unitWords}${centWords}`;
}
