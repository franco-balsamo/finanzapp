import {
  todayInArgentina,
  wallet,
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

/** Los grupos donde sos integrante activo, con lo necesario para calcular tu saldo. */
async function loadGroups(userId: string): Promise<DbWalletGroup[]> {
  const mine = rows<{ id: string; group_id: string }>(
    await supabase.from('group_members').select('id, group_id').eq('user_id', userId).is('left_at', null),
  );
  if (!mine.length) return [];
  const ids = mine.map((m) => m.group_id);
  const [groups, members, expenses, payments] = await Promise.all([
    supabase.from('groups').select('id, currency').in('id', ids).is('deleted_at', null),
    supabase.from('group_members').select('id, group_id, display_name').in('group_id', ids).order('joined_at'),
    supabase
      .from('group_expenses')
      .select('id, group_id, amount::text, currency, fx_rate::text, payer_member_id, split_mode, parts:group_expense_parts(member_id, value::text)')
      .in('group_id', ids)
      .is('deleted_at', null),
    supabase.from('group_payments').select('id, group_id, from_member_id, to_member_id, amount::text').in('group_id', ids).is('deleted_at', null),
  ]);
  const memberRows = rows<{ id: string; group_id: string; display_name: string }>(members);
  const expenseRows = rows<DbWalletGroup['expenses'][number] & { group_id: string }>(expenses);
  const paymentRows = rows<DbWalletGroup['payments'][number] & { group_id: string }>(payments);
  return rows<{ id: string; currency: DbWalletGroup['currency'] }>(groups).map((g) => ({
    id: g.id,
    currency: g.currency,
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
