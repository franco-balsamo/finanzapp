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
import type { DbWalletGroup } from './wallet.ts';

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

/** Tus grupos activos (`loadGroups` de la app o `WalletInput.groups`). */
export function groupList(groups: readonly DbWalletGroup[]): GroupList {
  const owed: ByCurrency = { ARS: zero('ARS'), USD: zero('USD') };
  const owe: ByCurrency = { ARS: zero('ARS'), USD: zero('USD') };
  const items = groups.map((g): GroupListItem => {
    const { group, expenses, payments } = coreGroupFromDb(g);
    const mine = displayBalance(groupBalances(group, expenses, payments)[g.my_member_id] ?? zero(g.currency));
    if (mine.minor > 0) owed[g.currency] = add(owed[g.currency], mine);
    if (mine.minor < 0) owe[g.currency] = add(owe[g.currency], { minor: -mine.minor, currency: g.currency });
    return { id: g.id, name: g.name, currency: g.currency, memberCount: activeMembers(g).length, myBalance: mine };
  });
  return { groups: items, owed, owe };
}

export interface GroupMemberView {
  id: string;
  name: string;
  isMe: boolean;
  /** Sin cuenta en Mangos: "· sin cuenta". */
  isProvisional: boolean;
  /** Día en que reclamó su lugar: "· se sumó 2/10". */
  claimedOn: ISODate | null;
  /** Día en que se fue del grupo (null en la web de invitados, que no lo recibe). */
  leftOn: ISODate | null;
  /** Se fue del grupo. */
  left: boolean;
  /** Como se muestra (cero debajo del umbral). */
  balance: Money;
  /** Al día (02 §7): puede abandonar el grupo. */
  settled: boolean;
  /**
   * Pagó, tuvo parte o estuvo en un pago visible. Si es false (y está al día), el dueño lo puede
   * quitar. Los gastos borrados no llegan a la app: la base igual rechaza a quien participó en uno.
   */
  participated: boolean;
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
export function groupDetail(groups: readonly DbWalletGroup[], groupId: string): GroupDetail {
  const g = groups.find((x) => x.id === groupId);
  if (!g) throw new RangeError(`Grupo desconocido: ${groupId}`);
  const { group, expenses, payments } = coreGroupFromDb(g);
  const balances = groupBalances(group, expenses, payments);
  const nameOf = (id: string) => g.members.find((m) => m.id === id)?.display_name ?? '';

  const participated = new Set<string>();
  for (const e of g.expenses) {
    participated.add(e.payer_member_id);
    e.parts.forEach((p) => participated.add(p.member_id));
  }
  // Los pagos anulados también cuentan: la base no deja quitar a quien estuvo en uno.
  for (const p of g.payments) {
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
      left: m.left_at !== null,
      balance: displayBalance(balance),
      settled: isSettled(balance),
      participated: participated.has(m.id),
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

/**
 * Para el toast de un gasto de grupo (9A): tu parte y, si pagaste vos, lo que te deben de ese gasto.
 * En la moneda del grupo.
 */
export function expenseShareFor(g: DbWalletGroup, expense: GroupExpense): { myShare: Money; owedToMe: Money | null } {
  const { group } = coreGroupFromDb(g);
  const parts = shares(group, expense);
  const myShare = parts[g.my_member_id] ?? zero(g.currency);
  if (expense.payerMemberId !== g.my_member_id) return { myShare, owedToMe: null };
  const total = Object.values(parts).reduce(add, zero(g.currency));
  return { myShare, owedToMe: { minor: total.minor - myShare.minor, currency: g.currency } };
}

/** Los grupos para las fichas de la hoja de carga: los de actividad más reciente (gastos o pagos) primero. */
export function recentGroups(groups: readonly DbWalletGroup[], limit = 3): DbWalletGroup[] {
  const last = (g: DbWalletGroup) =>
    [...g.expenses.map((e) => e.date), ...g.payments.map((p) => p.date)].reduce((a, b) => (b > a ? b : a), '');
  return groups
    .map((g, i) => ({ g, i, at: last(g) }))
    .sort((a, b) => (a.at === b.at ? a.i - b.i : a.at < b.at ? 1 : -1))
    .slice(0, limit)
    .map((x) => x.g);
}

/** La respuesta de `get_guest_group` (web de invitados): sin `user_id`, sin alias y sin fechas de ingreso. */
export interface GuestGroupJson {
  name: string;
  currency: Currency;
  members: { id: string; display_name: string; has_account: boolean; active: boolean }[];
  expenses: {
    id: string;
    date: ISODate;
    description: string;
    amount: string;
    currency: Currency;
    fx_rate: string | null;
    payer_member_id: string;
    split_mode: 'equal' | 'exact';
    parts: { member_id: string; value: string }[];
  }[];
  /** Sin los anulados. */
  payments: { id: string; date: ISODate; from_member_id: string; to_member_id: string; amount: string }[];
}

const GUEST_ID = 'guest';
// La web no recibe cuándo se fue alguien: alcanza con marcarlo.
const LEFT_PLACEHOLDER = '1970-01-01T00:00:00Z';

/**
 * El detalle de la web de invitados (W-1): los mismos saldos y "Cómo saldar" que la app, sin
 * lugar propio (nadie es "Vos", tu saldo en cero y sin dueño).
 */
export function guestGroupDetail(json: GuestGroupJson): GroupDetail {
  const g: DbWalletGroup = {
    id: GUEST_ID,
    name: json.name,
    currency: json.currency,
    owner_member_id: null,
    my_member_id: '',
    members: json.members.map((m) => ({
      id: m.id,
      display_name: m.display_name,
      user_id: m.has_account ? 'cuenta' : null,
      left_at: m.active ? null : LEFT_PLACEHOLDER,
      claimed_at: null,
    })),
    expenses: json.expenses.map((e) => ({ ...e, category_id: null })),
    payments: json.payments.map((p) => ({ ...p, deleted_at: null })),
  };
  const detail = groupDetail([g], GUEST_ID);
  return { ...detail, members: detail.members.map((m) => ({ ...m, leftOn: null })) };
}
