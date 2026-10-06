// Textos de "¿Ya lo pagaste?" (02 §3, D-6): la pregunta, cada pago propuesto y el final del toast.

import type { ProposedPayment } from '../cards/late.ts';
import type { ISODate, Period } from '../dates.ts';
import { add, zero } from '../money.ts';
import { formatMoney, formatTotal } from '../notices/format.ts';
import { formatShortDate } from './toast.ts';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "septiembre", o "diciembre de 2025" si no es de este año. */
export function periodMonthName(period: Period, today: ISODate): string {
  const [year, month] = period.split('-').map(Number) as [number, number];
  const name = MONTHS[month - 1]!;
  return year === Number(today.slice(0, 4)) ? name : `${name} de ${year}`;
}

function joinWithY(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}

/** "¿Ya lo pagaste con el resumen de septiembre?" o "… con los resúmenes de julio, agosto y septiembre?". */
export function alreadyPaidQuestion(payments: readonly ProposedPayment[], today: ISODate): string {
  const periods = [...new Set(payments.map((p) => p.period))].sort();
  const names = periods.map((p) => periodMonthName(p, today));
  return periods.length === 1
    ? `¿Ya lo pagaste con el resumen de ${names[0]}?`
    : `¿Ya lo pagaste con los resúmenes de ${joinWithY(names)}?`;
}

/** "Pago de $12.000 desde Mercado Pago, 6/10": lo que sale de la cuenta, en su moneda. */
export function proposedPaymentText(payment: ProposedPayment, accountName: string): string {
  return `Pago de ${formatMoney(payment.debitedAmount)} desde ${accountName}, ${formatShortDate(payment.paidAt)}`;
}

/** " · pago de $12.000 registrado", " · pagos de $36.000 registrados" o "" si no hay pagos. */
export function paymentsToastSuffix(payments: readonly ProposedPayment[]): string {
  if (!payments.length) return '';
  const total = { ARS: zero('ARS'), USD: zero('USD') };
  for (const p of payments) total[p.debitedAmount.currency] = add(total[p.debitedAmount.currency], p.debitedAmount);
  return payments.length === 1
    ? ` · pago de ${formatTotal(total)} registrado`
    : ` · pagos de ${formatTotal(total)} registrados`;
}
