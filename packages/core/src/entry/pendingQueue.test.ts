import { describe, expect, it } from 'vitest';
import { applyOutcome, classifySaveError, enqueue, nextToSend, pendingSummary, remove, retry, type PendingExpense } from './pendingQueue.ts';

function item(id: string, over: Partial<PendingExpense> = {}): PendingExpense {
  return {
    id,
    row: {
      id,
      type: 'expense',
      origin: 'manual',
      date: '2026-10-14',
      description: 'Coto súper',
      amount: '12000',
      currency: 'ARS',
      card_id: 'visa',
      account_id: null,
      installments: 1,
      category_id: null,
      debited_amount: null,
    },
    status: 'pending',
    error: null,
    queuedAt: '2026-10-14T10:00:00.000Z',
    ...over,
  };
}

describe('enqueue', () => {
  it('suma un gasto nuevo al final de la cola', () => {
    const queue = enqueue([item('a')], item('b'));
    expect(queue.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('con el mismo id, reemplaza el borrador en su lugar y lo deja pendiente', () => {
    const queue = [item('a'), item('b', { status: 'failed', error: 'tarjeta archivada' }), item('c')];
    const edited = item('b');
    edited.row.amount = '15000';
    const next = enqueue(queue, edited);
    expect(next.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(next[1]).toMatchObject({ status: 'pending', error: null, row: { amount: '15000' } });
  });
});

describe('nextToSend', () => {
  it('da el primer pendiente, por orden de llegada', () => {
    expect(nextToSend([item('a'), item('b')])?.id).toBe('a');
  });

  it('salta los que no se pudieron guardar', () => {
    expect(nextToSend([item('a', { status: 'failed', error: 'x' }), item('b')])?.id).toBe('b');
  });

  it('sin pendientes, no hay nada para enviar', () => {
    expect(nextToSend([])).toBeNull();
    expect(nextToSend([item('a', { status: 'failed', error: 'x' })])).toBeNull();
  });
});

describe('applyOutcome', () => {
  const queue = [item('a'), item('b')];

  it('enviado: sale de la cola', () => {
    expect(applyOutcome(queue, 'a', 'sent').map((p) => p.id)).toEqual(['b']);
  });

  it('para reintentar: queda pendiente, en su lugar', () => {
    expect(applyOutcome(queue, 'a', 'retry')).toEqual(queue);
  });

  it('rechazado: queda "No se pudo guardar" con el mensaje de la base', () => {
    const next = applyOutcome(queue, 'a', 'failed', 'card is archived');
    expect(next[0]).toMatchObject({ id: 'a', status: 'failed', error: 'card is archived' });
    expect(next[1]).toEqual(queue[1]);
  });
});

describe('retry', () => {
  it('"Reintentar" vuelve a dejar pendiente un gasto que no se pudo guardar', () => {
    const next = retry([item('a', { status: 'failed', error: 'x' }), item('b')], 'a');
    expect(next[0]).toMatchObject({ id: 'a', status: 'pending', error: null });
    expect(nextToSend(next)?.id).toBe('a');
  });
});

describe('remove', () => {
  it('"Deshacer" o "Borrar gasto" lo saca de la cola', () => {
    expect(remove([item('a'), item('b')], 'a').map((p) => p.id)).toEqual(['b']);
  });
});

describe('pendingSummary', () => {
  it('cuenta los gastos sin enviar y cuántos fallaron', () => {
    expect(pendingSummary([])).toEqual({ count: 0, failed: 0 });
    expect(pendingSummary([item('a'), item('b', { status: 'failed', error: 'x' }), item('c')])).toEqual({ count: 3, failed: 1 });
  });
});

describe('classifySaveError', () => {
  it('sin red, error del servidor o sesión vencida: queda pendiente', () => {
    expect(classifySaveError({ network: true })).toBe('retry');
    expect(classifySaveError({ status: 500, network: false })).toBe('retry');
    expect(classifySaveError({ status: 503, network: false })).toBe('retry');
    expect(classifySaveError({ status: 401, code: 'PGRST301', network: false })).toBe('retry');
  });

  it('el id ya existe (23505): ya había llegado, cuenta como enviado', () => {
    expect(classifySaveError({ status: 409, code: '23505', network: false })).toBe('sent');
  });

  it('un rechazo de la base: "No se pudo guardar"', () => {
    expect(classifySaveError({ status: 400, code: '23514', network: false })).toBe('failed');
    expect(classifySaveError({ status: 403, code: '42501', network: false })).toBe('failed');
  });
});
