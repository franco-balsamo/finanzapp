// Ejemplos compartidos con la base: packages/core/fixtures/group-balances.json.
// El mismo JSON genera supabase/tests/05_group_balances.test.sql (pnpm gen:sql-fixtures).
import { describe, expect, it } from 'vitest';
import data from '../../fixtures/group-balances.json' with { type: 'json' };
import { fromDbNumeric, rate, type Currency } from '../money.ts';
import { groupBalances, isSettled } from './balances.ts';
import { shares } from './shares.ts';
import type { Group, GroupExpense, GroupPayment } from './types.ts';

interface FixtureCase {
  name: string;
  currency: string;
  members: string[];
  expenses: {
    id: string;
    amount: string;
    currency: string;
    fxRate: string | null;
    payer: string;
    splitMode: string;
    parts: (string | null)[][];
  }[];
  payments: { id: string; from: string; to: string; amount: string; voided: boolean }[];
  shares?: Record<string, Record<string, string>>;
  balances: Record<string, string>;
}

const cases = data.cases as FixtureCase[];

function build(c: FixtureCase) {
  const currency = c.currency as Currency;
  const group: Group = { id: c.name, currency, members: c.members.map((id) => ({ id, name: id })) };
  const expenses: GroupExpense[] = c.expenses.map((e) => ({
    id: e.id,
    amount: fromDbNumeric(e.amount, e.currency as Currency),
    fxRate: e.fxRate === null ? null : rate(e.fxRate),
    payerMemberId: e.payer,
    splitMode: e.splitMode as GroupExpense['splitMode'],
    parts: e.parts.map(([memberId, value]) => ({
      memberId: memberId as string,
      value: value == null ? null : fromDbNumeric(value, e.currency as Currency),
    })),
  }));
  const payments: GroupPayment[] = c.payments.map((p) => ({
    id: p.id,
    fromMemberId: p.from,
    toMemberId: p.to,
    amount: fromDbNumeric(p.amount, currency),
    deletedAt: p.voided ? '2026-10-02' : null,
  }));
  return { group, expenses, payments, currency };
}

const asMoney = (values: Record<string, string>, currency: Currency) =>
  Object.fromEntries(Object.entries(values).map(([id, v]) => [id, fromDbNumeric(v, currency)]));

describe('saldos de grupo: ejemplos compartidos con la base', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const { group, expenses, payments, currency } = build(c);
    for (const [expenseId, expected] of Object.entries(c.shares ?? {})) {
      const expense = expenses.find((e) => e.id === expenseId);
      if (!expense) throw new Error(`No hay gasto ${expenseId}`);
      expect(shares(group, expense)).toEqual(asMoney(expected, currency));
    }
    expect(groupBalances(group, expenses, payments)).toEqual(asMoney(c.balances, currency));
  });

  it.each(data.settled.map((s) => [s.amount, s.currency, s.settled] as const))(
    'al día: %s %s → %s',
    (amount, currency, settled) => {
      expect(isSettled(fromDbNumeric(amount, currency as Currency))).toBe(settled);
    },
  );
});
