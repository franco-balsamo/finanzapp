// Carga por texto de varias líneas (D-5): ids estables por línea, lo que la persona completó a mano
// y el botón "Guardar 6 · faltan 2".

import { deduceCategory } from './categories.ts';
import type { PaymentMethod } from './paymentMethods.ts';
import type { LineStatus, LineWarning, ParsedLine } from './quickEntry.ts';

export interface BatchLine {
  /** El id del gasto: se genera al aparecer la línea y se mantiene mientras su texto no cambie. */
  id: string;
  text: string;
}

/** Las líneas no vacías del campo, sin espacios en los bordes (las mismas que lee `parseQuickEntry`). */
export function batchTexts(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Le da a cada línea el id de una línea anterior con el mismo texto (en orden, sin repetir) o uno
 * nuevo. Así, reintentar después de un corte guarda con los mismos ids y la base no duplica (02 §5).
 */
export function assignLineIds(prev: readonly BatchLine[], texts: readonly string[], newId: () => string): BatchLine[] {
  const free = new Map<string, string[]>();
  for (const line of prev) free.set(line.text, [...(free.get(line.text) ?? []), line.id]);
  return texts.map((text) => ({ text, id: free.get(text)?.shift() ?? newId() }));
}

/** Lo que la persona completó en la vista previa. Se pierde si cambia el texto de la línea. */
export interface LineOverride {
  methodId?: string;
  description?: string;
  /** Tocó "Revisar": la línea pasa a "Lista". */
  confirmed?: boolean;
}

export interface ResolvedLine extends ParsedLine {
  id: string;
}

/**
 * Aplica lo completado a mano y vuelve a calcular el estado. Una línea con el monto ambiguo no se
 * puede confirmar: hay que corregir el texto.
 */
export function resolveLine(
  line: BatchLine,
  parsed: ParsedLine,
  override: LineOverride | undefined,
  methods: readonly PaymentMethod[],
  keywords: ReadonlyMap<string, string>,
): ResolvedLine {
  const methodId = override?.methodId ?? parsed.methodId;
  const method = methods.find((m) => m.id === methodId);
  const description = (override?.description ?? parsed.description).trim();
  const isCard = method?.kind === 'card';
  const warnings: LineWarning[] = parsed.warnings.filter((w) => w !== 'installments_need_credit');
  if (method && !isCard && parsed.requestedInstallments > 1) warnings.push('installments_need_credit');

  const needsReview = warnings.some((w) => w !== 'installments_need_credit');
  const confirmable = parsed.amount !== null;
  const status: LineStatus =
    parsed.status === 'no_amount'
      ? 'no_amount'
      : !methodId || !description
        ? 'incomplete'
        : needsReview && !(override?.confirmed && confirmable)
          ? 'review'
          : 'ready';

  return {
    ...parsed,
    id: line.id,
    status,
    methodId: methodId ?? null,
    candidates: methodId ? [] : parsed.candidates,
    description,
    installments: isCard ? parsed.requestedInstallments : 1,
    categoryId: override?.description !== undefined ? deduceCategory(description, keywords) : parsed.categoryId,
    warnings,
  };
}

/** "Guardar 6 gastos", "Guardar 1 gasto" o "Guardar 6 · faltan 2". */
export function batchSaveLabel(lines: readonly ResolvedLine[]): string {
  const ready = lines.filter((l) => l.status === 'ready').length;
  const missing = lines.length - ready;
  if (missing > 0) return `Guardar ${ready} · faltan ${missing}`;
  return ready === 1 ? 'Guardar 1 gasto' : `Guardar ${ready} gastos`;
}

/** "Guardaste 6 gastos" o "Guardaste 1 gasto". */
export function batchSavedText(count: number): string {
  return count === 1 ? 'Guardaste 1 gasto' : `Guardaste ${count} gastos`;
}
