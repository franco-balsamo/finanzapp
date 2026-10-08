import { describe, expect, it } from 'vitest';
import { ars, usd } from '../cards/fixtures.ts';
import { rate } from '../money.ts';
import { cardDetail, cardStatementFor, wallet, type DbWalletAccount, type DbWalletCard, type DbWalletGroup, type DbWalletMovement, type WalletInput } from './wallet.ts';

// Hoy: lunes 5/10/2026. Visa con cierre 24: el resumen en curso cierra el 24/10.
const today = '2026-10-05';

const visa: DbWalletCard = {
  id: 'visa', name: 'Visa Galicia', bank: 'Banco Galicia', network: 'VISA', last4: '2337', color: '#23262b',
  is_favorite: false, close_day: 24, due_day: 6, credit_limit: '2000000.00', expiry: '07/30', created_at: '2026-10-01T10:00:00Z',
  archived_at: null,
};
const master: DbWalletCard = {
  ...visa, id: 'master', name: 'Master BBVA', network: 'MC', last4: '0763', is_favorite: true, credit_limit: null,
  created_at: '2026-10-02T10:00:00Z',
};
const pesos: DbWalletAccount = { id: 'pesos', name: 'Caja Galicia', type: 'bank', currency: 'ARS', opening_balance: '500000.00', created_at: '2026-10-01T10:00:00Z' };
const dolares: DbWalletAccount = { id: 'dolares', name: 'Caja USD', type: 'bank', currency: 'USD', opening_balance: '1000.00', created_at: '2026-10-01T11:00:00Z' };

function movement(fields: Partial<DbWalletMovement> & Pick<DbWalletMovement, 'id' | 'amount'>): DbWalletMovement {
  return {
    type: 'expense', date: '2026-10-02', description: 'gasto', currency: 'ARS', card_id: null, account_id: null, to_account_id: null,
    installments: 1, category_id: null, my_share: null, group_expense_id: null, fx_mep: null, fx_oficial: null,
    fx_blue: null, fx_pending: false, debited_amount: null, ...fields,
  };
}

function input(fields: Partial<WalletInput> = {}): WalletInput {
  return {
    today, display: 'ARS', reference: 'mep', referenceRate: rate('1500'), fxCard: rate('2028'),
    cards: [visa], accounts: [pesos, dolares], payments: [], overrides: [], groups: [],
    movements: [
      movement({ id: 'm1', amount: '187000.00', card_id: 'visa' }),
      movement({ id: 'm2', amount: '50.00', currency: 'USD', card_id: 'visa' }),
    ],
    ...fields,
  };
}

