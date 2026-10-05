import { formatAmountInput, money, toDbNumeric, type Currency } from '@mangos/core';
import { supabase } from './supabase';

export type AccountType = 'bank' | 'wallet' | 'cash';

export interface AccountFormValue {
  name: string;
  type: AccountType | null;
  currency: Currency;
  /** Saldo de hoy, formateado ("150.000"). Vacío es 0. */
  balance: string;
}

export const EMPTY_ACCOUNT: AccountFormValue = { name: '', type: null, currency: 'ARS', balance: '' };

export const ACCOUNT_TYPE_OPTIONS = [
  { value: 'bank', label: 'Banco' },
  { value: 'wallet', label: 'Billetera virtual' },
  { value: 'cash', label: 'Efectivo' },
] as const satisfies readonly { value: AccountType; label: string }[];

export type AccountFormErrors = Partial<Record<keyof AccountFormValue, string>>;

export function validateAccount(v: AccountFormValue): AccountFormErrors | null {
  const errors: AccountFormErrors = {};
  if (!v.name.trim()) errors.name = 'A la cuenta ponele un nombre.';
  if (!v.type) errors.type = 'Elegí el tipo de cuenta.';
  return Object.keys(errors).length ? errors : null;
}

export async function createAccount(v: AccountFormValue): Promise<void> {
  const minor = formatAmountInput(v.balance).minor ?? 0;
  const { error } = await supabase.from('accounts').insert({
    name: v.name.trim(),
    type: v.type!,
    currency: v.currency,
    opening_balance: toDbNumeric(money(minor, v.currency)),
  });
  if (error) throw error;
}
