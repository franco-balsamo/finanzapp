// Texto del toast después de guardar un gasto (diseño 9A).

import { parseDate, type ISODate } from '../dates.ts';
import type { ByCurrency } from '../cards/types.ts';
import { formatTotal } from '../notices/format.ts';

export type SavedToastInput =
  /** Con tarjeta de crédito: el cierre del resumen donde entra (la primera cuota) y lo que viene en ese resumen. */
  | { kind: 'card'; closeDate: ISODate; statementTotal: ByCurrency }
  | { kind: 'account'; accountName: string };

/** "24/10". */
export function formatShortDate(date: ISODate): string {
  const { month, day } = parseDate(date);
  return `${day}/${month}`;
}

/**
 * - "Guardado · entra en el resumen del 24/10 (te vienen $273.500)"
 * - "Guardado · se descontó de Mercado Pago"
 */
export function savedToastText(input: SavedToastInput): string {
  if (input.kind === 'account') return `Guardado · se descontó de ${input.accountName}`;
  return `Guardado · entra en el resumen del ${formatShortDate(input.closeDate)} (te vienen ${formatTotal(input.statementTotal)})`;
}
