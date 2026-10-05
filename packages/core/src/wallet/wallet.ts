// La Billetera a partir de las filas de la base (montos como texto): saldos de cuentas, lo que
// viene en cada tarjeta y el patrimonio (02 §2, §3 y §8). La usa la app; no accede a la base.

import { todayInArgentina } from '../notices/fromDb.ts';
import { cardState } from '../cards/state.ts';
import { closeDate, statementFor } from '../cards/schedule.ts';
import type { ByCurrency, CreditCard, StatementPayment, StatementOverride } from '../cards/types.ts';
import type { ISODate } from '../dates.ts';
import { groupBalances } from '../groups/balances.ts';
import type { Group, GroupExpense, GroupPayment } from '../groups/types.ts';
import { fromDbNumeric, rate, zero, type Currency, type Money, type Rate } from '../money.ts';
import { accountBalance } from '../personal/accountBalance.ts';
import { netWorth, type NetWorth } from '../personal/netWorth.ts';
import type { Account, Movement, MovementType } from '../personal/types.ts';
import type { CardNetwork } from '../entry/paymentMethods.ts';

export interface DbWalletCard {
  id: string;
  name: string;
  bank: string;
  network: CardNetwork;
  last4: string;
  color: string | null;
  is_favorite: boolean;
  close_day: number;
  due_day: number;
  credit_limit: string | null;
  created_at: string;
}

export interface DbWalletAccount {
  id: string;
  name: string;
  type: 'bank' | 'wallet' | 'cash';
  currency: Currency;
  opening_balance: string;
  created_at: string;
}

export interface DbWalletMovement {
  id: string;
  type: MovementType;
  date: ISODate;
  amount: string;
  currency: Currency;
  card_id: string | null;
  account_id: string | null;
  to_account_id: string | null;
  installments: number;
  category_id: string | null;
  my_share: string | null;
  group_expense_id: string | null;
  fx_mep: string | null;
  fx_oficial: string | null;
  fx_blue: string | null;
  fx_pending: boolean;
  debited_amount: string | null;
}

export interface DbWalletPayment {
  id: string;
  card_id: string;
  /** 1.º del mes de cierre ('2026-10-01'). */
  period: ISODate;
  applies_to: Currency;
  amount: string;
  from_account_id: string;
  debited_amount: string;
  fx_card_rate: string | null;
  paid_at: string;
  reverted_at: string | null;
}

export interface DbWalletOverride {
  card_id: string;
  period: ISODate;
  close_date: ISODate;
  due_date: ISODate;
}

export interface DbWalletGroup {
  id: string;
  currency: Currency;
  /** Tu lugar en el grupo. */
  my_member_id: string;
  /** Todos los integrantes, también los que se fueron, en orden de ingreso. */
  members: { id: string; display_name: string }[];
  /** Sin los borrados. En partes iguales, `value` es 1. */
  expenses: {
    id: string;
    amount: string;
    currency: Currency;
    fx_rate: string | null;
    payer_member_id: string;
    split_mode: 'equal' | 'exact';
    parts: { member_id: string; value: string }[];
  }[];
  /** Sin los anulados. */
  payments: { id: string; from_member_id: string; to_member_id: string; amount: string }[];
}

export interface WalletInput {
  today: ISODate;
  display: Currency;
  /** Última venta del dólar de referencia y del dólar tarjeta; null si todavía no hay. */
  referenceRate: Rate | null;
  fxCard: Rate | null;
  cards: readonly DbWalletCard[];
  accounts: readonly DbWalletAccount[];
  movements: readonly DbWalletMovement[];
  payments: readonly DbWalletPayment[];
  overrides: readonly DbWalletOverride[];
  groups: readonly DbWalletGroup[];
}

export interface WalletCard {
  id: string;
  name: string;
  network: CardNetwork;
  last4: string;
  color: string | null;
  isFavorite: boolean;
  /** Lo que viene en el resumen en curso ("Te vienen"). */
  currentTotal: ByCurrency;
  /** Cierre del resumen en curso. */
  closeDate: ISODate;
}

