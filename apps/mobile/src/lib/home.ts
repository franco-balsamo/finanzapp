import type { DbNotification } from '@mangos/core';
import type { UserSettings } from './session';
import { supabase } from './supabase';
import { loadWalletInput } from './wallet';

/**
 * Las filas de Inicio: las de la Billetera (con todas las cotizaciones, para el dólar del día) y los
 * últimos avisos. Si fallan solo los avisos, `notifications` es null y el resto se muestra igual.
 */
export async function loadHome(userId: string, settings: Pick<UserSettings, 'fx_reference' | 'display_currency'>) {
  const [wallet, notifications] = await Promise.all([
    loadWalletInput(userId, settings),
    supabase
      .from('notifications')
      .select('id, title, body, kind, data, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => (error ? null : ((data ?? []) as DbNotification[]))),
  ]);
  return { ...wallet, notifications };
}

/** Marca leído un aviso. Si falla, no se avisa: el punto queda y se reintenta al volver a tocarlo. */
export async function markNoticeRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
}
