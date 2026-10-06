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

export type ClaimError = 'already_member' | 'taken' | 'invalid' | 'failed';

/**
 * "Soy Juan" (W-5, 02 §7): tu cuenta toma el lugar provisorio de ese integrante (`claim_member`).
 * Los gastos que pagó ese lugar entran a tus finanzas como "Sin medio de pago".
 */
export async function claimPlace(token: string, memberId: string): Promise<ClaimError | null> {
  const { error } = await supabase.rpc('claim_member', { token, member_id: memberId });
  if (!error) return null;
  if (/already a member/.test(error.message)) return 'already_member';
  if (/invalid invite/.test(error.message)) return 'invalid';
  if (/not a provisional place|is not in this group/.test(error.message)) return 'taken';
  return 'failed';
}
