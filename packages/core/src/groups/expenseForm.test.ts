import { describe, expect, it } from 'vitest';
import { checkSplit, splitParts, splitRemainder, type SplitDraft } from './expenseForm.ts';

const order = ['vos', 'ana', 'juan'];
const draft = (fields: Partial<SplitDraft>): SplitDraft => ({
  amountMinor: 3_000_000, currency: 'ARS', mode: 'equal', included: order, exactMinor: {}, ...fields,
});

describe('división de un gasto de grupo (G-5)', () => {
  it('iguales: al menos una persona', () => {
    expect(checkSplit(draft({}))).toEqual({ ok: true });
    expect(checkSplit(draft({ included: [] }))).toEqual({ ok: false, error: 'nobody' });
    expect(splitParts(draft({ included: ['juan', 'vos'] }), order)).toEqual([{ member_id: 'vos' }, { member_id: 'juan' }]);
  });

  it('montos de 02 §7: Ana $10.000 y Juan $20.000 de $30.000', () => {
    const d = draft({ mode: 'exact', exactMinor: { ana: 1_000_000, juan: 2_000_000, vos: 0 } });
    expect(checkSplit(d)).toEqual({ ok: true });
    expect(splitParts(d, order)).toEqual([
      { member_id: 'ana', value: '10000.00' },
      { member_id: 'juan', value: '20000.00' },
    ]);
  });

  it('montos: falta asignar, te pasaste y la tolerancia de $0,50', () => {
    expect(checkSplit(draft({ mode: 'exact', exactMinor: { ana: 1_000_000 } }))).toEqual({ ok: false, error: 'mismatch', diffMinor: 2_000_000 });
    expect(checkSplit(draft({ mode: 'exact', exactMinor: { ana: 4_000_000 } }))).toEqual({ ok: false, error: 'mismatch', diffMinor: -1_000_000 });
    expect(checkSplit(draft({ amountMinor: 100_000, mode: 'exact', exactMinor: { vos: 60_000, ana: 39_960 } }))).toEqual({ ok: true });
    expect(splitRemainder(draft({ mode: 'exact', exactMinor: { ana: 1_000_000 } }))).toBe(2_000_000);
  });

  it('montos sin nadie cargado', () => {
    expect(checkSplit(draft({ mode: 'exact', exactMinor: { ana: 0 } }))).toEqual({ ok: false, error: 'nobody' });
  });
});
