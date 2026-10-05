// Carga rápida por texto (02 §5 "Carga por texto"): cada línea es un gasto, con reglas y sin IA.

import { addDays, makeDate, parseDate, type ISODate } from '../dates.ts';
import { money, type Currency, type Money } from '../money.ts';
import { parseAmountMinor } from './amount.ts';
import { deduceCategory, normalizeWord } from './categories.ts';
import { methodWords, usageCounts, type PaymentMethod, type PaymentUse } from './paymentMethods.ts';

/**
 * - `ready`: se guarda.
 * - `review`: hay que confirmarla (fecha futura, monto ambiguo, más de un monto posible).
 * - `incomplete`: falta el medio de pago o la descripción.
 * - `no_amount`: queda en el campo.
 */
export type LineStatus = 'ready' | 'review' | 'incomplete' | 'no_amount';

export type LineWarning =
  | 'future_date'
  | 'invalid_date'
  | 'ambiguous_amount'
  | 'several_amounts'
  | 'installments_out_of_range'
  | 'installments_need_credit';

export interface ParsedLine {
  /** La línea tal como se escribió. */
  text: string;
  status: LineStatus;
  date: ISODate;
  amount: Money | null;
  currency: Currency;
  /** 1 a 24. Si el medio no es una tarjeta de crédito, 1 (R3-2). */
  installments: number;
  /** Las cuotas que pidió el texto, para aplicarlas si después se elige una tarjeta de crédito. */
  requestedInstallments: number;
  methodId: string | null;
  /** Si el texto nombra a varias tarjetas y no se pudo desempatar: sus ids, para mostrar esas fichas. */
  candidates: string[];
  description: string;
  categoryId: string;
  warnings: LineWarning[];
}

export interface QuickEntryContext {
  /** Hoy, en hora de Argentina. */
  today: ISODate;
  methods: readonly PaymentMethod[];
  /** Gastos anteriores, para desempatar por el más usado en 30 días. */
  uses: readonly PaymentUse[];
  /** Correcciones de categoría del usuario: palabra normalizada → `category_id`. */
  keywords: ReadonlyMap<string, string>;
  /** En el detalle de una tarjeta: esa tarjeta, salvo que el texto nombre otro medio. */
  defaultCardId?: string;
}

const CURRENCY_WORDS = new Set(['u$s', 'us$', 'usd', 'dolares', 'dolar', 'u$d']);
const CURRENCY_PREFIX = /^(u\$s|us\$|usd|u\$d|\$)(?=\d)/;
const CURRENCY_SUFFIX = /(?<=\d)(u\$s|us\$|usd)$/;
const DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/;
const NUMBER_TOKEN = /^\d[\d.,]*(k|mil|m)?$/;

interface Token {
  /** Como se escribió, para la descripción. */
  raw: string;
  /** Normalizado, para comparar. */
  norm: string;
  used: boolean;
}

function tokenize(line: string): Token[] {
  return line
    .split(/\s+/)
    .map((raw) => raw.replace(/^[,;:!?¡¿()"']+|[,;:!?¡¿()"']+$/g, ''))
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalizeWord(raw), used: false }));
}

function validDate(year: number, month: number, day: number): ISODate | null {
  const date = makeDate(year, month, day);
  try {
    parseDate(date);
    return date;
  } catch {
    return null;
  }
}

/**
 * `ayer`, `anteayer`, `dd/mm` (la fecha más reciente que no sea futura) o `dd/mm/aa` (esa fecha,
 * marcada si es futura). null si no es una fecha; `invalid` si tiene forma de fecha pero no existe.
 * La usan la carga por texto y el campo de fecha de la hoja.
 */
export function parseShortDate(text: string, today: ISODate): { date: ISODate; future: boolean } | 'invalid' | null {
  const norm = normalizeWord(text.trim());
  if (norm === 'hoy') return { date: today, future: false };
  if (norm === 'ayer' || norm === 'anteayer') return { date: addDays(today, norm === 'ayer' ? -1 : -2), future: false };
  const match = DATE_PATTERN.exec(norm);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const { year: thisYear } = parseDate(today);
  if (match[3]) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    const date = validDate(year, month, day);
    return date ? { date, future: date > today } : 'invalid';
  }
  const date = validDate(thisYear, month, day);
  if (!date) return 'invalid';
  return { date: date > today ? (validDate(thisYear - 1, month, day) ?? date) : date, future: false };
}

function readDate(tokens: Token[], today: ISODate, warnings: LineWarning[]): ISODate {
  for (const t of tokens) {
    if (t.used) continue;
    const parsed = parseShortDate(t.norm, today);
    if (parsed === null) continue;
    t.used = true;
    if (parsed === 'invalid') {
      warnings.push('invalid_date');
      return today;
    }
    if (parsed.future) warnings.push('future_date');
    return parsed.date;
  }
  return today;
}

/** `N cuotas`, `N cuota`, `N c`, `Nc` o `xN`. */
function readInstallments(tokens: Token[], warnings: LineWarning[]): number {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.used) continue;
    const next = tokens[i + 1];
    let n: number | null = null;
    const single = /^x(\d{1,2})$/.exec(t.norm) ?? /^(\d{1,2})c$/.exec(t.norm);
    if (single) {
      n = Number(single[1]);
      t.used = true;
    } else if (/^\d{1,2}$/.test(t.norm) && next && !next.used && ['cuotas', 'cuota', 'c'].includes(next.norm)) {
      n = Number(t.norm);
      t.used = true;
      next.used = true;
    }
    if (n === null) continue;
    if (n >= 1 && n <= 24) return n;
    warnings.push('installments_out_of_range');
    return 1;
  }
  return 1;
}

