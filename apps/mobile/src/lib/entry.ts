import {
  addDays,
  cardStatementFor,
  closeDate,
  lateImpacts,
  statementFor,
  convert,
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
  type LateDraft,
  type LateExpenseImpact,
  type LineWarning,
  type Money,
  type PaymentMethod,
  type PaymentUse,
  type ProposedPayment,
  type Rate,
  type ResolvedLine,
  type StatementOverride,
} from '@mangos/core';
import type { UserSettings } from './session';
import { impliedRate } from './payments';
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

/** Venta de un dólar en una fecha (`fx_rate_on`, con la ventana de 4 días de 02 §1). null si no hay. */
export async function rateOn(kind: 'tarjeta' | 'mep' | 'oficial' | 'blue', date: ISODate): Promise<Rate | null> {
  const { data, error } = await supabase.rpc('fx_rate_on', { kind, on_date: date });
  if (error || data === null || data === undefined) return null;
  return rate(String(data));
}

/** Dólar tarjeta de una fecha (02 §2), para proponer lo descontado de una cuenta en otra moneda. */
export function cardRateOn(date: ISODate): Promise<Rate | null> {
  return rateOn('tarjeta', date);
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

export function isNetworkError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? error);
  return /network request failed|failed to fetch|fetch failed|load failed|networkerror/i.test(message);
}

/** Un pago propuesto por "¿Ya lo pagaste?", con el id que generó el teléfono para poder deshacerlo. */
export interface LatePayment extends ProposedPayment {
  id: string;
}

export function withIds(payments: readonly ProposedPayment[], newId: () => string): LatePayment[] {
  return payments.map((p) => ({ ...p, id: newId() }));
}

/**
 * La persona corrigió lo que salió de la cuenta. En la misma moneda cambia también lo que cubre; en
 * otra, cambia la cotización (como al pagar un resumen, D-3).
 */
export function editLatePayment(payment: LatePayment, debitedMinor: number): LatePayment {
  const debited = money(debitedMinor, payment.debitedAmount.currency);
  if (payment.appliesTo === debited.currency) return { ...payment, amount: money(debitedMinor, payment.appliesTo), debitedAmount: debited };
  return { ...payment, debitedAmount: debited, fxCardRate: impliedRate(debitedMinor, payment.amount.minor) };
}

/**
 * ¿Algún resumen donde entra este gasto ya cerró? Solo entonces vale la pena traer los pagos para
 * preguntar "¿Ya lo pagaste?": la carga común (fecha de hoy) no espera nada más.
 */
export function mayBeLate(ctx: EntryContext, cardId: string, date: ISODate): boolean {
  const card = ctx.cards.get(cardId);
  if (!card) return false;
  const core = { id: card.id, closeDay: card.closeDay, dueDay: card.dueDay, creditLimit: money(0, 'ARS') };
  return closeDate(core, statementFor(core, date, card.overrides), card.overrides) < ctx.today;
}

/** `lateImpacts` con los datos de la Billetera. null si no se pudieron traer: se guarda sin preguntar. */
export async function loadLateImpacts(userId: string, settings: UserSettings, drafts: readonly LateDraft[]): Promise<LateExpenseImpact[] | null> {
  try {
    const { input } = await loadWalletInput(userId, settings);
    return lateImpacts(input, drafts);
  } catch {
    return null;
  }
}

function paymentJson(p: LatePayment) {
  return {
    id: p.id,
    period: `${p.period}-01`,
    applies_to: p.appliesTo,
    amount: toDbNumeric(p.amount),
    from_account_id: p.fromAccountId,
    debited_amount: toDbNumeric(p.debitedAmount),
    fx_card_rate: p.fxCardRate,
    paid_on: p.paidAt,
  };
}

/**
 * Guarda el gasto con el id que generó el teléfono al abrir la hoja. Si ese id ya existe (un reintento
 * que sí había llegado), cuenta como guardado: nunca se duplica (02 §5). Con pagos ("¿Ya lo pagaste?"
 * → Sí), gasto y pagos van juntos en `save_expense_with_payments`.
 */