describe('Billetera', () => {
  it('ejemplo de 02 §8 sin grupos: patrimonio en pesos', () => {
    const w = wallet(input());
    expect(w.netWorth).toEqual({ accounts: ars(2_000_000), groups: ars(0), cards: ars(288_400), total: ars(1_711_600) });
  });

  it('ejemplo de 02 §8 en dólares', () => {
    expect(wallet(input({ display: 'USD' })).netWorth?.total).toEqual(usd(1_158.66));
  });

  it('lo que viene en el resumen en curso y su cierre', () => {
    const [card] = wallet(input()).cards;
    expect(card).toMatchObject({ id: 'visa', closeDate: '2026-10-24', currentTotal: { ARS: ars(187_000), USD: usd(50) } });
  });

  it('una compra en 3 cuotas suma una cuota al resumen en curso', () => {
    const w = wallet(input({ movements: [movement({ id: 'm', amount: '30000.00', card_id: 'visa', installments: 3, date: '2026-09-25' })] }));
    expect(w.cards[0]!.currentTotal.ARS).toEqual(ars(10_000));
    // Las tres cuotas siguen debiéndose y restan del patrimonio.
    expect(w.netWorth?.cards).toEqual(ars(30_000));
  });

  it('avisa si hay un resumen cerrado sin pagar: a pagar antes del vencimiento, vencido después', () => {
    const cerrado = movement({ id: 'cerrado', amount: '80000.00', card_id: 'visa', date: '2026-09-10' });
    // El resumen de septiembre vence el 6/10.
    expect(wallet(input({ movements: [cerrado] })).cards[0]).toMatchObject({ currentTotal: { ARS: ars(0) }, dueStatus: 'to_pay' });
    expect(wallet(input({ today: '2026-10-07', movements: [cerrado] })).cards[0]!.dueStatus).toBe('overdue');
    expect(wallet(input()).cards[0]!.dueStatus).toBeNull();
  });

  it('la favorita primero y después en el orden de carga', () => {
    expect(wallet(input({ cards: [visa, master] })).cards.map((c) => c.id)).toEqual(['master', 'visa']);
  });

  it('saldos de cuentas: gastos, lo descontado en otra moneda y pagos de tarjeta', () => {
    const w = wallet(input({
      movements: [
        movement({ id: 'a', amount: '20000.00', account_id: 'pesos' }),
        movement({ id: 'b', amount: '12.00', currency: 'USD', account_id: 'pesos', debited_amount: '24336.00' }),
      ],
      payments: [{
        id: 'p', card_id: 'visa', period: '2026-09-01', applies_to: 'ARS', amount: '100000.00', from_account_id: 'pesos',
        debited_amount: '100000.00', fx_card_rate: null, paid_at: '2026-10-03T15:00:00Z', reverted_at: null,
      }],
    }));
    expect(w.accounts.map((a) => a.balance)).toEqual([ars(355_664), usd(1000)]);
  });

  it('tu saldo en los grupos', () => {
    const group: DbWalletGroup = {
      id: 'g', name: 'Cabaña', currency: 'ARS', owner_member_id: 'yo', my_member_id: 'yo',
      members: [
        { id: 'yo', display_name: 'Vos', user_id: 'u1', left_at: null, claimed_at: null },
        { id: 'juan', display_name: 'Juan', user_id: null, left_at: null, claimed_at: null },
      ],
      expenses: [{ id: 'e', date: '2026-10-01', description: 'Súper', amount: '120000.00', currency: 'ARS', fx_rate: null, payer_member_id: 'yo', split_mode: 'equal', category_id: null, parts: [{ member_id: 'yo', value: '1.00' }, { member_id: 'juan', value: '1.00' }] }],
      payments: [
        { id: 'gp', from_member_id: 'juan', to_member_id: 'yo', amount: '10000.00', date: '2026-10-02', deleted_at: null },
        { id: 'anulado', from_member_id: 'juan', to_member_id: 'yo', amount: '5000.00', date: '2026-10-02', deleted_at: '2026-10-03T12:00:00Z' },
      ],
    };
    expect(wallet(input({ movements: [], groups: [group] })).netWorth?.groups).toEqual(ars(50_000));
  });

  describe('resumen donde entra un gasto (toast, 9A)', () => {
    it('3 cuotas del 25/9: la primera entra en el resumen del 24/10', () => {
      const w = input({ movements: [movement({ id: 'm', amount: '30000.00', card_id: 'visa', installments: 3, date: '2026-09-25' })] });
      expect(cardStatementFor(w, 'visa', '2026-09-25')).toEqual({ closeDate: '2026-10-24', total: { ARS: ars(10_000), USD: usd(0) } });
    });

    it('un gasto del 20/9 entra en el resumen que cerró el 24/9', () => {
      const w = input({ movements: [movement({ id: 'm', amount: '5000.00', card_id: 'visa', date: '2026-09-20' })] });
      expect(cardStatementFor(w, 'visa', '2026-09-20')).toEqual({ closeDate: '2026-09-24', total: { ARS: ars(5_000), USD: usd(0) } });
    });

    it('sin consumos en ese resumen: total cero', () => {
      expect(cardStatementFor(input({ movements: [] }), 'visa', '2026-12-01').total).toEqual({ ARS: ars(0), USD: usd(0) });
    });
  });

  describe('sin cotizaciones', () => {
    it('todo en pesos: el patrimonio se calcula igual', () => {
      const w = wallet(input({ referenceRate: null, fxCard: null, accounts: [pesos], movements: [movement({ id: 'm', amount: '1000.00', card_id: 'visa' })] }));
      expect(w.netWorth?.total).toEqual(ars(499_000));
    });

    it('con dólares: sin patrimonio, pero con tarjetas y cuentas', () => {
      const w = wallet(input({ referenceRate: null }));
      expect(w.netWorth).toBeNull();
      expect(w.accounts).toHaveLength(2);
      expect(w.cards[0]!.currentTotal.ARS).toEqual(ars(187_000));
    });

    it('deuda en dólares sin dólar tarjeta: sin patrimonio en pesos', () => {
      expect(wallet(input({ fxCard: null })).netWorth).toBeNull();
    });
  });

  describe('tarjetas archivadas (02 §3)', () => {
    const archived = { ...visa, archived_at: '2026-10-05T15:00:00Z' };

    it('no salen en la lista, pero su deuda sigue contando', () => {
      const w = wallet(input({ cards: [archived] }));
      expect(w.cards).toEqual([]);
      expect(w.netWorth?.total).toEqual(ars(1_711_600));
      expect(w.archivedCards).toEqual([
        { id: 'visa', name: 'Visa Galicia', network: 'VISA', last4: '2337', color: '#23262b', deletesOn: '2026-10-12' },
      ]);
    });
  });
});

