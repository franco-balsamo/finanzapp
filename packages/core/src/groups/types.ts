import type { Currency, Money, Rate } from '../money';

export interface GroupMember {
  id: string;
  name: string;
}

export interface Group {
  id: string;
  currency: Currency;
  /** En orden de ingreso al grupo (joined_at). Desempata restos y simplificación. */
  members: GroupMember[];
}

export interface GroupExpense {
  id: string;
  amount: Money;
  /** Cotización guardada del día. Obligatoria si el gasto está en otra moneda que el grupo. */
  fxRate: Rate | null;
  payerMemberId: string;
  splitMode: 'equal' | 'exact';
  /** Los excluidos no aparecen. En 'equal', value es null; en 'exact', va en la moneda del gasto. */
  parts: { memberId: string; value: Money | null }[];
}

/** Pago entre integrantes, en la moneda del grupo. Mangos lo registra; no mueve plata. */
export interface GroupPayment {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: Money;
  /** Si está anulado (void_group_payment), no cuenta para los saldos. */
  deletedAt?: string | null;
}

export type Balances = Record<string, Money>;

export interface Transfer {
  fromMemberId: string;
  toMemberId: string;
  amount: Money;
}
