import { describe, expect, it } from 'vitest';
import { ars, usd } from '../cards/fixtures.ts';
import { rate } from '../money.ts';
import { movementList, type MovementFilter } from './movements.ts';
import type { DbWalletAccount, DbWalletCard, DbWalletMovement, WalletInput } from './wallet.ts';

// Hoy: jueves 8/10/2026. Visa con cierre 24: el resumen en curso cierra el 24/10.
const today = '2026-10-08';

const visa: DbWalletCard = {
  id: 'visa', name: 'Visa', bank: 'Banco Galicia', network: 'VISA', last4: '2337', color: null,
  is_favorite: true, close_day: 24, due_day: 6, credit_limit: null, expiry: null, created_at: '2026-10-01T10:00:00Z',
  archived_at: null,
};
const caja: DbWalletAccount = { id: 'caja', name: 'Caja de Ahorros', type: 'bank', currency: 'ARS', opening_balance: '0', created_at: '2026-10-01T10:00:00Z' };

function movement(fields: Partial<DbWalletMovement> & Pick<DbWalletMovement, 'id' | 'amount'>): DbWalletMovement {
  return {
    type: 'expense', date: '2026-10-02', description: 'gasto', currency: 'ARS', card_id: 'visa', account_id: null, to_account_id: null,
    installments: 1, category_id: null, my_share: null, group_expense_id: null, fx_mep: null, fx_oficial: null,
    fx_blue: null, fx_pending: false, debited_amount: null, origin: 'manual', group_payment_id: null, ...fields,
  };
}

function input(movements: DbWalletMovement[], fields: Partial<WalletInput> = {}): WalletInput {
  return {
    today, display: 'ARS', reference: 'mep', referenceRate: rate('1500'), fxCard: rate('2028'),
    cards: [visa], accounts: [caja], payments: [], overrides: [], groups: [], movements, ...fields,
  };
}

const october: MovementFilter = { month: '2026-10', query: '', missingMethodOnly: false };

const ids = (list: ReturnType<typeof movementList>) => list.days.flatMap((d) => d.rows.map((r) => r.id));

