import { SYSTEM_CATEGORY_IDS } from '@mangos/core';

export type CategoryIconName = 'cart' | 'food' | 'bus' | 'bolt' | 'play' | 'box';

/**
 * Las 6 categorías fijas de la beta, en el orden de la base (`sort`). Ícono y color (`cat[colorIndex]`)
 * según DESIGN.md "Ícono de categoría".
 */
export const CATEGORIES: readonly { id: string; label: string; icon: CategoryIconName; colorIndex: number }[] = [
  { id: SYSTEM_CATEGORY_IDS.supermercado, label: 'Supermercado', icon: 'cart', colorIndex: 0 },
  { id: SYSTEM_CATEGORY_IDS.salidas, label: 'Salidas', icon: 'food', colorIndex: 1 },
  { id: SYSTEM_CATEGORY_IDS.transporte, label: 'Transporte', icon: 'bus', colorIndex: 2 },
  { id: SYSTEM_CATEGORY_IDS.servicios, label: 'Servicios', icon: 'bolt', colorIndex: 3 },
  { id: SYSTEM_CATEGORY_IDS.suscripciones, label: 'Suscripciones', icon: 'play', colorIndex: 4 },
  { id: SYSTEM_CATEGORY_IDS.otros, label: 'Otros', icon: 'box', colorIndex: 5 },
];

export function categoryLabel(id: string | null): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? 'Otros';
}
