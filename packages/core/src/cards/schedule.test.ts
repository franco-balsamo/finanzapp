import { describe, expect, it } from 'vitest';
import { ars, cardA, expense } from './fixtures.ts';
import {
  closeDate,
  dueDate,
  installmentSchedule,
  statementFor,
  validateCardDays,
  validateOverride,
} from './schedule.ts';
import type { CreditCard } from './types.ts';

describe('statementFor (T-01, 02 §3)', () => {
  it.each([
    ['2026-09-20', '2026-09', '2026-09-24', '2026-10-06'],
    ['2026-09-24', '2026-09', '2026-09-24', '2026-10-06'],
    ['2026-09-25', '2026-10', '2026-10-24', '2026-11-06'],
    ['2026-12-28', '2027-01', '2027-01-24', '2027-02-06'],
  ])('compra del %s → resumen %s (cierra %s, vence %s)', (date, period, close, due) => {
    expect(statementFor(cardA, date)).toBe(period);
    expect(closeDate(cardA, period)).toBe(close);
    expect(dueDate(cardA, period)).toBe(due);
  });
});

describe('installmentSchedule', () => {
  it('T-02: $30.000 en 3 cuotas el 25/9 → $10.000 en oct, nov y dic', () => {
    const schedule = installmentSchedule(cardA, expense('e', '2026-09-25', ars(30_000), 3));
    expect(schedule.map((i) => i.period)).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(schedule.map((i) => i.amount)).toEqual([ars(10_000), ars(10_000), ars(10_000)]);
    expect(schedule.map((i) => dueDate(cardA, i.period))).toEqual([
      '2026-11-06',
      '2026-12-06',
      '2027-01-06',
    ]);
  });

  it('T-03: $100.000 en 3 → el resto va a la primera cuota', () => {
    const schedule = installmentSchedule(cardA, expense('e', '2026-09-10', ars(100_000), 3));
    expect(schedule.map((i) => i.amount.minor)).toEqual([3_333_334, 3_333_333, 3_333_333]);
    expect(schedule.map((i) => `${i.index}/${i.of}`)).toEqual(['1/3', '2/3', '3/3']);
  });

  it('las cuotas siguen al resumen de la compra aunque se corrija un cierre', () => {
    const overrides = [{ period: '2026-11', closeDate: '2026-11-20', dueDate: '2026-12-02' }];
    const schedule = installmentSchedule(cardA, expense('e', '2026-09-25', ars(30_000), 3), overrides);
    expect(schedule.map((i) => i.period)).toEqual(['2026-10', '2026-11', '2026-12']);
  });

  it('rechaza gastos de $0 o negativos', () => {
    expect(() => installmentSchedule(cardA, expense('e', '2026-09-10', ars(0)))).toThrow(RangeError);
    expect(() => installmentSchedule(cardA, expense('e', '2026-09-10', ars(-100)))).toThrow(RangeError);
  });

  it('rechaza cuotas fuera de 1 a 24', () => {
    expect(() => installmentSchedule(cardA, expense('e', '2026-09-10', ars(1), 0))).toThrow(RangeError);
    expect(() => installmentSchedule(cardA, expense('e', '2026-09-10', ars(1), 25))).toThrow(RangeError);
  });
});

describe('mes de vencimiento (02 §3)', () => {
  it.each([
    [5, 20, '2026-10', '2026-10-20'],
    [10, 10, '2026-10', '2026-11-10'],
    [31, 31, '2026-02', '2026-03-31'],
  ])('cierre %i, vence %i → el resumen %s vence el %s', (closeDay, dueDay, period, due) => {
    expect(dueDate({ ...cardA, closeDay, dueDay }, period)).toBe(due);
  });

  it('si después del ajuste a fin de mes vence el día del cierre o antes, vence al día siguiente', () => {
    const card: CreditCard = { ...cardA, closeDay: 28, dueDay: 29 };
    expect(closeDate(card, '2027-02')).toBe('2027-02-28');
    expect(dueDate(card, '2027-02')).toBe('2027-03-01');
    expect(dueDate({ ...cardA, closeDay: 30, dueDay: 31 }, '2027-02')).toBe('2027-03-01');
    // En un bisiesto el 29/2 existe, así que vence ese día.
    expect(dueDate(card, '2028-02')).toBe('2028-02-29');
    // En los meses largos no cambia nada.
    expect(dueDate(card, '2027-03')).toBe('2027-03-29');
  });
});

describe('validateCardDays: al menos 5 días entre cierre y vencimiento (02 §3)', () => {
  it('cierre 24 y vencimiento 6: el caso más corto es febrero, con 10 días', () => {
    expect(validateCardDays(24, 6)).toEqual({ ok: true, minDays: 10 });
  });

  it('cierre 28 y vencimiento 2: en febrero quedan 2 días, se rechaza', () => {
    expect(validateCardDays(28, 2)).toEqual({ ok: false, minDays: 2 });
  });

  it.each([
    [5, 10, true],
    [5, 9, false],
    [28, 29, false],
    [25, 31, false],
    [31, 10, true],
  ])('cierre %i y vencimiento %i → %s', (closeDay, dueDay, ok) => {
    expect(validateCardDays(closeDay, dueDay).ok).toBe(ok);
  });
});

