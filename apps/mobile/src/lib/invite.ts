import { Platform, Share } from 'react-native';
import { supabase } from './supabase';

// Dónde está publicada la web de invitados (W-2). Sin esta variable no se puede armar el link.
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/+$/, '') ?? null;

/** El link de la web de invitados para un token: `<EXPO_PUBLIC_WEB_URL>/g/<token>`. null si falta la URL. */
export function inviteUrl(token: string): string | null {
  return WEB_URL ? `${WEB_URL}/g/${token}` : null;
}

/** Crea un link nuevo (`rotate_invite_token`): el anterior, si había, deja de andar. Devuelve el token. */
export async function rotateInvite(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_invite_token', { gid: groupId });
  if (error) throw error;
  return data as string;
}

/** Revoca el link (`revoke_invite_token`): deja de andar y "Compartir" vuelve a crear uno. */
export async function revokeInvite(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_invite_token', { gid: groupId });
  if (error) throw error;
}

export type ShareResult = 'shared' | 'copied' | 'dismissed';

/**
 * La hoja de compartir del sistema con "Mirá los gastos de Cabaña en Mangos: <link>". En la web,
 * si el navegador no tiene `navigator.share`, copia el link.
 */
export async function shareInvite(groupName: string, url: string): Promise<ShareResult> {
  const message = `Mirá los gastos de ${groupName} en Mangos: ${url}`;
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
    await navigator.clipboard.writeText(url);
    return 'copied';
  }
  const result = await Share.share(Platform.OS === 'ios' ? { message, url } : { message });
  return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
}
