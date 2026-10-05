import { formatAmountInput, toDbNumeric, money, validateCardDays, type CardNetwork } from '@mangos/core';
import { cardColors } from '../theme/tokens';

/** Lo que se escribe en el formulario de tarjeta, como texto. */
export interface CardFormValue {
  bank: string;
  name: string;
  network: CardNetwork | null;
  last4: string;
  expiry: string;
  closeDay: string;
  dueDay: string;
  /** Texto formateado del límite ("2.000.000"). */
  limit: string;
}

export type CardFormErrors = Partial<Record<keyof CardFormValue, string>>;

export const EMPTY_CARD: CardFormValue = {
  bank: '',
  name: '',
  network: null,
  last4: '',
  expiry: '',
  closeDay: '',
  dueDay: '',
  limit: '',
};

/** Bancos y billeteras sugeridos (los del prototipo). */
export const BANK_SUGGESTIONS = [
  'Banco Galicia', 'Santander', 'BBVA', 'Banco Nación', 'Banco Provincia', 'Macro', 'ICBC', 'HSBC',
  'Banco Ciudad', 'Brubank', 'Naranja X', 'Mercado Pago', 'Ualá', 'Personal Pay',
];

export const NETWORK_OPTIONS = [
  { value: 'VISA', label: 'Visa' },
  { value: 'MC', label: 'Mastercard' },
  { value: 'AMEX', label: 'Amex' },
  { value: 'CABAL', label: 'Cabal' },
] as const satisfies readonly { value: CardNetwork; label: string }[];

/** "0730" → "07/30" mientras se escribe. */
export function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

function day(text: string): number | null {
  const n = Number(text);
  return /^\d{1,2}$/.test(text) && n >= 1 && n <= 31 ? n : null;
}

/** Errores en voseo, o null si se puede guardar. */
export function validateCard(v: CardFormValue): CardFormErrors | null {
  const errors: CardFormErrors = {};
  if (!v.bank.trim()) errors.bank = 'Poné el banco o la billetera.';
  if (!v.name.trim()) errors.name = 'Ponele un nombre, por ejemplo "Visa Galicia".';
  if (!v.network) errors.network = 'Elegí la red.';
  if (!/^\d{4}$/.test(v.last4)) errors.last4 = 'Poné los últimos 4 números de la tarjeta.';
  if (v.expiry && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(v.expiry)) errors.expiry = 'El vencimiento va como MM/AA.';
  const close = day(v.closeDay);
  const due = day(v.dueDay);
  if (close === null) errors.closeDay = 'Va del 1 al 31.';
  if (due === null) errors.dueDay = 'Va del 1 al 31.';
  if (close !== null && due !== null && !validateCardDays(close, due).ok) {
    errors.dueDay = 'El vencimiento tiene que quedar al menos 5 días después del cierre.';
  }
  return Object.keys(errors).length ? errors : null;
}

/** El primer color de plástico que no usa otra tarjeta activa; si están todos, se repite en orden. */
export function nextCardColor(usedColors: readonly (string | null)[]): string {
  const palette = cardColors.credit.map((c) => c.base);
  return palette.find((c) => !usedColors.includes(c)) ?? palette[usedColors.length % palette.length]!;
}

/** La fila para `insert` en `cards`. Llamar solo después de `validateCard`. */
export function cardInsert(v: CardFormValue, opts: { color: string; isFavorite: boolean }) {
  const limitMinor = formatAmountInput(v.limit).minor;
  return {
    bank: v.bank.trim(),
    name: v.name.trim(),
    network: v.network!,
    last4: v.last4,
    expiry: v.expiry || null,
    close_day: Number(v.closeDay),
    due_day: Number(v.dueDay),
    credit_limit: limitMinor === null ? null : toDbNumeric(money(limitMinor, 'ARS')),
    color: opts.color,
    is_favorite: opts.isFavorite,
  };
}
