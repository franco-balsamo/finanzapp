import { rate, type Rate } from '@mangos/core';
import { supabase } from './supabase';

export type FxKind = 'mep' | 'oficial' | 'blue' | 'tarjeta';

export interface LatestRate {
  sell: Rate;
  fetchedAt: string;
}

/**
 * La última venta guardada de cada tipo. Las cotizaciones las trae el backend cada 10 minutos
 * (la app nunca llama a las APIs): con las últimas filas alcanza para tener todos los tipos.
 */
export async function latestRates(): Promise<Partial<Record<FxKind, LatestRate>>> {
  const { data, error } = await supabase
    .from('fx_rates')
    .select('kind, sell, fetched_at')
    .in('kind', ['mep', 'oficial', 'blue', 'tarjeta'])
    .order('fetched_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  const result: Partial<Record<FxKind, LatestRate>> = {};
  for (const row of data ?? []) {
    const kind = row.kind as FxKind;
    // `sell` llega como número de PostgREST; se pasa a string sin perder decimales (numeric(14,4)).
    if (!result[kind]) result[kind] = { sell: rate(String(row.sell)), fetchedAt: row.fetched_at };
  }
  return result;
}
