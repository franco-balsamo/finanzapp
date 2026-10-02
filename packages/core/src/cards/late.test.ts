import { describe, expect, it } from 'vitest';
import { rate } from '../money';
import { ars, cardB, cardC, expense, fxCard, payment, usd } from './fixtures';
import { lateExpenseImpact, type ProposedPayment } from './late';
import { cardState } from './state';
import type { CardExpense, CreditCard, StatementPayment } from './types';

function impact(
  card: CreditCard,
  nuevo: CardExpense,
  expenses: CardExpense[],
  payments: StatementPayment[],
  today: string,
  fx = fxCard,
) {
  return lateExpenseImpact({ card, expense: nuevo, expenses, payments, overrides: [], today, fxCard: fx });
}

function september(card: CreditCard, expenses: CardExpense[], payments: StatementPayment[], today: string) {
  const s = cardState({ card, expenses, payments, overrides: [], today, fxCard });
  return s.statements.find((x) => x.period === '2026-09')!;
}

/** Lo que la app guardaría si la persona contesta "Sí". */
function asPayment(p: ProposedPayment, id: string): StatementPayment {
  return { id, revertedAt: null, ...p };
}

describe('gasto tarde en un resumen pagado (02 §3, tarjeta B)', () => {
  const base = expense('base', '2026-09-15', ars(100_000));
  const nuevo = expense('farmacia', '2026-09-28', ars(12_000));
  const pago = payment('p1', '2026-09', ars(100_000), 'galicia', '2026-10-03');

  it('pregunta "¿Ya lo pagaste?" y propone un pago de $12.000', () => {
    const result = impact(cardB, nuevo, [base], [pago], '2026-10-05');
    expect(result.isLate).toBe(true);
    expect(result.askAlreadyPaid).toBe(true);
    expect(result.proposedPayments).toEqual([
      {
        period: '2026-09',
        appliesTo: 'ARS',
        amount: ars(12_000),
        fromAccountId: 'galicia',
        debitedAmount: ars(12_000),
        fxCardRate: null,
        paidAt: '2026-10-03',
      },
    ]);
  });

  it('con "No", el resumen pasa a $112.000 con $12.000 pendientes', () => {
    const sep = september(cardB, [base, nuevo], [pago], '2026-10-05');
    expect(sep.total.ARS).toEqual(ars(112_000));
    expect(sep.status).toBe('partial');
    expect(sep.pending.ARS).toEqual(ars(12_000));
  });

  it('con "No" y el vencimiento pasado, queda Vencido', () => {
    expect(september(cardB, [base, nuevo], [pago], '2026-10-11').status).toBe('overdue');
  });
});

describe('gasto tarde con varios pagos (R3-3, tarjeta B)', () => {
  const base = expense('base', '2026-09-15', ars(100_000));
  const nuevo = expense('farmacia', '2026-09-28', ars(12_000));
  const pagos = [
    payment('p1', '2026-09', ars(60_000), 'galicia', '2026-10-03'),
    payment('p2', '2026-09', ars(40_000), 'mp', '2026-10-06'),
  ];

  it('propone el pago desde la cuenta del último pago, con su fecha', () => {
    const [propuesta] = impact(cardB, nuevo, [base], pagos, '2026-10-08').proposedPayments;
    expect(propuesta).toMatchObject({ amount: ars(12_000), fromAccountId: 'mp', paidAt: '2026-10-06' });
  });

  it('ignora los pagos revertidos al elegir la cuenta', () => {
    const conRevertido = [
      payment('p1', '2026-09', ars(100_000), 'galicia', '2026-10-03'),
      payment('p2', '2026-09', ars(40_000), 'mp', '2026-10-06', { revertedAt: '2026-10-07' }),
    ];
    const [propuesta] = impact(cardB, nuevo, [base], conRevertido, '2026-10-08').proposedPayments;
    expect(propuesta).toMatchObject({ fromAccountId: 'galicia', paidAt: '2026-10-03' });
  });

  it('da lo mismo si la lista de gastos ya incluye el gasto nuevo', () => {
    expect(impact(cardB, nuevo, [base, nuevo], pagos, '2026-10-08')).toEqual(
      impact(cardB, nuevo, [base], pagos, '2026-10-08'),
    );
  });

  it('aplicado deja el resumen Pagado; revertido vuelve a Pago parcial', () => {
    const [propuesta] = impact(cardB, nuevo, [base], pagos, '2026-10-08').proposedPayments;
    const nuevoPago = asPayment(propuesta!, 'p3');
    expect(september(cardB, [base, nuevo], [...pagos, nuevoPago], '2026-10-08').status).toBe('paid');

    const revertido = { ...nuevoPago, revertedAt: '2026-10-08' };
    const sep = september(cardB, [base, nuevo], [...pagos, revertido], '2026-10-08');
    expect(sep.status).toBe('partial');
    expect(sep.pending.ARS).toEqual(ars(12_000));
  });
});

