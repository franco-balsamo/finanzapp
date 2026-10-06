// Grupos en la app (G-2): la lista y el detalle (diseño 1A) a partir de las filas de la base.
// Los saldos salen de groupBalances y simplifyDebts (02 §7); acá solo se arman las vistas.

import type { ByCurrency } from '../cards/types.ts';
import type { ISODate } from '../dates.ts';
import { displayBalance, groupBalances, isSettled } from '../groups/balances.ts';
import { shares } from '../groups/shares.ts';
import { simplifyDebts } from '../groups/simplify.ts';
import type { Group, GroupExpense, GroupPayment } from '../groups/types.ts';
import { add, fromDbNumeric, rate, zero, type Currency, type Money } from '../money.ts';
import { todayInArgentina } from '../notices/fromDb.ts';
import type { DbWalletGroup, WalletInput } from './wallet.ts';

/** Las filas de un grupo en los tipos de core. Los pagos anulados quedan con `deletedAt`. */
export function coreGroupFromDb(g: DbWalletGroup): { group: Group; expenses: GroupExpense[]; payments: GroupPayment[] } {
  return {
    group: { id: g.id, currency: g.currency, members: g.members.map((m) => ({ id: m.id, name: m.display_name })) },
    expenses: g.expenses.map((e) => ({
      id: e.id,
      amount: fromDbNumeric(e.amount, e.currency),
      fxRate: e.fx_rate === null ? null : rate(e.fx_rate),
      payerMemberId: e.payer_member_id,
      splitMode: e.split_mode,
      parts: e.parts.map((p) => ({
        memberId: p.member_id,
        value: e.split_mode === 'equal' ? null : fromDbNumeric(p.value, e.currency),
      })),
    })),
    payments: g.payments.map((p) => ({
      id: p.id,
      fromMemberId: p.from_member_id,
      toMemberId: p.to_member_id,
      amount: fromDbNumeric(p.amount, g.currency),
      deletedAt: p.deleted_at,
    })),
  };
}

const activeMembers = (g: DbWalletGroup) => g.members.filter((m) => m.left_at === null);
const dayOf = (timestamp: string | null): ISODate | null => (timestamp === null ? null : todayInArgentina(new Date(timestamp)));

export interface GroupListItem {
  id: string;
  name: string;
  currency: Currency;
  /** Integrantes activos. */
  memberCount: number;
  /** Tu saldo como se muestra (cero debajo del umbral). Positivo: te deben. */
  myBalance: Money;
}

export interface GroupList {
  groups: GroupListItem[];
  /** Lo que te deben y lo que debés, sumando todos tus grupos, por moneda (los dos en positivo). */
  owed: ByCurrency;
  owe: ByCurrency;
}

export function groupList(input: WalletInput): GroupList {
  const owed: ByCurrency = { ARS: zero('ARS'), USD: zero('USD') };
  const owe: ByCurrency = { ARS: zero('ARS'), USD: zero('USD') };
  const groups = input.groups.map((g): GroupListItem => {
    const { group, expenses, payments } = coreGroupFromDb(g);
    const mine = displayBalance(groupBalances(group, expenses, payments)[g.my_member_id] ?? zero(g.currency));
    if (mine.minor > 0) owed[g.currency] = add(owed[g.currency], mine);
    if (mine.minor < 0) owe[g.currency] = add(owe[g.currency], { minor: -mine.minor, currency: g.currency });
    return { id: g.id, name: g.name, currency: g.currency, memberCount: activeMembers(g).length, myBalance: mine };
  });
  return { groups, owed, owe };
}

export interface GroupMemberView {
  id: string;
  name: string;
  isMe: boolean;
  /** Sin cuenta en Mangos: "· sin cuenta". */
  isProvisional: boolean;
  /** Día en que reclamó su lugar: "· se sumó 2/10". */
  claimedOn: ISODate | null;
  /** Día en que se fue del grupo. */
  leftOn: ISODate | null;
  /** Como se muestra (cero debajo del umbral). */
  balance: Money;
  /** Al día (02 §7): puede abandonar el grupo. */
  settled: boolean;
}

export interface GroupTransferView {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: Money;
  involvesMe: boolean;
}

export interface GroupExpenseView {
  id: string;
  date: ISODate;
  description: string;
  /** En la moneda del gasto. */
  amount: Money;
  payerId: string;
  payerName: string;
  /** Tu parte, en la moneda del grupo. Cero si no participaste. */
  myShare: Money;
  categoryId: string | null;
}

