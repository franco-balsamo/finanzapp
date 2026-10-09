import { cardAlerts, type CardAlertSettings, type DbAlert } from '@mangos/core';
import { supabase } from './supabase';

/** Avisos de cada tarjeta activa (02 §9), en el orden de la Billetera: la favorita primero. */
export async function loadCardAlerts(): Promise<CardAlertSettings[]> {
  const [cards, alerts] = await Promise.all([
    supabase
      .from('cards')
      .select('id, name, last4')
      .is('archived_at', null)
      .order('is_favorite', { ascending: false })
      .order('created_at'),
    supabase.from('alerts').select('type, enabled, params').in('type', ['card_closing', 'card_due']),
  ]);
  if (cards.error) throw cards.error;
  if (alerts.error) throw alerts.error;
  return cardAlerts(cards.data, alerts.data as DbAlert[]);
}

export async function setCardAlert(cardId: string, type: DbAlert['type'], enabled: boolean, daysBefore?: number): Promise<void> {
  const { error } = await supabase.rpc('set_card_alert', { card_id: cardId, alert_type: type, enabled, days_before: daysBefore });
  if (error) throw error;
}
