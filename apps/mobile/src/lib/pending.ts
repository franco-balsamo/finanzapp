// Cola sin conexión (02 §5, "Sin conexión"): los gastos personales nuevos que se guardaron en el teléfono
// y se envían solos cuando vuelve la señal. La lógica de estados está en core (`pendingQueue.ts`).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyOutcome, enqueue, nextToSend, remove, retry, type PendingExpense } from '@mangos/core';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { deleteExpense, entryContextKey, expenseRow, sendExpense, type ExpenseDraft } from './entry';
import { onWalletChanged, pendingChanged, walletChanged } from './events';

const queueKey = (userId: string) => `mangos.pending.${userId}`;

export async function loadQueue(userId: string): Promise<PendingExpense[]> {
  const raw = await AsyncStorage.getItem(queueKey(userId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingExpense[];
  } catch (error) {
    // No se pierde nada por un bug: se aparta la copia rota antes de que la próxima escritura la pise.
    console.warn('Cola sin conexión ilegible', error);
    await AsyncStorage.setItem(`${queueKey(userId)}.broken.${Date.now()}`, raw);
    return [];
  }
}

// Las escrituras van de a una, para que encolar mientras se envía no pise la cola.
let writes: Promise<unknown> = Promise.resolve();

function mutate(userId: string, change: (queue: PendingExpense[]) => PendingExpense[]): Promise<PendingExpense[]> {
  const next = writes.then(async () => {
    const queue = change(await loadQueue(userId));
    await AsyncStorage.setItem(queueKey(userId), JSON.stringify(queue));
    return queue;
  });
  writes = next.catch(() => undefined);
  return next.finally(pendingChanged);
}

/** Guarda el gasto en el teléfono. Con el id de un borrador de la cola, lo reemplaza y lo deja pendiente. */
export function enqueueExpense(userId: string, draft: ExpenseDraft): Promise<PendingExpense[]> {
  const item: PendingExpense = { id: draft.id, row: expenseRow(draft), status: 'pending', error: null, queuedAt: new Date().toISOString() };
  return mutate(userId, (queue) => enqueue(queue, item));
}

/** "Reintentar" de un gasto que no se pudo guardar. */
export async function retryPending(userId: string, id: string): Promise<void> {
  await mutate(userId, (queue) => retry(queue, id));
  void flushPending(userId);
}

/** "Borrar gasto" de un borrador de la cola. */
export function removePending(userId: string, id: string): Promise<PendingExpense[]> {
  return mutate(userId, (queue) => remove(queue, id));
}

/** "Deshacer": lo saca de la cola y, si justo se estaba enviando y llegó, lo borra de la base. */
export async function undoPending(userId: string, ids: readonly string[]): Promise<void> {
  await mutate(userId, (queue) => ids.reduce(remove, queue));
  await flushing;
  await Promise.all(ids.map(deleteExpense));
}

let flushing: Promise<void> | null = null;

/**
 * Manda la cola en orden, de a un gasto y con un solo envío en curso. Sin red corta la vuelta: los que
 * siguen fallarían igual. Un rechazo queda "No se pudo guardar" y se sigue con el próximo.
 */
export function flushPending(userId: string): Promise<void> {
  flushing ??= (async () => {
    let sent = false;
    try {
      for (let item = nextToSend(await loadQueue(userId)); item; item = nextToSend(await loadQueue(userId))) {
        // shortcut: si se edita el borrador mientras se envía, gana la versión que ya salió; se resuelve editando el movimiento.
        const { outcome, message } = await sendExpense(item.row);
        if (outcome === 'retry') break;
        await mutate(userId, (queue) => applyOutcome(queue, item.id, outcome, message ?? undefined));
        sent ||= outcome === 'sent';
      }
    } catch (error) {
      console.warn('Envío de la cola sin conexión', error);
    } finally {
      flushing = null;
    }
    if (sent) walletChanged();
  })();
  return flushing;
}

/**
 * Disparos del envío (D4): al tener sesión (abrir la app o iniciarla), al volver al primer plano, cada
 * 30 s mientras haya pendientes y después de cada guardado (todo guardado avisa con `walletChanged`).
 */
export function usePendingSender(userId: string | undefined): void {
  useEffect(() => {
    if (!userId) return;
    const flush = () => void flushPending(userId);
    flush();
    const appState = AppState.addEventListener('change', (state) => state === 'active' && flush());
    const offWallet = onWalletChanged(flush);
    const timer = setInterval(async () => {
      if (nextToSend(await loadQueue(userId))) flush();
    }, 30_000);
    return () => {
      appState.remove();
      offWallet();
      clearInterval(timer);
    };
  }, [userId]);
}

/** Borrar la cuenta (02 §10) borra también lo guardado en el teléfono. */
export async function clearLocalData(userId: string): Promise<void> {
  const broken = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(`${queueKey(userId)}.broken.`));
  await AsyncStorage.multiRemove([queueKey(userId), entryContextKey(userId), ...broken]);
  pendingChanged();
}

/** El borrador de la cola que se edita en la hoja, con la misma forma que un gasto guardado. */
export async function loadPendingRow(userId: string, id: string): Promise<PendingExpense['row']> {
  const item = (await loadQueue(userId)).find((p) => p.id === id);
  if (!item) throw new Error('El gasto ya no está en la cola');
  return item.row;
}
