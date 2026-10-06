import { describe, expect, it } from 'vitest';
import { ars, usd } from '../cards/fixtures.ts';
import { alreadyPaidQuestion, paymentsToastSuffix, proposedPaymentText } from '../entry/alreadyPaid.ts';
import { rate } from '../money.ts';
import {
  lateImpacts,
  type DbWalletAccount,
  type DbWalletCard,
  type DbWalletMovement,
  type DbWalletPayment,
  type LateDraft,
  type WalletInput,
} from './wallet.ts';

// Hoy: martes 6/10/2026. Visa con cierre 30 (ejemplos de 02 §3): septiembre cerró el 30/9.
const today = '2026-10-06';

const visa: DbWalletCard = {
  id: 'visa', name: 'Visa Galicia', bank: 'Banco Galicia', network: 'VISA', last4: '4532', color: null,
  is_favorite: true, close_day: 30, due_day: 10, credit_limit: '2000000.00', expiry: '07/30', created_at: '2026-01-01T10:00:00Z',
  archived_at: null,
};
const galicia: DbWalletAccount = { id: 'galicia', name: 'Caja Galicia', type: 'bank', currency: 'ARS', opening_balance: '500000.00', created_at: '2026-01-01T10:00:00Z' };
const mp: DbWalletAccount = { id: 'mp', name: 'Mercado Pago', type: 'wallet', currency: 'ARS', opening_balance: '200000.00', created_at: '2026-01-01T11:00:00Z' };

function movement(id: string, date: string, amount: string, currency: 'ARS' | 'USD' = 'ARS'): DbWalletMovement {
  return {
    id, type: 'expense', date, description: id, amount, currency, card_id: 'visa', account_id: null, to_account_id: null,
    installments: 1, category_id: null, my_share: null, group_expense_id: null, fx_mep: null, fx_oficial: null,
    fx_blue: null, fx_pending: false, debited_amount: null,
  };
}

function payment(id: string, period: string, amount: string, from: string, paidOn: string, fields: Partial<DbWalletPayment> = {}): DbWalletPayment {
  return {
    id, card_id: 'visa', period: `${period}-01`, applies_to: 'ARS', amount, from_account_id: from, debited_amount: amount,
    fx_card_rate: null, paid_at: `${paidOn}T15:00:00Z`, reverted_at: null, ...fields,
  };
}

// Septiembre: $100.000 pagados con $60.000 (Galicia, 3/10) y $40.000 (Mercado Pago, 6/10).
function input(fields: Partial<WalletInput> = {}): WalletInput {
  return {
    today, display: 'ARS', referenceRate: rate('1500'), fxCard: rate('2028'),
    cards: [visa], accounts: [galicia, mp], overrides: [], groups: [],
    movements: [movement('heladera', '2026-09-15', '100000.00')],
    payments: [payment('p1', '2026-09', '60000.00', 'galicia', '2026-10-03'), payment('p2', '2026-09', '40000.00', 'mp', '2026-10-06')],
    ...fields,
  };
}

const draft = (id: string, date: string, amount = ars(12_000), installments = 1): LateDraft => ({ id, cardId: 'visa', date, amount, installments });

