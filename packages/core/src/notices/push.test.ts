import { describe, expect, it } from 'vitest';
import { deadTokens, pushMessages, pushRoute, type PushRow } from './push.ts';

const row = (i: number): PushRow => ({
  notification_id: `n${i}`,
  token: `ExponentPushToken[t${i}]`,
  title: 'Cerró tu Visa',
  body: 'Te vienen $187.000. ¿Te falta cargar algo?',
  data: { card_ids: ['visa'] },
});

describe('pushMessages (spec del push, "Envío")', () => {
  it('sin filas, ninguna tanda', () => {
    expect(pushMessages([])).toEqual([]);
  });

  it('una fila da un mensaje con canal, sonido y los datos para abrir la tarjeta', () => {
    expect(pushMessages([row(1)])).toEqual([
      [
        {
          to: 'ExponentPushToken[t1]',
          title: 'Cerró tu Visa',
          body: 'Te vienen $187.000. ¿Te falta cargar algo?',
          channelId: 'avisos',
          sound: 'default',
          data: { notification_id: 'n1', card_ids: ['visa'] },
        },
      ],
    ]);
  });

  it('un aviso de grupo (data nulo) solo lleva notification_id', () => {
    const message = pushMessages([{ ...row(1), data: null }])[0]![0]!;
    expect(message.data).toEqual({ notification_id: 'n1' });
  });

  it('100 filas entran en una tanda; 101, en dos', () => {
    const rows = Array.from({ length: 101 }, (_, i) => row(i));
    expect(pushMessages(rows.slice(0, 100)).map((b) => b.length)).toEqual([100]);
    expect(pushMessages(rows).map((b) => b.length)).toEqual([100, 1]);
  });
});

describe('deadTokens', () => {
  it('devuelve solo los tokens con DeviceNotRegistered', () => {
    const messages = pushMessages([row(1), row(2), row(3)])[0]!;
    const tickets = [
      { status: 'ok' as const, id: 'r1' },
      { status: 'error' as const, message: 'no registrado', details: { error: 'DeviceNotRegistered' } },
      { status: 'error' as const, message: 'muy grande', details: { error: 'MessageTooBig' } },
    ];
    expect(deadTokens(messages, tickets)).toEqual(['ExponentPushToken[t2]']);
  });
});

describe('pushRoute', () => {
  it('sin data o sin tarjetas, Inicio', () => {
    expect(pushRoute(null)).toBe('/');
    expect(pushRoute({})).toBe('/');
    expect(pushRoute({ card_ids: [] })).toBe('/');
  });

  it('con dos tarjetas, abre la primera', () => {
    expect(pushRoute({ card_ids: ['visa', 'master'] })).toEqual({ pathname: '/tarjeta/[id]', params: { id: 'visa' } });
  });
});
