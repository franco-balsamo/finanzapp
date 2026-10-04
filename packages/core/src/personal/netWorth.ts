// Patrimonio del inicio (02 §8): cuentas + lo que te deben en grupos − lo que falta pagar de tarjetas.
// Cada componente se convierte una sola vez a la moneda en que se muestra, nunca de ida y vuelta.

import { add, convert, subtract, zero, type Currency, type Money, type Rate } from '../money.ts';
import type { ByCurrency } from '../cards/types.ts';

export interface NetWorthInput {
  display: Currency;
  /** Cotización de hoy del dólar de referencia. */
  referenceRate: Rate;
  /** Dólar tarjeta de hoy: solo pasa a pesos la deuda en dólares de las tarjetas. */
  fxCard: Rate;
  accountBalances: readonly Money[];
  /** Tu saldo en cada grupo, en la moneda del grupo. */
  myGroupBalances: readonly Money[];
  /** El `pendingTotal` de cada `cardState`: lo que falta pagar, en pesos y en dólares. */
  cardDebts: readonly ByCurrency[];
}

export interface NetWorth {
  accounts: Money;
  groups: Money;
  cards: Money;
  total: Money;
}

function sumByCurrency(values: readonly Money[]): ByCurrency {
  const sums: ByCurrency = { ARS: zero('ARS'), USD: zero('USD') };
  for (const v of values) sums[v.currency] = add(sums[v.currency], v);
  return sums;
}

/** Suma pesos y dólares por separado y convierte una sola vez la parte que no está en `display`. */
function inDisplay(sums: ByCurrency, display: Currency, usdToArs: Rate, arsToUsd: Rate): Money {
  return display === 'ARS'
    ? add(sums.ARS, convert(sums.USD, usdToArs, 'ARS'))
    : add(sums.USD, convert(sums.ARS, arsToUsd, 'USD'));
}

export function netWorth(input: NetWorthInput): NetWorth {
  const { display, referenceRate, fxCard } = input;
  const accounts = inDisplay(sumByCurrency(input.accountBalances), display, referenceRate, referenceRate);
  const groups = inDisplay(sumByCurrency(input.myGroupBalances), display, referenceRate, referenceRate);
  const cardSums = sumByCurrency(input.cardDebts.flatMap((d) => [d.ARS, d.USD]));
  // En pesos, la deuda en dólares se paga a dólar tarjeta. En dólares, va tal cual.
  const cards = inDisplay(cardSums, display, fxCard, referenceRate);
  return { accounts, groups, cards, total: subtract(add(accounts, groups), cards) };
}
