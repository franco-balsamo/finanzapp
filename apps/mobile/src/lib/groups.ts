import { groupDetail, groupList, type Currency, type GroupDetail, type GroupList } from '@mangos/core';
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