describe('detalle de tarjeta (6A)', () => {
  // Visa con cierre 24 y vencimiento 6. Hoy 5/10: septiembre cerró el 24/9 y vence el 6/10.
  const payment = (id: string, amount: string, paidAt: string, reverted: string | null = null) => ({
    id, card_id: 'visa', period: '2026-09-01', applies_to: 'ARS' as const, amount, from_account_id: 'pesos',
    debited_amount: amount, fx_card_rate: null, paid_at: paidAt, reverted_at: reverted,
  });
  const septiembre = movement({ id: 's', amount: '200000.00', card_id: 'visa', date: '2026-09-10', description: 'heladera' });

  it('pago parcial: $200.000 con un pago de $120.000 quedan $80.000 (02 §3)', () => {
    const d = cardDetail(input({ movements: [septiembre], payments: [payment('p', '120000.00', '2026-10-03T15:00:00Z')] }), 'visa');
    const sep = d.statements.find((s) => s.period === '2026-09')!;
    expect(sep).toMatchObject({ status: 'partial', pending: { ARS: ars(80_000), USD: usd(0) }, closeDate: '2026-09-24', dueDate: '2026-10-06' });
    expect(sep.payments).toEqual([
      { id: 'p', appliesTo: 'ARS', amount: ars(120_000), fromAccountId: 'pesos', debitedAmount: ars(120_000), paidAt: '2026-10-03' },
    ]);
    expect(d.defaultPeriod).toBe('2026-09');
  });

  it('los pagos deshechos no se listan y el resumen vuelve a "A pagar"', () => {
    const d = cardDetail(input({ movements: [septiembre], payments: [payment('p', '120000.00', '2026-10-03T15:00:00Z', '2026-10-04T15:00:00Z')] }), 'visa');
    const sep = d.statements.find((s) => s.period === '2026-09')!;
    expect(sep.payments).toEqual([]);
    expect(sep.status).toBe('to_pay');
  });

  it('sin nada para pagar abre el resumen en curso', () => {
    expect(cardDetail(input({ movements: [] }), 'visa').defaultPeriod).toBe('2026-10');
  });

  it('cuotas que siguen: $30.000 en 3 cuotas del 25/9', () => {
    const d = cardDetail(input({ movements: [movement({ id: 'c', amount: '30000.00', card_id: 'visa', installments: 3, date: '2026-09-25', description: 'tele' })] }), 'visa');
    expect(d.futureInstallments.map((f) => [f.period, f.total.ARS])).toEqual([
      ['2026-11', ars(10_000)],
      ['2026-12', ars(10_000)],
    ]);
    const oct = d.statements.find((s) => s.period === '2026-10')!;
    expect(oct.items).toEqual([
      { expenseId: 'c', date: '2026-09-25', description: 'tele', categoryId: null, index: 1, of: 3, amount: ars(10_000) },
    ]);
  });

  it('pago mínimo: 15% de la parte en pesos', () => {
    const d = cardDetail(input(), 'visa');
    expect(d.statements.find((s) => s.period === '2026-10')!.minimumPayment).toEqual(ars(28_050));
  });

  it('límite usado y disponible, con los dólares a dólar tarjeta', () => {
    const d = cardDetail(input(), 'visa');
    expect(d.limitUsed).toEqual(ars(288_400));
    expect(d.available).toEqual(ars(1_711_600));
    expect(cardDetail(input({ fxCard: null }), 'visa').limitUsed).toBeNull();
  });
});
