// La división de un gasto de grupo en la hoja de carga (G-5, 02 §7): validación y partes para la base.

import { money, toDbNumeric, type Currency, type DbNumeric } from '../money.ts';

/** Misma tolerancia que la base y que `shares`: $0,50 o US$ 0,50. */
const EXACT_TOLERANCE_MINOR = 50;

export interface SplitDraft {
  /** Total del gasto, en centavos de `currency`. */
  amountMinor: number;
  currency: Currency;
  mode: 'equal' | 'exact';
  /** En partes iguales: los incluidos, en orden de ingreso al grupo. */
  included: readonly string[];
  /** En montos: lo que se cargó para cada integrante, en centavos. Vacío o 0 queda afuera. */
  exactMinor: Readonly<Record<string, number>>;
}

export type SplitCheck =
  | { ok: true }
  | { ok: false; error: 'nobody' }
  /** `diffMinor` > 0: falta asignar; < 0: te pasaste. */
  | { ok: false; error: 'mismatch'; diffMinor: number };

export function checkSplit(draft: SplitDraft): SplitCheck {
  if (draft.mode === 'equal') return draft.included.length ? { ok: true } : { ok: false, error: 'nobody' };
  const values = Object.values(draft.exactMinor).filter((v) => v > 0);
  if (!values.length) return { ok: false, error: 'nobody' };
  const diffMinor = draft.amountMinor - values.reduce((a, b) => a + b, 0);
  return Math.abs(diffMinor) <= EXACT_TOLERANCE_MINOR ? { ok: true } : { ok: false, error: 'mismatch', diffMinor };
}

/** Lo que falta asignar (positivo) o lo que sobra (negativo) en montos exactos, en centavos. */
export function splitRemainder(draft: SplitDraft): number {
  return draft.amountMinor - Object.values(draft.exactMinor).filter((v) => v > 0).reduce((a, b) => a + b, 0);
}

export interface DbPart {
  member_id: string;
  value?: DbNumeric;
}

/**
 * Las partes para `save_group_expense_with_movement`, en el orden de `memberOrder`.
 * En iguales, sin valor; en montos, solo los que tienen algo cargado.
 */
export function splitParts(draft: SplitDraft, memberOrder: readonly string[]): DbPart[] {
  if (draft.mode === 'equal') {
    return memberOrder.filter((id) => draft.included.includes(id)).map((member_id) => ({ member_id }));
  }
  return memberOrder
    .filter((id) => (draft.exactMinor[id] ?? 0) > 0)
    .map((member_id) => ({ member_id, value: toDbNumeric(money(draft.exactMinor[member_id]!, draft.currency)) }));
}
