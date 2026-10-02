// Gastos cargados tarde en un resumen ya cerrado (02 §3, R3-3 y R3-4).
// Core solo propone: si la persona contesta "Sí", la app guarda los pagos propuestos.

import type { ISODate, Period } from '../dates';
import { add, convert, money, zero, type Currency, type Money, type Rate } from '../money';
import { closeDate, installmentSchedule } from './schedule';
import { assertPayment, cardState, isActivePayment } from './state';
import type { CardExpense, CreditCard, StatementOverride, StatementPayment } from './types';

export interface LateExpenseInput {
  card: CreditCard;
  /** El gasto que se está cargando. */
  expense: CardExpense;
  /** Los demás gastos de la tarjeta (si incluye `expense`, se ignora). */
  expenses: readonly CardExpense[];
  payments: readonly StatementPayment[];
  overrides: readonly StatementOverride[];
  today: ISODate;
  /** Dólar tarjeta de hoy, para cuando no hay un pago anterior en esa moneda. */
  fxCard: Rate;
}

export interface ProposedPayment {
  period: Period;
  appliesTo: Currency;
  amount: Money;
  fromAccountId: string;
  debitedAmount: Money;
  fxCardRate: Rate | null;
  paidAt: ISODate;
}

export interface LateExpenseImpact {
  /** Alguna cuota cae en un resumen que ya cerró. */
  isLate: boolean;
  /** Alguno de esos resúmenes estaba pagado: se pregunta una sola vez "¿Ya lo pagaste?". */
  askAlreadyPaid: boolean;
  /** Uno por resumen pagado afectado. */
  proposedPayments: ProposedPayment[];
}

/** El pago vigente más reciente; si empatan en fecha, el último del array. */
function lastPayment(payments: readonly StatementPayment[]): StatementPayment | undefined {
  let last: StatementPayment | undefined;
  for (const p of payments) {
    if (!last || p.paidAt >= last.paidAt) last = p;
  }
  return last;
}

function propose(
  period: Period,
  amount: Money,
  periodPayments: readonly StatementPayment[],
  fxCard: Rate,
): ProposedPayment {
  const sameCurrency = lastPayment(periodPayments.filter((p) => p.appliesTo === amount.currency));
  // Si esa parte nunca se pagó: cuenta y fecha del último pago del resumen, con el dólar tarjeta de hoy.
  const source = sameCurrency ?? lastPayment(periodPayments);
  if (!source) throw new Error(`El resumen ${period} no tiene pagos`);
  // Dólares pagados en pesos: con el dólar tarjeta de ese último pago (R3-4). assertPayment garantiza que exista.
  const fx = sameCurrency?.fxCardRate ?? fxCard;
  const accountCurrency = source.debitedAmount.currency;
  return {
    period,
    appliesTo: amount.currency,
    amount,
    fromAccountId: source.fromAccountId,
    debitedAmount: convert(amount, fx, accountCurrency),
    fxCardRate: accountCurrency === amount.currency ? null : fx,
    paidAt: source.paidAt,
  };
}

export function lateExpenseImpact(input: LateExpenseInput): LateExpenseImpact {
  const { card, expense, payments, overrides, today, fxCard } = input;
  payments.forEach(assertPayment);

  const lateByPeriod = new Map<Period, Money>();
  for (const installment of installmentSchedule(card, expense, overrides)) {
    if (closeDate(card, installment.period, overrides) < today) {
      const previous = lateByPeriod.get(installment.period) ?? zero(installment.amount.currency);
      lateByPeriod.set(installment.period, add(previous, installment.amount));
    }
  }
  if (lateByPeriod.size === 0) {
    return { isLate: false, askAlreadyPaid: false, proposedPayments: [] };
  }

  const before = cardState({
    card,
    expenses: input.expenses.filter((e) => e.id !== expense.id),
    payments,
    overrides,
    today,
    fxCard,
  });

  const proposedPayments: ProposedPayment[] = [];
  for (const [period, amount] of lateByPeriod) {
    const periodPayments = payments.filter((p) => p.period === period && isActivePayment(p));
    const statement = before.statements.find((s) => s.period === period);
    // Un resumen de $0 sin pagos también figura como pagado, pero no hay nada que preguntar.
    const wasPaid = statement?.status === 'paid' && periodPayments.length > 0;
    if (!wasPaid) continue;
    // Si el resumen se había pagado de más, el excedente cubre primero el gasto nuevo.
    const uncovered = amount.minor - statement.overpaid[amount.currency].minor;
    if (uncovered > 0) {
      proposedPayments.push(propose(period, money(uncovered, amount.currency), periodPayments, fxCard));
    }
  }

  return {
    isLate: true,
    askAlreadyPaid: proposedPayments.length > 0,
    proposedPayments,
  };
}