export interface WalletAccount {
  id: string;
  name: string;
  type: DbWalletAccount['type'];
  balance: Money;
}

export interface Wallet {
  /** La favorita primero y después en el orden en que se cargaron. */
  cards: WalletCard[];
  accounts: WalletAccount[];
  /** null si hace falta una cotización que todavía no está. */
  netWorth: NetWorth | null;
}

const period = (date: ISODate) => date.slice(0, 7);
const optionalRate = (s: string | null): Rate | null => (s === null ? null : rate(s));

function movementFromDb(m: DbWalletMovement): Movement {
  return {
    id: m.id,
    type: m.type,
    date: m.date,
    amount: fromDbNumeric(m.amount, m.currency),
    categoryId: m.category_id,
    cardId: m.card_id,
    accountId: m.account_id,
    toAccountId: m.to_account_id,
    installments: m.installments,
    myShare: m.my_share === null ? null : fromDbNumeric(m.my_share, m.currency),
    groupExpenseId: m.group_expense_id,
    fx: { mep: optionalRate(m.fx_mep), oficial: optionalRate(m.fx_oficial), blue: optionalRate(m.fx_blue) },
    fxPending: m.fx_pending,
    debitedAmount: null, // se completa con la moneda de la cuenta (abajo)
  };
}

function myGroupBalance(g: DbWalletGroup): Money {
  const group: Group = { id: g.id, currency: g.currency, members: g.members.map((m) => ({ id: m.id, name: m.display_name })) };
  const expenses: GroupExpense[] = g.expenses.map((e) => ({
    id: e.id,
    amount: fromDbNumeric(e.amount, e.currency),
    fxRate: optionalRate(e.fx_rate),
    payerMemberId: e.payer_member_id,
    splitMode: e.split_mode,
    parts: e.parts.map((p) => ({
      memberId: p.member_id,
      value: e.split_mode === 'equal' ? null : fromDbNumeric(p.value, e.currency),
    })),
  }));
  const payments: GroupPayment[] = g.payments.map((p) => ({
    id: p.id,
    fromMemberId: p.from_member_id,
    toMemberId: p.to_member_id,
    amount: fromDbNumeric(p.amount, g.currency),
  }));
  return groupBalances(group, expenses, payments)[g.my_member_id] ?? zero(g.currency);
}

// El dólar tarjeta solo entra en el límite usado, que la Billetera no muestra: sin cotización,
// cardState igual calcula los resúmenes.
const UNUSED_RATE = rate('1');

type CardPayment = StatementPayment & { cardId: string };

/** Movimientos y pagos en los tipos de core, con lo descontado en la moneda de cada cuenta. */
function prepare(input: WalletInput): { movements: Movement[]; payments: CardPayment[] } {
  const accountCurrency = new Map(input.accounts.map((a) => [a.id, a.currency]));

  const movements = input.movements.map((row) => {
    const m = movementFromDb(row);
    const currency = row.account_id ? accountCurrency.get(row.account_id) : undefined;
    return row.debited_amount !== null && currency
      ? { ...m, debitedAmount: fromDbNumeric(row.debited_amount, currency) }
      : m;
  });

  const payments: CardPayment[] = input.payments.map((p) => ({
    id: p.id,
    cardId: p.card_id,
    period: period(p.period),
    appliesTo: p.applies_to,
    amount: fromDbNumeric(p.amount, p.applies_to),
    fromAccountId: p.from_account_id,
    debitedAmount: fromDbNumeric(p.debited_amount, accountCurrency.get(p.from_account_id) ?? p.applies_to),
    fxCardRate: optionalRate(p.fx_card_rate),
    paidAt: todayInArgentina(new Date(p.paid_at)),
    revertedAt: p.reverted_at === null ? null : todayInArgentina(new Date(p.reverted_at)),
  }));

  return { movements, payments };
}

