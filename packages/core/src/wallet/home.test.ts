import { describe, expect, it } from 'vitest';
import { ars, usd } from '../cards/fixtures.ts';
import { rate } from '../money.ts';
import { home, type DbNotification } from './home.ts';
import type { DbWalletAccount, DbWalletCard, DbWalletGroup, DbWalletMovement, WalletInput } from './wallet.ts';

// Hoy: jueves 8/10/2026. Visa con cierre 24 y vencimiento 6: el resumen en curso cierra el 24/10.
const today = '2026-10-08';

const visa: DbWalletCard = {
  id: 'visa', name: 'Visa Galicia', bank: 'Banco Galicia', network: 'VISA', last4: '2337', color: '#23262b',
  is_favorite: false, close_day: 24, due_day: 6, credit_limit: '2000000.00', expiry: '07/30', created_at: '2026-10-01T10:00:00Z',
  archived_at: null,
};
const pesos: DbWalletAccount = { id: 'pesos', name: 'Caja Galicia', type: 'bank', currency: 'ARS', opening_balance: '500000.00', created_at: '2026-10-01T10:00:00Z' };
const dolares: DbWalletAccount = { id: 'dolares', name: 'Caja USD', type: 'bank', currency: 'USD', opening_balance: '1000.00', created_at: '2026-10-01T11:00:00Z' };

function movement(fields: Partial<DbWalletMovement> & Pick<DbWalletMovement, 'id' | 'amount'>): DbWalletMovement {
  return {
    type: 'expense', date: '2026-10-02', description: 'gasto', currency: 'ARS', card_id: null, account_id: null, to_account_id: null,
    installments: 1, category_id: null, my_share: null, group_expense_id: null, fx_mep: null, fx_oficial: null,
    fx_blue: null, fx_pending: false, debited_amount: null, origin: 'manual', group_payment_id: null, ...fields,
  };
}

