import { cardInsert, nextCardColor, type CardFormValue } from './cardForm';
import { supabase } from './supabase';

/**
 * Guarda una tarjeta nueva. Toma el primer color libre y, si es la primera tarjeta activa del
 * usuario, la deja como favorita (02 §5: una sola favorita).
 */
export async function createCard(value: CardFormValue): Promise<void> {
  const { data: active, error: readError } = await supabase.from('cards').select('color').is('archived_at', null);
  if (readError) throw readError;
  const row = cardInsert(value, {
    color: nextCardColor((active ?? []).map((c) => c.color)),
    isFavorite: (active ?? []).length === 0,
  });
  const { error } = await supabase.from('cards').insert(row);
  if (error) throw error;
}
