// Saldo de cada integrante (02 §7). Positivo: le deben. Negativo: debe.

import { add, money, negate, zero, type Money } from '../money';
import { shares } from './shares';
import type { Balances, Group, GroupExpense, GroupPayment } from './types';

/** Debajo de esto el saldo se muestra como cero: $1 en pesos, US$ 0,01 en dólares (D14). */
const ZERO_THRESHOLD_MINOR = { ARS: 100, USD: 1 } as const;

export function groupBalances(
  group: Group,
  expenses: readonly GroupExpense[],
  payments: readonly GroupPayment[],
): Balances {
  const balances: Balances = Object.fromEntries(group.members.map((m) => [m.id, zero(group.currency)]));
  const apply = (memberId: string, delta: Money) => {
    const current = balances[memberId];
    if (!current) throw new RangeError(`${memberId} no es integrante del grupo ${group.id}`);
    balances[memberId] = add(current, delta);
  };

  for (const expense of expenses) {
    const parts = shares(group, expense);
    // Al que pagó se le suma la suma de las partes: así los saldos dan cero exacto.
    const total = Object.values(parts).reduce(add, zero(group.currency));
    apply(expense.payerMemberId, total);
    for (const [memberId, part] of Object.entries(parts)) apply(memberId, negate(part));
  }

  for (const payment of payments) {
    if (payment.amount.currency !== group.currency) {
      throw new RangeError(`El pago ${payment.id} no está en la moneda del grupo`);
    }
    if (payment.amount.minor <= 0) {
      throw new RangeError(`El pago ${payment.id} tiene que ser mayor a cero`);
    }
    apply(payment.fromMemberId, payment.amount);
    apply(payment.toMemberId, negate(payment.amount));
  }

  return balances;
}

/** El saldo como se muestra: cero si está debajo del umbral de su moneda. */
export function displayBalance(m: Money): Money {
  return Math.abs(m.minor) < ZERO_THRESHOLD_MINOR[m.currency] ? zero(m.currency) : money(m.minor, m.currency);
}

/**
 * "Al día" (02 §7): debajo del umbral de su moneda. Vale para mostrar, simplificar, abandonar,
 * quitar a un integrante y eliminar el grupo. El saldo exacto queda guardado igual.
 */
export function isSettled(m: Money): boolean {
  return displayBalance(m).minor === 0;
}
