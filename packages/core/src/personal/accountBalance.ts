// Saldo de una cuenta calculado a partir de los movimientos (02 §2). Nunca se guarda.

import { add, subtract, type Money } from '../money.ts';
import { isActivePayment } from '../cards/state.ts';
import type { StatementPayment } from '../cards/types.ts';
import type { Account, Movement } from './types.ts';

/** Lo que el movimiento movió en la moneda de la cuenta (D12). */
function inAccountCurrency(account: Account, movement: Movement): Money {
  const value = movement.debitedAmount ?? movement.amount;
  if (value.currency !== account.currency) {
    throw new RangeError(
      `El movimiento ${movement.id} está en ${value.currency} y la cuenta ${account.id} en ${account.currency}: falta debitedAmount`,
    );
  }
  return value;
}

function sameCurrency(account: Account, value: Money, id: string): Money {
  if (value.currency !== account.currency) {
    throw new RangeError(`${id} está en ${value.currency} y la cuenta ${account.id} en ${account.currency}`);
  }
  return value;
}

export function accountBalance(
  account: Account,
  movements: readonly Movement[],
  payments: readonly StatementPayment[],
): Money {
  let balance = account.openingBalance;

  for (const m of movements) {
    const fromHere = m.accountId === account.id;
    switch (m.type) {
      case 'expense':
      case 'card_payment':
        if (fromHere) balance = subtract(balance, inAccountCurrency(account, m));
        break;
      case 'income':
        if (fromHere) balance = add(balance, inAccountCurrency(account, m));
        break;
      case 'adjustment':
        if (fromHere) balance = add(balance, sameCurrency(account, m.amount, m.id));
        break;
      case 'transfer':
        if (fromHere) balance = subtract(balance, inAccountCurrency(account, m));
        if (m.toAccountId === account.id) balance = add(balance, sameCurrency(account, m.amount, m.id));
        break;
    }
  }

  for (const p of payments) {
    if (p.fromAccountId === account.id && isActivePayment(p)) {
      balance = subtract(balance, sameCurrency(account, p.debitedAmount, p.id));
    }
  }

  return balance;
}
