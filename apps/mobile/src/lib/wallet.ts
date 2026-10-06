import {
  cardDetail,
  todayInArgentina,
  wallet,
  type CardDetail,
  type DbWalletAccount,
  type DbWalletCard,
  type DbWalletGroup,
  type DbWalletMovement,
  type DbWalletOverride,
  type DbWalletPayment,
  type Wallet,
  type WalletInput,
} from '@mangos/core';
import { latestRates, type LatestRate } from './fx';
import type { UserSettings } from './session';
import { supabase } from './supabase';

// Los montos se piden como texto (`::text`) para no pasar por number: core los lee exactos.
const CARD_COLUMNS =
  'id, name, bank, network, last4, color, is_favorite, close_day, due_day, credit_limit::text, expiry, created_at, archived_at';
const ACCOUNT_COLUMNS = 'id, name, type, currency, opening_balance::text, created_at';
const MOVEMENT_COLUMNS =
  'id, type, date, description, amount::text, currency, card_id, account_id, to_account_id, installments, category_id, ' +
  'my_share::text, group_expense_id, fx_mep::text, fx_oficial::text, fx_blue::text, fx_pending, debited_amount::text';
const PAYMENT_COLUMNS =
  'id, card_id, period, applies_to, amount::text, from_account_id, debited_amount::text, fx_card_rate::text, paid_at, reverted_at';

function rows<T>(result: { data: unknown; error: unknown }): T[] {
  if (result.error) throw result.error;
  return (result.data ?? []) as T[];
}

/** Los grupos donde sos integrante activo, con lo necesario para el saldo, la lista y el detalle. */
export async function loadGroups(userId: string): Promise<DbWalletGroup[]> {
  const mine = rows<{ id: string; group_id: string }>(
    await supabase.from('group_members').select('id, group_id').eq('user_id', userId).is('left_at', null),
  );
  if (!mine.length) return [];
  const ids = mine.map((m) => m.group_id);
  const [groups, members, expenses, payments] = await Promise.all([
    supabase.from('groups').select('id, name, currency, owner_member_id, invite_token, created_at').in('id', ids).is('deleted_at', null).order('created_at'),
    supabase
      .from('group_members')
      .select('id, group_id, display_name, user_id, left_at, claimed_at')
      .in('group_id', ids)
      // Mismo orden que private.member_shares: el resto de una división va igual en core y en la base.
      .order('joined_at')
      .order('id'),
    supabase
      .from('group_expenses')
      .select(
        'id, group_id, date, description, amount::text, currency, fx_rate::text, payer_member_id, split_mode, category_id, ' +
          'parts:group_expense_parts(member_id, value::text)',
      )
      .in('group_id', ids)
      .is('deleted_at', null)
      .order('date')
      .order('created_at'),
    // También los anulados: el detalle los muestra tachados y core no los cuenta.
    supabase
      .from('group_payments')
      .select('id, group_id, from_member_id, to_member_id, amount::text, date, deleted_at')
      .in('group_id', ids)
      .order('date')
      .order('created_at'),
  ]);
  const memberRows = rows<DbWalletGroup['members'][number] & { group_id: string }>(members);
  const expenseRows = rows<DbWalletGroup['expenses'][number] & { group_id: string }>(expenses);
  const paymentRows = rows<DbWalletGroup['payments'][number] & { group_id: string }>(payments);
  return rows<{ id: string; name: string; currency: DbWalletGroup['currency']; owner_member_id: string | null; invite_token: string | null }>(
    groups,
  ).map((g) => ({
    id: g.id,
    name: g.name,
    currency: g.currency,
    owner_member_id: g.owner_member_id,
    invite_token: g.invite_token,
    my_member_id: mine.find((m) => m.group_id === g.id)!.id,
    members: memberRows.filter((m) => m.group_id === g.id),
    expenses: expenseRows.filter((e) => e.group_id === g.id),
    payments: paymentRows.filter((p) => p.group_id === g.id),
  }));
}

export interface WalletData extends Wallet {
  /** La cotización del dólar de referencia que se usó, para mostrar su hora. */
  referenceRate: LatestRate | null;
}

/** Todas las filas que necesita la Billetera, ya en el formato de core. */
export async function loadWalletInput(
  userId: string,
  settings: UserSettings,
): Promise<{ input: WalletInput; referenceRate: LatestRate | null }> {
  const [cards, accounts, movements, payments, overrides, groups, rates] = await Promise.all([
    // También las archivadas: su deuda sigue contando hasta la purga (02 §3).
    supabase.from('cards').select(CARD_COLUMNS),
    supabase.from('accounts').select(ACCOUNT_COLUMNS).is('deleted_at', null),
    supabase.from('movements').select(MOVEMENT_COLUMNS),
    supabase.from('statement_payments').select(PAYMENT_COLUMNS),
    supabase.from('statement_overrides').select('card_id, period, close_date, due_date'),
    loadGroups(userId),
    latestRates(),
  ]);
  const reference = rates[settings.fx_reference] ?? null;
  return {
    input: {
      today: todayInArgentina(),
      display: settings.display_currency,
      referenceRate: reference?.sell ?? null,
      fxCard: rates.tarjeta?.sell ?? null,
      cards: rows<DbWalletCard>(cards),
      accounts: rows<DbWalletAccount>(accounts),
      movements: rows<DbWalletMovement>(movements),
      payments: rows<DbWalletPayment>(payments),
      overrides: rows<DbWalletOverride>(overrides),
      groups,
    },
    referenceRate: reference,
  };
}

export async function loadWallet(userId: string, settings: UserSettings): Promise<WalletData> {
  const { input, referenceRate } = await loadWalletInput(userId, settings);
  return { ...wallet(input), referenceRate };
}

export interface CardDetailData {
  detail: CardDetail;
  /** Nombre y moneda de cada cuenta, para los pagos ("desde Caja Galicia"). */
  accounts: Map<string, { name: string; currency: 'ARS' | 'USD' }>;
}

/** El detalle de una tarjeta (6A), calculado con las mismas filas que la Billetera. */
export async function loadCardDetail(userId: string, settings: UserSettings, cardId: string): Promise<CardDetailData> {
  const { input } = await loadWalletInput(userId, settings);
  return {
    detail: cardDetail(input, cardId),
    accounts: new Map(input.accounts.map((a) => [a.id, { name: a.name, currency: a.currency }])),
  };
}