describe('gasto tarde en dólares (R3-4, tarjeta B)', () => {
  const base = expense('base', '2026-09-15', usd(50));
  const netflix = expense('netflix', '2026-09-29', usd(12));

  it('si la parte en dólares se pagó en pesos, usa el dólar tarjeta de ese pago', () => {
    const pago = payment('p1', '2026-09', usd(50), 'galicia', '2026-10-06', {
      debitedAmount: ars(101_400),
      fxCardRate: rate('2028.00'),
    });
    const [propuesta] = impact(cardB, netflix, [base], [pago], '2026-10-08', rate('2100.00')).proposedPayments;
    expect(propuesta).toEqual({
      period: '2026-09',
      appliesTo: 'USD',
      amount: usd(12),
      fromAccountId: 'galicia',
      debitedAmount: ars(24_336),
      fxCardRate: rate('2028.00'),
      paidAt: '2026-10-06',
    });
  });

  it('si se pagó desde una cuenta en dólares, propone dólares desde esa cuenta', () => {
    const pago = payment('p1', '2026-09', usd(50), 'caja-usd', '2026-10-06');
    const [propuesta] = impact(cardB, netflix, [base], [pago], '2026-10-08').proposedPayments;
    expect(propuesta).toMatchObject({
      fromAccountId: 'caja-usd',
      debitedAmount: usd(12),
      fxCardRate: null,
    });
  });

  it('si la parte en dólares nunca se pagó, usa el último pago y el dólar tarjeta de hoy', () => {
    const pesos = expense('pesos', '2026-09-15', ars(100_000));
    const pago = payment('p1', '2026-09', ars(100_000), 'galicia', '2026-10-03');
    const [propuesta] = impact(cardB, netflix, [pesos], [pago], '2026-10-08', rate('2100.00')).proposedPayments;
    expect(propuesta).toEqual({
      period: '2026-09',
      appliesTo: 'USD',
      amount: usd(12),
      fromAccountId: 'galicia',
      debitedAmount: ars(25_200),
      fxCardRate: rate('2100.00'),
      paidAt: '2026-10-03',
    });
  });
});

describe('cuotas cargadas tarde (02 §3, tarjeta C)', () => {
  const existentes = [
    expense('jul', '2026-07-10', ars(5_000)),
    expense('ago', '2026-08-10', ars(5_000)),
    expense('sep', '2026-09-10', ars(5_000)),
  ];
  const pagos = [
    payment('pj', '2026-07', ars(5_000), 'cuenta-jul', '2026-08-05'),
    payment('pa', '2026-08', ars(5_000), 'cuenta-ago', '2026-09-05'),
    payment('ps', '2026-09', ars(5_000), 'cuenta-sep', '2026-10-03'),
  ];
  const nuevo = expense('compra', '2026-07-15', ars(60_000), 6);

  it('pregunta una sola vez y propone un pago por resumen pagado', () => {
    const result = impact(cardC, nuevo, existentes, pagos, '2026-10-05');
    expect(result.askAlreadyPaid).toBe(true);
    expect(result.proposedPayments.map((p) => [p.period, p.amount, p.fromAccountId, p.paidAt])).toEqual([
      ['2026-07', ars(10_000), 'cuenta-jul', '2026-08-05'],
      ['2026-08', ars(10_000), 'cuenta-ago', '2026-09-05'],
      ['2026-09', ars(10_000), 'cuenta-sep', '2026-10-03'],
    ]);
  });

  it('octubre queda en curso y noviembre y diciembre como cuotas futuras', () => {
    const s = cardState({
      card: cardC,
      expenses: [...existentes, nuevo],
      payments: pagos,
      overrides: [],
      today: '2026-10-05',
      fxCard,
    });
    const status = Object.fromEntries(s.statements.map((x) => [x.period, x.status]));
    expect(status).toMatchObject({ '2026-10': 'current', '2026-11': 'future', '2026-12': 'future' });
  });
});

describe('resumen pagado de más (tarjeta B)', () => {
  const base = expense('base', '2026-09-15', ars(1_000));
  const nuevo = expense('tarde', '2026-09-28', ars(50));

  it('si el excedente cubre el gasto nuevo, no hay pago que proponer', () => {
    const pago = payment('p', '2026-09', ars(1_100), 'galicia', '2026-10-03');
    expect(impact(cardB, nuevo, [base], [pago], '2026-10-05')).toEqual({
      isLate: true,
      askAlreadyPaid: false,
      proposedPayments: [],
    });
  });

  it('si lo cubre en parte, propone solo la diferencia', () => {
    const pago = payment('p', '2026-09', ars(1_020), 'galicia', '2026-10-03');
    const [propuesta] = impact(cardB, nuevo, [base], [pago], '2026-10-05').proposedPayments;
    expect(propuesta?.amount).toEqual(ars(30));
  });
});

describe('cuándo no se pregunta', () => {
  it('un gasto del resumen en curso no es tarde', () => {
    const result = impact(cardB, expense('hoy', '2026-10-04', ars(1_000)), [], [], '2026-10-05');
    expect(result).toEqual({ isLate: false, askAlreadyPaid: false, proposedPayments: [] });
  });

  it('el día de cierre, un gasto de ese día todavía no es tarde', () => {
    const result = impact(cardB, expense('hoy', '2026-09-30', ars(1_000)), [], [], '2026-09-30');
    expect(result.isLate).toBe(false);
  });

  it('un resumen con pago parcial no dispara la pregunta', () => {
    const base = expense('base', '2026-09-15', ars(100_000));
    const parcial = payment('p', '2026-09', ars(60_000), 'galicia', '2026-10-03');
    const result = impact(cardB, expense('tarde', '2026-09-28', ars(12_000)), [base], [parcial], '2026-10-05');
    expect(result).toEqual({ isLate: true, askAlreadyPaid: false, proposedPayments: [] });
  });

  it('un resumen cerrado sin pagos no dispara la pregunta', () => {
    const result = impact(cardB, expense('agosto', '2026-08-20', ars(1_000)), [], [], '2026-10-05');
    expect(result).toEqual({ isLate: true, askAlreadyPaid: false, proposedPayments: [] });
  });
});