/** Saca la moneda: palabras sueltas ("usd", "dólares") o pegadas al número ("u$s50", "$12000"). */
function readCurrency(tokens: Token[]): Currency {
  let currency: Currency = 'ARS';
  for (const t of tokens) {
    if (t.used) continue;
    if (CURRENCY_WORDS.has(t.norm)) {
      t.used = true;
      currency = 'USD';
      continue;
    }
    const prefix = CURRENCY_PREFIX.exec(t.norm);
    if (prefix) {
      if (prefix[1] !== '$') currency = 'USD';
      t.norm = t.norm.slice(prefix[1]!.length);
    }
    const suffix = CURRENCY_SUFFIX.exec(t.norm);
    if (suffix) {
      currency = 'USD';
      t.norm = t.norm.slice(0, -suffix[1]!.length);
    }
  }
  return currency;
}

/** Junta "12 mil" en un solo número. */
function joinMil(tokens: Token[]): void {
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i]!;
    const next = tokens[i + 1]!;
    if (!t.used && !next.used && /^\d[\d.,]*$/.test(t.norm) && next.norm === 'mil') {
      t.norm = `${t.norm}mil`;
      next.used = true;
    }
  }
}

interface MethodPick {
  methodId: string | null;
  candidates: string[];
}

/**
 * El texto manda (R3-6). Se elige el medio que coincide con más palabras. Si empatan varios:
 * la favorita si es una de ellas; si no, la más usada en 30 días; si siguen empatadas, incompleta.
 */
function readMethod(tokens: Token[], last4Card: PaymentMethod | null, ctx: QuickEntryContext): MethodPick {
  const matched = new Map<string, number>();
  const wordsById = new Map(ctx.methods.map((m) => [m.id, new Set(methodWords(m))]));
  for (const t of tokens) {
    if (t.used) continue;
    let hit = false;
    for (const m of ctx.methods) {
      if (wordsById.get(m.id)!.has(t.norm)) {
        matched.set(m.id, (matched.get(m.id) ?? 0) + 1);
        hit = true;
      }
    }
    if (hit) t.used = true;
  }
  if (last4Card) return { methodId: last4Card.id, candidates: [] };
  if (matched.size === 0) {
    const fallback = ctx.methods.find((m) => m.id === ctx.defaultCardId);
    return { methodId: fallback?.id ?? null, candidates: [] };
  }

  const best = Math.max(...matched.values());
  const tied = ctx.methods.filter((m) => matched.get(m.id) === best);
  if (tied.length === 1) return { methodId: tied[0]!.id, candidates: [] };

  const favorite = tied.find((m) => m.kind === 'card' && m.isFavorite);
  if (favorite) return { methodId: favorite.id, candidates: [] };

  const counts = usageCounts(ctx.uses, ctx.today);
  const countOf = (m: PaymentMethod) => counts.get(m.id)?.count ?? 0;
  const top = Math.max(...tied.map(countOf));
  const mostUsed = tied.filter((m) => countOf(m) === top);
  if (mostUsed.length === 1) return { methodId: mostUsed[0]!.id, candidates: [] };
  return { methodId: null, candidates: mostUsed.map((m) => m.id) };
}

export function parseQuickEntryLine(text: string, ctx: QuickEntryContext): ParsedLine {
  const warnings: LineWarning[] = [];
  const tokens = tokenize(text);

  const date = readDate(tokens, ctx.today, warnings);
  const requestedInstallments = readInstallments(tokens, warnings);
  const currency = readCurrency(tokens);
  joinMil(tokens);

  // Últimos 4: solo si queda otro número para el monto.
  const numbers = () => tokens.filter((t) => !t.used && NUMBER_TOKEN.test(t.norm));
  let last4Card: PaymentMethod | null = null;
  if (numbers().length > 1) {
    for (const t of numbers()) {
      const card = ctx.methods.find((m) => m.kind === 'card' && /^\d{4}$/.test(t.norm) && m.last4 === t.norm);
      if (card) {
        last4Card = card;
        t.used = true;
        break;
      }
    }
  }

  let amount: Money | null = null;
  const amountTokens = numbers();
  const first = amountTokens[0];
  if (first) {
    first.used = true;
    const parsed = parseAmountMinor(first.norm);
    if ('error' in parsed) warnings.push('ambiguous_amount');
    else amount = money(parsed.minor, currency);
    if (amountTokens.length > 1) warnings.push('several_amounts');
  }

  const { methodId, candidates } = readMethod(tokens, last4Card, ctx);
  const method = ctx.methods.find((m) => m.id === methodId);

  let installments = requestedInstallments;
  if (method && method.kind !== 'card' && requestedInstallments > 1) {
    warnings.push('installments_need_credit');
    installments = 1;
  }

  const description = tokens
    .filter((t) => !t.used && t.raw !== '$')
    .map((t) => t.raw)
    .join(' ');

  const needsReview = warnings.some((w) => w !== 'installments_need_credit');
  const status: LineStatus = !first
    ? 'no_amount'
    : !methodId || !description
      ? 'incomplete'
      : needsReview
        ? 'review'
        : 'ready';

  return {
    text,
    status,
    date,
    amount,
    currency,
    installments,
    requestedInstallments,
    methodId,
    candidates,
    description,
    categoryId: deduceCategory(description, ctx.keywords),
    warnings,
  };
}

/** Una línea, un gasto. Las líneas vacías se ignoran. */
export function parseQuickEntry(text: string, ctx: QuickEntryContext): ParsedLine[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseQuickEntryLine(line, ctx));
}
