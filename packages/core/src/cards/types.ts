import type { ISODate, Period } from '../dates.ts';
import type { Currency, Money, Rate } from '../money.ts';

export interface CreditCard {
  id: string;
  /** 1 a 31; en meses más cortos se usa el último día. */
  closeDay: number;
  /** 1 a 31; en meses más cortos se usa el último día. */
  dueDay: number;
  /** En pesos. */
  creditLimit: Money;
}

/** Fecha real de cierre y de vencimiento de un resumen, cuando el banco la corre. */
export interface StatementOverride {
  period: Period;
  closeDate: ISODate;
  dueDate: ISODate;
}

export interface CardExpense {
  id: string;
  date: ISODate;
  amount: Money;
  /** 1 a 24. */
  installments: number;
}

export interface StatementPayment {
  id: string;
  period: Period;
  /** Qué parte del resumen cubre. `amount.currency` tiene que coincidir. */
  appliesTo: Currency;
  amount: Money;
  fromAccountId: string;
  /** Lo que salió de la cuenta, en la moneda de la cuenta. */
  debitedAmount: Money;
  /** Dólar tarjeta usado si se pagaron dólares en pesos. */
  fxCardRate: Rate | null;
  paidAt: ISODate;
  revertedAt: ISODate | null;
}

export type StatementStatus = 'current' | 'future' | 'to_pay' | 'partial' | 'paid' | 'overdue';

export interface Installment {
  /** De 1 a `of`. */
  index: number;
  of: number;
  period: Period;
  amount: Money;
}

export interface ByCurrency {
  ARS: Money;
  USD: Money;
}

export interface StatementView {
  period: Period;
  closeDate: ISODate;
  dueDate: ISODate;
  status: StatementStatus;
  total: ByCurrency;
  /** Sin los pagos revertidos. */
  paid: ByCurrency;
  pending: ByCurrency;
  /** Lo pagado de más. En la v1 no pasa al resumen siguiente. */
  overpaid: ByCurrency;
  items: { expenseId: string; index: number; of: number; amount: Money }[];
}