function cardFromDb(row: DbWalletCard, input: WalletInput): { card: CreditCard; overrides: StatementOverride[] } {
  return {
    card: {
      id: row.id,
      closeDay: row.close_day,
      dueDay: row.due_day,
      creditLimit: row.credit_limit === null ? zero('ARS') : fromDbNumeric(row.credit_limit, 'ARS'),
    },
    overrides: input.overrides
      .filter((o) => o.card_id === row.id)
      .map((o) => ({ period: period(o.period), closeDate: o.close_date, dueDate: o.due_date })),
  };
}

function stateOf(row: DbWalletCard, input: WalletInput, prepared: ReturnType<typeof prepare>) {
  const { card, overrides } = cardFromDb(row, input);
  return cardState({
    card,
    expenses: prepared.movements
      .filter((m) => m.cardId === row.id && m.type === 'expense')
      .map((m) => ({ id: m.id, date: m.date, amount: m.amount, installments: m.installments })),
    payments: prepared.payments.filter((p) => p.cardId === row.id),
    overrides,
    today: input.today,
    fxCard: input.fxCard ?? UNUSED_RATE,
  });
}

/**
 * El resumen donde entra un gasto con esa fecha (la primera cuota): su cierre y su total, con los
 * gastos ya guardados. Lo usa el toast después de guardar (9A).
 */
export function cardStatementFor(input: WalletInput, cardId: string, date: ISODate): { closeDate: ISODate; total: ByCurrency } {
  const row = input.cards.find((c) => c.id === cardId);
  if (!row) throw new RangeError(`Tarjeta desconocida: ${cardId}`);
  const { card, overrides } = cardFromDb(row, input);
  const target = statementFor(card, date, overrides);
  const statement = stateOf(row, input, prepare(input)).statements.find((s) => s.period === target);
  return statement
    ? { closeDate: statement.closeDate, total: statement.total }
    : { closeDate: closeDate(card, target, overrides), total: { ARS: zero('ARS'), USD: zero('USD') } };
}

export function wallet(input: WalletInput): Wallet {
  const prepared = prepare(input);
  const { movements, payments } = prepared;

  const states = [...input.cards]
    .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.created_at.localeCompare(b.created_at))
    .map((row) => {
      const state = stateOf(row, input, prepared);
      const current = state.statements.find((s) => s.period === state.currentPeriod)!;
      const view: WalletCard = {
        id: row.id,
        name: row.name,
        network: row.network,
        last4: row.last4,
        color: row.color,
        isFavorite: row.is_favorite,
        currentTotal: current.total,
        closeDate: current.closeDate,
      };
      return { view, pending: state.pendingTotal };
    });

  const accounts: WalletAccount[] = [...input.accounts]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((row) => {
      const account: Account = {
        id: row.id,
        currency: row.currency,
        openingBalance: fromDbNumeric(row.opening_balance, row.currency),
      };
      return { id: row.id, name: row.name, type: row.type, balance: accountBalance(account, movements, payments) };
    });

  const groupBalancesList = input.groups.map(myGroupBalance);
  const cardDebts = states.map((s) => s.pending);

  // Sin cotización solo se puede mostrar el patrimonio si todo está en la moneda que se muestra.
  const other: Currency = input.display === 'ARS' ? 'USD' : 'ARS';
  // La deuda de tarjeta en dólares pasa a pesos con el dólar tarjeta; todo lo demás, con el de referencia.
  const needsReference =
    [...accounts.map((a) => a.balance), ...groupBalancesList].some((m) => m.currency === other && m.minor !== 0) ||
    (input.display === 'USD' && cardDebts.some((d) => d.ARS.minor !== 0));
  const needsCard = input.display === 'ARS' && cardDebts.some((d) => d.USD.minor !== 0);
  const missing = (needsReference && !input.referenceRate) || (needsCard && !input.fxCard);

  return {
    cards: states.map((s) => s.view),
    accounts,
    netWorth: missing
      ? null
      : netWorth({
          display: input.display,
          referenceRate: input.referenceRate ?? UNUSED_RATE,
          fxCard: input.fxCard ?? UNUSED_RATE,
          accountBalances: accounts.map((a) => a.balance),
          myGroupBalances: groupBalancesList,
          cardDebts,
        }),
  };
}
