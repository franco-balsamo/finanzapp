// Estado de una tarjeta de crédito: resúmenes, saldo pendiente y límite usado (02 §3).

import type { ISODate, Period } from '../dates';
import { add, convert, subtract, zero, type Currency, type Money, type Rate } from '../money';
import { closeDate, dueDate, installmentSchedule, statementFor } from './schedule';
import type {
  ByCurrency,
  CardExpense,
  CreditCard,
  StatementOverride,
  StatementPayment,
  StatementStatus,
  StatementView,
} from './types';

export interface CardStateInput {
  card: CreditCard;
  expenses: readonly CardExpense[];
  payments: readonly StatementPayment[];
  overrides: readonly StatementOverride[];
  today: ISODate;
  /** Dólar tarjeta de hoy: convierte la parte en dólares para el límite usado. */
  fxCard: Rate;
}

export interface CardState {
  currentPeriod: Period;
  statements: StatementView[];
  /** Resúmenes cerrados con saldo pendiente, el más próximo a vencer primero. */
  toPay: StatementView[];
  /** En pesos: todo lo que falta pagar, con los dólares a dólar tarjeta. */
  limitUsed: Money;
  available: Money;
}

const emptyByCurrency = (): ByCurrency => ({ ARS: zero('ARS'), USD: zero('USD') });

const max0 = (m: Money): Money => (m.minor < 0 ? zero(m.currency) : m);

function hasAmount(b: ByCurrency): boolean {
  return b.ARS.minor > 0 || b.USD.minor > 0;
}

function addTo(b: ByCurrency, m: Money): void {
  b[m.currency] = add(b[m.currency], m);
}

export function isActivePayment(p: StatementPayment): boolean {
  return p.revertedAt === null;
}

export function assertPayment(p: StatementPayment): void {
  if (p.amount.currency !== p.appliesTo) {
    throw new RangeError(`El pago ${p.id} cubre ${p.appliesTo} pero el monto está en ${p.amount.currency}`);
  }
}

function statusOf(
  period: Period,
  currentPeriod: Period,
  due: ISODate,
  today: ISODate,
  pending: ByCurrency,
  hasActivePayments: boolean,
): StatementStatus {
  if (period > currentPeriod) return 'future';
  if (period === currentPeriod) return 'current';
  if (!hasAmount(pending)) return 'paid';
  if (today > due) return 'overdue';
  return hasActivePayments ? 'partial' : 'to_pay';
}

export function cardState(input: CardStateInput): CardState {
  const { card, expenses, payments, overrides, today, fxCard } = input;
  if (card.creditLimit.currency !== 'ARS') {
    throw new RangeError('El límite de la tarjeta va en pesos');
  }
  payments.forEach(assertPayment);

  const currentPeriod = statementFor(card, today, overrides);
  const items = new Map<Period, StatementView['items']>();
  for (const expense of expenses) {
    for (const installment of installmentSchedule(card, expense, overrides)) {
      const list = items.get(installment.period) ?? [];
      list.push({
        expenseId: expense.id,
        index: installment.index,
        of: installment.of,
        amount: installment.amount,
      });
      items.set(installment.period, list);
    }
  }

  const periods = new Set<Period>([currentPeriod, ...items.keys(), ...payments.map((p) => p.period)]);
  const statements = [...periods].sort().map((period): StatementView => {
    const periodItems = items.get(period) ?? [];
    const periodPayments = payments.filter((p) => p.period === period && isActivePayment(p));

    const total = emptyByCurrency();
    periodItems.forEach((item) => addTo(total, item.amount));
    const paid = emptyByCurrency();
    periodPayments.forEach((p) => addTo(paid, p.amount));

    const pending: ByCurrency = {
      ARS: max0(subtract(total.ARS, paid.ARS)),
      USD: max0(subtract(total.USD, paid.USD)),
    };
    const overpaid: ByCurrency = {
      ARS: max0(subtract(paid.ARS, total.ARS)),
      USD: max0(subtract(paid.USD, total.USD)),
    };
    const due = dueDate(card, period, overrides);

    return {
      period,
      closeDate: closeDate(card, period, overrides),
      dueDate: due,
      status: statusOf(period, currentPeriod, due, today, pending, periodPayments.length > 0),
      total,
      paid,
      pending,
      overpaid,
      items: periodItems,
    };
  });

  const toPay = statements
    .filter((s) => s.period < currentPeriod && hasAmount(s.pending))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

  const pendingSum = (currency: Currency) =>
    statements.reduce((sum, s) => add(sum, s.pending[currency]), zero(currency));
  // Los dólares se suman primero y se convierten una sola vez.
  const limitUsed = add(pendingSum('ARS'), convert(pendingSum('USD'), fxCard, 'ARS'));
  const available = max0(subtract(card.creditLimit, limitUsed));

  return { currentPeriod, statements, toPay, limitUsed, available };
}
