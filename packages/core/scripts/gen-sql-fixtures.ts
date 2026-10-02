// Genera supabase/tests/05_group_balances.test.sql desde
// packages/core/fixtures/group-balances.json, así core y la base se prueban
// con los mismos ejemplos. Uso: pnpm gen:sql-fixtures [--check]
// Con --check no escribe: falla si el archivo generado no está al día.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Expense {
  id: string;
  amount: string;
  currency: string;
  fxRate: string | null;
  payer: string;
  splitMode: string;
  parts: [string, string | null][];
}

interface Payment {
  id: string;
  from: string;
  to: string;
  amount: string;
  voided: boolean;
}

interface Case {
  name: string;
  currency: string;
  members: string[];
  expenses: Expense[];
  payments: Payment[];
  shares?: Record<string, Record<string, string>>;
  balances: Record<string, string>;
}

interface Fixtures {
  cases: Case[];
  settled: { amount: string; currency: string; settled: boolean }[];
}

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const input = join(here, '..', 'fixtures', 'group-balances.json');
const output = join(root, 'supabase', 'tests', '05_group_balances.test.sql');

const pad = (n: number, width: number) => String(n).padStart(width, '0');
const groupId = (c: number) => `90000000-0000-4000-8000-${pad(c, 12)}`;
const memberId = (c: number, m: number) => `e0000000-0000-4000-8000-${pad(c, 6)}${pad(m, 6)}`;
const expenseId = (c: number, e: number) => `ab000000-0000-4000-8000-${pad(c, 6)}${pad(e, 6)}`;
const paymentId = (c: number, p: number) => `70000000-0000-4000-8000-${pad(c, 6)}${pad(p, 6)}`;

const text = (s: string) => `'${s.replaceAll("'", "''")}'`;

/** '−33.33' → -3333, sin pasar por float. */
function toMinor(amount: string): number {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(amount);
  if (!match) throw new Error(`Monto inválido en el JSON: ${amount} (usá dos decimales)`);
  const [, sign, int, frac] = match;
  const minor = Number(int) * 100 + Number(frac);
  return sign ? -minor : minor;
}

function render(fixtures: Fixtures): string {
  const lines: string[] = [];
  let assertions = 0;

  fixtures.cases.forEach((c, ci) => {
    const n = ci + 1;
    const member = (name: string) => {
      const index = c.members.indexOf(name);
      if (index < 0) throw new Error(`${c.name}: ${name} no es integrante`);
      return memberId(n, index + 1);
    };

    lines.push('', `-- ${n}. ${c.name}`);
    lines.push(`insert into public.groups (id, name, currency) values (${text(groupId(n))}, ${text(`caso ${n}`)}, ${text(c.currency)});`);
    lines.push('insert into public.group_members (id, group_id, display_name, joined_at) values');
    lines.push(
      c.members
        .map((name, mi) => `  (${text(member(name))}, ${text(groupId(n))}, ${text(name)}, now() + interval '${mi} seconds')`)
        .join(',\n') + ';',
    );

    c.expenses.forEach((e, ei) => {
      const id = expenseId(n, ei + 1);
      lines.push(
        'insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode) values',
        `  (${text(id)}, ${text(groupId(n))}, '2026-10-01', ${text(e.id)}, ${e.amount}, ${text(e.currency)}, ` +
          `${e.fxRate ?? 'null'}, ${text(member(e.payer))}, ${text(e.splitMode)});`,
        'insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values',
        e.parts
          .map(([name, value]) => `  (${text(groupId(n))}, ${text(id)}, ${text(member(name))}, ${value ?? '1'})`)
          .join(',\n') + ';',
      );
    });

    c.payments.forEach((p, pi) => {
      lines.push(
        'insert into public.group_payments (id, group_id, from_member_id, to_member_id, amount, date, deleted_at) values',
        `  (${text(paymentId(n, pi + 1))}, ${text(groupId(n))}, ${text(member(p.from))}, ${text(member(p.to))}, ` +
          `${p.amount}, '2026-10-02', ${p.voided ? 'now()' : 'null'});`,
      );
    });

    for (const [expense, expected] of Object.entries(c.shares ?? {})) {
      const ei = c.expenses.findIndex((e) => e.id === expense);
      if (ei < 0) throw new Error(`${c.name}: no hay gasto ${expense}`);
      const json = JSON.stringify(Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, toMinor(v)])));
      lines.push(
        'select is(',
        '  (select jsonb_object_agg(m.display_name, s.share_minor)',
        `   from private.member_shares(${text(expenseId(n, ei + 1))}) s join public.group_members m on m.id = s.member_id),`,
        `  ${text(json)}::jsonb,`,
        `  ${text(`${c.name}: partes de ${expense}`)}`,
        ');',
      );
      assertions++;
    }

    const balances = JSON.stringify(Object.fromEntries(Object.entries(c.balances).map(([k, v]) => [k, toMinor(v)])));
    lines.push(
      'select is(',
      '  (select jsonb_object_agg(m.display_name, b.balance_minor)',
      `   from private.group_balances(${text(groupId(n))}) b join public.group_members m on m.id = b.member_id),`,
      `  ${text(balances)}::jsonb,`,
      `  ${text(`${c.name}: saldos`)}`,
      ');',
    );
    assertions++;
  });

  lines.push('', '-- Umbral de "al día" (D14)');
  for (const s of fixtures.settled) {
    lines.push(
      `select is(private.is_settled(${toMinor(s.amount)}, ${text(s.currency)}), ${s.settled}, ` +
        `${text(`al día: ${s.amount} ${s.currency} → ${s.settled}`)});`,
    );
    assertions++;
  }

  return [
    '-- GENERADO por `pnpm gen:sql-fixtures` desde packages/core/fixtures/group-balances.json.',
    '-- No lo edites a mano: cambiá el JSON y volvé a correr el script.',
    '-- Los saldos en SQL (private.member_shares y private.group_balances) tienen que dar',
    '-- lo mismo que shares() y groupBalances() de core, que leen el mismo JSON en Vitest.',
    'begin;',
    'create extension if not exists pgtap with schema extensions;',
    `select plan(${assertions});`,
    ...lines,
    '',
    'select * from finish();',
    'rollback;',
    '',
  ].join('\n');
}

const fixtures = JSON.parse(readFileSync(input, 'utf8')) as Fixtures;
const sql = render(fixtures);

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(output, 'utf8');
  } catch {
    // No existe todavía.
  }
  if (current !== sql) {
    console.error('supabase/tests/05_group_balances.test.sql no está al día. Corré pnpm gen:sql-fixtures.');
    process.exit(1);
  }
  console.log('05_group_balances.test.sql está al día.');
} else {
  writeFileSync(output, sql);
  console.log(`Generado ${output}`);
}