describe('lista de movimientos', () => {
  it('el mes por la fecha del gasto, agrupado por día de más nuevo a más viejo', () => {
    const list = movementList(input([
      movement({ id: 'coto', amount: '12000.00', date: '2026-10-07' }),
      movement({ id: 'septiembre', amount: '5000.00', date: '2026-09-30' }),
      movement({ id: 'cafe', amount: '3000.00', date: '2026-10-08' }),
      movement({ id: 'farmacia', amount: '8000.00', date: '2026-10-07' }),
    ]), october);

    expect(list.days.map((d) => [d.date, d.rows.map((r) => r.id)])).toEqual([
      ['2026-10-08', ['cafe']],
      ['2026-10-07', ['coto', 'farmacia']],
    ]);
    expect(list.count).toBe(3);
    expect(list.totals).toEqual({ ARS: ars(23_000), USD: null });
    expect(list.months).toEqual(['2026-10', '2026-09']);
  });

  it('"Todos los meses" muestra todo', () => {
    const list = movementList(input([
      movement({ id: 'octubre', amount: '1.00', date: '2026-10-07' }),
      movement({ id: 'agosto', amount: '1.00', date: '2026-08-30' }),
    ]), { ...october, month: 'all' });
    expect(ids(list)).toEqual(['octubre', 'agosto']);
  });

  describe('búsqueda (L14)', () => {
    const movements = [
      movement({ id: 'cafe', amount: '3500.00', description: 'Café Martínez' }),
      movement({ id: 'farmacia', amount: '12000.00', description: 'Farmacia' }),
      movement({ id: 'coto', amount: '120.00', description: 'Coto' }),
    ];

    it('por descripción, sin acentos ni mayúsculas', () => {
      expect(ids(movementList(input(movements), { ...october, query: 'cafe mart' }))).toEqual(['cafe']);
      expect(ids(movementList(input(movements), { ...october, query: 'FARMA' }))).toEqual(['farmacia']);
    });

    it('por monto, con o sin puntos', () => {
      expect(ids(movementList(input(movements), { ...october, query: '12000' }))).toEqual(['farmacia']);
      expect(ids(movementList(input(movements), { ...october, query: '12.000' }))).toEqual(['farmacia']);
      expect(ids(movementList(input(movements), { ...october, query: '120' }))).toEqual(['farmacia', 'coto']);
    });

    it('el total y la cuenta son los del filtro', () => {
      const list = movementList(input(movements), { ...october, query: '12000' });
      expect(list.count).toBe(1);
      expect(list.totals).toEqual({ ARS: ars(12_000), USD: null });
    });
  });

  it('el total suma solo los gastos, por moneda; ingresos y ajustes llevan signo (L12, L13)', () => {
    const list = movementList(input([
      movement({ id: 'gasto', amount: '245300.00' }),
      movement({ id: 'netflix', amount: '30.00', currency: 'USD' }),
      movement({ id: 'sueldo', type: 'income', amount: '900000.00', card_id: null, account_id: 'caja' }),
      movement({ id: 'mas', type: 'adjustment', amount: '1000.00', card_id: null, account_id: 'caja' }),
      movement({ id: 'menos', type: 'adjustment', amount: '-2500.00', card_id: null, account_id: 'caja' }),
    ]), october);

    expect(list.count).toBe(5);
    expect(list.totals).toEqual({ ARS: ars(245_300), USD: usd(30) });
    const rows = Object.fromEntries(list.days[0]!.rows.map((r) => [r.id, [r.sign, r.amount]]));
    expect(rows).toEqual({
      gasto: ['none', ars(245_300)],
      netflix: ['none', usd(30)],
      sueldo: ['plus', ars(900_000)],
      mas: ['plus', ars(1_000)],
      menos: ['minus', ars(2_500)],
    });
  });

  it('qué abre cada fila (L6)', () => {
    const list = movementList(input([
      movement({ id: 'personal', amount: '1.00' }),
      movement({ id: 'grupo', amount: '1.00', group_expense_id: 'ge1', my_share: '0.50' }),
      movement({ id: 'reclamo', amount: '1.00', card_id: null, origin: 'claim', group_expense_id: 'ge2', my_share: '0.50' }),
      movement({ id: 'ingreso', type: 'income', amount: '1.00', card_id: null, account_id: 'caja' }),
      movement({ id: 'ajuste', type: 'adjustment', amount: '1.00', card_id: null, account_id: 'caja' }),
      movement({ id: 'pago-grupo', type: 'adjustment', amount: '-1.00', card_id: null, account_id: 'caja', group_payment_id: 'gp1' }),
      movement({ id: 'purga', type: 'card_payment', amount: '1.00', card_id: null, account_id: 'caja', origin: 'purge' }),
    ]), october);

    const actions = Object.fromEntries(list.days[0]!.rows.map((r) => [r.id, [r.action, r.isGroup, r.groupExpenseId]]));
    expect(actions).toEqual({
      personal: ['edit', false, null],
      grupo: ['group', true, 'ge1'],
      reclamo: ['complete', true, 'ge2'],
      ingreso: ['none', false, null],
      ajuste: ['none', false, null],
      'pago-grupo': ['none', false, null],
      purga: ['none', false, null],
    });
  });

  it('un gasto de una tarjeta archivada no se edita: la hoja no la ofrece como medio de pago', () => {
    const vieja: DbWalletCard = { ...visa, id: 'vieja', archived_at: '2026-10-05T12:00:00Z' };
    const list = movementList(input([
      movement({ id: 'archivada', amount: '1.00', card_id: 'vieja' }),
      movement({ id: 'reclamo', amount: '1.00', card_id: 'vieja', origin: 'claim', group_expense_id: 'ge', my_share: '0.50' }),
    ], { cards: [visa, vieja] }), october);
    expect(Object.fromEntries(list.days[0]!.rows.map((r) => [r.id, r.action]))).toEqual({ archivada: 'none', reclamo: 'none' });
  });

  it('la ficha "Sin medio de pago" muestra solo esos, en todos los meses', () => {
    const movements = [
      movement({ id: 'visa', amount: '1.00' }),
      movement({ id: 'asado', amount: '48000.00', date: '2026-08-15', card_id: null, origin: 'claim', group_expense_id: 'ge', my_share: '16000.00' }),
      movement({ id: 'completo', amount: '1.00', card_id: 'visa', origin: 'claim', group_expense_id: 'ge3', my_share: '0.50' }),
    ];
    expect(movementList(input(movements), october).missingMethodCount).toBe(1);

    const list = movementList(input(movements), { ...october, missingMethodOnly: true });
    expect(ids(list)).toEqual(['asado']);
    expect(list.days[0]!.rows[0]).toMatchObject({ methodLabel: null, myShare: ars(16_000) });
  });

  it('medio de pago: tarjeta con los últimos 4 (también archivada) o el nombre de la cuenta', () => {
    const vieja: DbWalletCard = { ...visa, id: 'vieja', name: 'Master', last4: '9876', archived_at: '2026-10-05T12:00:00Z' };
    const list = movementList(input([
      movement({ id: 'visa', amount: '1.00' }),
      movement({ id: 'vieja', amount: '1.00', card_id: 'vieja' }),
      movement({ id: 'caja', amount: '1.00', card_id: null, account_id: 'caja' }),
    ], { cards: [visa, vieja] }), october);

    expect(Object.fromEntries(list.days[0]!.rows.map((r) => [r.id, r.methodLabel]))).toEqual({
      visa: 'Visa ·· 2337',
      vieja: 'Master ·· 9876',
      caja: 'Caja de Ahorros',
    });
  });

  it('cuotas: "cuota k/N" con el resumen en curso y "N cuotas de $X" si ya cerraron todas (L11)', () => {
    const list = movementList(input([
      // 6 cuotas desde el resumen de julio: la de octubre es la 4.
      movement({ id: 'tele', amount: '60000.00', date: '2026-07-15', installments: 6 }),
      // Marzo, abril y mayo: ya cerraron todas.
      movement({ id: 'heladera', amount: '30000.00', date: '2026-03-10', installments: 3 }),
      movement({ id: 'un-pago', amount: '5000.00', date: '2026-03-10' }),
    ]), { ...october, month: 'all' });

    expect(Object.fromEntries(list.days.flatMap((d) => d.rows).map((r) => [r.id, r.installmentsLabel]))).toEqual({
      tele: 'cuota 4/6',
      heladera: '3 cuotas de $10.000',
      'un-pago': null,
    });
  });
});
