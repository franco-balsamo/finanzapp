// En qué resumen entra cada compra y cada cuota (02 §3, D9, D10, D11).

import { addMonths, clampedDate, daysBetween, parseDate, periodOf, type ISODate, type Period } from '../dates';
import { money } from '../money';
import type { CardExpense, CreditCard, Installment, StatementOverride } from './types';

const OVERRIDE_TOLERANCE_DAYS = 10;
const MAX_INSTALLMENTS = 24;

function findOverride(overrides: readonly StatementOverride[], period: Period) {
  const override = overrides.find((o) => o.period === period);
  if (override) {
    // Las fechas se comparan como texto: tienen que venir completas ('YYYY-MM-DD').
    parseDate(override.closeDate);
    parseDate(override.dueDate);
  }
  return override;
}

function assertDay(day: number, label: string): void {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new RangeError(`${label} tiene que ser de 1 a 31: ${day}`);
  }
}

export function closeDate(
  card: CreditCard,
  period: Period,
  overrides: readonly StatementOverride[] = [],
): ISODate {
  const override = findOverride(overrides, period);
  if (override) return override.closeDate;
  assertDay(card.closeDay, 'El día de cierre');
  return clampedDate(period, card.closeDay);
}

export function dueDate(
  card: CreditCard,
  period: Period,
  overrides: readonly StatementOverride[] = [],
): ISODate {
  const override = findOverride(overrides, period);
  if (override) return override.dueDate;
  assertDay(card.dueDay, 'El día de vencimiento');
  assertDay(card.closeDay, 'El día de cierre');
  // Se comparan los días configurados, antes de ajustar al último día del mes (D11).
  const duePeriod = card.dueDay > card.closeDay ? period : addMonths(period, 1);
  const due = clampedDate(duePeriod, card.dueDay);
  // Si al ajustar a un mes corto el vencimiento no queda después del cierre, pasa al mes siguiente.
  return due > clampedDate(period, card.closeDay) ? due : clampedDate(addMonths(duePeriod, 1), card.dueDay);
}

/** Resumen en el que entra una compra: el día de cierre o antes, ese mes; después, el siguiente. */
export function statementFor(
  card: CreditCard,
  date: ISODate,
  overrides: readonly StatementOverride[] = [],
): Period {
  const base = periodOf(date);
  // Una corrección de ±10 días puede correr un cierre al mes anterior o al siguiente,
  // así que se mira desde el mes anterior hasta dos meses después.
  for (const period of [addMonths(base, -1), base, addMonths(base, 1), addMonths(base, 2)]) {
    const previousClose = closeDate(card, addMonths(period, -1), overrides);
    if (previousClose < date && date <= closeDate(card, period, overrides)) {
      return period;
    }
  }
  throw new RangeError(`Los cierres corregidos dejan la fecha ${date} sin resumen`);
}

export type OverrideCheck =
  | { ok: true }
  | {
      ok: false;
      reason: 'out_of_range' | 'not_after_previous' | 'not_before_next' | 'due_before_close';
    };

/** El cierre corregido tiene que quedar a ±10 días del estimado y entre los cierres vecinos (D10). */
export function validateOverride(
  card: CreditCard,
  period: Period,
  override: Omit<StatementOverride, 'period'>,
  overrides: readonly StatementOverride[] = [],
): OverrideCheck {
  parseDate(override.closeDate);
  parseDate(override.dueDate);
  const others = overrides.filter((o) => o.period !== period);
  const estimated = closeDate(card, period);
  if (Math.abs(daysBetween(estimated, override.closeDate)) > OVERRIDE_TOLERANCE_DAYS) {
    return { ok: false, reason: 'out_of_range' };
  }
  if (override.closeDate <= closeDate(card, addMonths(period, -1), others)) {
    return { ok: false, reason: 'not_after_previous' };
  }
  if (override.closeDate >= closeDate(card, addMonths(period, 1), others)) {
    return { ok: false, reason: 'not_before_next' };
  }
  if (override.dueDate <= override.closeDate) {
    return { ok: false, reason: 'due_before_close' };
  }
  return { ok: true };
}

/** La cuota k va al resumen de la compra + k meses. El resto de la división va a la primera (D9). */
export function installmentSchedule(
  card: CreditCard,
  expense: CardExpense,
  overrides: readonly StatementOverride[] = [],
): Installment[] {
  const n = expense.installments;
  if (!Number.isInteger(n) || n < 1 || n > MAX_INSTALLMENTS) {
    throw new RangeError(`Las cuotas tienen que ser de 1 a ${MAX_INSTALLMENTS}: ${n}`);
  }
  if (expense.amount.minor <= 0) {
    throw new RangeError(`El monto del gasto ${expense.id} tiene que ser mayor a cero`);
  }
  const first = statementFor(card, expense.date, overrides);
  const total = expense.amount.minor;
  const base = Math.trunc(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, k) => ({
    index: k + 1,
    of: n,
    period: addMonths(first, k),
    amount: money(k === 0 ? base + remainder : base, expense.amount.currency),
  }));
}
