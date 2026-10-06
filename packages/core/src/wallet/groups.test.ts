import { describe, expect, it } from 'vitest';
import { ars, usd } from '../cards/fixtures.ts';
import { savedToastText } from '../entry/toast.ts';
import { rate } from '../money.ts';
import { groupDetail, groupList } from './groups.ts';
import type { DbWalletGroup, WalletInput } from './wallet.ts';

type Member = DbWalletGroup['members'][number];
type Expense = DbWalletGroup['expenses'][number];
type Payment = DbWalletGroup['payments'][number];

const member = (id: string, name: string, fields: Partial<Member> = {}): Member => ({
  id, display_name: name, user_id: `u-${id}`, left_at: null, claimed_at: null, ...fields,
});

const vos = member('vos', 'Vos');
const ana = member('ana', 'Ana', { claimed_at: '2026-10-02T15:00:00Z' });
const juan = member('juan', 'Juan', { user_id: null });

function expense(id: string, date: string, amount: string, payer: string, fields: Partial<Expense> = {}): Expense {
  return {
    id, date, description: id, amount, currency: 'ARS', fx_rate: null, payer_member_id: payer, split_mode: 'equal',
    category_id: null, parts: [], ...fields,
  };
}

const payment = (id: string, from: string, to: string, amount: string, fields: Partial<Payment> = {}): Payment => ({
  id, from_member_id: from, to_member_id: to, amount, date: '2026-10-05', deleted_at: null, ...fields,
});

// Ejemplo de 02 §7: Vos paga $90.000 en partes iguales; Ana paga $30.000 en montos (Ana $10.000, Juan $20.000).
function cabana(fields: Partial<DbWalletGroup> = {}): DbWalletGroup {
  return {
    id: 'cabana', name: 'Cabaña', currency: 'ARS', owner_member_id: 'vos', my_member_id: 'vos',
    members: [vos, ana, juan],
    expenses: [
      expense('súper', '2026-10-02', '90000.00', 'vos', {
        category_id: 'cat-super',
        parts: [{ member_id: 'vos', value: '1' }, { member_id: 'ana', value: '1' }, { member_id: 'juan', value: '1' }],
      }),
      expense('nafta', '2026-10-03', '30000.00', 'ana', {
        split_mode: 'exact',
        parts: [{ member_id: 'ana', value: '10000.00' }, { member_id: 'juan', value: '20000.00' }],
      }),
    ],
    payments: [],
    ...fields,
  };
}

function input(groups: DbWalletGroup[]): WalletInput {
  return {
    today: '2026-10-06', display: 'ARS', referenceRate: rate('1500'), fxCard: rate('2028'),
    cards: [], accounts: [], movements: [], payments: [], overrides: [], groups,
  };
}

