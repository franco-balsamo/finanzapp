import { rate as toRate, toDbNumeric, type Currency, type ISODate, type Money, type Period, type Rate } from '@mangos/core';
import { supabase } from './supabase';

/** Pesos por dólar con 4 decimales, a partir de lo descontado y lo pagado (en centavos). */
export function impliedRate(arsMinor: number, usdMinor: number): Rate {
  const scaled = Math.round((arsMinor * 10_000) / usdMinor);
  return toRate(`${Math.floor(scaled / 10_000)}.${String(scaled % 10_000).padStart(4, '0')}`);
}

export interface PaymentDraft {
  appliesTo: Currency;
  /** Lo que cubre del resumen, en la moneda de `appliesTo`. */
  amount: Money;
  fromAccountId: string;
  /** Lo que salió de la cuenta, en la moneda de la cuenta. */
  debited: Money;
  /** Dólar tarjeta usado si se pagaron dólares en pesos (02 §3). */
  fxCardRate: Rate | null;
}

/**
 * Registra los pagos de un resumen (una fila por moneda) en un solo `insert`, que es atómico.
 * La fecha se guarda a las 12:00 de Argentina, como `save_expense_with_payments`, así no se corre de día.
 * Devuelve los ids, para el "Deshacer" del toast.
 */
export async function registerPayments(cardId: string, period: Period, paidOn: ISODate, drafts: readonly PaymentDraft[]): Promise<string[]> {
  const { data, error } = await supabase
    .from('statement_payments')
    .insert(
      drafts.map((d) => ({
        card_id: cardId,
        period: `${period}-01`,
        applies_to: d.appliesTo,
        amount: toDbNumeric(d.amount),
        from_account_id: d.fromAccountId,
        debited_amount: toDbNumeric(d.debited),
        fx_card_rate: d.fxCardRate,
        paid_at: `${paidOn}T12:00:00-03:00`,
      })),
    )
    .select('id');
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

/**
 * Deshacer: el pago deja de contar y la plata vuelve a la cuenta (02 §3). La fila no se borra.
 * Solo toca los pagos todavía vigentes, así deshacer dos veces no cambia la fecha.
 */
export async function revertPayments(ids: readonly string[]): Promise<void> {
  const { error } = await supabase
    .from('statement_payments')
    .update({ reverted_at: new Date().toISOString() })
    .in('id', [...ids])
    .is('reverted_at', null);
  if (error) throw error;
}
