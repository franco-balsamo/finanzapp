import { toDbNumeric, type DbPart, type ISODate, type Money, type Rate } from '@mangos/core';
import { isNetworkError, type SaveError } from './entry';
import { supabase } from './supabase';

/** Tu gasto personal vinculado al gasto de grupo (`movement` de `save_group_expense_with_movement`). */
export type MovementChange =
  /** No toca tu gasto personal (pagó otro, o en un alta "No sumarlo a mis finanzas"). */
  | null
  /** Borra tu gasto personal vinculado ("No sumarlo a mis finanzas" al editar). */
  | { remove: true }
  | {
      id: string;
      origin: 'manual' | 'text';
      card_id?: string;
      account_id?: string;
      installments: number;
      /** Solo si la cuenta está en otra moneda que el gasto. */
      debited_amount?: string;
    };

export interface GroupExpenseDraft {
  /** El id del gasto de grupo: el que generó el teléfono al abrir la hoja, o el del gasto que se edita. */
  id: string;
  groupId: string;
  date: ISODate;
  description: string;
  amount: Money;
  /** Solo si la moneda del gasto difiere de la del grupo. */
  fxRate: Rate | null;
  payerMemberId: string;
  splitMode: 'equal' | 'exact';
  categoryId: string;
  parts: DbPart[];
  movement: MovementChange;
}

export type GroupSaveError = SaveError | 'payer_only';

/** Gasto de grupo, partes y tu gasto personal en una transacción (G-1). Reintentar no duplica. */
export async function saveGroupExpense(draft: GroupExpenseDraft): Promise<GroupSaveError | null> {
  try {
    const { error } = await supabase.rpc('save_group_expense_with_movement', {
      expense_id: draft.id,
      group_id: draft.groupId,
      expense_date: draft.date,
      description: draft.description.trim(),
      amount: toDbNumeric(draft.amount),
      currency: draft.amount.currency,
      fx_rate: draft.fxRate,
      payer_member_id: draft.payerMemberId,
      split_mode: draft.splitMode,
      category_id: draft.categoryId,
      parts: draft.parts,
      movement: draft.movement,
    });
    if (!error) return null;
    if (error.code === '42501' && /only the payer/.test(error.message)) return 'payer_only';
    return isNetworkError(error) ? 'offline' : 'failed';
  } catch (error) {
    return isNetworkError(error) ? 'offline' : 'failed';
  }
}

/** Borra el gasto de grupo (D6): tu gasto personal, si había, queda y vuelve a contar completo. */
export async function deleteGroupExpense(id: string): Promise<boolean> {
  const { error } = await supabase.rpc('delete_group_expense', { expense_id: id });
  return !error;
}

export interface MyGroupMovement {
  id: string;
  card_id: string | null;
  account_id: string | null;
  installments: number;
  debited_amount: string | null;
}

/** Tu gasto personal vinculado a un gasto de grupo, para editarlo. null si no lo tenés en tus finanzas. */
export async function loadMyGroupMovement(groupExpenseId: string): Promise<MyGroupMovement | null> {
  const { data, error } = await supabase
    .from('movements')
    .select('id, card_id, account_id, installments, debited_amount::text')
    .eq('group_expense_id', groupExpenseId)
    .neq('origin', 'claim')
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as MyGroupMovement | undefined) ?? null;
}

/** D5: otro lo tiene en sus finanzas, así que no podés cambiar monto, moneda ni quién pagó. */
export async function loadMoneyLocked(groupExpenseId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('group_expense_money_locked', { expense_id: groupExpenseId });
  if (error) throw error;
  return data as boolean;
}
