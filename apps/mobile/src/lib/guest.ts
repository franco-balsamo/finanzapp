import { guestGroupDetail, type GroupDetail, type GuestGroupJson } from '@mangos/core';
import { supabase } from './supabase';

/**
 * El grupo de un link de invitación (`get_guest_group`, sin sesión). null si el link no anda:
 * no existe, se revocó o se regeneró, o el grupo se eliminó. Falla solo si no hubo respuesta.
 */
export async function loadGuestGroup(token: string): Promise<GroupDetail | null> {
  const { data, error } = await supabase.rpc('get_guest_group', { token });
  if (error) throw error;
  return data ? guestGroupDetail(data as GuestGroupJson) : null;
}
