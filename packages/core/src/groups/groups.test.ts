import { describe, expect, it } from 'vitest';
import { rate } from '../money';
import { ars, usd } from '../cards/fixtures';
import { displayBalance, groupBalances } from './balances';
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

describe('saldos y simplificación (T-10, T-11)', () => {
  it('Vos +60.000, Ana −10.000, Juan −50.000; suman cero', () => {
    const balances = groupBalances(cabana, [vosPaga, anaPaga], []);
    expect(balances).toEqual({ vos: ars(60_000), ana: ars(-10_000), juan: ars(-50_000) });
  });

  it('Juan → Vos $50.000 y Ana → Vos $10.000', () => {
    const balances = groupBalances(cabana, [vosPaga, anaPaga], []);
    expect(simplifyDebts(cabana, balances)).toEqual([
      { fromMemberId: 'juan', toMemberId: 'vos', amount: ars(50_000) },
      { fromMemberId: 'ana', toMemberId: 'vos', amount: ars(10_000) },
    ]);
  });

  it('un pago entre integrantes baja la deuda', () => {
    const balances = groupBalances(
      cabana,
      [vosPaga, anaPaga],
      [{ id: 'p', fromMemberId: 'juan', toMemberId: 'vos', amount: ars(50_000) }],
    );
    expect(balances).toEqual({ vos: ars(10_000), ana: ars(-10_000), juan: ars(0) });
  });
});

describe('restos al dividir (T-12, T-13, D9)', () => {
  it('$100 entre 3, pagó Ana → Ana $33,34', () => {
    expect(shares(cabana, equal('g', ars(100), 'ana'))).toEqual({
      vos: ars(33.33),
      ana: ars(33.34),
      juan: ars(33.33),
    });
  });

  it('si el que pagó quedó excluido, el resto va al primer incluido', () => {
    expect(shares(cabana, equal('g', ars(0.03), 'ana', ['vos', 'juan']))).toEqual({
      vos: ars(0.02),
      juan: ars(0.01),
    });
  });

  it('montos exactos: la diferencia de hasta $0,50 va al que pagó', () => {
    const gasto = exact('g', ars(1_000), 'vos', [
      ['vos', ars(600)],
      ['ana', ars(399.6)],
    ]);
    expect(shares(cabana, gasto)).toEqual({ vos: ars(600.4), ana: ars(399.6) });
  });

  it('montos exactos con una diferencia de $0,60 se rechazan', () => {
    const gasto = exact('g', ars(1_000), 'vos', [
      ['vos', ars(600)],
      ['ana', ars(399.4)],
    ]);
    expect(() => shares(cabana, gasto)).toThrow(RangeError);
  });

  it('sin nadie incluido se rechaza', () => {
    expect(() => shares(cabana, equal('g', ars(100), 'vos', []))).toThrow(RangeError);
  });
});

describe('gasto en otra moneda que el grupo', () => {
  it('US$ 100 a $1.500 en un grupo en pesos: se convierte y después se divide', () => {
    const gasto = { ...equal('g', usd(100), 'vos'), fxRate: rate('1500.00') };
    const parts = shares(cabana, gasto);
    expect(parts).toEqual({ vos: ars(50_000), ana: ars(50_000), juan: ars(50_000) });
  });

  it('las partes suman exacto el total convertido', () => {
    const gasto = { ...equal('g', usd(10.01), 'ana'), fxRate: rate('1333.33') };
    const parts = Object.values(shares(cabana, gasto));
    // 10,01 × 1333,33 = 13.346,63
    expect(parts.reduce((a, b) => a + b.minor, 0)).toBe(1_334_663);
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

  it('empates: se desempata por orden de ingreso al grupo', () => {
    expect(simplifyDebts(cabana, { vos: ars(100), ana: ars(-50), juan: ars(-50) })).toEqual([
      { fromMemberId: 'ana', toMemberId: 'vos', amount: ars(50) },
      { fromMemberId: 'juan', toMemberId: 'vos', amount: ars(50) },
    ]);
  });
});
