import { describe, expect, it } from 'vitest';
import { ars, cardA, expense, fxCard, payment, usd } from './fixtures';
import { cardState } from './state';
import type { CardExpense, StatementPayment } from './types';

function state(
  expenses: CardExpense[],
  payments: StatementPayment[],
  today: string,
  card = cardA,
) {
  return cardState({ card, expenses, payments, overrides: [], today, fxCard });
}

const find = (s: ReturnType<typeof cardState>, period: string) => {
  const statement = s.statements.find((x) => x.period === period);
  if (!statement) throw new Error(`No hay resumen ${period}`);
  return statement;
};

describe('pago parcial, vencido y deshacer (T-04, 02 §3)', () => {
  const resumen = expense('e1', '2026-09-10', ars(200_000));
  const pago = payment('p1', '2026-09', ars(120_000), 'caja', '2026-10-03');

  it('pago de $120.000 sobre $200.000 → Pago parcial con $80.000', () => {
    const sep = find(state([resumen], [pago], '2026-10-04'), '2026-09');
    expect(sep.status).toBe('partial');
    expect(sep.pending.ARS).toEqual(ars(80_000));
  });

  it('pasado el vencimiento sin otro pago → Vencido con $80.000', () => {
    const sep = find(state([resumen], [pago], '2026-10-07'), '2026-09');
    expect(sep.status).toBe('overdue');
    expect(sep.pending.ARS).toEqual(ars(80_000));
  });

  it('el día del vencimiento todavía no está vencido', () => {
    expect(find(state([resumen], [pago], '2026-10-06'), '2026-09').status).toBe('partial');
  });

  it('al deshacer el pago vuelven los $200.000 pendientes', () => {
    const revertido = { ...pago, revertedAt: '2026-10-04' };
    const sep = find(state([resumen], [revertido], '2026-10-04'), '2026-09');
    expect(sep.status).toBe('to_pay');
    expect(sep.pending.ARS).toEqual(ars(200_000));
    expect(sep.paid.ARS).toEqual(ars(0));
  });
});

describe('un resumen por estado (T-05)', () => {
  it('Pagado, A pagar, En curso y Cuotas futuras', () => {
    const s = state(
      [
        expense('ago', '2026-08-10', ars(1_000)),
        expense('sep', '2026-09-10', ars(2_000)),
        expense('oct', '2026-10-01', ars(3_000), 2),
      ],
      [payment('p', '2026-08', ars(1_000), 'caja', '2026-09-05')],
      '2026-10-02',
    );
    expect(s.currentPeriod).toBe('2026-10');
    expect(s.statements.map((x) => [x.period, x.status])).toEqual([
      ['2026-08', 'paid'],
      ['2026-09', 'to_pay'],
      ['2026-10', 'current'],
      ['2026-11', 'future'],
    ]);
  });

  it('el día de cierre el resumen sigue en curso', () => {
    expect(state([expense('e', '2026-09-10', ars(1_000))], [], '2026-09-24').currentPeriod).toBe('2026-09');
    expect(state([expense('e', '2026-09-10', ars(1_000))], [], '2026-09-25').currentPeriod).toBe('2026-10');
  });
});

describe('límite usado y disponible (T-06)', () => {
  const expenses = [
    expense('vencido', '2026-08-10', ars(50_000)),
    expense('en-curso', '2026-10-01', ars(20_000)),
    expense('cuotas', '2026-10-01', ars(30_000), 3),
    expense('dolares', '2026-10-01', usd(50)),
  ];

  it('suma vencidos, en curso, cuotas futuras y dólares a dólar tarjeta', () => {
    const s = state(expenses, [], '2026-10-02');
    expect(find(s, '2026-08').status).toBe('overdue');
    // 50.000 + 20.000 + 30.000 + 50 × 2.028
    expect(s.limitUsed).toEqual(ars(201_400));
    expect(s.available).toEqual(ars(798_600));
  });

  it('el disponible nunca es negativo', () => {
    const s = state(expenses, [], '2026-10-02', { ...cardA, creditLimit: ars(100_000) });
    expect(s.available).toEqual(ars(0));
  });
});

describe('casos que 02 no resolvía (decididos en el spec)', () => {
  it('un resumen cerrado en $0 queda Pagado', () => {
    const s = state([expense('cero', '2026-09-10', ars(0))], [], '2026-10-04');
    expect(find(s, '2026-09').status).toBe('paid');
    expect(s.toPay).toEqual([]);
  });

  it('un pago de más deja el resumen Pagado e informa el excedente', () => {
    const sep = find(
      state(
        [expense('e', '2026-09-10', ars(200_000))],
        [payment('p', '2026-09', ars(210_000), 'caja', '2026-10-03')],
        '2026-10-04',
      ),
      '2026-09',
    );
    expect(sep.status).toBe('paid');
    expect(sep.pending.ARS).toEqual(ars(0));
    expect(sep.overpaid.ARS).toEqual(ars(10_000));
  });

  it('con los pesos pagados y los dólares no, queda Pago parcial', () => {
    const sep = find(
      state(
        [expense('pesos', '2026-09-10', ars(100_000)), expense('dolares', '2026-09-11', usd(50))],
        [payment('p', '2026-09', ars(100_000), 'caja', '2026-10-03')],
        '2026-10-04',
      ),
      '2026-09',
    );
    expect(sep.status).toBe('partial');
    expect(sep.pending.USD).toEqual(usd(50));
  });

  it('"A pagar" lista los cerrados con saldo, el más próximo a vencer primero', () => {
    const s = state(
      [expense('sep', '2026-09-10', ars(2_000)), expense('ago', '2026-08-10', ars(1_000))],
      [],
      '2026-10-02',
    );
    expect(s.toPay.map((x) => [x.period, x.status])).toEqual([
      ['2026-08', 'overdue'],
      ['2026-09', 'to_pay'],
    ]);
  });

  it('rechaza un pago cuyo monto no coincide con la parte que cubre', () => {
    const malo = payment('p', '2026-09', ars(1_000), 'caja', '2026-10-03', { appliesTo: 'USD' });
    expect(() => state([], [malo], '2026-10-04')).toThrow(RangeError);
  });
});
