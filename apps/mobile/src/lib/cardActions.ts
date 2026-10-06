import type { ISODate, Period } from '@mangos/core';
import { cardInsert, type CardFormValue } from './cardForm';
import { supabase } from './supabase';

function check(result: { error: unknown }): void {
  if (result.error) throw result.error;
}

/** Una sola favorita: la base saca la marca anterior y pone la nueva en una transacción. */
export async function setFavoriteCard(cardId: string): Promise<void> {
  check(await supabase.rpc('set_favorite_card', { card_id: cardId }));
}

/**
 * Archivar = "eliminar" (02 §3): deja de verse 7 días y después la purga la borra. Su deuda sigue
 * contando. Pierde la favorita, porque la favorita es entre las tarjetas activas.
 */
export async function archiveCard(cardId: string): Promise<void> {
  check(await supabase.from('cards').update({ archived_at: new Date().toISOString(), is_favorite: false }).eq('id', cardId));
}

export async function unarchiveCard(cardId: string): Promise<void> {
  check(await supabase.from('cards').update({ archived_at: null }).eq('id', cardId));
}

/** Editar: los datos del formulario. El color y la favorita no cambian acá. */
export async function updateCard(cardId: string, value: CardFormValue): Promise<void> {
  const { color: _color, is_favorite: _favorite, ...fields } = cardInsert(value, { color: '', isFavorite: false });
  check(await supabase.from('cards').update(fields).eq('id', cardId));
}

/** Cierre real de un resumen (02 §3). Se valida antes con `validateOverride` de core. */
export async function saveOverride(cardId: string, period: Period, closeDate: ISODate, dueDate: ISODate): Promise<void> {
  check(
    await supabase
      .from('statement_overrides')
      .upsert({ card_id: cardId, period: `${period}-01`, close_date: closeDate, due_date: dueDate }, { onConflict: 'card_id,period' }),
  );
}

/** "Volver a la fecha estimada": borra la corrección. */
export async function deleteOverride(cardId: string, period: Period): Promise<void> {
  check(await supabase.from('statement_overrides').delete().eq('card_id', cardId).eq('period', `${period}-01`));
}
