// Dinero en centavos enteros (D8). Toda conversión entre monedas pasa por convert().

export type Currency = 'ARS' | 'USD';
export const CURRENCIES: readonly Currency[] = ['ARS', 'USD'];

export interface Money {
  readonly minor: number;
  readonly currency: Currency;
}

/** Cotización como string decimal ('2028.00'), nunca como number. */
export type Rate = string & { readonly __brand: 'Rate' };

/** Valor numeric(14,2) tal como viene de la base ('86500.00'). */
export type DbNumeric = string & { readonly __brand: 'DbNumeric' };

const RATE_SCALE = 1_000_000n;
const RATE_PATTERN = /^(\d+)(?:\.(\d{1,6}))?$/;
const DB_NUMERIC_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

function assertCurrency(currency: string): asserts currency is Currency {
  if (!CURRENCIES.includes(currency as Currency)) {
    throw new TypeError(`Moneda desconocida: ${currency}`);
  }
}

export function money(minor: number, currency: Currency): Money {
  if (!Number.isSafeInteger(minor)) {
    throw new TypeError(`El monto tiene que ser un entero de centavos: ${minor}`);
  }
  assertCurrency(currency);
  // Evita -0, que rompe comparaciones con toEqual.
  return { minor: minor === 0 ? 0 : minor, currency };
}

export function zero(currency: Currency): Money {
  return money(0, currency);
}

export function rate(s: string): Rate {
  const match = RATE_PATTERN.exec(s);
  if (!match || rateToScaled(s as Rate) === 0n) {
    throw new RangeError(`Cotización inválida: ${s}`);
  }
  return s as Rate;
}

function rateToScaled(r: Rate): bigint {
  const match = RATE_PATTERN.exec(r);
  if (!match) throw new RangeError(`Cotización inválida: ${r}`);
  const [, intPart = '0', fracPart = ''] = match;
  return BigInt(intPart) * RATE_SCALE + BigInt(fracPart.padEnd(6, '0'));
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(`No se pueden combinar ${a.currency} y ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor - b.minor, a.currency);
}

export function negate(m: Money): Money {
  return money(-m.minor, m.currency);
}

/** División entera con redondeo half-up alejándose del cero. `den` siempre positivo. */
function roundDiv(num: bigint, den: bigint): bigint {
  const quotient = num / den;
  const remainder = num % den;
  const absRemainder = remainder < 0n ? -remainder : remainder;
  if (absRemainder * 2n >= den) {
    return quotient + (num < 0n ? -1n : 1n);
  }
  return quotient;
}

function toSafeMinor(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`El monto convertido se pasa del rango: ${value}`);
  }
  return result;
}

/**
 * Convierte con la cotización en pesos por dólar: USD→ARS multiplica y ARS→USD divide.
 * Redondea al centavo con half-up alejándose del cero.
 */
export function convert(m: Money, r: Rate, to: Currency): Money {
  assertCurrency(to);
  if (m.currency === to) return money(m.minor, to);

  const scaled = rateToScaled(r);
  const minor = BigInt(m.minor);
  const result =
    to === 'ARS' ? roundDiv(minor * scaled, RATE_SCALE) : roundDiv(minor * RATE_SCALE, scaled);
  return money(toSafeMinor(result), to);
}

export function fromDbNumeric(s: DbNumeric | string, currency: Currency): Money {
  const match = DB_NUMERIC_PATTERN.exec(s);
  if (!match) {
    throw new RangeError(`Monto de la base inválido: ${s}`);
  }
  const [, sign, intPart = '0', fracPart = ''] = match;
  const abs = BigInt(intPart) * 100n + BigInt(fracPart.padEnd(2, '0'));
  return money(toSafeMinor(sign ? -abs : abs), currency);
}

export function toDbNumeric(m: Money): DbNumeric {
  const abs = Math.abs(m.minor);
  const sign = m.minor < 0 ? '-' : '';
  const intPart = Math.floor(abs / 100);
  const fracPart = String(abs % 100).padStart(2, '0');
  return `${sign}${intPart}.${fracPart}` as DbNumeric;
}
