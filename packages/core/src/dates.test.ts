import { describe, expect, it } from 'vitest';
import { addMonths, clampedDate, daysBetween, lastDayOfMonth, parseDate, periodOf } from './dates';

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
