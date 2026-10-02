// Cómo se divide un gasto de grupo (02 §7, D9). Las partes siempre suman el total exacto.

import { convert, money, type Money } from '../money';
import type { Balances, Group, GroupExpense } from './types';

/** Diferencia máxima entre la suma de los montos exactos y el total: $0,50 o US$ 0,50. */
const EXACT_TOLERANCE_MINOR = 50;

function toGroupCurrency(group: Group, expense: GroupExpense, m: Money): Money {
  if (m.currency === group.currency) return m;
  if (!expense.fxRate) {
    throw new RangeError(`El gasto ${expense.id} está en otra moneda y no tiene cotización`);
  }
  return convert(m, expense.fxRate, group.currency);
}

/** Las partes de cada incluido, en la moneda del grupo. Los excluidos no aparecen. */
export function shares(group: Group, expense: GroupExpense): Balances {
  const memberIds = group.members.map((m) => m.id);
  for (const part of expense.parts) {
    if (!memberIds.includes(part.memberId)) {
      throw new RangeError(`${part.memberId} no es integrante del grupo ${group.id}`);
    }
  }
  if (!memberIds.includes(expense.payerMemberId)) {
    throw new RangeError(`${expense.payerMemberId} no es integrante del grupo ${group.id}`);
  }

  // Incluidos en el orden del grupo.
  const included = memberIds.filter((id) => expense.parts.some((p) => p.memberId === id));
  const first = included[0];
  if (first === undefined) {
    throw new RangeError(`El gasto ${expense.id} no tiene a nadie incluido`);
  }
  // El resto va al que pagó, o al primer incluido si el que pagó quedó afuera.
  const remainderTo = included.includes(expense.payerMemberId) ? expense.payerMemberId : first;
  const total = toGroupCurrency(group, expense, expense.amount);
  const result: Record<string, number> = {};

  if (expense.splitMode === 'equal') {
    const base = Math.trunc(total.minor / included.length);
    for (const id of included) result[id] = base;
  } else {
    let sum = 0;
    for (const part of expense.parts) {
      if (!part.value || part.value.currency !== expense.amount.currency) {
        throw new RangeError(`En montos exactos cada parte va en la moneda del gasto (${part.memberId})`);
      }
      sum += part.value.minor;
    }
    if (Math.abs(expense.amount.minor - sum) > EXACT_TOLERANCE_MINOR) {
      throw new RangeError(`Los montos exactos no suman el total del gasto ${expense.id}`);
    }
    for (const part of expense.parts) {
      result[part.memberId] = toGroupCurrency(group, expense, part.value!).minor;
    }
  }

  const assigned = Object.values(result).reduce((a, b) => a + b, 0);
  result[remainderTo] = (result[remainderTo] ?? 0) + (total.minor - assigned);

  return Object.fromEntries(
    included.map((id) => [id, money(result[id] ?? 0, group.currency)]),
  );
}
