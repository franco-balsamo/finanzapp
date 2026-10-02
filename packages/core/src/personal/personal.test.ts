import { describe, expect, it } from 'vitest';
import { rate } from '../money';
import { ars, cardA, payment, usd } from '../cards/fixtures';
import { accountBalance } from './accountBalance';
import { categorySpend } from './categorySpend';
import { expenseFrom, movement } from './fixtures';
import { netWorth } from './netWorth';
import type { Account, Movement } from './types';

const caja: Account = { id: 'caja', currency: 'ARS', openingBalance: ars(500_000) };
const cajaUsd: Account = { id: 'caja-usd', currency: 'USD', openingBalance: usd(1_000) };

function spend(movements: Movement[], month: string, todayRate = rate('1500.00')) {
  return categorySpend({
    movements,
    cards: [{ card: cardA, overrides: [] }],
    month,
    reference: 'mep',
    todayRate,
  });
}

describe('accountBalance (02 §2)', () => {
  it('T-18: US$ 12 desde una caja en pesos resta lo descontado ($24.336)', () => {
    const gasto = expenseFrom('m', '2026-10-01', usd(12), { accountId: 'caja', debitedAmount: ars(24_336) });
    expect(accountBalance(caja, [gasto], [])).toEqual(ars(475_664));
  });

  it('T-04 (lado de la caja): el pago de tarjeta resta y al deshacerlo vuelve', () => {
    const pago = payment('p', '2026-09', ars(120_000), 'caja', '2026-10-03');
    expect(accountBalance(caja, [], [pago])).toEqual(ars(380_000));
    expect(accountBalance(caja, [], [{ ...pago, revertedAt: '2026-10-04' }])).toEqual(ars(500_000));
  });

  it('compra de dólares: sale de la caja en pesos y entra en la de dólares', () => {
    const compra = movement('t', {
      type: 'transfer',
      date: '2026-10-01',
      amount: usd(100),
      accountId: 'caja',
      toAccountId: 'caja-usd',
      debitedAmount: ars(142_000),
    });
    expect(accountBalance(caja, [compra], [])).toEqual(ars(358_000));
    expect(accountBalance(cajaUsd, [compra], [])).toEqual(usd(1_100));
  });

  it('ingresos, ajustes y pagos de tarjetas eliminadas', () => {
    const movimientos = [
      movement('i', { type: 'income', date: '2026-10-01', amount: ars(100_000), accountId: 'caja' }),
      movement('a', { type: 'adjustment', date: '2026-10-02', amount: ars(-5_000), accountId: 'caja' }),
      movement('c', { type: 'card_payment', date: '2026-10-03', amount: ars(20_000), accountId: 'caja' }),
      expenseFrom('otra', '2026-10-03', ars(1_000), { accountId: 'otra-cuenta' }),
    ];
    expect(accountBalance(caja, movimientos, [])).toEqual(ars(575_000));
  });

  it('un gasto en otra moneda sin debitedAmount se rechaza', () => {
    expect(() => accountBalance(caja, [expenseFrom('m', '2026-10-01', usd(12), { accountId: 'caja' })], [])).toThrow(
      RangeError,
    );
  });
});

