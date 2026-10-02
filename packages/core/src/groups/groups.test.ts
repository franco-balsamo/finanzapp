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

  it('montos exactos en dólares: cada parte se convierte y el resto va al que pagó', () => {
    const gasto: GroupExpense = {
      ...exact('g', usd(10.01), 'ana', [
        ['vos', usd(3.33)],
        ['ana', usd(3.34)],
        ['juan', usd(3.34)],
      ]),
      fxRate: rate('1333.33'),
    };
    const parts = shares(cabana, gasto);
    // 10,01 × 1333,33 = 13.346,63, igual a la suma de las partes convertidas.
    expect(Object.values(parts).reduce((a, b) => a + b.minor, 0)).toBe(1_334_663);
    expect(parts['vos']).toEqual(ars(4_439.99));
  });

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

  it('"al día" usa el mismo umbral que mostrar: menos de $1 o menos de US$ 0,01', () => {
    expect(isSettled(ars(0.99))).toBe(true);
    expect(isSettled(ars(-1))).toBe(false);
    expect(isSettled(usd(0))).toBe(true);
    expect(isSettled(usd(-0.01))).toBe(false);
  });

  it('el saldo exacto queda guardado: groupBalances no redondea los centavos', () => {
    const balances = groupBalances(cabana, [equal('g', ars(100), 'ana')], []);
    expect(balances['ana']).toEqual(ars(66.66));
    expect(balances['vos']).toEqual(ars(-33.33));
  });

  it('empates: se desempata por orden de ingreso al grupo', () => {
    expect(simplifyDebts(cabana, { vos: ars(100), ana: ars(-50), juan: ars(-50) })).toEqual([
      { fromMemberId: 'ana', toMemberId: 'vos', amount: ars(50) },
      { fromMemberId: 'juan', toMemberId: 'vos', amount: ars(50) },
    ]);
  });
});
