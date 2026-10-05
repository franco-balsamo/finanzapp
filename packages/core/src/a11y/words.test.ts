import { describe, expect, it } from 'vitest';
import { ars, usd } from '../cards/fixtures.ts';
import { money } from '../money.ts';
import { integerInWords, moneyInWords } from './words.ts';

describe('números en palabras', () => {
  it.each([
    [0, 'cero'],
    [1, 'uno'],
    [16, 'dieciséis'],
    [21, 'veintiuno'],
    [30, 'treinta'],
    [31, 'treinta y uno'],
    [100, 'cien'],
    [101, 'ciento uno'],
    [500, 'quinientos'],
    [1000, 'mil'],
    [1001, 'mil uno'],
    [21_000, 'veintiún mil'],
    [31_000, 'treinta y un mil'],
    [86_500, 'ochenta y seis mil quinientos'],
    [100_000, 'cien mil'],
    [187_000, 'ciento ochenta y siete mil'],
    [1_000_000, 'un millón'],
    [2_000_000, 'dos millones'],
    [21_500_000, 'veintiún millones quinientos mil'],
    [1_711_600, 'un millón setecientos once mil seiscientos'],
  ])('%i', (n, words) => {
    expect(integerInWords(n)).toBe(words);
  });
});

describe('montos en palabras (12A)', () => {
  it('pesos y dólares', () => {
    expect(moneyInWords(ars(86_500))).toBe('ochenta y seis mil quinientos pesos');
    expect(moneyInWords(usd(50))).toBe('cincuenta dólares');
    expect(moneyInWords(ars(1))).toBe('un peso');
    expect(moneyInWords(usd(21))).toBe('veintiún dólares');
    expect(moneyInWords(ars(0))).toBe('cero pesos');
  });

  it('millones redondos llevan "de"', () => {
    expect(moneyInWords(ars(2_000_000))).toBe('dos millones de pesos');
    expect(moneyInWords(ars(1_000_000))).toBe('un millón de pesos');
    expect(moneyInWords(ars(1_711_600))).toBe('un millón setecientos once mil seiscientos pesos');
  });

  it('centavos y negativos', () => {
    expect(moneyInWords(money(150, 'USD'))).toBe('un dólar con cincuenta centavos');
    expect(moneyInWords(money(1_200_001, 'ARS'))).toBe('doce mil pesos con un centavo');
    expect(moneyInWords(ars(-1000))).toBe('menos mil pesos');
  });
});
