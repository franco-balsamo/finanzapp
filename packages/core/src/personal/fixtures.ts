// Datos de prueba de finanzas personales. No se exporta desde index.ts.

import type { Money } from '../money';
import type { Movement } from './types';

export function movement(id: string, fields: Partial<Movement> & Pick<Movement, 'type' | 'date' | 'amount'>): Movement {
  return {
    id,
    categoryId: null,
    cardId: null,
    accountId: null,
    toAccountId: null,
    installments: 1,
    myShare: null,
    groupExpenseId: null,
    fx: { mep: null, oficial: null, blue: null },
    fxPending: false,
    debitedAmount: null,
    ...fields,
  };
}

export const expenseFrom = (
  id: string,
  date: string,
  amount: Money,
  fields: Partial<Movement> = {},
): Movement => movement(id, { type: 'expense', date, amount, ...fields });
