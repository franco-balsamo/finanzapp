import { groupDetail, groupList, toDbNumeric, type Currency, type GroupDetail, type GroupList, type ISODate, type Money } from '@mangos/core';
import { isNetworkError, type SaveError } from './entry';
import { supabase } from './supabase';
import { loadGroups } from './wallet';

/** La lista de Grupos: tus grupos activos con tu saldo, y lo que te deben y debés en total. */
export async function loadGroupList(userId: string): Promise<GroupList> {
  return groupList(await loadGroups(userId));
}

/** El detalle de un grupo (1A). Falla si ya no sos integrante o el grupo se eliminó. */
export async function loadGroupDetail(userId: string, groupId: string): Promise<GroupDetail> {
  return groupDetail(await loadGroups(userId), groupId);
}

/** Te suma como integrante y dueño (`create_group`). Devuelve el id del grupo. */
export async function createGroup(name: string, currency: Currency, myName: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_group', {
    group_name: name.trim(),
    group_currency: currency,
    member_name: myName.trim(),
  });
  if (error) throw error;
  return data as string;
}

/**
 * Suma integrantes provisorios de a uno, así quedan en el orden en que se escribieron (`joined_at`).
 * Cada uno lleva el id que generó el teléfono: si se reintenta, los que ya entraron no se duplican.
 */
export async function addProvisionalMembers(groupId: string, people: readonly { id: string; name: string }[]): Promise<void> {
  for (const person of people) {
    const { error } = await supabase
      .from('group_members')
      .insert({ id: person.id, group_id: groupId, display_name: person.name.trim() });
    if (error && error.code !== '23505') throw error;
  }
}

export interface GroupPaymentDraft {
  /** El id que generó el teléfono al abrir la hoja: reintentar no duplica. */
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  /** En la moneda del grupo. */
  amount: Money;
  date: ISODate;
  /** "Mover saldo de…" (D7): una cuenta tuya en la moneda del grupo, o null ("No mover saldos"). */
  accountId: string | null;
}

/** Registra un pago entre integrantes (G-1). Mangos no mueve plata: solo lo anota. */
export async function registerGroupPayment(draft: GroupPaymentDraft): Promise<SaveError | null> {
  try {
    const { error } = await supabase.rpc('register_group_payment', {
      payment_id: draft.id,
      group_id: draft.groupId,
      from_member_id: draft.fromMemberId,
      to_member_id: draft.toMemberId,
      amount: toDbNumeric(draft.amount),
      payment_date: draft.date,
      account_id: draft.accountId,
    });
    if (!error) return null;
    return isNetworkError(error) ? 'offline' : 'failed';
  } catch (error) {
    return isNetworkError(error) ? 'offline' : 'failed';
  }
}

/** Anula un pago: deja de contar y, si había movido el saldo de una cuenta, ese movimiento se borra. */
export async function voidGroupPayment(paymentId: string): Promise<boolean> {
  const { error } = await supabase.rpc('void_group_payment', { payment_id: paymentId });
  return !error;
}

/** Tus cuentas en una moneda, para "Mover saldo de…". */
export async function loadAccountsIn(currency: Currency): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('currency', currency)
    .is('deleted_at', null)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}