export async function saveExpense(draft: ExpenseDraft, payments: readonly LatePayment[] = []): Promise<SaveError | null> {
  const row = {
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
  };
  try {
    const { error } = payments.length
      ? await supabase.rpc('save_expense_with_payments', { expense: row, payments: payments.map(paymentJson) })
      : await supabase.from('movements').insert(row);
    if (!error || error.code === '23505') return null;
    return isNetworkError(error) ? 'offline' : 'failed';
  } catch (error) {
    return isNetworkError(error) ? 'offline' : 'failed';
  }
}

/** Por qué una línea de la carga por texto (o la hoja) pide revisión. */
export const WARNING_TEXT: Record<LineWarning, string> = {
  future_date: 'La fecha es futura.',
  invalid_date: 'La fecha no existe.',
  ambiguous_amount: 'Revisá el monto.',
  several_amounts: 'Hay más de un número: revisá el monto.',
  installments_out_of_range: 'Las cuotas van de 1 a 24.',
  installments_need_credit: 'Las cuotas son solo para tarjetas de crédito.',
};

export interface BatchResult {
  /** Los ids que quedaron guardados, en orden. */
  saved: string[];
  /** Los pagos de "¿Ya lo pagaste?" que se registraron con esos gastos. */
  payments: LatePayment[];
  /** Sin dólar tarjeta de la fecha para descontar de una cuenta en otra moneda: quedan en el campo. */
  noRate: string[];
  /** Si se cortó a mitad de la tanda: las que siguen quedan en el campo. */
  failure: SaveError | null;
}

/**
 * Guarda las líneas listas de a una, cada una con su id (D-5). Si se corta la señal, para ahí: al
 * reintentar, las que ya habían llegado cuentan como guardadas y no se duplican.
 */
export async function saveBatch(
  lines: readonly ResolvedLine[],
  ctx: EntryContext,
  payments: ReadonlyMap<string, readonly LatePayment[]> = new Map(),
): Promise<BatchResult> {
  const result: BatchResult = { saved: [], payments: [], noRate: [], failure: null };
  const rates = new Map<ISODate, Rate | null>();
  for (const line of lines) {
    const method = ctx.methods.find((m) => m.id === line.methodId);
    if (!method || !line.amount) continue;
    const account = method.kind === 'account' ? ctx.accounts.get(method.id) : undefined;
    let debited: Money | null = null;
    if (account && account.currency !== line.amount.currency) {
      if (!rates.has(line.date)) rates.set(line.date, await cardRateOn(line.date));
      const r = rates.get(line.date);
      if (!r) {
        result.noRate.push(line.id);
        continue;
      }
      debited = convert(line.amount, r, account.currency);
    }
    const linePayments = payments.get(line.id) ?? [];
    const failure = await saveExpense({
      id: line.id,
      origin: 'text',
      date: line.date,
      description: line.description.slice(0, 60),
      amount: line.amount,
      method,
      installments: line.installments,
      categoryId: line.categoryId,
      debited,
    }, linePayments);
    if (failure) {
      result.failure = failure;
      break;
    }
    result.saved.push(line.id);
    result.payments.push(...linePayments);
  }
  return result;
}

/** "Deshacer" del toast: borra el gasto. */
export async function deleteExpense(id: string): Promise<boolean> {
  return deleteExpenses([id]);
}

/** "Deshacer" de la tanda: borra todos los gastos que se guardaron juntos. */
export async function deleteExpenses(ids: readonly string[]): Promise<boolean> {
  const { error } = await supabase.from('movements').delete().in('id', ids);
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

/** Pasa las líneas de tarjeta de una tanda a `LateDraft`, para `loadLateImpacts`. */
export function lateDrafts(lines: readonly ResolvedLine[], ctx: EntryContext): LateDraft[] {
  return lines.flatMap((l) => {
    const method = ctx.methods.find((m) => m.id === l.methodId);
    return method?.kind === 'card' && l.amount
      ? [{ id: l.id, cardId: method.id, date: l.date, amount: l.amount, installments: l.installments }]
      : [];
  });
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
