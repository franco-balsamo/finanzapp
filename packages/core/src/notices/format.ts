// Montos y fechas para los textos de los avisos (02 §9), en castellano rioplatense.

import { parseDate, type ISODate } from '../dates.ts';
import type { Money } from '../money.ts';
import type { ByCurrency } from '../cards/types.ts';

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `$187.000`, `$187.000,50`, `US$ 50`. Los decimales solo si no son ,00. */
export function formatMoney(m: Money): string {
  const abs = Math.abs(m.minor);
  const sign = m.minor < 0 ? '-' : '';
  const cents = abs % 100;
  const amount = groupThousands(Math.floor(abs / 100)) + (cents ? `,${String(cents).padStart(2, '0')}` : '');
  return m.currency === 'ARS' ? `${sign}$${amount}` : `${sign}US$ ${amount}`;
}

/** `$187.000`, `US$ 50` o `$187.000 + US$ 50`. Sin nada en ninguna moneda: `$0`. */
export function formatTotal(total: ByCurrency): string {
  const parts = [total.ARS, total.USD].filter((m) => m.minor !== 0).map(formatMoney);
  return parts.length ? parts.join(' + ') : '$0';
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** `lunes 6/10`. */
export function formatDay(date: ISODate): string {
  const { year, month, day } = parseDate(date);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${day}/${month}`;
}

/** `a`, `a y b`, `a, b y c`. */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}