/** Grupo en partes iguales entre vos y Juan: el que pagó `paid` queda con la mitad a favor. */
function group(id: string, paid: string, payer: 'yo' | 'juan' = 'yo'): DbWalletGroup {
  return {
    id, name: `Grupo ${id}`, currency: 'ARS', owner_member_id: 'yo', my_member_id: 'yo',
    members: [
      { id: 'yo', display_name: 'Fran', user_id: 'u1', left_at: null, claimed_at: null },
      { id: 'juan', display_name: 'Juan', user_id: null, left_at: null, claimed_at: null },
    ],
    expenses: [{
      id: `${id}-e`, date: '2026-10-01', description: 'asado', amount: paid, currency: 'ARS', fx_rate: null,
      payer_member_id: payer, split_mode: 'equal', category_id: null,
      parts: [{ member_id: 'yo', value: '1' }, { member_id: 'juan', value: '1' }],
    }],
    payments: [],
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

describe('Inicio', () => {
  it('ejemplo de 02 §8: patrimonio con un grupo a favor por $60.000', () => {
    const h = home(input({ groups: [group('asado', '120000.00')] }), []);
    expect(h.netWorth).toEqual({ accounts: ars(2_000_000), groups: ars(60_000), cards: ars(288_400), total: ars(1_771_600) });
  });

  describe('próximos vencimientos', () => {
    it('el resumen cerrado con saldo y el en curso con consumos, por fecha de vencimiento', () => {
      const h = home(input({ movements: [
        movement({ id: 'en-curso', amount: '187000.00', card_id: 'visa' }),
        movement({ id: 'cerrado', amount: '80000.00', card_id: 'visa', date: '2026-09-10' }),
      ] }), []);
      expect(h.dues).toEqual([
        {
          cardId: 'visa', cardName: 'Visa Galicia', network: 'VISA', color: '#23262b', period: '2026-09', kind: 'closed',
          closeDate: null, dueDate: '2026-10-06', pending: { ARS: ars(80_000), USD: usd(0) }, overdue: true, daysToDue: -2,
        },
        {
          cardId: 'visa', cardName: 'Visa Galicia', network: 'VISA', color: '#23262b', period: '2026-10', kind: 'current',
          closeDate: '2026-10-24', dueDate: '2026-11-06', pending: { ARS: ars(187_000), USD: usd(0) }, overdue: false, daysToDue: 29,
        },
      ]);
    });

    it('sin el resumen en curso vacío ni las tarjetas archivadas', () => {
      const archivada = { ...visa, id: 'vieja', archived_at: '2026-10-07T12:00:00Z' };
      const h = home(input({ cards: [visa, archivada], movements: [
        movement({ id: 'cerrado', amount: '80000.00', card_id: 'visa', date: '2026-09-10' }),
        movement({ id: 'de-la-vieja', amount: '5000.00', card_id: 'vieja' }),
      ] }), []);
      expect(h.dues.map((d) => [d.cardId, d.kind])).toEqual([['visa', 'closed']]);
    });

    it('con 6 resúmenes por pagar se ven los 4 que vencen primero', () => {
      // Cierres 24, 26 y 28: vencen el 6, 8 y 10 de cada mes.
      const cards = [24, 26, 28].map((day, i) => ({ ...visa, id: `c${day}`, close_day: day, due_day: 6 + 2 * i }));
      const h = home(input({ cards, movements: cards.flatMap((c) => [
        movement({ id: `${c.id}-cerrado`, amount: '1000.00', card_id: c.id, date: '2026-09-10' }),
        movement({ id: `${c.id}-en-curso`, amount: '1000.00', card_id: c.id }),
      ]) }), []);
      expect(h.dues.map((d) => [d.dueDate, d.daysToDue, d.overdue])).toEqual([
        ['2026-10-06', -2, true],
        ['2026-10-08', 0, false],
        ['2026-10-10', 2, false],
        ['2026-11-06', 29, false],
      ]);
    });
  });

  describe('gastos del mes', () => {
    const cuotas = movement({ id: 'tv', amount: '30000.00', card_id: 'visa', installments: 3, date: '2026-09-25', category_id: 'cat-otros' });

    it('ejemplo de 02 §6: $30.000 en 3 cuotas del 25/9 cuenta $10.000 en octubre', () => {
      const h = home(input({ movements: [cuotas] }), []);
      expect(h.spend).toEqual({ byCategory: { 'cat-otros': ars(10_000) }, total: ars(10_000), approximate: false });
    });

    it('y nada en septiembre', () => {
      expect(home(input({ today: '2026-09-28', movements: [cuotas] }), []).spend?.total).toEqual(ars(0));
    });

    it('de un gasto de grupo de $90.000 entre 3 que pagaste vos, cuenta tu parte', () => {
      const asado = movement({ id: 'asado', amount: '90000.00', account_id: 'pesos', my_share: '30000.00', group_expense_id: 'ge1', category_id: 'cat-salidas' });
      expect(home(input({ movements: [asado] }), []).spend?.byCategory).toEqual({ 'cat-salidas': ars(30_000) });
    });

    it('un gasto en dólares usa la cotización guardada del dólar de referencia', () => {
      const libro = movement({ id: 'libro', amount: '20.00', currency: 'USD', account_id: 'dolares', fx_mep: '1400', fx_blue: '1450' });
      expect(home(input({ movements: [libro] }), []).spend).toMatchObject({ total: ars(28_000), approximate: false });
    });

    it('sin cotización de hoy y con un gasto en dólares sin cotización guardada, no se calcula', () => {
      const libro = movement({ id: 'libro', amount: '20.00', currency: 'USD', account_id: 'dolares', fx_pending: true });
      expect(home(input({ referenceRate: null, movements: [libro] }), []).spend).toBeNull();
    });
  });

  describe('grupos', () => {
    it('hasta 3 con saldo, del mayor al menor en valor absoluto', () => {
      const h = home(input({ groups: [
        group('chico', '20000.00'),
        group('asado', '120000.00'),
        group('al-dia', '1.50'), // $0,75 a favor: debajo del umbral, está al día
        group('viaje', '300000.00', 'juan'),
        group('cine', '40000.00'),
      ] }), []);
      expect(h.groups).toEqual([
        { id: 'viaje', name: 'Grupo viaje', balance: ars(-150_000) },
        { id: 'asado', name: 'Grupo asado', balance: ars(60_000) },
        { id: 'cine', name: 'Grupo cine', balance: ars(20_000) },
      ]);
      expect(h.hasGroups).toBe(true);
    });

    it('todos al día: ninguno en la lista, pero hay grupos', () => {
      const h = home(input({ groups: [group('al-dia', '1.50')] }), []);
      expect([h.groups, h.hasGroups]).toEqual([[], true]);
    });
  });

  describe('avisos', () => {
    function notice(fields: Partial<DbNotification> & Pick<DbNotification, 'id' | 'created_at'>): DbNotification {
      return { title: 'Cierre de tarjeta', body: 'Cerró tu Visa: te vienen $80.000. ¿Te falta cargar algo?', kind: 'card_closing', data: { card_ids: ['visa'] }, read_at: null, ...fields };
    }
    const archivada = { ...visa, id: 'vieja', archived_at: '2026-10-01T12:00:00Z' };
    // El aviso de cierre del 24/9 a las 20:00; ese resumen vence el 6/10.
    const cierre = notice({ id: 'n1', created_at: '2026-09-24T23:00:00Z' });
    const septiembre = movement({ id: 'cerrado', amount: '80000.00', card_id: 'visa', date: '2026-09-10' });
    const pago = {
      id: 'p', card_id: 'visa', period: '2026-09-01', applies_to: 'ARS' as const, amount: '80000.00', from_account_id: 'pesos',
      debited_amount: '80000.00', fx_card_rate: null, paid_at: '2026-10-03T15:00:00Z', reverted_at: null,
    };
    const banners = (fields: Partial<WalletInput>, notices = [cierre]) =>
      home(input({ movements: [septiembre], ...fields }), notices).closingBanners.map((b) => [b.id, b.cardId]);

    it('"Cerró tu Visa" sigue hasta el día del vencimiento, inclusive', () => {
      expect(banners({ today: '2026-10-05' })).toEqual([['n1', 'visa']]);
      expect(banners({ today: '2026-10-06' })).toEqual([['n1', 'visa']]);
      expect(banners({ today: '2026-10-07' })).toEqual([]);
    });

    it('se va al pagar el resumen', () => {
      expect(banners({ today: '2026-10-05', payments: [pago] })).toEqual([]);
    });

    it('sin consumos cargados también se ve: es para preguntar si falta cargar algo', () => {
      expect(banners({ today: '2026-10-05', movements: [] })).toEqual([['n1', 'visa']]);
    });

    it('abre la primera tarjeta vigente, salteando las archivadas', () => {
      const varias = notice({ id: 'n2', created_at: '2026-09-24T23:00:00Z', data: { card_ids: ['vieja', 'visa'] } });
      expect(banners({ today: '2026-10-05', cards: [visa, archivada] }, [varias])).toEqual([['n2', 'visa']]);
      const soloArchivada = notice({ id: 'n3', created_at: '2026-09-24T23:00:00Z', data: { card_ids: ['vieja'] } });
      expect(banners({ today: '2026-10-05', cards: [visa, archivada] }, [soloArchivada])).toEqual([]);
    });

    it('el aviso de vencimiento no es un "Cerró tu Visa"', () => {
      expect(banners({ today: '2026-10-05' }, [{ ...cierre, kind: 'card_due' }])).toEqual([]);
    });

    it('los 3 avisos más recientes, leídos o no, con la tarjeta que abren', () => {
      const h = home(input({ cards: [visa, archivada] }), [
        notice({ id: 'viejo', created_at: '2026-09-01T13:00:00Z' }),
        notice({ id: 'grupo', created_at: '2026-10-07T13:00:00Z', kind: null, data: null, title: 'Asado', body: 'Juan cargó un gasto' }),
        notice({ id: 'leido', created_at: '2026-10-06T13:00:00Z', read_at: '2026-10-06T14:00:00Z', data: { card_ids: ['vieja', 'visa'] } }),
        notice({ id: 'archivada', created_at: '2026-10-05T13:00:00Z', data: { card_ids: ['vieja'] } }),
      ]);
      expect(h.recentNotices.map((n) => [n.id, n.read, n.cardId])).toEqual([
        ['grupo', false, null],
        ['leido', true, 'visa'],
        ['archivada', false, null],
      ]);
      expect(h.recentNotices[0]).toMatchObject({ title: 'Asado', body: 'Juan cargó un gasto', createdAt: '2026-10-07T13:00:00Z' });
    });
  });
});
