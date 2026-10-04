// Lo que devuelve card_notice_input (montos como texto) pasado a los tipos de
// core. Lo usan las Edge Functions de avisos de tarjeta.

import { fromDbNumeric, rate, type Currency } from '../money.ts';
import type { ISODate } from '../dates.ts';
import type { NoticeInput, NoticeKind, NoticeUser } from './notices.ts';

export interface DbNoticeCard {
  id: string;
  name: string;
  close_day: number;
  due_day: number;
  credit_limit: string;
  overrides: { period: string; close_date: string; due_date: string }[];
  expenses: { id: string; date: string; amount: string; currency: Currency; installments: number }[];
  payments: {
    id: string;
    period: string;
    applies_to: Currency;
    amount: string;
    debited_amount: string;
    debited_currency: Currency;
    fx_card_rate: string | null;
    paid_at: string;
    reverted_at: string | null;
  }[];
  closing_enabled: boolean;
  due_enabled: boolean;
  due_days_before: number;
  noticed: { kind: NoticeKind; period: string }[];
}

export interface DbNoticeUser {
  user_id: string;
  notify_push: boolean;
  quiet_from: number | null;
  quiet_to: number | null;
  cards: DbNoticeCard[] | null;
}

export function noticeInputFromDb(today: ISODate, rows: readonly DbNoticeUser[]): NoticeInput {
  const users: NoticeUser[] = rows.map((u) => ({
    userId: u.user_id,
    cards: (u.cards ?? []).map((c) => ({
      card: {
        id: c.id,
        closeDay: c.close_day,
        dueDay: c.due_day,
        creditLimit: fromDbNumeric(c.credit_limit, 'ARS'),
      },
      name: c.name,
      overrides: c.overrides.map((o) => ({ period: o.period, closeDate: o.close_date, dueDate: o.due_date })),
      expenses: c.expenses.map((e) => ({
        id: e.id,
        date: e.date,
        amount: fromDbNumeric(e.amount, e.currency),
        installments: e.installments,
      })),
      payments: c.payments.map((p) => ({
        id: p.id,
        period: p.period,
        appliesTo: p.applies_to,
        amount: fromDbNumeric(p.amount, p.applies_to),
        fromAccountId: '',
        debitedAmount: fromDbNumeric(p.debited_amount, p.debited_currency),
        fxCardRate: p.fx_card_rate === null ? null : rate(p.fx_card_rate),
        paidAt: p.paid_at,
        revertedAt: p.reverted_at,
      })),
      closingEnabled: c.closing_enabled,
      dueEnabled: c.due_enabled,
      dueDaysBefore: c.due_days_before,
      noticed: c.noticed,
    })),
  }));
  return { today, users };
}

/** Hoy en hora de Argentina, como 'AAAA-MM-DD'. */
export function todayInArgentina(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(now);
}
