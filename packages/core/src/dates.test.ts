import { describe, expect, it } from 'vitest';
import { addMonths, clampedDate, daysBetween, lastDayOfMonth, parseDate, parseDateNear, periodOf } from './dates.ts';

describe('dates', () => {
  it('último día del mes, con bisiestos', () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
    expect(lastDayOfMonth(2028, 2)).toBe(29);
    expect(lastDayOfMonth(2026, 4)).toBe(30);
    expect(lastDayOfMonth(2026, 12)).toBe(31);
  });

  it('suma y resta meses cruzando años', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-07', 23)).toBe('2028-06');
  });

  it('ajusta el día al último del mes', () => {
    expect(clampedDate('2026-02', 31)).toBe('2026-02-28');
    expect(clampedDate('2026-03', 31)).toBe('2026-03-31');
  });

  it('período y días entre fechas', () => {
    expect(periodOf('2026-09-25')).toBe('2026-09');
    expect(daysBetween('2026-10-24', '2026-11-08')).toBe(15);
    expect(daysBetween('2026-10-24', '2026-10-14')).toBe(-10);
  });

  it('rechaza fechas inválidas', () => {
    expect(() => parseDate('2026-02-30')).toThrow(RangeError);
    expect(() => parseDate('26-02-01')).toThrow(RangeError);
  });
});

describe('parseDateNear (cierre real)', () => {
  it('elige el año más cercano a la fecha estimada', () => {
    expect(parseDateNear('27/10', '2026-10-24')).toBe('2026-10-27');
    expect(parseDateNear('2/1', '2026-12-28')).toBe('2027-01-02');
    expect(parseDateNear('29/12', '2027-01-03')).toBe('2026-12-29');
  });

  it('con año, tal cual; si no existe, null', () => {
    expect(parseDateNear('27/10/26', '2026-10-24')).toBe('2026-10-27');
    expect(parseDateNear('31/11', '2026-11-24')).toBeNull();
    expect(parseDateNear('mañana', '2026-11-24')).toBeNull();
  });
});
