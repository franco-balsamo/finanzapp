import { describe, expect, it } from 'vitest';
import { money } from '../money.ts';
import { ars, usd } from '../cards/fixtures.ts';
import { amountInputText, formatAmountInput, parseAmount, parseAmountMinor } from './amount.ts';
import { deduceCategory, learnableWord, SYSTEM_CATEGORY_IDS as CAT } from './categories.ts';
import {
  orderedMethods,
  paymentChips,
  paymentMethodLabel,
  paymentMethodWords,
  type PaymentMethod,
  type PaymentUse,
} from './paymentMethods.ts';
import { parseQuickEntry, parseQuickEntryLine, parseShortDate, type QuickEntryContext } from './quickEntry.ts';
import { formatShortDate, savedToastText } from './toast.ts';

// Hoy: lunes 5/10/2026.
const today = '2026-10-05';

const visaGalicia: PaymentMethod = { kind: 'card', id: 'visa-g', bank: 'Banco Galicia', network: 'VISA', last4: '4532', isFavorite: true };
const visaBbva: PaymentMethod = { kind: 'card', id: 'visa-b', bank: 'BBVA', network: 'VISA', last4: '1111', isFavorite: false };
const masterBbva: PaymentMethod = { kind: 'card', id: 'master-b', bank: 'BBVA', network: 'MC', last4: '0763', isFavorite: false };
const mp: PaymentMethod = { kind: 'account', id: 'mp', name: 'Mercado Pago' };
const cash: PaymentMethod = { kind: 'account', id: 'cash', name: 'Efectivo' };

function ctx(fields: Partial<QuickEntryContext> = {}): QuickEntryContext {
  return { today, methods: [visaGalicia, masterBbva, mp, cash], uses: [], keywords: new Map(), ...fields };
}

const uses = (methodId: string, ...dates: string[]): PaymentUse[] => dates.map((date) => ({ methodId, date }));

describe('monto escrito', () => {
  it('punto de miles y coma decimal', () => {
    expect(parseAmountMinor('12000')).toEqual({ minor: 1_200_000 });
    expect(parseAmountMinor('12.000')).toEqual({ minor: 1_200_000 });
    expect(parseAmountMinor('12.000,50')).toEqual({ minor: 1_200_050 });
    expect(parseAmountMinor('1.234.567,5')).toEqual({ minor: 123_456_750 });
    expect(parseAmountMinor('86500,05')).toEqual({ minor: 8_650_005 });
  });

  it('sufijos k, mil y M', () => {
    expect(parseAmountMinor('12k')).toEqual({ minor: 1_200_000 });
    expect(parseAmountMinor('12mil')).toEqual({ minor: 1_200_000 });
    expect(parseAmountMinor('1,5k')).toEqual({ minor: 150_000 });
    expect(parseAmountMinor('2M')).toEqual({ minor: 200_000_000 });
  });

  it('lo ambiguo nunca se adivina', () => {
    expect(parseAmountMinor('12.5')).toEqual({ error: 'ambiguous' });
    expect(parseAmountMinor('1.50')).toEqual({ error: 'ambiguous' });
    expect(parseAmountMinor('12,345')).toEqual({ error: 'ambiguous' });
    expect(parseAmountMinor('12.5k')).toEqual({ error: 'ambiguous' });
    expect(parseAmountMinor('doce')).toEqual({ error: 'invalid' });
  });

  it('parseAmount devuelve Money en la moneda pedida', () => {
    expect(parseAmount('50', 'USD')).toEqual({ value: usd(50) });
  });
});

