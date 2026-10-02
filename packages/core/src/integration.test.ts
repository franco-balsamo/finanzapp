// T-15: un gasto de grupo pagado con tarjeta impacta distinto en tarjeta, categoría y grupo (02 §7).

import { describe, expect, it } from 'vitest';
import { ars, cardA, fxCard } from './cards/fixtures';
import { cardState } from './cards/state';
import { groupBalances } from './groups/balances';
import type { Group, GroupExpense } from './groups/types';
import { categorySpend } from './personal/categorySpend';
import { expenseFrom } from './personal/fixtures';
import type { Movement } from './personal/types';
import { rate } from './money';

const cabana: Group = {
  id: 'cabana',
  currency: 'ARS',
  members: [
    { id: 'vos', name: 'Vos' },
    { id: 'ana', name: 'Ana' },
    { id: 'juan', name: 'Juan' },
  ],
};

const gastoDeGrupo = (payer: string): GroupExpense => ({
  id: 'g1',
  amount: ars(90_000),
  fxRate: null,
  payerMemberId: payer,
  splitMode: 'equal',
  parts: ['vos', 'ana', 'juan'].map((memberId) => ({ memberId, value: null })),
});

function impacto(personal: Movement[], payer: string) {
  const tarjeta = cardState({
    card: cardA,
    expenses: personal
      .filter((m) => m.cardId === 'A')
      .map((m) => ({ id: m.id, date: m.date, amount: m.amount, installments: m.installments })),
    payments: [],
    overrides: [],
    today: '2026-09-21',
    fxCard,
  });
  const categoria = categorySpend({
    movements: personal,
    cards: [{ card: cardA, overrides: [] }],
    month: '2026-09',
    reference: 'mep',
    todayRate: rate('1500.00'),
  });
  const saldo = groupBalances(cabana, [gastoDeGrupo(payer)], [])['vos'];
  return { tarjeta: tarjeta.limitUsed, categoria: categoria.total, saldo };
}

describe('impacto en tus finanzas (T-15)', () => {
  it('pagaste $90.000 con tarjeta en 3 iguales: tarjeta $90.000, categoría $30.000, te deben $60.000', () => {
    const personal = [
      expenseFrom('m1', '2026-09-20', ars(90_000), {
        cardId: 'A',
        myShare: ars(30_000),
        groupExpenseId: 'g1',
        categoryId: 'salidas',
      }),
    ];
    expect(impacto(personal, 'vos')).toEqual({
      tarjeta: ars(90_000),
      categoria: ars(30_000),
      saldo: ars(60_000),
    });
  });

  it('pagó otro: nada personal y tu saldo en el grupo es −$30.000', () => {
    expect(impacto([], 'ana')).toEqual({ tarjeta: ars(0), categoria: ars(0), saldo: ars(-30_000) });
  });

  it('"No sumarlo a mis finanzas": nada personal y te deben $60.000', () => {
    expect(impacto([], 'vos')).toEqual({ tarjeta: ars(0), categoria: ars(0), saldo: ars(60_000) });
  });
});
