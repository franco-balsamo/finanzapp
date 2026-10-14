// Push de los avisos (spec del 14/10): arma los mensajes para Expo con las filas
// de claim_push_batch, lee los tokens muertos y dice qué abrir al tocar uno.

export type PushData = { card_ids?: string[] };

/** Una fila de claim_push_batch: un aviso para un token. */
export type PushRow = { notification_id: string; token: string; title: string; body: string; data: PushData | null };

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  channelId: 'avisos';
  sound: 'default';
  data: PushData & { notification_id: string };
};

export type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

/** Máximo de mensajes por pedido a Expo. */
const EXPO_BATCH = 100;

export function pushMessages(rows: PushRow[]): ExpoMessage[][] {
  const messages = rows.map(
    (r): ExpoMessage => ({
      to: r.token,
      title: r.title,
      body: r.body,
      channelId: 'avisos',
      sound: 'default',
      data: r.data?.card_ids ? { notification_id: r.notification_id, card_ids: r.data.card_ids } : { notification_id: r.notification_id },
    }),
  );
  const batches: ExpoMessage[][] = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH) batches.push(messages.slice(i, i + EXPO_BATCH));
  return batches;
}

/** Expo devuelve los tickets en el mismo orden que los mensajes. */
export function deadTokens(messages: ExpoMessage[], tickets: ExpoTicket[]): string[] {
  return messages
    .filter((_, i) => {
      const t = tickets[i];
      return t?.status === 'error' && t.details?.error === 'DeviceNotRegistered';
    })
    .map((m) => m.to);
}

export function pushRoute(data: PushData | null) {
  const id = data?.card_ids?.[0];
  return id ? { pathname: '/tarjeta/[id]' as const, params: { id } } : ('/' as const);
}