describe('campo Monto mientras se escribe (11A)', () => {
  it('pone el punto de miles', () => {
    expect(formatAmountInput('86500')).toEqual({ text: '86.500', minor: 8_650_000 });
    expect(formatAmountInput('1234567')).toEqual({ text: '1.234.567', minor: 123_456_700 });
  });

  it('el punto que ya puso el formato no cambia el número', () => {
    expect(formatAmountInput('86.5000')).toEqual({ text: '865.000', minor: 86_500_000 });
    expect(formatAmountInput('8.650')).toEqual({ text: '8.650', minor: 865_000 });
  });

  it('coma decimal, como máximo 2 decimales', () => {
    expect(formatAmountInput('86.500,')).toEqual({ text: '86.500,', minor: 8_650_000 });
    expect(formatAmountInput('86.500,5')).toEqual({ text: '86.500,5', minor: 8_650_050 });
    expect(formatAmountInput('12,345')).toEqual({ text: '12,34', minor: 1_234 });
  });

  it('de centavos al texto del campo, ida y vuelta', () => {
    for (const minor of [0, 5, 50, 1_200_000, 1_200_050, 1_200_005, 8_650_000]) {
      expect(formatAmountInput(amountInputText(minor)).minor).toBe(minor === 0 ? 0 : minor);
    }
    expect(amountInputText(1_200_050)).toBe('12.000,5');
    expect(amountInputText(1_200_000)).toBe('12.000');
  });

  it('un punto recién tecleado al final es la coma decimal', () => {
    expect(formatAmountInput('12.')).toEqual({ text: '12,', minor: 1_200 });
  });

  it('vacío, ceros a la izquierda y caracteres de más', () => {
    expect(formatAmountInput('')).toEqual({ text: '', minor: null });
    expect(formatAmountInput('007')).toEqual({ text: '7', minor: 700 });
    expect(formatAmountInput(',5')).toEqual({ text: '0,5', minor: 50 });
    expect(formatAmountInput('$ 12a3')).toEqual({ text: '123', minor: 12_300 });
  });
});

describe('categoría deducida', () => {
  it('por palabra completa, sin acentos ni mayúsculas', () => {
    expect(deduceCategory('Súper Coto')).toBe(CAT.supermercado);
    expect(deduceCategory('nafta YPF')).toBe(CAT.transporte);
    expect(deduceCategory('Café con Juan')).toBe(CAT.salidas);
    expect(deduceCategory('superpancho')).toBe(CAT.otros);
  });

  it('gana la primera palabra que coincide', () => {
    expect(deduceCategory('uber al super')).toBe(CAT.transporte);
  });

  it('sin coincidencias, Otros', () => {
    expect(deduceCategory('regalo de cumple')).toBe(CAT.otros);
    expect(deduceCategory('')).toBe(CAT.otros);
  });

  it('las correcciones del usuario mandan sobre la lista inicial', () => {
    const keywords = new Map([
      ['birreria', CAT.salidas],
      ['super', CAT.salidas],
    ]);
    expect(deduceCategory('Birrería La Birra', keywords)).toBe(CAT.salidas);
    expect(deduceCategory('super', keywords)).toBe(CAT.salidas);
  });
});

describe('palabra que se aprende (R3-5)', () => {
  const paymentWords = paymentMethodWords([visaGalicia, masterBbva, mp]);

  it('la primera palabra que enseña', () => {
    expect(learnableWord('compra coto', paymentWords)).toBe('coto');
    expect(learnableWord('Birrería La Birra', paymentWords)).toBe('birreria');
  });

  it('no aprende números, cuotas ni medios de pago', () => {
    expect(learnableWord('pago visa', paymentWords)).toBeNull();
    expect(learnableWord('12000 galicia x3 cuotas', paymentWords)).toBe(null);
    expect(learnableWord('3 cuotas de la heladera', paymentWords)).toBe('heladera');
    expect(learnableWord('', paymentWords)).toBeNull();
  });
});

