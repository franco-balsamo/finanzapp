// La Billetera a partir de las filas de la base (montos como texto): saldos de cuentas, lo que
// viene en cada tarjeta y el patrimonio (02 §2, §3 y §8). La usa la app; no accede a la base.

import { todayInArgentina } from '../notices/fromDb.ts';
import { cardState, type CardState } from '../cards/state.ts';
import { closeDate, statementFor } from '../cards/schedule.ts';
import { lateExpenseImpact, type LateExpenseImpact } from '../cards/late.ts';
import type { ByCurrency, CardExpense, CreditCard, StatementOverride, StatementPayment, StatementStatus } from '../cards/types.ts';
import { addDays, type ISODate, type Period } from '../dates.ts';
import { groupBalances } from '../groups/balances.ts';
import { coreGroupFromDb } from './groups.ts';
import { fromDbNumeric, money, rate, zero, type Currency, type Money, type Rate } from '../money.ts';
import { accountBalance } from '../personal/accountBalance.ts';
import { netWorth, type NetWorth } from '../personal/netWorth.ts';
import type { Account, FxReference, Movement, MovementType } from '../personal/types.ts';
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
  /** MM/AA del plástico. */
  expiry: string | null;
  created_at: string;
  /** Archivada: no sale en la lista, pero su deuda sigue contando 7 días (02 §3). */
  archived_at: string | null;
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
  description: string;
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
  name: string;
  currency: Currency;
  owner_member_id: string | null;
  /** El link para invitar (D2 de la web de invitados). null si no hay o se revocó. */
  invite_token?: string | null;
  /** Tu lugar en el grupo. */
  my_member_id: string;
  /** Todos los integrantes, también los que se fueron, en orden de ingreso. */
  members: {
    id: string;
    display_name: string;
    /** null: integrante provisorio (sin cuenta). */
    user_id: string | null;
    left_at: string | null;
    claimed_at: string | null;
  }[];
  /** Sin los borrados. En partes iguales, `value` es 1. */
  expenses: {
    id: string;
    date: ISODate;
    description: string;
    amount: string;
    currency: Currency;
    fx_rate: string | null;
    payer_member_id: string;
    split_mode: 'equal' | 'exact';
    category_id: string | null;
    parts: { member_id: string; value: string }[];
  }[];
  /** También los anulados (`deleted_at`): no cuentan en el saldo, pero el detalle los muestra. */
  payments: { id: string; from_member_id: string; to_member_id: string; amount: string; date: ISODate; deleted_at: string | null }[];
}

