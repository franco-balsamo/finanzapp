// Inicio (spec del 8/10): patrimonio, próximos vencimientos, gastos del mes, grupos y avisos, todo
// calculado con las mismas filas que la Billetera. No accede a la base.

import type { ByCurrency } from '../cards/types.ts';
import { daysBetween, periodOf, type ISODate, type Period } from '../dates.ts';
import type { CardNetwork } from '../entry/paymentMethods.ts';
import { displayBalance } from '../groups/balances.ts';
import { todayInArgentina } from '../notices/fromDb.ts';
import { rate, type Money } from '../money.ts';
import { categorySpend, type CategorySpend } from '../personal/categorySpend.ts';
import type { NetWorth } from '../personal/netWorth.ts';
import { activeCardStates, coreMovementsAndCards, myGroupBalance, wallet, type WalletInput } from './wallet.ts';

export interface DbNotification {
  id: string;
  title: string;
  body: string;
  kind: 'card_closing' | 'card_due' | null;
  data: { card_ids?: string[] } | null;
  /** timestamptz */
  created_at: string;
  read_at: string | null;
}

export interface HomeDue {
  cardId: string;
  cardName: string;
  network: CardNetwork;
  color: string | null;
  period: Period;
  kind: 'closed' | 'current';
  /** Solo en 'current'. */
  closeDate: ISODate | null;
  dueDate: ISODate;
  pending: ByCurrency;
  overdue: boolean;
  /** Días de hoy al vencimiento (negativo si venció). */
  daysToDue: number;
}

/** Saldo en la moneda del grupo, distinto de cero. */
export interface HomeGroup {
  id: string;
  name: string;
  balance: Money;
}

export interface HomeNotice {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  /** Primera tarjeta no archivada de data.card_ids, o null. */
  cardId: string | null;
}

export interface Home {
  /** El mismo de wallet(). */
  netWorth: NetWorth | null;
  /** D3: máximo 4. */
  dues: HomeDue[];
  /** D4: null si falta una cotización necesaria. */
  spend: CategorySpend | null;
  /** D9: máximo 3. */
  groups: HomeGroup[];
  hasGroups: boolean;
  /** D6 */
  closingBanners: HomeNotice[];
  /** D7: máximo 3. */
  recentNotices: HomeNotice[];
}

const MAX_DUES = 4;

const hasAmount = (b: ByCurrency) => b.ARS.minor !== 0 || b.USD.minor !== 0;

/** D3: lo cerrado con saldo (vencido o no) y el resumen en curso si falta pagarle algo. */
function dues(input: WalletInput, states: ReturnType<typeof activeCardStates>): HomeDue[] {
  return states
    .flatMap(({ row, state }) => {
      const current = state.statements.find((s) => s.period === state.currentPeriod)!;
      const statements = hasAmount(current.pending) ? [...state.toPay, current] : state.toPay;
      return statements.map((s): HomeDue => ({
        cardId: row.id,
        cardName: row.name,
        network: row.network,
        color: row.color,
        period: s.period,
        kind: s.period === state.currentPeriod ? 'current' : 'closed',
        closeDate: s.period === state.currentPeriod ? s.closeDate : null,
        dueDate: s.dueDate,
        pending: s.pending,
        overdue: s.status === 'overdue',
        daysToDue: daysBetween(input.today, s.dueDate),
      }));
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, MAX_DUES);
}

/**
 * D4: el mes calendario en curso (02 §6). Sin cotización de hoy, solo si ningún gasto en dólares la
 * necesita: `approximate` dice que alguno usó la de hoy.
 */
function spend(input: WalletInput): CategorySpend | null {
  const result = categorySpend({
    ...coreMovementsAndCards(input),
    month: periodOf(input.today),
    reference: input.reference,
    todayRate: input.referenceRate ?? rate('1'),
  });
  return !input.referenceRate && result.approximate ? null : result;
}

const MAX_GROUPS = 3;

/** D9: los grupos donde no estás al día, el saldo más grande primero. */
function groups(input: WalletInput): HomeGroup[] {
  // shortcut: compara centavos de pesos y de dólares como si fueran lo mismo; alcanza mientras casi todos los grupos sean en pesos.
  return input.groups
    .map((g) => ({ id: g.id, name: g.name, balance: displayBalance(myGroupBalance(g)) }))
    .filter((g) => g.balance.minor !== 0)
    .sort((a, b) => Math.abs(b.balance.minor) - Math.abs(a.balance.minor))
    .slice(0, MAX_GROUPS);
}

const MAX_NOTICES = 3;

function noticeOf(n: DbNotification, cardId: string | null): HomeNotice {
  return { id: n.id, title: n.title, body: n.body, createdAt: n.created_at, read: n.read_at !== null, cardId };
}

export function home(input: WalletInput, notifications: readonly DbNotification[]): Home {
  const states = activeCardStates(input);
  const cardIds = (n: DbNotification) => (n.data?.card_ids ?? []).filter((id) => states.some((c) => c.row.id === id));

  // D6: vigente mientras alguna tarjeta tenga sin pagar el resumen que cerró ese día (o antes) y no haya vencido.
  const closingBanners = notifications.flatMap((n) => {
    if (n.kind !== 'card_closing') return [];
    const day = todayInArgentina(new Date(n.created_at));
    const live = cardIds(n).find((id) => {
      const closed = states
        .find((c) => c.row.id === id)!
        .state.statements.filter((st) => st.closeDate <= day)
        .at(-1);
      return closed !== undefined && closed.status !== 'paid' && input.today <= closed.dueDate;
    });
    return live ? [noticeOf(n, live)] : [];
  });

  const recentNotices = [...notifications]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, MAX_NOTICES)
    .map((n) => noticeOf(n, cardIds(n)[0] ?? null));

  return {
    netWorth: wallet(input).netWorth,
    dues: dues(input, states),
    spend: spend(input),
    groups: groups(input),
    hasGroups: input.groups.length > 0,
    closingBanners,
    recentNotices,
  };
}