describe('fichas de medio de pago (3A)', () => {
  const methods = [mp, masterBbva, cash, visaBbva, visaGalicia];

  it('la favorita y los 2 más usados en 30 días, sin repetir', () => {
    const recent = [
      ...uses('visa-g', '2026-10-01', '2026-10-02'),
      ...uses('cash', '2026-10-03', '2026-10-04', '2026-10-05'),
      ...uses('mp', '2026-09-20'),
      ...uses('master-b', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'),
    ];
    expect(paymentChips(methods, recent, today).map((m) => m.id)).toEqual(['visa-g', 'cash', 'mp']);
  });

  it('el día 30 cuenta y el 31 no', () => {
    const recent = [...uses('master-b', '2026-09-06'), ...uses('visa-b', '2026-09-05', '2026-09-05')];
    expect(paymentChips(methods, recent, today).map((m) => m.id)).toEqual(['visa-g', 'master-b', 'visa-b']);
  });

  it('con el mismo uso gana el más reciente', () => {
    const recent = [...uses('mp', '2026-10-01'), ...uses('cash', '2026-10-04')];
    expect(paymentChips(methods, recent, today).map((m) => m.id)).toEqual(['visa-g', 'cash', 'mp']);
  });

  it('sin usos completa con el orden de la lista: tarjetas y después cuentas', () => {
    expect(paymentChips(methods, [], today).map((m) => m.id)).toEqual(['visa-g', 'master-b', 'visa-b']);
    expect(paymentChips([mp], [], today).map((m) => m.id)).toEqual(['mp']);
    expect(paymentChips([], [], today)).toEqual([]);
  });

  it('sin favorita, los 3 más usados', () => {
    const noFavorite = methods.map((m) => (m.kind === 'card' ? { ...m, isFavorite: false } : m));
    const recent = [...uses('cash', '2026-10-01'), ...uses('mp', '2026-10-02', '2026-10-03')];
    expect(paymentChips(noFavorite, recent, today).map((m) => m.id)).toEqual(['mp', 'cash', 'master-b']);
  });

  it('nunca devuelve más de 3', () => {
    const recent = methods.flatMap((m) => uses(m.id, '2026-10-01'));
    expect(paymentChips(methods, recent, today)).toHaveLength(3);
  });

  it('lista completa: favorita, tarjetas y cuentas', () => {
    expect(orderedMethods(methods).map((m) => m.id)).toEqual(['visa-g', 'master-b', 'visa-b', 'mp', 'cash']);
  });

  it('etiquetas', () => {
    expect(paymentMethodLabel(masterBbva)).toBe('Master ·· 0763');
    expect(paymentMethodLabel(mp)).toBe('Mercado Pago');
  });
});

describe('carga por texto (02 §5)', () => {
  it('ejemplo de 02: "28/09 4532 12000 súper x3"', () => {
    const line = parseQuickEntryLine('28/09 4532 12000 súper x3', ctx());
    expect(line).toMatchObject({
      status: 'ready',
      date: '2026-09-28',
      methodId: 'visa-g',
      amount: ars(12_000),
      installments: 3,
      description: 'súper',
      categoryId: CAT.supermercado,
      warnings: [],
    });
  });

  it('"12000 súper visa 3 cuotas" con la Visa favorita', () => {
    expect(parseQuickEntryLine('12000 súper visa 3 cuotas', ctx())).toMatchObject({
      status: 'ready',
      amount: ars(12_000),
      methodId: 'visa-g',
      installments: 3,
      description: 'súper',
      categoryId: CAT.supermercado,
    });
  });

  it('4 dígitos solos son el monto, no la tarjeta', () => {
    expect(parseQuickEntryLine('4532 súper visa', ctx())).toMatchObject({
      status: 'ready',
      amount: ars(4_532),
      methodId: 'visa-g',
      description: 'súper',
    });
  });

  it('el texto manda: "súper master" usa la Master aunque la favorita sea Visa (R3-6)', () => {
    expect(parseQuickEntryLine('5000 súper master', ctx())).toMatchObject({ methodId: 'master-b', status: 'ready' });
  });

  describe('varias tarjetas coinciden', () => {
    const methods = [visaGalicia, visaBbva, masterBbva];

    it('la favorita, si es una de ellas', () => {
      expect(parseQuickEntryLine('5000 súper visa', ctx({ methods })).methodId).toBe('visa-g');
    });

    it('si no, la más usada en 30 días', () => {
      const noFav = [{ ...visaGalicia, isFavorite: false }, visaBbva, masterBbva];
      const line = parseQuickEntryLine('5000 súper visa', ctx({ methods: noFav, uses: uses('visa-b', '2026-10-01') }));
      expect(line).toMatchObject({ methodId: 'visa-b', status: 'ready' });
    });

    it('si empatan, incompleta con las fichas de esas tarjetas', () => {
      const noFav = [{ ...visaGalicia, isFavorite: false }, visaBbva, masterBbva];
      const line = parseQuickEntryLine('5000 súper visa', ctx({ methods: noFav }));
      expect(line).toMatchObject({ status: 'incomplete', methodId: null, candidates: ['visa-g', 'visa-b'] });
    });

    it('el banco desempata: "visa bbva" es la Visa del BBVA', () => {
      expect(parseQuickEntryLine('5000 súper visa bbva', ctx({ methods })).methodId).toBe('visa-b');
    });
  });

  it('una cuenta por su nombre', () => {
    expect(parseQuickEntryLine('3500 café efectivo', ctx())).toMatchObject({ methodId: 'cash', status: 'ready' });
    expect(parseQuickEntryLine('3500 café mp', ctx())).toMatchObject({ methodId: 'mp', description: 'café' });
  });

  it('sin medio de pago: incompleta (R3-1)', () => {
    expect(parseQuickEntryLine('12000 súper', ctx())).toMatchObject({ status: 'incomplete', methodId: null, candidates: [] });
  });

  it('sin descripción: incompleta (R3-1)', () => {
    expect(parseQuickEntryLine('12000 visa', ctx())).toMatchObject({ status: 'incomplete', description: '', methodId: 'visa-g' });
  });

  it('sin monto', () => {
    expect(parseQuickEntryLine('súper visa', ctx())).toMatchObject({ status: 'no_amount', amount: null });
  });

  it('en el detalle de una tarjeta usa esa tarjeta, salvo que el texto nombre otra', () => {
    expect(parseQuickEntryLine('12000 súper', ctx({ defaultCardId: 'master-b' })).methodId).toBe('master-b');
    expect(parseQuickEntryLine('12000 súper visa', ctx({ defaultCardId: 'master-b' })).methodId).toBe('visa-g');
  });

  describe('cuotas', () => {
    it('N cuotas, N c, Nc y xN', () => {
      expect(parseQuickEntryLine('30000 tele visa 6 cuotas', ctx()).installments).toBe(6);
      expect(parseQuickEntryLine('30000 tele visa 6 c', ctx()).installments).toBe(6);
      expect(parseQuickEntryLine('30000 tele visa 12c', ctx()).installments).toBe(12);
      expect(parseQuickEntryLine('30000 tele visa x24', ctx()).installments).toBe(24);
    });

    it('fuera de 1 a 24: revisar', () => {
      expect(parseQuickEntryLine('30000 tele visa x30', ctx())).toMatchObject({
        status: 'review',
        installments: 1,
        warnings: ['installments_out_of_range'],
      });
    });

    it('con una cuenta: 1 pago y aviso (R3-2)', () => {
      expect(parseQuickEntryLine('30000 tele mp 3 cuotas', ctx())).toMatchObject({
        status: 'ready',
        installments: 1,
        requestedInstallments: 3,
        warnings: ['installments_need_credit'],
      });
    });

    it('sin medio de pago, las cuotas quedan pedidas', () => {
      expect(parseQuickEntryLine('30000 tele 3 cuotas', ctx())).toMatchObject({ status: 'incomplete', installments: 3 });
    });
  });

  describe('fecha', () => {
    it('ayer y anteayer', () => {
      expect(parseQuickEntryLine('ayer 5000 café visa', ctx()).date).toBe('2026-10-04');
      expect(parseQuickEntryLine('anteayer 5000 café visa', ctx()).date).toBe('2026-10-03');
    });

    it('sin fecha es hoy; "hoy" no queda en la descripción', () => {
      expect(parseQuickEntryLine('5000 café visa', ctx()).date).toBe(today);
      expect(parseQuickEntryLine('hoy 5000 café visa', ctx())).toMatchObject({ date: today, description: 'café' });
    });

    it('campo de fecha de la hoja', () => {
      expect(parseShortDate('28/09', today)).toEqual({ date: '2026-09-28', future: false });
      expect(parseShortDate('Ayer', today)).toEqual({ date: '2026-10-04', future: false });
      expect(parseShortDate('1/1/27', today)).toEqual({ date: '2027-01-01', future: true });
      expect(parseShortDate('30/02', today)).toBe('invalid');
      expect(parseShortDate('mañana', today)).toBeNull();
    });

    it('dd/mm toma la fecha más reciente que no sea futura', () => {
      expect(parseQuickEntryLine('20/12 5000 regalos visa', ctx()).date).toBe('2025-12-20');
      expect(parseQuickEntryLine('5/10 5000 café visa', ctx()).date).toBe('2026-10-05');
    });

    it('dd/mm/aa futura: revisar', () => {
      expect(parseQuickEntryLine('20/12/26 5000 regalos visa', ctx())).toMatchObject({
        date: '2026-12-20',
        status: 'review',
        warnings: ['future_date'],
      });
    });

    it('fecha imposible: revisar y queda hoy', () => {
      expect(parseQuickEntryLine('31/02 5000 café visa', ctx())).toMatchObject({
        date: today,
        status: 'review',
        warnings: ['invalid_date'],
      });
    });
  });

  describe('monto', () => {
    it('ambiguo: revisar y sin monto', () => {
      expect(parseQuickEntryLine('12.5 café visa', ctx())).toMatchObject({
        status: 'review',
        amount: null,
        warnings: ['ambiguous_amount'],
      });
    });

    it('más de un monto posible: revisar con el primero', () => {
      expect(parseQuickEntryLine('2 cafés 3000 visa', ctx())).toMatchObject({
        status: 'review',
        amount: ars(2),
        warnings: ['several_amounts'],
      });
    });

    it('"12 mil", "12k" y "$12.000"', () => {
      expect(parseQuickEntryLine('12 mil súper visa', ctx()).amount).toEqual(ars(12_000));
      expect(parseQuickEntryLine('12k súper visa', ctx()).amount).toEqual(ars(12_000));
      expect(parseQuickEntryLine('$12.000 súper visa', ctx())).toMatchObject({ amount: ars(12_000), description: 'súper' });
    });

    it('dólares: u$s, usd, us$ y dólares', () => {
      for (const text of ['u$s 50 netflix visa', 'usd50 netflix visa', '50us$ netflix visa', '50 dólares netflix visa']) {
        expect(parseQuickEntryLine(text, ctx())).toMatchObject({
          amount: usd(50),
          currency: 'USD',
          description: 'netflix',
          categoryId: CAT.suscripciones,
        });
      }
    });
  });

  it('la descripción conserva lo que se escribió', () => {
    expect(parseQuickEntryLine('8500 Cena en Lo de Juan, visa', ctx())).toMatchObject({
      description: 'Cena en Lo de Juan',
      categoryId: CAT.otros,
    });
  });

  it('usa las correcciones del usuario para la categoría', () => {
    const keywords = new Map([['heladeria', CAT.salidas]]);
    expect(parseQuickEntryLine('4000 heladería visa', ctx({ keywords })).categoryId).toBe(CAT.salidas);
  });

  it('una línea, un gasto; las vacías se ignoran', () => {
    const lines = parseQuickEntry('12000 súper visa\n\n  3500 café mp  \nsúper', ctx());
    expect(lines.map((l) => l.status)).toEqual(['ready', 'ready', 'no_amount']);
    expect(lines[1]!.text).toBe('3500 café mp');
  });
});

describe('toast después de guardar (9A)', () => {
  it('con tarjeta de crédito', () => {
    expect(
      savedToastText({ kind: 'card', closeDate: '2026-10-24', statementTotal: { ARS: ars(273_500), USD: usd(0) } }),
    ).toBe('Guardado · entra en el resumen del 24/10 (te vienen $273.500)');
    expect(
      savedToastText({ kind: 'card', closeDate: '2026-11-06', statementTotal: { ARS: ars(187_000), USD: usd(50) } }),
    ).toBe('Guardado · entra en el resumen del 6/11 (te vienen $187.000 + US$ 50)');
  });

  it('con una cuenta', () => {
    expect(savedToastText({ kind: 'account', accountName: 'Mercado Pago' })).toBe('Guardado · se descontó de Mercado Pago');
  });

  it('fecha corta', () => {
    expect(formatShortDate('2026-01-05')).toBe('5/1');
  });
});

it('money sigue exacto con montos de la carga', () => {
  expect(parseQuickEntryLine('12.000,50 súper visa', ctx()).amount).toEqual(money(1_200_050, 'ARS'));
});