export interface WalletInput {
  today: ISODate;
  display: Currency;
  /** El dólar de referencia de la persona: convierte los gastos en dólares del mes (02 §6). */
  reference: FxReference;
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

export interface ArchivedCard {
  id: string;
  name: string;
  network: CardNetwork;
  last4: string;
  color: string | null;
  /** Día de la purga: 7 días después de archivarla, en hora de Argentina. */
  deletesOn: ISODate;
}

export interface Wallet {
  /** La favorita primero y después en el orden en que se cargaron. Sin las archivadas. */
  cards: WalletCard[];
  archivedCards: ArchivedCard[];
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

/** Tu saldo exacto en el grupo, en su moneda. */
export function myGroupBalance(g: DbWalletGroup): Money {
  const { group, expenses, payments } = coreGroupFromDb(g);
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

/** Movimientos y tarjetas (también las archivadas) en los tipos de core, para el gasto del mes de Inicio. */
export function coreMovementsAndCards(input: WalletInput): {
  movements: Movement[];
  cards: { card: CreditCard; overrides: StatementOverride[] }[];
} {
  return { movements: prepare(input).movements, cards: input.cards.map((row) => cardFromDb(row, input)) };
}

/** El estado de cada tarjeta no archivada, para Inicio (home.ts). */
export function activeCardStates(input: WalletInput): { row: DbWalletCard; state: CardState }[] {
  const prepared = prepare(input);
  return input.cards.filter((row) => !row.archived_at).map((row) => ({ row, state: stateOf(row, input, prepared) }));
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
      return { view, pending: state.pendingTotal, archivedAt: row.archived_at };
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
    cards: states.filter((s) => !s.archivedAt).map((s) => s.view),
    archivedCards: states
      .filter((s) => s.archivedAt)
      .map(({ view, archivedAt }) => ({
        id: view.id,
        name: view.name,
        network: view.network,
        last4: view.last4,
        color: view.color,
        deletesOn: addDays(todayInArgentina(new Date(archivedAt!)), 7),
      })),
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

// ───────────────────────── Detalle de tarjeta (6A) ─────────────────────────

export interface DetailItem {
  expenseId: string;
  date: ISODate;
  description: string;
  categoryId: string | null;
  /** "cuota 3/6" cuando `of` > 1. */
  index: number;
  of: number;
  amount: Money;
}

export interface DetailPayment {
  id: string;
  appliesTo: Currency;
  amount: Money;
  fromAccountId: string;
  debitedAmount: Money;
  paidAt: ISODate;
}

export interface DetailStatement {
  period: Period;
  closeDate: ISODate;
  dueDate: ISODate;
  status: StatementStatus;
  total: ByCurrency;
  paid: ByCurrency;
  pending: ByCurrency;
  /** 15% de lo pendiente en pesos; los dólares no entran (02 §3). Es una aproximación. */
  minimumPayment: Money;
  /** Consumos y cuotas de este resumen, del más reciente al más viejo. */
  items: DetailItem[];
  /** Los pagos vigentes (sin los deshechos), del más reciente al más viejo. */
  payments: DetailPayment[];
}

export interface CardDetail {
  card: {
    id: string;
    name: string;
    bank: string;
    network: CardNetwork;
    last4: string;
    expiry: string | null;
    color: string | null;
    isFavorite: boolean;
    archivedAt: string | null;
    closeDay: number;
    dueDay: number;
    creditLimit: Money;
  };
  /** Del más viejo al más nuevo: resúmenes cerrados, el en curso y las cuotas futuras. */
  statements: DetailStatement[];
  currentPeriod: Period;
  /** El que se abre: el más urgente de "A pagar"; si no hay, el resumen en curso. */
  defaultPeriod: Period;
  /** Resúmenes después del en curso con algo cargado ("Cuotas que siguen"). */
  futureInstallments: { period: Period; closeDate: ISODate; total: ByCurrency }[];
  /** null si hay deuda en dólares y todavía no hay dólar tarjeta. */
  limitUsed: Money | null;
  available: Money | null;
  overrides: StatementOverride[];
}

function minimumOf(pending: ByCurrency): Money {
  return money(Math.round((pending.ARS.minor * 15) / 100), 'ARS');
}

export function cardDetail(input: WalletInput, cardId: string): CardDetail {
  const row = input.cards.find((c) => c.id === cardId);
  if (!row) throw new RangeError(`Tarjeta desconocida: ${cardId}`);
  const prepared = prepare(input);
  const { card, overrides } = cardFromDb(row, input);
  const state = stateOf(row, input, prepared);

  const byId = new Map(input.movements.map((m) => [m.id, m]));
  const statements: DetailStatement[] = state.statements.map((s) => ({
    period: s.period,
    closeDate: s.closeDate,
    dueDate: s.dueDate,
    status: s.status,
    total: s.total,
    paid: s.paid,
    pending: s.pending,
    minimumPayment: minimumOf(s.pending),
    items: s.items
      .map((item) => {
        const m = byId.get(item.expenseId)!;
        return {
          expenseId: item.expenseId,
          date: m.date,
          description: m.description,
          categoryId: m.category_id,
          index: item.index,
          of: item.of,
          amount: item.amount,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date)),
    payments: prepared.payments
      .filter((p) => p.cardId === cardId && p.period === s.period && p.revertedAt === null)
      .map((p) => ({
        id: p.id,
        appliesTo: p.appliesTo,
        amount: p.amount,
        fromAccountId: p.fromAccountId,
        debitedAmount: p.debitedAmount,
        paidAt: p.paidAt,
      }))
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
  }));

  const hasUsdDebt = state.pendingTotal.USD.minor !== 0;
  const limitKnown = !hasUsdDebt || input.fxCard !== null;

  return {
    card: {
      id: row.id,
      name: row.name,
      bank: row.bank,
      network: row.network,
      last4: row.last4,
      expiry: row.expiry,
      color: row.color,
      isFavorite: row.is_favorite,
      archivedAt: row.archived_at,
      closeDay: row.close_day,
      dueDay: row.due_day,
      creditLimit: card.creditLimit,
    },
    statements,
    currentPeriod: state.currentPeriod,
    defaultPeriod: state.toPay[0]?.period ?? state.currentPeriod,
    futureInstallments: statements
      .filter((s) => s.period > state.currentPeriod && (s.total.ARS.minor !== 0 || s.total.USD.minor !== 0))
      .map((s) => ({ period: s.period, closeDate: s.closeDate, total: s.total })),
    limitUsed: limitKnown ? state.limitUsed : null,
    available: limitKnown ? state.available : null,
    overrides,
  };
}

/** Un gasto con tarjeta de crédito que se está por guardar, para "¿Ya lo pagaste?" (D-6). */
export interface LateDraft {
  id: string;
  cardId: string;
  date: ISODate;
  amount: Money;
  installments: number;
}

/**
 * "¿Ya lo pagaste?" para uno o varios gastos que se guardan juntos (02 §3, D-6). Cada gasto se evalúa
 * contra los guardados y contra los anteriores de la tanda, con sus pagos propuestos como si se
 * contestara "Sí": la pregunta es una sola para toda la tanda. Sin dólar tarjeta de hoy, no se
 * propone un pago que lo necesite.
 */
export function lateImpacts(input: WalletInput, drafts: readonly LateDraft[]): LateExpenseImpact[] {
  const prepared = prepare(input);
  const extraExpenses: (CardExpense & { cardId: string })[] = [];
  const extraPayments: CardPayment[] = [];
  const fxCard = input.fxCard ?? UNUSED_RATE;

  return drafts.map((draft) => {
    const row = input.cards.find((c) => c.id === draft.cardId);
    if (!row) return { isLate: false, askAlreadyPaid: false, proposedPayments: [] };
    const { card, overrides } = cardFromDb(row, input);
    const expense: CardExpense = { id: draft.id, date: draft.date, amount: draft.amount, installments: draft.installments };
    const impact = lateExpenseImpact({
      card,
      expense,
      expenses: [
        ...prepared.movements
          .filter((m) => m.cardId === row.id && m.type === 'expense')
          .map((m) => ({ id: m.id, date: m.date, amount: m.amount, installments: m.installments })),
        ...extraExpenses.filter((e) => e.cardId === row.id),
      ],
      payments: [...prepared.payments, ...extraPayments].filter((p) => p.cardId === row.id),
      overrides,
      today: input.today,
      fxCard,
    });
    const proposedPayments = impact.proposedPayments.filter((p) => input.fxCard || p.fxCardRate !== UNUSED_RATE);

    extraExpenses.push({ ...expense, cardId: row.id });
    proposedPayments.forEach((p, i) =>
      extraPayments.push({ ...p, id: `${draft.id}-${i}`, cardId: row.id, revertedAt: null }),
    );
    return { ...impact, askAlreadyPaid: proposedPayments.length > 0, proposedPayments };
  });
}