describe('"¿Ya lo pagaste?" (D-6, 02 §3)', () => {
  it('R3-3: propone $12.000 desde Mercado Pago (el último pago) con fecha 6/10', () => {
    const [impact] = lateImpacts(input(), [draft('farmacia', '2026-09-28')]);
    expect(impact).toMatchObject({ isLate: true, askAlreadyPaid: true });
    expect(impact!.proposedPayments).toEqual([
      { period: '2026-09', appliesTo: 'ARS', amount: ars(12_000), fromAccountId: 'mp', debitedAmount: ars(12_000), fxCardRate: null, paidAt: '2026-10-06' },
    ]);
  });

  it('un gasto del resumen en curso no pregunta nada', () => {
    expect(lateImpacts(input(), [draft('café', '2026-10-02')])[0]).toEqual({ isLate: false, askAlreadyPaid: false, proposedPayments: [] });
  });

  it('R3-4: US$ 12 con US$ 50 pagados en pesos a $2.028 propone $24.336 desde Galicia', () => {
    const fields = {
      movements: [movement('heladera', '2026-09-15', '100000.00'), movement('spotify', '2026-09-10', '50.00', 'USD')],
      payments: [
        payment('p1', '2026-09', '100000.00', 'galicia', '2026-10-03'),
        payment('p2', '2026-09', '50.00', 'galicia', '2026-10-06', { applies_to: 'USD', debited_amount: '101400.00', fx_card_rate: '2028' }),
      ],
    };
    const [impact] = lateImpacts(input(fields), [draft('netflix', '2026-09-29', usd(12))]);
    expect(impact!.proposedPayments).toEqual([
      { period: '2026-09', appliesTo: 'USD', amount: usd(12), fromAccountId: 'galicia', debitedAmount: ars(24_336), fxCardRate: rate('2028'), paidAt: '2026-10-06' },
    ]);
  });

  it('cuotas en julio, agosto y septiembre pagados: una pregunta y 3 pagos', () => {
    const fields = {
      movements: ['07', '08', '09'].map((m) => movement(`m${m}`, `2026-${m}-10`, '10000.00')),
      payments: [
        payment('p7', '2026-07', '10000.00', 'galicia', '2026-08-05'),
        payment('p8', '2026-08', '10000.00', 'galicia', '2026-09-05'),
        payment('p9', '2026-09', '10000.00', 'galicia', '2026-10-05'),
      ],
    };
    const [impact] = lateImpacts(input(fields), [draft('heladera', '2026-07-15', ars(60_000), 6)]);
    expect(impact!.proposedPayments.map((p) => [p.period, p.amount])).toEqual([
      ['2026-07', ars(10_000)],
      ['2026-08', ars(10_000)],
      ['2026-09', ars(10_000)],
    ]);
  });

  it('en una tanda, cada línea cuenta los gastos y pagos de las anteriores', () => {
    const impacts = lateImpacts(input(), [draft('farmacia', '2026-09-28'), draft('kiosco', '2026-09-29', ars(5_000))]);
    expect(impacts.map((i) => i.proposedPayments.map((p) => p.amount))).toEqual([[ars(12_000)], [ars(5_000)]]);
  });

  it('sin dólar tarjeta de hoy, no propone un pago que lo necesite', () => {
    const [impact] = lateImpacts(input({ fxCard: null }), [draft('netflix', '2026-09-29', usd(12))]);
    expect(impact).toMatchObject({ isLate: true, askAlreadyPaid: false, proposedPayments: [] });
  });
});

describe('textos de "¿Ya lo pagaste?"', () => {
  const [one] = lateImpacts(input(), [draft('farmacia', '2026-09-28')]);
  const p = one!.proposedPayments[0]!;

  it('la pregunta, con uno o varios resúmenes', () => {
    expect(alreadyPaidQuestion([p], today)).toBe('¿Ya lo pagaste con el resumen de septiembre?');
    const others = [{ ...p, period: '2026-07' }, { ...p, period: '2026-08' }, p];
    expect(alreadyPaidQuestion(others, today)).toBe('¿Ya lo pagaste con los resúmenes de julio, agosto y septiembre?');
    expect(alreadyPaidQuestion([{ ...p, period: '2025-12' }], today)).toBe('¿Ya lo pagaste con el resumen de diciembre de 2025?');
  });

  it('el pago propuesto y el final del toast', () => {
    expect(proposedPaymentText(p, 'Mercado Pago')).toBe('Pago de $12.000 desde Mercado Pago, 6/10');
    expect(paymentsToastSuffix([])).toBe('');
    expect(paymentsToastSuffix([p])).toBe(' · pago de $12.000 registrado');
    expect(paymentsToastSuffix([p, p, p])).toBe(' · pagos de $36.000 registrados');
  });
});