describe('categorySpend (02 §6)', () => {
  it('T-09: $30.000 en 3 cuotas el 25/9 cuentan en oct, nov y dic, y nada en sep', () => {
    const compra = expenseFrom('m', '2026-09-25', ars(30_000), { cardId: 'A', installments: 3, categoryId: 'super' });
    expect(spend([compra], '2026-09').total).toEqual(ars(0));
    for (const month of ['2026-10', '2026-11', '2026-12']) {
      expect(spend([compra], month).byCategory).toEqual({ super: ars(10_000) });
    }
  });

  it('con débito, en el mes de la fecha', () => {
    const compra = expenseFrom('m', '2026-09-25', ars(30_000), { accountId: 'caja', categoryId: 'super' });
    expect(spend([compra], '2026-09').total).toEqual(ars(30_000));
    expect(spend([compra], '2026-10').total).toEqual(ars(0));
  });

  it('gasto de grupo en cuotas: tu parte también va en cuotas', () => {
    const compra = expenseFrom('m', '2026-09-25', ars(90_000), {
      cardId: 'A',
      installments: 3,
      myShare: ars(30_000),
      groupExpenseId: 'g1',
      categoryId: 'salidas',
    });
    expect(spend([compra], '2026-10').byCategory).toEqual({ salidas: ars(10_000) });
  });

  it('un gasto "Sin medio de pago" de un reclamo cuenta tu parte en el mes de la fecha', () => {
    const reclamo = expenseFrom('m', '2026-09-10', ars(90_000), {
      myShare: ars(30_000),
      groupExpenseId: 'g1',
      categoryId: 'salidas',
    });
    expect(spend([reclamo], '2026-09').total).toEqual(ars(30_000));
  });

  it('si el grupo se eliminó, cuenta el gasto completo', () => {
    const desvinculado = expenseFrom('m', '2026-09-10', ars(90_000), {
      accountId: 'caja',
      myShare: ars(30_000),
      groupExpenseId: null,
    });
    expect(spend([desvinculado], '2026-09').total).toEqual(ars(90_000));
  });

  it('dólares con la cotización guardada del dólar de referencia', () => {
    const compra = expenseFrom('m', '2026-09-10', usd(10), {
      accountId: 'caja-usd',
      categoryId: 'suscripciones',
      fx: { mep: rate('1400.00'), oficial: rate('1000.00'), blue: rate('1450.00') },
    });
    expect(spend([compra], '2026-09')).toEqual({
      byCategory: { suscripciones: ars(14_000) },
      total: ars(14_000),
      approximate: false,
    });
  });

  it('sin cotización guardada usa la de hoy y lo marca como aproximado', () => {
    const compra = expenseFrom('m', '2026-09-10', usd(10), { accountId: 'caja-usd', categoryId: 'suscripciones', fxPending: true });
    expect(spend([compra], '2026-09')).toMatchObject({ total: ars(15_000), approximate: true });
  });

  it('con fxPending no usa la cotización guardada aunque exista', () => {
    const compra = expenseFrom('m', '2026-09-10', usd(10), {
      accountId: 'caja-usd',
      categoryId: 'suscripciones',
      fxPending: true,
      fx: { mep: rate('1400.00'), oficial: null, blue: null },
    });
    expect(spend([compra], '2026-09')).toMatchObject({ total: ars(15_000), approximate: true });
  });

  it('un gasto sin categoría va a la clave "none"', () => {
    const compra = expenseFrom('m', '2026-09-10', ars(1_000), { accountId: 'caja' });
    expect(spend([compra], '2026-09').byCategory).toEqual({ none: ars(1_000) });
  });

  it('rechaza una parte propia en otra moneda que el gasto', () => {
    const malo = expenseFrom('m', '2026-09-10', usd(30), { myShare: ars(10_000), groupExpenseId: 'g1' });
    expect(() => spend([malo], '2026-09')).toThrow(RangeError);
  });

  it('ingresos y transferencias no cuentan', () => {
    const ingreso = movement('i', { type: 'income', date: '2026-09-10', amount: ars(1_000), accountId: 'caja' });
    expect(spend([ingreso], '2026-09').total).toEqual(ars(0));
  });
});

describe('netWorth (T-16, 02 §8): cada componente se convierte una sola vez', () => {
  const input = {
    referenceRate: rate('1500.00'),
    fxCard: rate('2028.00'),
    accountBalances: [ars(500_000), usd(1_000)],
    myGroupBalances: [ars(60_000)],
    // $187.000 + US$ 50, como lo devuelve cardState.pendingTotal.
    cardDebts: [{ ARS: ars(187_000), USD: usd(50) }],
  };

  it('en pesos: la deuda en dólares de la tarjeta va a dólar tarjeta', () => {
    expect(netWorth({ ...input, display: 'ARS' })).toEqual({
      accounts: ars(2_000_000),
      groups: ars(60_000),
      cards: ars(288_400),
      total: ars(1_771_600),
    });
  });

  it('en dólares: la deuda en dólares va tal cual y lo que está en pesos se divide por el MEP', () => {
    expect(netWorth({ ...input, display: 'USD' })).toEqual({
      accounts: usd(1_333.33),
      groups: usd(40),
      cards: usd(174.67),
      total: usd(1_198.66),
    });
  });

  it('US$ 100 de deuda de tarjeta se ven como US$ 100, sin ida y vuelta por el dólar tarjeta', () => {
    const result = netWorth({
      display: 'USD',
      referenceRate: rate('1300.00'),
      fxCard: rate('2028.00'),
      accountBalances: [],
      myGroupBalances: [],
      cardDebts: [{ ARS: ars(0), USD: usd(100) }],
    });
    expect(result.cards).toEqual(usd(100));
    expect(result.total).toEqual(usd(-100));
  });

  it('suma la deuda de varias tarjetas antes de convertir', () => {
    const result = netWorth({
      ...input,
      display: 'ARS',
      cardDebts: [
        { ARS: ars(100_000), USD: usd(25) },
        { ARS: ars(87_000), USD: usd(25) },
      ],
    });
    expect(result.cards).toEqual(ars(288_400));
  });
});