export interface GroupPaymentView {
  id: string;
  date: ISODate;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: Money;
  voided: boolean;
}

export interface GroupDetail {
  id: string;
  name: string;
  currency: Currency;
  isOwner: boolean;
  /** null si el grupo quedó sin dueño. */
  ownerName: string | null;
  /** Integrantes activos: "4 personas". */
  memberCount: number;
  myBalance: Money;
  /** Suma de los gastos en la moneda del grupo. */
  totalSpent: Money;
  /** "Cómo saldar": como máximo N−1 transferencias. */
  transfers: GroupTransferView[];
  /** Los activos en orden de ingreso; al final, los que se fueron y participaron en algo. */
  members: GroupMemberView[];
  /** Del más nuevo al más viejo. */
  expenses: GroupExpenseView[];
  /** Del más nuevo al más viejo, también los anulados. */
  payments: GroupPaymentView[];
}

/** El detalle de un grupo (diseño 1A). */
export function groupDetail(input: WalletInput, groupId: string): GroupDetail {
  const g = input.groups.find((x) => x.id === groupId);
  if (!g) throw new RangeError(`Grupo desconocido: ${groupId}`);
  const { group, expenses, payments } = coreGroupFromDb(g);
  const balances = groupBalances(group, expenses, payments);
  const nameOf = (id: string) => g.members.find((m) => m.id === id)?.display_name ?? '';

  const participated = new Set<string>();
  for (const e of g.expenses) {
    participated.add(e.payer_member_id);
    e.parts.forEach((p) => participated.add(p.member_id));
  }
  for (const p of g.payments) {
    if (p.deleted_at !== null) continue;
    participated.add(p.from_member_id);
    participated.add(p.to_member_id);
  }

  const memberView = (m: DbWalletGroup['members'][number]): GroupMemberView => {
    const balance = balances[m.id] ?? zero(g.currency);
    return {
      id: m.id,
      name: m.display_name,
      isMe: m.id === g.my_member_id,
      isProvisional: m.user_id === null,
      claimedOn: dayOf(m.claimed_at),
      leftOn: dayOf(m.left_at),
      balance: displayBalance(balance),
      settled: isSettled(balance),
    };
  };

  let totalSpent = zero(g.currency);
  const expenseViews = expenses.map((e, i): GroupExpenseView => {
    const row = g.expenses[i]!;
    const parts = shares(group, e);
    for (const part of Object.values(parts)) totalSpent = add(totalSpent, part);
    return {
      id: e.id,
      date: row.date,
      description: row.description,
      amount: e.amount,
      payerId: e.payerMemberId,
      payerName: nameOf(e.payerMemberId),
      myShare: parts[g.my_member_id] ?? zero(g.currency),
      categoryId: row.category_id,
    };
  });

  const newestFirst = <T extends { date: ISODate }>(rows: T[]) =>
    rows.map((row, i) => ({ row, i })).sort((a, b) => (a.row.date === b.row.date ? b.i - a.i : a.row.date < b.row.date ? 1 : -1)).map((x) => x.row);

  return {
    id: g.id,
    name: g.name,
    currency: g.currency,
    isOwner: g.owner_member_id === g.my_member_id,
    ownerName: g.owner_member_id === null ? null : nameOf(g.owner_member_id),
    memberCount: activeMembers(g).length,
    myBalance: displayBalance(balances[g.my_member_id] ?? zero(g.currency)),
    totalSpent,
    transfers: simplifyDebts(group, balances).map((t) => ({
      fromId: t.fromMemberId,
      fromName: nameOf(t.fromMemberId),
      toId: t.toMemberId,
      toName: nameOf(t.toMemberId),
      amount: t.amount,
      involvesMe: t.fromMemberId === g.my_member_id || t.toMemberId === g.my_member_id,
    })),
    members: [
      ...activeMembers(g).map(memberView),
      ...g.members.filter((m) => m.left_at !== null && participated.has(m.id)).map(memberView),
    ],
    expenses: newestFirst(expenseViews),
    payments: newestFirst(
      g.payments.map((p): GroupPaymentView => ({
        id: p.id,
        date: p.date,
        fromId: p.from_member_id,
        fromName: nameOf(p.from_member_id),
        toId: p.to_member_id,
        toName: nameOf(p.to_member_id),
        amount: fromDbNumeric(p.amount, g.currency),
        voided: p.deleted_at !== null,
      })),
    ),
  };
}
