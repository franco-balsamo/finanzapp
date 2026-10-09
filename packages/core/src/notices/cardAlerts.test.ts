import { describe, expect, it } from 'vitest';
import { cardAlerts } from './cardAlerts.ts';

const visa = { id: 'visa', name: 'Visa', last4: '2337' };
const master = { id: 'master', name: 'Master', last4: '1111' };

describe('cardAlerts (02 §9)', () => {
  it('sin filas, los dos avisos están prendidos y el vencimiento es a 2 días', () => {
    expect(cardAlerts([visa, master], [])).toEqual([
      { card: visa, closing: true, due: true, daysBefore: 2 },
      { card: master, closing: true, due: true, daysBefore: 2 },
    ]);
  });

  it('el vencimiento apagado conserva sus días para cuando se vuelva a prender', () => {
    const alerts = [{ type: 'card_due' as const, enabled: false, params: { card_id: 'visa', days_before: 4 } }];
    expect(cardAlerts([visa], alerts)).toEqual([{ card: visa, closing: true, due: false, daysBefore: 4 }]);
  });

  it('la fila de otra tarjeta no cambia nada', () => {
    const alerts = [
      { type: 'card_closing' as const, enabled: false, params: { card_id: 'master' } },
      { type: 'card_due' as const, enabled: false, params: { card_id: 'master', days_before: 5 } },
    ];
    expect(cardAlerts([visa], alerts)).toEqual([{ card: visa, closing: true, due: true, daysBefore: 2 }]);
  });
});
