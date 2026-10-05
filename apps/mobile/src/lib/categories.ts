import { SYSTEM_CATEGORY_IDS } from '@mangos/core';

/** Las 6 categorías fijas de la beta, en el orden de la base (`sort`). */
export const CATEGORIES = [
  { id: SYSTEM_CATEGORY_IDS.supermercado, label: 'Supermercado' },
  { id: SYSTEM_CATEGORY_IDS.salidas, label: 'Salidas' },
  { id: SYSTEM_CATEGORY_IDS.transporte, label: 'Transporte' },
  { id: SYSTEM_CATEGORY_IDS.servicios, label: 'Servicios' },
  { id: SYSTEM_CATEGORY_IDS.suscripciones, label: 'Suscripciones' },
  { id: SYSTEM_CATEGORY_IDS.otros, label: 'Otros' },
];

export function categoryLabel(id: string | null): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? 'Otros';
}
