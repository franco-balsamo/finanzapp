// Simplificar deudas (02 §7): el que más debe le paga al que más cobra. Como máximo N−1 transferencias.

import { money } from '../money.ts';
import { isSettled } from './balances.ts';
import type { Balances, Group, Transfer } from './types.ts';

interface Entry {
  memberId: string;
  order: number;
  amount: number;
}

/** De mayor a menor; los empates, por orden de ingreso al grupo, para que el resultado sea estable. */
const byAmountThenOrder = (a: Entry, b: Entry) => b.amount - a.amount || a.order - b.order;

/**
 * Pagan solo los que no están al día, y les pagan a todos los que tienen saldo a favor,
 * aunque ese saldo esté debajo del umbral: así una deuda visible nunca queda sin transferencias.
 */
export function simplifyDebts(group: Group, balances: Balances): Transfer[] {
  const debtors: Entry[] = [];
  const creditors: Entry[] = [];
  group.members.forEach((member, order) => {
    const balance = balances[member.id];
    if (!balance || balance.minor === 0) return;
    if (balance.currency !== group.currency) {
      throw new RangeError(`El saldo de ${member.id} no está en la moneda del grupo`);
    }
    const entry = { memberId: member.id, order, amount: Math.abs(balance.minor) };
    if (balance.minor > 0) creditors.push(entry);
    else if (!isSettled(balance)) debtors.push(entry);
  });

  const transfers: Transfer[] = [];
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byAmountThenOrder);
    creditors.sort(byAmountThenOrder);
    const debtor = debtors[0]!;
    const creditor = creditors[0]!;
    const amount = Math.min(debtor.amount, creditor.amount);
    transfers.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      amount: money(amount, group.currency),
    });
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) debtors.shift();
    if (creditor.amount === 0) creditors.shift();
  }
  return transfers;
}
