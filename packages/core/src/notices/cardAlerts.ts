// Los avisos de cada tarjeta, para Ajustes.

export interface DbAlert {
  type: 'card_closing' | 'card_due';
  enabled: boolean;
  params: { card_id: string; days_before?: number };
}
export interface CardAlertCard {
  id: string;
  name: string;
  last4: string;
}
export interface CardAlertSettings {
  card: CardAlertCard;
  closing: boolean;
  due: boolean;
  daysBefore: number;
}

/** Sin fila, los dos avisos están prendidos y el vencimiento es a 2 días (02 §9). */
export function cardAlerts(cards: CardAlertCard[], alerts: DbAlert[]): CardAlertSettings[] {
  return cards.map((card) => {
    const closing = alerts.find((a) => a.type === 'card_closing' && a.params.card_id === card.id);
    const due = alerts.find((a) => a.type === 'card_due' && a.params.card_id === card.id);
    return { card, closing: closing?.enabled ?? true, due: due?.enabled ?? true, daysBefore: due?.params.days_before ?? 2 };
  });
}
