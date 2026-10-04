import type { ISODate } from '../dates.ts';
import type { Currency, Money, Rate } from '../money.ts';

export type FxReference = 'mep' | 'oficial' | 'blue';

export interface Account {
  id: string;
  currency: Currency;
  openingBalance: Money;
}

export type MovementType = 'expense' | 'income' | 'transfer' | 'adjustment' | 'card_payment';

export interface Movement {
  id: string;
  type: MovementType;
  date: ISODate;
  /** Monto total. En una transferencia, lo que entra a `toAccountId`. */
  amount: Money;
  categoryId: string | null;
  cardId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  installments: number;
  /** Si viene de un grupo: tu parte, en la moneda del movimiento. */
  myShare: Money | null;
  groupExpenseId: string | null;
  /** Cotizaciones de la fecha del gasto, guardadas por la base. */
  fx: Record<FxReference, Rate | null>;
  fxPending: boolean;
  /** Lo que salió de `accountId` en la moneda de esa cuenta, si difiere de `amount`. */
  debitedAmount: Money | null;
}
