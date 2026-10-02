// Patrimonio del inicio (02 §8): cuentas + lo que te deben en grupos − lo que falta pagar de tarjetas.

import { add, convert, subtract, zero, type Currency, type Money, type Rate } from '../money';

export interface NetWorthInput {
  display: Currency;
  /** Cotización de hoy del dólar de referencia. */
  referenceRate: Rate;
  accountBalances: readonly Money[];
  /** Tu saldo en cada grupo, en la moneda del grupo. */
  myGroupBalances: readonly Money[];
  /** El `limitUsed` de cada tarjeta: ya en pesos, con los dólares a dólar tarjeta. */
  cardDebts: readonly Money[];
}

export interface NetWorth {
  accounts: Money;
  groups: Money;
  cards: Money;
  total: Money;
}

/** Suma pesos y dólares por separado y convierte una sola vez la parte que no está en `display`. */
function block(values: readonly Money[], display: Currency, referenceRate: Rate): Money {
  const sums = { ARS: zero('ARS'), USD: zero('USD') };
  for (const v of values) sums[v.currency] = add(sums[v.currency], v);
  const other: Currency = display === 'ARS' ? 'USD' : 'ARS';
  return add(sums[display], convert(sums[other], referenceRate, display));
}

export function netWorth(input: NetWorthInput): NetWorth {
  const { display, referenceRate } = input;
  const accounts = block(input.accountBalances, display, referenceRate);
  const groups = block(input.myGroupBalances, display, referenceRate);
  const cards = block(input.cardDebts, display, referenceRate);
  return { accounts, groups, cards, total: subtract(add(accounts, groups), cards) };
}
