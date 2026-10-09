// La lista de movimientos (épica de la lista, L-2): mes, búsqueda, "Sin medio de pago" y el total
// del filtro. La usa la app; no accede a la base.

import { installmentSchedule, statementFor } from '../cards/schedule.ts';
import type { CreditCard, StatementOverride } from '../cards/types.ts';
import type { ISODate, Period } from '../dates.ts';
import { normalizeWord } from '../entry/categories.ts';
import { fromDbNumeric, money, type Money } from '../money.ts';
import { formatMoney } from '../notices/format.ts';
import { coreMovementsAndCards, type DbWalletCard, type DbWalletMovement, type WalletInput } from './wallet.ts';

export interface MovementFilter {
  /** Por la fecha del gasto, no por el resumen (L11). */
  month: Period | 'all';
  query: string;
  /** Ficha "Sin medio de pago": ignora `month`. */
  missingMethodOnly: boolean;
}

/** Qué abre tocar la fila (L6). */
export type MovementAction = 'edit' | 'complete' | 'group' | 'none';

export interface MovementListRow {
  id: string;
  date: ISODate;
  description: string;
  /** Siempre positivo: el signo va en `sign` (L13). */
  amount: Money;
  sign: 'none' | 'plus' | 'minus';
  categoryId: string | null;
  /** null = "Sin medio de pago". */
  methodLabel: string | null;
  /** "cuota 3/6" o "6 cuotas de $10.000". */
  installmentsLabel: string | null;
  myShare: Money | null;
  isGroup: boolean;
  action: MovementAction;
  groupExpenseId: string | null;
}

export interface MovementList {
  /** De más nuevo a más viejo. */
  days: { date: ISODate; rows: MovementListRow[] }[];
  count: number;
  /** Solo los gastos, con el monto completo (L12). USD null si no hay gastos en dólares. */
  totals: { ARS: Money; USD: Money | null };
  /** Los meses con movimientos, de más nuevo a más viejo. */
  months: Period[];
  missingMethodCount: number;
}

const monthOf = (date: ISODate): Period => date.slice(0, 7);

const isMissingMethod = (m: DbWalletMovement) => m.origin === 'claim' && m.card_id === null && m.account_id === null;

function actionOf(m: DbWalletMovement, card: Card | undefined): MovementAction {
  // La hoja de carga no ofrece las tarjetas archivadas: editar obligaría a cambiar el medio de pago.
  if (card?.row.archived_at) return 'none';
  if (m.origin === 'claim') return 'complete';
  if (m.type !== 'expense' || m.origin === 'purge') return 'none';
  return m.group_expense_id === null ? 'edit' : 'group';
}

function signOf(m: DbWalletMovement, amount: Money): MovementListRow['sign'] {
  if (m.type === 'income') return 'plus';
  if (m.type === 'adjustment') return amount.minor < 0 ? 'minus' : 'plus';
  return 'none';
}

interface Card {
  row: DbWalletCard;
  card: CreditCard;
  overrides: StatementOverride[];
  currentPeriod: Period;
}

/** "cuota k/N" con el resumen en curso, como el detalle de la tarjeta; "N cuotas de $X" si ya cerraron todas. */
function installmentsLabel(m: DbWalletMovement, amount: Money, card: Card | undefined): string | null {
  if (!card || m.installments < 2) return null;
  const schedule = installmentSchedule(card.card, { id: m.id, date: m.date, amount, installments: m.installments }, card.overrides);
  const current = schedule.find((i) => i.period === card.currentPeriod);
  if (current) return `cuota ${current.index}/${current.of}`;
  // La cuota sin el resto de la división (que va en la primera).
  return `${m.installments} cuotas de ${formatMoney(schedule.at(-1)!.amount)}`;
}

function rowOf(m: DbWalletMovement, cards: Map<string, Card>, accountNames: Map<string, string>): MovementListRow {
  const amount = fromDbNumeric(m.amount, m.currency);
  const card = m.card_id === null ? undefined : cards.get(m.card_id);
  return {
    id: m.id,
    date: m.date,
    description: m.description,
    amount: money(Math.abs(amount.minor), amount.currency),
    sign: signOf(m, amount),
    categoryId: m.category_id,
    methodLabel: card ? `${card.row.name} ·· ${card.row.last4}` : (m.account_id && accountNames.get(m.account_id)) || null,
    installmentsLabel: m.type === 'expense' ? installmentsLabel(m, amount, card) : null,
    myShare: m.group_expense_id !== null && m.my_share !== null ? fromDbNumeric(m.my_share, m.currency) : null,
    isGroup: m.group_expense_id !== null,
    action: actionOf(m, card),
    groupExpenseId: m.group_expense_id,
  };
}

/** Por descripción, sin acentos ni mayúsculas, o por los dígitos del monto sin puntos (L14). */
function matches(m: DbWalletMovement, query: string): boolean {
  const text = normalizeWord(query.trim());
  if (!text) return true;
  const digits = text.replace(/[.\s]/g, '');
  return normalizeWord(m.description).includes(text) || (/^\d+$/.test(digits) && m.amount.replace('-', '').split('.')[0]!.startsWith(digits));
}

// shortcut: arma la lista con todos los movimientos en memoria; paginar por mes cuando una persona pase los ~5.000 (L15).
export function movementList(input: WalletInput, filter: MovementFilter): MovementList {
  const all = [...input.movements].sort((a, b) => b.date.localeCompare(a.date));
  const shown = all.filter(
    (m) =>
      (filter.missingMethodOnly ? isMissingMethod(m) : filter.month === 'all' || monthOf(m.date) === filter.month) &&
      matches(m, filter.query),
  );

  const coreCards = coreMovementsAndCards(input).cards;
  const cards = new Map(
    input.cards.map((row, i) => {
      const { card, overrides } = coreCards[i]!;
      return [row.id, { row, card, overrides, currentPeriod: statementFor(card, input.today, overrides) }];
    }),
  );
  const accountNames = new Map(input.accounts.map((a) => [a.id, a.name]));

  const days: MovementList['days'] = [];
  const totals = { ARS: money(0, 'ARS'), USD: null as Money | null };
  for (const m of shown) {
    const row = rowOf(m, cards, accountNames);
    if (days.at(-1)?.date !== m.date) days.push({ date: m.date, rows: [] });
    days.at(-1)!.rows.push(row);
    if (m.type !== 'expense') continue;
    if (m.currency === 'ARS') totals.ARS = money(totals.ARS.minor + row.amount.minor, 'ARS');
    else totals.USD = money((totals.USD?.minor ?? 0) + row.amount.minor, 'USD');
  }

  return {
    days,
    count: shown.length,
    totals,
    months: [...new Set(all.map((m) => monthOf(m.date)))],
    missingMethodCount: all.filter(isMissingMethod).length,
  };
}
