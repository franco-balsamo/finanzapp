import { describe, expect, it } from 'vitest';
import { ars } from '../cards/fixtures.ts';
import { SYSTEM_CATEGORY_IDS as CAT } from './categories.ts';
import type { PaymentMethod } from './paymentMethods.ts';
import {
  assignLineIds,
  batchSavedText,
  batchSaveLabel,
  batchTexts,
  resolveLine,
  type BatchLine,
  type LineOverride,
} from './quickBatch.ts';
import { parseQuickEntryLine, type QuickEntryContext } from './quickEntry.ts';

// Hoy: lunes 5/10/2026.
const today = '2026-10-05';

const visa: PaymentMethod = { kind: 'card', id: 'visa', bank: 'Banco Galicia', network: 'VISA', last4: '4532', isFavorite: true };
const master: PaymentMethod = { kind: 'card', id: 'master', bank: 'BBVA', network: 'MC', last4: '0763', isFavorite: false };
const mp: PaymentMethod = { kind: 'account', id: 'mp', name: 'Mercado Pago' };
const methods = [visa, master, mp];

function ctx(fields: Partial<QuickEntryContext> = {}): QuickEntryContext {
  return { today, methods, uses: [], keywords: new Map(), ...fields };
}

function counter() {
  let n = 0;
  return () => `id-${++n}`;
}

function resolveAll(text: string, overrides: Record<string, LineOverride> = {}, fields: Partial<QuickEntryContext> = {}) {
  const lines = assignLineIds([], batchTexts(text), counter());
  return lines.map((l) => resolveLine(l, parseQuickEntryLine(l.text, ctx(fields)), overrides[l.id], methods, new Map()));
}

describe('ids de cada línea (D-5)', () => {
  it('ignora las líneas vacías y los espacios de los bordes', () => {
    expect(batchTexts('12000 súper visa\n\n  3500 café mp  \n')).toEqual(['12000 súper visa', '3500 café mp']);
  });

  it('una línea que no cambia conserva su id; una que cambia recibe uno nuevo', () => {
    const newId = counter();
    const first = assignLineIds([], ['12000 súper', '3500 café'], newId);
    expect(first).toEqual([
      { text: '12000 súper', id: 'id-1' },
      { text: '3500 café', id: 'id-2' },
    ]);
    const next = assignLineIds(first, ['12000 súper', '3600 café', '800 kiosco'], newId);
    expect(next.map((l) => l.id)).toEqual(['id-1', 'id-3', 'id-4']);
  });

  it('dos líneas iguales tienen ids distintos y los conservan', () => {
    const newId = counter();
    const first = assignLineIds([], ['1000 café', '1000 café'], newId);
    expect(first.map((l) => l.id)).toEqual(['id-1', 'id-2']);
    expect(assignLineIds(first, ['1000 café', '1000 café'], newId).map((l) => l.id)).toEqual(['id-1', 'id-2']);
  });

  it('al sacar las guardadas, las que quedan conservan el id (reintentar no duplica)', () => {
    const newId = counter();
    const prev: BatchLine[] = assignLineIds([], ['12000 súper', '3500 café', '800 kiosco'], newId);
    const left = assignLineIds(prev, ['3500 café', '800 kiosco'], newId);
    expect(left.map((l) => l.id)).toEqual(['id-2', 'id-3']);
  });
});

describe('tanda de varias líneas (D-5)', () => {
  it('8 líneas: 6 completas, 1 sin medio y 1 sin monto → "Guardar 6 · faltan 2"', () => {
    const text = [
      '12000 súper visa',
      '3500 café mp',
      '8000 farmacia master',
      '25000 nafta visa',
      '1500 kiosco mp',
      '40000 ropa master 3 cuotas',
      '9000 verdulería',
      'peluquería visa',
    ].join('\n');
    const lines = resolveAll(text);
    expect(lines.map((l) => l.status)).toEqual(['ready', 'ready', 'ready', 'ready', 'ready', 'ready', 'incomplete', 'no_amount']);
    expect(batchSaveLabel(lines)).toBe('Guardar 6 · faltan 2');
  });

  it('en el detalle de la Master, "12000 súper" va con la Master y "12000 súper visa" con la Visa (R3-6)', () => {
    const lines = resolveAll('12000 súper\n12000 súper visa', {}, { defaultCardId: 'master' });
    expect(lines.map((l) => l.methodId)).toEqual(['master', 'visa']);
    expect(batchSaveLabel(lines)).toBe('Guardar 2 gastos');
  });

  it('elegir una ficha completa la línea sin medio', () => {
    const [line] = resolveAll('9000 verdulería', { 'id-1': { methodId: 'mp' } });
    expect(line).toMatchObject({ status: 'ready', methodId: 'mp', amount: ars(9_000), installments: 1 });
  });

  it('escribir la descripción completa la línea y deduce la categoría', () => {
    const [line] = resolveAll('9000 visa', { 'id-1': { description: 'súper' } });
    expect(line).toMatchObject({ status: 'ready', description: 'súper', categoryId: CAT.supermercado });
  });

  it('tocar "Revisar" confirma la línea', () => {
    expect(resolveAll('28/12/26 9000 súper visa')[0]!.status).toBe('review');
    expect(resolveAll('28/12/26 9000 súper visa', { 'id-1': { confirmed: true } })[0]!.status).toBe('ready');
  });

  it('un monto ambiguo no se confirma: hay que corregir el texto', () => {
    expect(resolveAll('12.5 súper visa', { 'id-1': { confirmed: true } })[0]!.status).toBe('review');
  });

  it('las cuotas se aplican si la ficha elegida es una tarjeta, y no con una cuenta', () => {
    const text = '60000 heladera x6';
    expect(resolveAll(text, { 'id-1': { methodId: 'visa' } })[0]).toMatchObject({ installments: 6, warnings: [] });
    expect(resolveAll(text, { 'id-1': { methodId: 'mp' } })[0]).toMatchObject({
      status: 'ready',
      installments: 1,
      warnings: ['installments_need_credit'],
    });
  });

  it('textos del botón y del toast', () => {
    expect(batchSaveLabel(resolveAll('12000 súper visa'))).toBe('Guardar 1 gasto');
    expect(batchSaveLabel(resolveAll('súper visa'))).toBe('Guardar 0 · faltan 1');
    expect(batchSavedText(1)).toBe('Guardaste 1 gasto');
    expect(batchSavedText(6)).toBe('Guardaste 6 gastos');
  });
});
