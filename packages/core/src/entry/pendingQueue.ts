import type { ISODate } from '../dates.ts';
import type { Currency } from '../money.ts';

/**
 * Cola sin conexión (02 §5, "Sin conexión"): los gastos personales nuevos que se guardaron en el teléfono
 * y esperan llegar a la base. Funciones puras: el almacenamiento y la red están en la app.
 */

/** La fila de `movements` tal como la manda `saveExpense` (montos como texto numeric, nunca float). */
export interface PendingRow {
  id: string;
  type: 'expense';
  origin: 'manual' | 'text';
  date: ISODate;
  description: string;
  amount: string;
  currency: Currency;
  card_id: string | null;
  account_id: string | null;
  installments: number;
  category_id: string | null;
  debited_amount: string | null;
}

export type PendingStatus = 'pending' | 'failed';

export interface PendingExpense {
  /** El mismo id que va a tener el movimiento: reenviarlo nunca lo duplica. */
  id: string;
  row: PendingRow;
  status: PendingStatus;
  /** Solo con `failed`: el mensaje de la base, para depurar (no se muestra). */
  error: string | null;
  /** ISO con hora. */
  queuedAt: string;
}

/** Mismo id: reemplaza en su lugar (editar un borrador). Si no, va al final. */
export function enqueue(queue: readonly PendingExpense[], item: PendingExpense): PendingExpense[] {
  return queue.some((p) => p.id === item.id) ? queue.map((p) => (p.id === item.id ? item : p)) : [...queue, item];
}

/** El primer `pending`, por orden de llegada. */
export function nextToSend(queue: readonly PendingExpense[]): PendingExpense | null {
  return queue.find((p) => p.status === 'pending') ?? null;
}

export type SendOutcome = 'sent' | 'retry' | 'failed';

/** Enviado: sale de la cola. Para reintentar: queda igual. Rechazado: `failed` con el mensaje de la base. */
export function applyOutcome(queue: readonly PendingExpense[], id: string, outcome: SendOutcome, error?: string): PendingExpense[] {
  if (outcome === 'sent') return remove(queue, id);
  if (outcome === 'retry') return [...queue];
  return queue.map((p) => (p.id === id ? { ...p, status: 'failed', error: error ?? null } : p));
}

export function remove(queue: readonly PendingExpense[], id: string): PendingExpense[] {
  return queue.filter((p) => p.id !== id);
}

/** "Reintentar": `failed` → `pending`. */
export function retry(queue: readonly PendingExpense[], id: string): PendingExpense[] {
  return queue.map((p) => (p.id === id ? { ...p, status: 'pending', error: null } : p));
}

export function pendingSummary(queue: readonly PendingExpense[]): { count: number; failed: number } {
  return { count: queue.length, failed: queue.filter((p) => p.status === 'failed').length };
}

/**
 * Qué hacer con un envío que falló: la red, un 5xx o la sesión vencida (401) esperan al próximo intento;
 * `23505` es un reenvío de algo que ya había llegado; cualquier otro rechazo es definitivo.
 */
export function classifySaveError(input: { status?: number; code?: string; network: boolean }): SendOutcome {
  if (input.network || (input.status ?? 0) >= 500 || input.status === 401) return 'retry';
  return input.code === '23505' ? 'sent' : 'failed';
}