describe('días 29 a 31 (T-07, D11)', () => {
  const close31: CreditCard = { ...cardA, closeDay: 31, dueDay: 10 };

  it('cierre 31 → último día de los meses cortos', () => {
    expect(closeDate(close31, '2026-02')).toBe('2026-02-28');
    expect(closeDate(close31, '2028-02')).toBe('2028-02-29');
    expect(closeDate(close31, '2026-04')).toBe('2026-04-30');
  });

  it('cierre 31 y vencimiento 30 → febrero cierra el 28/2 y vence el 30/3', () => {
    const card: CreditCard = { ...cardA, closeDay: 31, dueDay: 30 };
    expect(closeDate(card, '2026-02')).toBe('2026-02-28');
    expect(dueDate(card, '2026-02')).toBe('2026-03-30');
  });
});

describe('cierre real corregido (T-08, D10)', () => {
  const october = { period: '2026-10', closeDate: '2026-10-27', dueDate: '2026-11-08' };

  it('con el cierre corregido al 27/10, la compra del 26/10 entra en octubre', () => {
    expect(statementFor(cardA, '2026-10-26')).toBe('2026-11');
    expect(statementFor(cardA, '2026-10-26', [october])).toBe('2026-10');
  });

  it('una corrección que corre el cierre al mes siguiente también funciona', () => {
    const overrides = [{ period: '2026-10', closeDate: '2026-11-02', dueDate: '2026-11-14' }];
    expect(statementFor(cardA, '2026-11-01', overrides)).toBe('2026-10');
    expect(statementFor(cardA, '2026-11-03', overrides)).toBe('2026-11');
  });

  it('acepta una corrección de hasta ±10 días', () => {
    expect(validateOverride(cardA, '2026-10', october)).toEqual({ ok: true });
  });

  it.each([
    ['2026-11-03', true],
    ['2026-11-04', false],
    ['2026-10-14', true],
    ['2026-10-13', false],
  ])('borde de ±10 días: cierre corregido al %s → %s', (close, ok) => {
    const result = validateOverride(cardA, '2026-10', { closeDate: close, dueDate: '2026-11-20' });
    expect(result.ok).toBe(ok);
  });

  it('un cierre adelantado al mes anterior no deja fechas sin resumen', () => {
    const card: CreditCard = { ...cardA, closeDay: 2, dueDay: 15 };
    const enero = { period: '2027-01', closeDate: '2026-12-30', dueDate: '2027-01-15' };
    expect(validateOverride(card, '2027-01', enero)).toEqual({ ok: true });
    expect(statementFor(card, '2026-12-30', [enero])).toBe('2027-01');
    expect(statementFor(card, '2026-12-31', [enero])).toBe('2027-02');
  });

  it('rechaza una corrección de +15 días', () => {
    expect(
      validateOverride(cardA, '2026-10', { closeDate: '2026-11-08', dueDate: '2026-11-20' }),
    ).toEqual({ ok: false, reason: 'out_of_range' });
  });

  it('rechaza un cierre que no queda después del anterior', () => {
    const september = { period: '2026-09', closeDate: '2026-10-03', dueDate: '2026-10-15' };
    expect(
      validateOverride(cardA, '2026-10', { closeDate: '2026-10-15', dueDate: '2026-11-06' }, [
        { ...september, closeDate: '2026-10-15' },
      ]),
    ).toEqual({ ok: false, reason: 'not_after_previous' });
  });

  it('rechaza un cierre que no queda antes del siguiente', () => {
    const november = { period: '2026-11', closeDate: '2026-11-01', dueDate: '2026-11-15' };
    expect(
      validateOverride(cardA, '2026-10', { closeDate: '2026-11-02', dueDate: '2026-11-14' }, [november]),
    ).toEqual({ ok: false, reason: 'not_before_next' });
  });

  it('rechaza fechas corregidas mal escritas', () => {
    const malFormada = { period: '2026-10', closeDate: '2026-10-7', dueDate: '2026-11-08' };
    expect(() => statementFor(cardA, '2026-10-05', [malFormada])).toThrow(RangeError);
    expect(() => validateOverride(cardA, '2026-10', malFormada)).toThrow(RangeError);
  });

  it('rechaza un vencimiento que no es posterior al cierre', () => {
    expect(
      validateOverride(cardA, '2026-10', { closeDate: '2026-10-27', dueDate: '2026-10-27' }),
    ).toEqual({ ok: false, reason: 'due_before_close' });
  });
});
