import { describe, expect, it } from 'vitest';
import {
  add,
  convert,
  fromDbNumeric,
  money,
  negate,
  rate,
  subtract,
  toDbNumeric,
  zero,
} from './money';

describe('convert (T-23: half-up al centavo)', () => {
  it('USD → ARS multiplica y redondea ,005 hacia arriba', () => {
    expect(convert(money(1005, 'USD'), rate('1.5'), 'ARS')).toEqual(money(1508, 'ARS'));
  });

  it('ARS → USD divide y redondea ,005 hacia arriba', () => {
    expect(convert(money(1005, 'ARS'), rate('2'), 'USD')).toEqual(money(503, 'USD'));
  });

  it('los negativos redondean alejándose del cero', () => {
    expect(convert(money(-1005, 'USD'), rate('1.5'), 'ARS')).toEqual(money(-1508, 'ARS'));
  });

  it('no arrastra el error de los decimales binarios', () => {
    // 1.005 * 100 en number da 100.49999..., que redondearía a $1,00.
    expect(convert(money(100, 'USD'), rate('1.005'), 'ARS')).toEqual(money(101, 'ARS'));
  });

  it('división periódica', () => {
    expect(convert(money(1000, 'ARS'), rate('3'), 'USD')).toEqual(money(333, 'USD'));
  });

  it('misma moneda devuelve el mismo monto', () => {
    expect(convert(money(8650000, 'ARS'), rate('2028.00'), 'ARS')).toEqual(money(8650000, 'ARS'));
  });

  it('dólar tarjeta de 02 §2: US$ 12 a $2.028 son $24.336', () => {
    expect(convert(money(1200, 'USD'), rate('2028.00'), 'ARS')).toEqual(money(2433600, 'ARS'));
  });
});

describe('borde de la base (T-24)', () => {
  it.each([
    ['86500.00', 8650000],
    ['0.00', 0],
    ['-0.05', -5],
    ['999999999999.99', 99999999999999],
  ])('%s ↔ %i ida y vuelta exactas', (db, minor) => {
    const m = fromDbNumeric(db, 'ARS');
    expect(m).toEqual(money(minor, 'ARS'));
    expect(toDbNumeric(m)).toBe(db);
  });

  it('acepta valores sin decimales o con uno', () => {
    expect(fromDbNumeric('86500', 'ARS')).toEqual(money(8650000, 'ARS'));
    expect(fromDbNumeric('86500.5', 'ARS')).toEqual(money(8650050, 'ARS'));
  });

  it('rechaza más de 2 decimales', () => {
    expect(() => fromDbNumeric('1.005', 'ARS')).toThrow(RangeError);
  });
});

describe('validaciones', () => {
  it('money exige un entero seguro', () => {
    expect(() => money(1.5, 'ARS')).toThrow(TypeError);
    expect(() => money(Number.MAX_SAFE_INTEGER + 1, 'ARS')).toThrow(TypeError);
  });

  it('rate rechaza cero, negativos y más de 6 decimales', () => {
    expect(() => rate('0')).toThrow(RangeError);
    expect(() => rate('0.000')).toThrow(RangeError);
    expect(() => rate('-1')).toThrow(RangeError);
    expect(() => rate('1.1234567')).toThrow(RangeError);
  });

  it('no se suman monedas distintas', () => {
    expect(() => add(money(1, 'ARS'), money(1, 'USD'))).toThrow(TypeError);
  });

  it('add, subtract, negate y zero', () => {
    expect(add(money(150, 'ARS'), money(50, 'ARS'))).toEqual(money(200, 'ARS'));
    expect(subtract(money(150, 'ARS'), money(200, 'ARS'))).toEqual(money(-50, 'ARS'));
    expect(negate(money(0, 'USD'))).toEqual(zero('USD'));
  });
});
