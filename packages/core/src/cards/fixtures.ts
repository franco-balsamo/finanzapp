// Datos de prueba compartidos por los tests de tarjetas. No se exporta desde index.ts.

import { money, rate, type Money } from '../money.ts';
import type { CardExpense, CreditCard, StatementPayment } from './types.ts';

export const ars = (pesos: number): Money => money(Math.round(pesos * 100), 'ARS');
export const usd = (dollars: number): Money => money(Math.round(dollars * 100), 'USD');

const card = (id: string, closeDay: number, dueDay: number, limit = 1_000_000): CreditCard => ({
  id,
  closeDay,
  dueDay,
  creditLimit: ars(limit),
});

/** Ejemplo general de 02 §3: cierre 24, vencimiento 6. */
export const cardA = card('A', 24, 6);
/** Ejemplos de gastos tarde de 02 §3 (R3-3 y R3-4): cierre 30, vencimiento 10. */
export const cardB = card('B', 30, 10);
/** Ejemplo de cuotas cargadas tarde de 02 §3: cierre 25, vencimiento 8. */
export const cardC = card('C', 25, 8);

export const fxCard = rate('2028.00');

export function expense(id: string, date: string, amount: Money, installments = 1): CardExpense {
  return { id, date, amount, installments };
}

export function payment(
  id: string,
  period: string,
  amount: Money,
  fromAccountId: string,
  paidAt: string,
  extra: Partial<StatementPayment> = {},
): StatementPayment {
  return {
    id,
    period,
    appliesTo: amount.currency,
    amount,
    fromAccountId,
    debitedAmount: amount,
    fxCardRate: null,
    paidAt,
    revertedAt: null,
    ...extra,
  };
}