describe('detalle de grupo (1A, 02 §7)', () => {
  it('ejemplo de 02 §7: +$60.000, total $120.000 y 2 transferencias', () => {
    const d = groupDetail(input([cabana()]), 'cabana');
    expect(d).toMatchObject({ name: 'Cabaña', isOwner: true, ownerName: 'Vos', memberCount: 3, myBalance: ars(60_000), totalSpent: ars(120_000) });
    expect(d.transfers).toEqual([
      { fromId: 'juan', fromName: 'Juan', toId: 'vos', toName: 'Vos', amount: ars(50_000), involvesMe: true },
      { fromId: 'ana', fromName: 'Ana', toId: 'vos', toName: 'Vos', amount: ars(10_000), involvesMe: true },
    ]);
  });

  it('integrantes: saldo, provisorio y reclamado', () => {
    const { members } = groupDetail(input([cabana()]), 'cabana');
    expect(members.map((m) => [m.name, m.balance, m.isMe, m.isProvisional, m.claimedOn, m.settled])).toEqual([
      ['Vos', ars(60_000), true, false, null, false],
      ['Ana', ars(-10_000), false, false, '2026-10-02', false],
      ['Juan', ars(-50_000), false, true, null, false],
    ]);
  });

  it('gastos del más nuevo al más viejo, con quién pagó y tu parte', () => {
    const { expenses } = groupDetail(input([cabana()]), 'cabana');
    expect(expenses.map((e) => [e.id, e.payerName, e.amount, e.myShare, e.categoryId])).toEqual([
      ['nafta', 'Ana', ars(30_000), ars(0), null],
      ['súper', 'Vos', ars(90_000), ars(30_000), 'cat-super'],
    ]);
  });

  it('umbral (02 §7): Beto, Caro y Dani en $0 y al día; Ana paga $0,99 a cada uno', () => {
    const people = ['ana', 'beto', 'caro', 'dani'];
    const g = cabana({
      members: people.map((id) => member(id, id[0]!.toUpperCase() + id.slice(1))),
      my_member_id: 'beto',
      owner_member_id: 'ana',
      expenses: ['beto', 'caro', 'dani'].map((payer) =>
        expense(`e-${payer}`, '2026-10-01', '0.99', payer, { split_mode: 'exact', parts: [{ member_id: 'ana', value: '0.99' }] }),
      ),
    });
    const d = groupDetail(input([g]), 'cabana');
    expect(d.members.map((m) => [m.name, m.balance, m.settled])).toEqual([
      ['Ana', ars(-2.97), false],
      ['Beto', ars(0), true],
      ['Caro', ars(0), true],
      ['Dani', ars(0), true],
    ]);
    expect(d.transfers.map((t) => [t.fromName, t.toName, t.amount])).toEqual([
      ['Ana', 'Beto', ars(0.99)],
      ['Ana', 'Caro', ars(0.99)],
      ['Ana', 'Dani', ars(0.99)],
    ]);
    expect(d.myBalance).toEqual(ars(0));
  });

  it('un pago anulado se muestra pero no cambia los saldos', () => {
    const g = cabana({
      payments: [
        payment('p1', 'juan', 'vos', '50000.00', { date: '2026-10-04' }),
        payment('p2', 'ana', 'vos', '10000.00', { deleted_at: '2026-10-06T12:00:00Z' }),
      ],
    });
    const d = groupDetail(input([g]), 'cabana');
    expect(d.myBalance).toEqual(ars(10_000));
    expect(d.payments.map((p) => [p.id, p.fromName, p.toName, p.amount, p.voided])).toEqual([
      ['p2', 'Ana', 'Vos', ars(10_000), true],
      ['p1', 'Juan', 'Vos', ars(50_000), false],
    ]);
    expect(d.transfers).toEqual([{ fromId: 'ana', fromName: 'Ana', toId: 'vos', toName: 'Vos', amount: ars(10_000), involvesMe: true }]);
  });

  it('los que se fueron: al final si participaron; si no, no salen', () => {
    const caro = member('caro', 'Caro', { left_at: '2026-10-04T12:00:00Z' });
    const lu = member('lu', 'Lu', { left_at: '2026-10-04T12:00:00Z' });
    const g = cabana({
      members: [vos, caro, ana, juan, lu],
      expenses: [expense('viejo', '2026-09-01', '1000.00', 'vos', { parts: [{ member_id: 'vos', value: '1' }, { member_id: 'caro', value: '1' }] })],
      payments: [payment('pc', 'caro', 'vos', '500.00')],
    });
    const d = groupDetail(input([g]), 'cabana');
    expect(d.members.map((m) => [m.name, m.leftOn])).toEqual([
      ['Vos', null],
      ['Ana', null],
      ['Juan', null],
      ['Caro', '2026-10-04'],
    ]);
    expect(d.memberCount).toBe(3);
  });

  it('un gasto en dólares se suma al total con su cotización', () => {
    const g = cabana({
      expenses: [expense('vuelo', '2026-10-01', '120.00', 'vos', {
        currency: 'USD', fx_rate: '1500.0000',
        parts: [{ member_id: 'vos', value: '1' }, { member_id: 'ana', value: '1' }],
      })],
    });
    const d = groupDetail(input([g]), 'cabana');
    expect(d.totalSpent).toEqual(ars(180_000));
    expect(d.expenses[0]!.amount).toEqual(usd(120));
    expect(d.expenses[0]!.myShare).toEqual(ars(90_000));
  });

  it('sin dueño', () => {
    expect(groupDetail(input([cabana({ owner_member_id: null })]), 'cabana')).toMatchObject({ isOwner: false, ownerName: null });
  });
});

describe('lista de grupos', () => {
  it('suma lo que te deben y lo que debés, por moneda', () => {
    const debo = cabana({
      id: 'asado', name: 'Asado', my_member_id: 'ana',
      expenses: [expense('carne', '2026-10-01', '10000.00', 'vos', { parts: [{ member_id: 'vos', value: '1' }, { member_id: 'ana', value: '1' }] })],
    });
    const enDolares = cabana({
      id: 'viaje', name: 'Viaje', currency: 'USD',
      expenses: [expense('hotel', '2026-10-01', '100.00', 'vos', { currency: 'USD', parts: [{ member_id: 'vos', value: '1' }, { member_id: 'juan', value: '1' }] })],
    });
    const list = groupList(input([cabana(), debo, enDolares]));
    expect(list.groups.map((g) => [g.name, g.memberCount, g.myBalance])).toEqual([
      ['Cabaña', 3, ars(60_000)],
      ['Asado', 3, ars(-5_000)],
      ['Viaje', 3, usd(50)],
    ]);
    expect(list.owed).toEqual({ ARS: ars(60_000), USD: usd(50) });
    expect(list.owe).toEqual({ ARS: ars(5_000), USD: usd(0) });
  });

  it('sin grupos', () => {
    expect(groupList(input([]))).toEqual({ groups: [], owed: { ARS: ars(0), USD: usd(0) }, owe: { ARS: ars(0), USD: usd(0) } });
  });
});

describe('toast de un gasto de grupo (9A)', () => {
  it('si pagaste vos, tu parte y lo que te deben', () => {
    expect(savedToastText({ kind: 'group', myShare: ars(30_000), owedToMe: ars(60_000) })).toBe('Guardado · tu parte $30.000; te deben $60.000');
  });

  it('si pagó otro, solo tu parte', () => {
    expect(savedToastText({ kind: 'group', myShare: ars(30_000), owedToMe: null })).toBe('Guardado · tu parte $30.000');
  });
});
