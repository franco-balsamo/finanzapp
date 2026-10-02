import { describe, expect, it } from 'vitest';
import { rate } from '../money';
import { ars, usd } from '../cards/fixtures';
import { displayBalance, groupBalances, isSettled } from './balances';
import { shares } from './shares';
import { simplifyDebts } from './simplify';
import type { Group, GroupExpense } from './types';

const cabana: Group = {
  id: 'cabana',
  currency: 'ARS',
  members: [
    { id: 'vos', name: 'Vos' },
    { id: 'ana', name: 'Ana' },
    { id: 'juan', name: 'Juan' },
  ],
};

const equal = (id: string, amount: GroupExpense['amount'], payer: string, who = ['vos', 'ana', 'juan']): GroupExpense => ({
  id,
  amount,
  fxRate: null,
  payerMemberId: payer,
  splitMode: 'equal',
  parts: who.map((memberId) => ({ memberId, value: null })),
});

const exact = (id: string, amount: GroupExpense['amount'], payer: string, parts: [string, GroupExpense['amount']][]): GroupExpense => ({
  id,
  amount,
  fxRate: null,
  payerMemberId: payer,
  splitMode: 'exact',
  parts: parts.map(([memberId, value]) => ({ memberId, value })),
});

// Ejemplo de 02 §7.
const vosPaga = equal('g1', ars(90_000), 'vos');
const anaPaga = exact('g2', ars(30_000), 'ana', [
  ['ana', ars(10_000)],
  ['juan', ars(20_000)],
]);

// Los saldos y las partes de los ejemplos de 02 §7 están en fixtures.test.ts (compartidos con la base).
describe('simplificación (T-11)', () => {
  it('Juan → Vos $50.000 y Ana → Vos $10.000', () => {
    const balances = groupBalances(cabana, [vosPaga, anaPaga], []);
    expect(simplifyDebts(cabana, balances)).toEqual([
      { fromMemberId: 'juan', toMemberId: 'vos', amount: ars(50_000) },
      { fromMemberId: 'ana', toMemberId: 'vos', amount: ars(10_000) },
    ]);
  });
});

describe('restos al dividir (T-12, T-13, D9)', () => {
  it('montos exactos con una diferencia de $0,60 se rechazan', () => {
    const gasto = exact('g', ars(1_000), 'vos', [
      ['vos', ars(600)],
      ['ana', ars(399.4)],
    ]);
    expect(() => shares(cabana, gasto)).toThrow(RangeError);
  });

  it('un integrante repetido en montos exactos se rechaza', () => {
    const gasto = exact('g', ars(1_000), 'vos', [
      ['ana', ars(600)],
      ['ana', ars(400)],
    ]);
    expect(() => shares(cabana, gasto)).toThrow(RangeError);
  });

  it('sin nadie incluido se rechaza', () => {
    expect(() => shares(cabana, equal('g', ars(100), 'vos', []))).toThrow(RangeError);
  });
});

describe('gasto en otra moneda que el grupo', () => {
  it('montos exactos en dólares con US$ 0,60 de diferencia se rechazan', () => {
    const gasto: GroupExpense = {
      ...exact('g', usd(10), 'ana', [
        ['vos', usd(4.7)],
        ['ana', usd(4.7)],
      ]),
      fxRate: rate('1500.00'),
    };
    expect(() => shares(cabana, gasto)).toThrow(RangeError);
  });

  it('rechaza gastos de $0 o negativos, partes exactas negativas y pagos no positivos', () => {
    expect(() => shares(cabana, equal('g', ars(0), 'vos'))).toThrow(RangeError);
    expect(() => shares(cabana, equal('g', ars(-90_000), 'vos'))).toThrow(RangeError);
    const negativa = exact('g', ars(1_000), 'vos', [
      ['vos', ars(1_500)],
      ['ana', ars(-500)],
    ]);
    expect(() => shares(cabana, negativa)).toThrow(RangeError);
    const conCero = exact('g', ars(1_000), 'vos', [
      ['vos', ars(1_000)],
      ['ana', ars(0)],
    ]);
    expect(shares(cabana, conCero)).toEqual({ vos: ars(1_000), ana: ars(0) });
    expect(() =>
      groupBalances(cabana, [], [{ id: 'p', fromMemberId: 'juan', toMemberId: 'vos', amount: ars(-50) }]),
    ).toThrow(RangeError);
  });

  it('sin cotización se rechaza', () => {
    expect(() => shares(cabana, equal('g', usd(100), 'vos'))).toThrow(RangeError);
  });
});

describe('umbral de cero por moneda (T-14, D14)', () => {
  it('en pesos, un saldo de $0,80 se muestra como cero y no genera transferencia', () => {
    expect(displayBalance(ars(0.8))).toEqual(ars(0));
    expect(simplifyDebts(cabana, { vos: ars(0.8), ana: ars(-0.8), juan: ars(0) })).toEqual([]);
  });

  it('en dólares, US$ 0,80 aparece', () => {
    const viaje: Group = { ...cabana, currency: 'USD' };
    expect(displayBalance(usd(0.8))).toEqual(usd(0.8));
    expect(simplifyDebts(viaje, { vos: usd(0.8), ana: usd(-0.8), juan: usd(0) })).toEqual([
      { fromMemberId: 'ana', toMemberId: 'vos', amount: usd(0.8) },
    ]);
  });

  it('deudas chicas (02 §7): Ana debe $2,97 y le paga a los tres que están al día', () => {
    const cuatro: Group = { ...cabana, members: [...cabana.members, { id: 'dani', name: 'Dani' }] };
    const balances = { vos: ars(0.99), ana: ars(-2.97), juan: ars(0.99), dani: ars(0.99) };
    expect(['vos', 'juan', 'dani'].every((id) => isSettled(balances[id as keyof typeof balances]))).toBe(true);
    expect(isSettled(balances.ana)).toBe(false);
    expect(simplifyDebts(cuatro, balances)).toEqual([
      { fromMemberId: 'ana', toMemberId: 'vos', amount: ars(0.99) },
      { fromMemberId: 'ana', toMemberId: 'juan', amount: ars(0.99) },
      { fromMemberId: 'ana', toMemberId: 'dani', amount: ars(0.99) },
    ]);
  });

  it('empates: se desempata por orden de ingreso al grupo', () => {
    expect(simplifyDebts(cabana, { vos: ars(100), ana: ars(-50), juan: ars(-50) })).toEqual([
      { fromMemberId: 'ana', toMemberId: 'vos', amount: ars(50) },
      { fromMemberId: 'juan', toMemberId: 'vos', amount: ars(50) },
    ]);
  });
});
