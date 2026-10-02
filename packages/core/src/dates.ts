// Fechas sin hora ni zona horaria. La app calcula "hoy" en hora de Argentina y lo pasa como parámetro.

/** 'YYYY-MM-DD' */
export type ISODate = string;
/** 'YYYY-MM': identifica un resumen por su mes de cierre. */
export type Period = string;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const PERIOD_PATTERN = /^(\d{4})-(\d{2})$/;

export function parseDate(date: ISODate): { year: number; month: number; day: number } {
  const match = ISO_DATE_PATTERN.exec(date);
  if (!match) throw new RangeError(`Fecha inválida: ${date}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > lastDayOfMonth(year, month)) {
    throw new RangeError(`Fecha inválida: ${date}`);
  }
  return { year, month, day };
}

export function parsePeriod(period: Period): { year: number; month: number } {
  const match = PERIOD_PATTERN.exec(period);
  if (!match) throw new RangeError(`Período inválido: ${period}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new RangeError(`Período inválido: ${period}`);
  return { year, month };
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function makePeriod(year: number, month: number): Period {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export function makeDate(year: number, month: number, day: number): ISODate {
  return `${makePeriod(year, month)}-${String(day).padStart(2, '0')}`;
}

export function periodOf(date: ISODate): Period {
  const { year, month } = parseDate(date);
  return makePeriod(year, month);
}

export function addMonths(period: Period, months: number): Period {
  const { year, month } = parsePeriod(period);
  const index = year * 12 + (month - 1) + months;
  return makePeriod(Math.floor(index / 12), (index % 12) + 1);
}

/** Fecha con el día pedido o el último del mes si ese mes es más corto. */
export function clampedDate(period: Period, day: number): ISODate {
  const { year, month } = parsePeriod(period);
  return makeDate(year, month, Math.min(day, lastDayOfMonth(year, month)));
}

/** Días de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from: ISODate, to: ISODate): number {
  const a = parseDate(from);
  const b = parseDate(to);
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / 86_400_000);
}
