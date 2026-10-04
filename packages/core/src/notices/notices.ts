// Avisos de cierre y de vencimiento de tarjeta (02 §9). Funciones puras: las
// llaman las Edge Functions card-closing-notices y card-due-notices con los
// datos de card_notice_input, y lo que devuelven lo guarda record_card_notices.

import { addDays, addMonths, daysBetween, type ISODate, type Period } from '../dates.ts';
import { rate, zero } from '../money.ts';
import { closeDate, statementFor } from '../cards/schedule.ts';
import { cardState } from '../cards/state.ts';
import type {
  ByCurrency,
  CardExpense,
  CreditCard,
  StatementOverride,
  StatementPayment,
  StatementView,
} from '../cards/types.ts';
import { formatDay, formatTotal, joinList } from './format.ts';

export type NoticeKind = 'card_closing' | 'card_due';

export interface NoticeCard {
  card: CreditCard;
  /** El nombre que le puso el usuario ("Visa"). */
  name: string;
  expenses: readonly CardExpense[];
  payments: readonly StatementPayment[];
  overrides: readonly StatementOverride[];
  closingEnabled: boolean;
  dueEnabled: boolean;
  /** 1 a 5; 2 si no hay alerta configurada. */
  dueDaysBefore: number;
  /** Lo que ya se avisó, para no repetir. */
  noticed: readonly { kind: NoticeKind; period: Period }[];
}

export interface NoticeUser {
  userId: string;
  cards: readonly NoticeCard[];
}

export interface NoticeInput {
  /** Hoy, en hora de Argentina. */
  today: ISODate;
  users: readonly NoticeUser[];
}

export interface CardNotice {
  userId: string;
  kind: NoticeKind;
  title: string;
  body: string;
  refs: { cardId: string; period: Period }[];
}

// El dólar tarjeta solo cambia el límite usado, que acá no se mira.
const ANY_RATE = rate('1');

const emptyByCurrency = (): ByCurrency => ({ ARS: zero('ARS'), USD: zero('USD') });
const isZero = (b: ByCurrency) => b.ARS.minor === 0 && b.USD.minor === 0;

function statementsOf(c: NoticeCard, today: ISODate): StatementView[] {
  return cardState({
    card: c.card,
    expenses: c.expenses,
    payments: c.payments,
    overrides: c.overrides,
    today,
    fxCard: ANY_RATE,
  }).statements;
}

function totalOf(statements: readonly StatementView[], period: Period): ByCurrency {
  return statements.find((s) => s.period === period)?.total ?? emptyByCurrency();
}

function alreadyNoticed(c: NoticeCard, kind: NoticeKind, period: Period): boolean {
  return c.noticed.some((n) => n.kind === kind && n.period === period);
}

/** El resumen que cierra exactamente en `date`, o null. Respeta los cierres corregidos. */
function periodClosingOn(c: NoticeCard, date: ISODate): Period | null {
  const period = statementFor(c.card, date, c.overrides);
  return closeDate(c.card, period, c.overrides) === date ? period : null;
}

interface ClosingItem {
  cardId: string;
  name: string;
  period: Period;
  total: ByCurrency;
}

function closingBody(items: readonly ClosingItem[], late: boolean): string {
  const ask = '¿Te falta cargar algo?';
  if (items.length === 1) {
    const [item] = items as [ClosingItem];
    const verb = late ? 'Ayer cerró' : 'Cerró';
    return isZero(item.total)
      ? `${verb} tu ${item.name} y no tiene consumos cargados este ciclo. ${ask}`
      : `${verb} tu ${item.name}: te vienen ${formatTotal(item.total)}. ${ask}`;
  }
  const verb = late ? 'Ayer cerraron' : 'Cerraron';
  const list = items.map(
    (i) => `tu ${i.name} (${isZero(i.total) ? 'sin consumos cargados' : formatTotal(i.total)})`,
  );
  return `${verb} ${joinList(list)}. ${ask}`;
}

/**
 * Un aviso por usuario con las tarjetas que cerraron hoy. Las que cerraron ayer y
 * no se avisaron (el cron no corrió) van en otro aviso, con "Ayer". Una tarjeta
 * en $0 se avisa solo si el ciclo anterior tuvo consumos.
 */
export function closingNotices(input: NoticeInput): CardNotice[] {
  const notices: CardNotice[] = [];
  const yesterday = addDays(input.today, -1);

  for (const user of input.users) {
    const byDay = new Map<ISODate, ClosingItem[]>([
      [input.today, []],
      [yesterday, []],
    ]);

    for (const c of user.cards) {
      if (!c.closingEnabled) continue;
      for (const day of [input.today, yesterday]) {
        const period = periodClosingOn(c, day);
        if (!period || alreadyNoticed(c, 'card_closing', period)) continue;
        const statements = statementsOf(c, input.today);
        const total = totalOf(statements, period);
        if (isZero(total) && isZero(totalOf(statements, addMonths(period, -1)))) continue;
        byDay.get(day)!.push({ cardId: c.card.id, name: c.name, period, total });
      }
    }

    for (const [day, items] of byDay) {
      if (!items.length) continue;
      notices.push({
        userId: user.userId,
        kind: 'card_closing',
        title: 'Cierre de tarjeta',
        body: closingBody(items, day !== input.today),
        refs: items.map((i) => ({ cardId: i.cardId, period: i.period })),
      });
    }
  }
  return notices;
}

interface DueItem {
  cardId: string;
  name: string;
  period: Period;
  dueDate: ISODate;
  pending: ByCurrency;
}

function dueBody(items: readonly DueItem[]): string {
  if (items.length === 1) {
    const [item] = items as [DueItem];
    return `Tu ${item.name} vence el ${formatDay(item.dueDate)}: quedan ${formatTotal(item.pending)} por pagar.`;
  }
  const list = items.map((i) => `tu ${i.name} (${formatDay(i.dueDate)}, ${formatTotal(i.pending)})`);
  return `Vencen ${joinList(list)}.`;
}

/**
 * Un aviso por usuario con los resúmenes a pagar que vencen dentro de los días
 * configurados. Si el cron no corrió el día justo, sale igual mientras no haya
 * vencido; el día del vencimiento ya no.
 */
export function dueNotices(input: NoticeInput): CardNotice[] {
  const notices: CardNotice[] = [];

  for (const user of input.users) {
    const items: DueItem[] = [];
    for (const c of user.cards) {
      if (!c.dueEnabled) continue;
      for (const s of statementsOf(c, input.today)) {
        if (s.status !== 'to_pay' && s.status !== 'partial') continue;
        const days = daysBetween(input.today, s.dueDate);
        if (days < 1 || days > c.dueDaysBefore) continue;
        if (alreadyNoticed(c, 'card_due', s.period)) continue;
        items.push({ cardId: c.card.id, name: c.name, period: s.period, dueDate: s.dueDate, pending: s.pending });
      }
    }
    if (!items.length) continue;
    items.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
    notices.push({
      userId: user.userId,
      kind: 'card_due',
      title: 'Vencimiento de tarjeta',
      body: dueBody(items),
      refs: items.map((i) => ({ cardId: i.cardId, period: i.period })),
    });
  }
  return notices;
}
