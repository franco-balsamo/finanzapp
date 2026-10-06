// Texto del toast después de guardar un gasto (diseño 9A).

import { parseDate, type ISODate } from '../dates.ts';
import type { ByCurrency } from '../cards/types.ts';
import type { Money } from '../money.ts';
import { formatMoney, formatTotal } from '../notices/format.ts';

export type SavedToastInput =
  /** Con tarjeta de crédito: el cierre del resumen donde entra (la primera cuota) y lo que viene en ese resumen. */
  | { kind: 'card'; closeDate: ISODate; statementTotal: ByCurrency }
  | { kind: 'account'; accountName: string }
  /** De grupo: tu parte y, si pagaste vos, lo que te deben de ese gasto (diseño 9A). */
  | { kind: 'group'; myShare: Money; owedToMe: Money | null };

/** "24/10". */
export function formatShortDate(date: ISODate): string {
  const { month, day } = parseDate(date);
  return `${day}/${month}`;
}

/**
 * - "Guardado · entra en el resumen del 24/10 (te vienen $273.500)"
 * - "Guardado · se descontó de Mercado Pago"
 * - "Guardado · tu parte $30.000; te deben $60.000"
 */
export function savedToastText(input: SavedToastInput): string {
  if (input.kind === 'group') {
    const owed = input.owedToMe && input.owedToMe.minor > 0 ? `; te deben ${formatMoney(input.owedToMe)}` : '';
    return `Guardado · tu parte ${formatMoney(input.myShare)}${owed}`;
  }
  if (input.kind === 'account') return `Guardado · se descontó de ${input.accountName}`;
  return `Guardado · entra en el resumen del ${formatShortDate(input.closeDate)} (te vienen ${formatTotal(input.statementTotal)})`;
}
