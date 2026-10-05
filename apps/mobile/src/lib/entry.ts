import {
  addDays,
  cardStatementFor,
  learnableWord,
  money,
  paymentMethodWords,
  rate,
  savedToastText,
  todayInArgentina,
  toDbNumeric,
  type CardNetwork,
  type Currency,
  type ISODate,
  type Money,
  type PaymentMethod,
  type PaymentUse,
  type Rate,
  type StatementOverride,
} from '@mangos/core';
import type { UserSettings } from './session';
import { supabase } from './supabase';
import { loadWalletInput } from './wallet';

export interface EntryCard {
  id: string;
  closeDay: number;
  dueDay: number;
  overrides: StatementOverride[];
}

export interface EntryAccount {
  id: string;
  name: string;
  currency: Currency;
}

/** Lo que necesita la hoja de carga: medios de pago, usos de 30 días y palabras aprendidas. */
export interface EntryContext {
  today: ISODate;
  methods: PaymentMethod[];
  uses: PaymentUse[];
  keywords: Map<string, string>;
  cards: Map<string, EntryCard>;
  accounts: Map<string, EntryAccount>;
}

function check<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

export async function loadEntryContext(): Promise<EntryContext> {
  const today = todayInArgentina();
  const [cards, accounts, recent, keywords, overrides] = await Promise.all([
    supabase
      .from('cards')
      .select('id, bank, network, last4, is_favorite, close_day, due_day')
      .is('archived_at', null)
      .order('created_at'),
    supabase.from('accounts').select('id, name, currency').is('deleted_at', null).order('created_at'),
    supabase
      .from('movements')
      .select('card_id, account_id, date')
      .eq('type', 'expense')
      .gte('date', addDays(today, -29)),
    supabase.from('category_keywords').select('word, category_id'),
    supabase.from('statement_overrides').select('card_id, period, close_date, due_date'),
  ]);
  const cardRows = check(cards) as {
    id: string; bank: string; network: CardNetwork; last4: string; is_favorite: boolean; close_day: number; due_day: number;
  }[];
  const accountRows = check(accounts) as EntryAccount[];
  const overrideRows = check(overrides) as { card_id: string; period: string; close_date: string; due_date: string }[];

  return {
    today,
    methods: [
      ...cardRows.map((c): PaymentMethod => ({ kind: 'card', id: c.id, bank: c.bank, network: c.network, last4: c.last4, isFavorite: c.is_favorite })),
      ...accountRows.map((a): PaymentMethod => ({ kind: 'account', id: a.id, name: a.name })),
    ],
    uses: (check(recent) as { card_id: string | null; account_id: string | null; date: string }[])
      .map((m) => ({ methodId: (m.card_id ?? m.account_id)!, date: m.date }))
      .filter((u) => u.methodId),
    keywords: new Map((check(keywords) as { word: string; category_id: string }[]).map((k) => [k.word, k.category_id])),
    cards: new Map(
      cardRows.map((c) => [
        c.id,
        {
          id: c.id,
          closeDay: c.close_day,
          dueDay: c.due_day,
          overrides: overrideRows
            .filter((o) => o.card_id === c.id)
            .map((o) => ({ period: o.period.slice(0, 7), closeDate: o.close_date, dueDate: o.due_date })),
        },
      ]),
    ),
    accounts: new Map(accountRows.map((a) => [a.id, a])),
  };
}

/** Dólar tarjeta de una fecha (02 §2), para proponer lo descontado de una cuenta en otra moneda. */
export async function cardRateOn(date: ISODate): Promise<Rate | null> {
  const { data, error } = await supabase.rpc('fx_rate_on', { kind: 'tarjeta', on_date: date });
  if (error || data === null || data === undefined) return null;
  return rate(String(data));
}

export interface ExpenseDraft {
  id: string;
  origin: 'manual' | 'text';
  date: ISODate;
  description: string;
  amount: Money;
  method: PaymentMethod;
  installments: number;
  categoryId: string;
  /** Solo si la moneda del gasto difiere de la de la cuenta: lo descontado, en la moneda de la cuenta. */
  debited: Money | null;
}

export type SaveError = 'offline' | 'failed';

function isNetworkError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? error);
  return /network request failed|failed to fetch|fetch failed|load failed|networkerror/i.test(message);
}

/**
 * Guarda el gasto con el id que generó el teléfono al abrir la hoja. Si ese id ya existe (un reintento
 * que sí había llegado), cuenta como guardado: nunca se duplica (02 §5).
 */
export async function saveExpense(draft: ExpenseDraft): Promise<SaveError | null> {
  try {
    const { error } = await supabase.from('movements').insert({
      id: draft.id,
      type: 'expense',
      origin: draft.origin,
      date: draft.date,
      description: draft.description.trim(),
      amount: toDbNumeric(draft.amount),
      currency: draft.amount.currency,
      card_id: draft.method.kind === 'card' ? draft.method.id : null,
      account_id: draft.method.kind === 'account' ? draft.method.id : null,
      installments: draft.method.kind === 'card' ? draft.installments : 1,
      category_id: draft.categoryId,
      debited_amount: draft.debited ? toDbNumeric(draft.debited) : null,
    });
    if (!error || error.code === '23505') return null;
    return isNetworkError(error) ? 'offline' : 'failed';
  } catch (error) {
    return isNetworkError(error) ? 'offline' : 'failed';
  }
}

/** "Deshacer" del toast: borra el gasto. */
export async function deleteExpense(id: string): Promise<boolean> {
  const { error } = await supabase.from('movements').delete().eq('id', id);
  return !error;
}

/**
 * La persona corrigió la categoría: la primera palabra que enseña queda asociada a la nueva (R3-5).
 * Si la misma palabra se corrige de nuevo, gana la última. Si falla, el gasto igual quedó guardado.
 */
export async function learnCategory(description: string, categoryId: string, methods: readonly PaymentMethod[]): Promise<void> {
  const word = learnableWord(description, paymentMethodWords(methods));
  if (!word) return;
  await supabase.from('category_keywords').upsert({ word, category_id: categoryId }, { onConflict: 'user_id,word' });
}

/** Texto del toast, con lo que viene en el resumen ya contando el gasto nuevo. */
export async function toastFor(draft: ExpenseDraft, userId: string, settings: UserSettings): Promise<string> {
  if (draft.method.kind === 'account') return savedToastText({ kind: 'account', accountName: draft.method.name });
  try {
    const { input } = await loadWalletInput(userId, settings);
    const statement = cardStatementFor(input, draft.method.id, draft.date);
    return savedToastText({ kind: 'card', closeDate: statement.closeDate, statementTotal: statement.total });
  } catch {
    return 'Gasto guardado';
  }
}
