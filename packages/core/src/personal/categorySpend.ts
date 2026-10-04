// Gasto del mes por categoría (02 §6): solo tu parte, y las cuotas en el mes de cierre de su resumen.

import { periodOf, type Period } from '../dates.ts';
import { add, convert, zero, type Money, type Rate } from '../money.ts';
import { installmentSchedule } from '../cards/schedule.ts';
import type { CreditCard, StatementOverride } from '../cards/types.ts';
import type { FxReference, Movement } from './types.ts';

/** Clave para los gastos sin categoría. */
export const UNCATEGORIZED = 'none';

export interface CategorySpendInput {
  movements: readonly Movement[];
  cards: readonly { card: CreditCard; overrides: readonly StatementOverride[] }[];
  /** Mes calendario; para tarjetas, el mes de cierre del resumen. */
  month: Period;
  reference: FxReference;
  /** Cotización de hoy del dólar de referencia, para movimientos sin cotización guardada. */
  todayRate: Rate;
}

export interface CategorySpend {
  /** En pesos. */
  byCategory: Record<string, Money>;
  total: Money;
  /** Algún gasto en dólares usó la cotización de hoy porque faltaba la de su fecha. */
  approximate: boolean;
}

export function categorySpend(input: CategorySpendInput): CategorySpend {
  const { movements, cards, month, reference, todayRate } = input;
  const byCategory: Record<string, Money> = {};
  let total = zero('ARS');
  let approximate = false;

  for (const m of movements) {
    if (m.type !== 'expense') continue;
    // Si viene de un grupo, cuenta solo tu parte. Si se desvinculó del grupo, cuenta completo.
    const base = m.groupExpenseId !== null && m.myShare !== null ? m.myShare : m.amount;
    if (base.currency !== m.amount.currency) {
      throw new RangeError(`La parte propia del movimiento ${m.id} no está en su moneda`);
    }

    let portions: Money[];
    if (m.cardId !== null) {
      const entry = cards.find((c) => c.card.id === m.cardId);
      if (!entry) throw new RangeError(`Falta la tarjeta ${m.cardId} del movimiento ${m.id}`);
      portions = installmentSchedule(
        entry.card,
        { id: m.id, date: m.date, amount: base, installments: m.installments },
        entry.overrides,
      )
        .filter((i) => i.period === month)
        .map((i) => i.amount);
    } else {
      // Con cuenta, efectivo o "Sin medio de pago": cuenta en el mes de la fecha.
      portions = periodOf(m.date) === month ? [base] : [];
    }

    for (const portion of portions) {
      let inPesos = portion;
      if (portion.currency === 'USD') {
        const stored = m.fxPending ? null : m.fx[reference];
        if (!stored) approximate = true;
        inPesos = convert(portion, stored ?? todayRate, 'ARS');
      }
      const key = m.categoryId ?? UNCATEGORIZED;
      byCategory[key] = add(byCategory[key] ?? zero('ARS'), inPesos);
      total = add(total, inPesos);
    }
  }

  return { byCategory, total, approximate };
}
