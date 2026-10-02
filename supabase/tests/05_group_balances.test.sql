-- Los saldos en SQL dan lo mismo que packages/core: mismos ejemplos que
-- packages/core/src/groups/groups.test.ts (02 §7, D9, D14).
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Un grupo por caso. Integrantes en orden de ingreso: Vos, Ana, Juan.
insert into public.groups (id, name, currency) values
  ('90000000-0000-4000-8000-000000000001', 'Ejemplo 02 §7', 'ARS'),
  ('90000000-0000-4000-8000-000000000002', 'Restos', 'ARS'),
  ('90000000-0000-4000-8000-000000000003', 'Dólares', 'ARS');
insert into public.group_members (id, group_id, display_name, joined_at)
select ('e0000000-0000-4000-8000-0000000000' || g || n)::uuid,
       ('90000000-0000-4000-8000-00000000000' || g)::uuid,
       name, now() + (n || ' seconds')::interval
from (values ('1'), ('2'), ('3')) gs (g),
     (values ('1', 'Vos'), ('2', 'Ana'), ('3', 'Juan')) ms (n, name);

create function pg_temp.expense(id text, gid text, amount numeric, currency text, fx numeric, payer text, mode text, parts text[], vals numeric[] default null)
returns void language plpgsql as $$
begin
  insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode)
  values (id::uuid, ('90000000-0000-4000-8000-00000000000' || gid)::uuid, '2026-10-01', 'gasto', amount, currency, fx,
          ('e0000000-0000-4000-8000-0000000000' || gid || payer)::uuid, mode);
  insert into public.group_expense_parts (group_id, group_expense_id, member_id, value)
  select ('90000000-0000-4000-8000-00000000000' || gid)::uuid, id::uuid,
         ('e0000000-0000-4000-8000-0000000000' || gid || p.m)::uuid, coalesce(vals[p.i], 1)
  from unnest(parts) with ordinality p (m, i);
end;
$$;

create function pg_temp.shares(id text, in_group boolean default true) returns numeric[]
language sql as $$
  select array_agg(s.share_minor order by s.member_id) from private.member_shares(id::uuid, in_group) s;
$$;

create function pg_temp.balances(gid text) returns numeric[]
language sql as $$
  select array_agg(b.balance_minor order by b.member_id)
  from private.group_balances(('90000000-0000-4000-8000-00000000000' || gid)::uuid) b;
$$;

-- ── Ejemplo de 02 §7 (T-10, T-11) ──
select pg_temp.expense('ab000000-0000-4000-8000-000000000001', '1', 90000, 'ARS', null, '1', 'equal', array['1', '2', '3']);
select pg_temp.expense('ab000000-0000-4000-8000-000000000002', '1', 30000, 'ARS', null, '2', 'exact', array['2', '3'], array[10000, 20000]);
select is(pg_temp.balances('1'), array[6000000, -1000000, -5000000]::numeric[], 'Vos +60.000, Ana −10.000, Juan −50.000');

insert into public.group_payments (id, group_id, from_member_id, to_member_id, amount, date) values
  ('70000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000013', 'e0000000-0000-4000-8000-000000000011', 50000, '2026-10-02');
select is(pg_temp.balances('1'), array[1000000, -1000000, 0]::numeric[], 'el pago de Juan a Vos baja la deuda');

update public.group_payments set deleted_at = now() where id = '70000000-0000-4000-8000-000000000001';
select is(pg_temp.balances('1'), array[6000000, -1000000, -5000000]::numeric[], 'un pago anulado no cuenta');

update public.group_expenses set deleted_at = now() where id = 'ab000000-0000-4000-8000-000000000002';
select is(pg_temp.balances('1'), array[6000000, -3000000, -3000000]::numeric[], 'un gasto borrado no cuenta');

-- ── Restos (T-12, T-13, D9) ──
select pg_temp.expense('ab000000-0000-4000-8000-000000000003', '2', 100, 'ARS', null, '2', 'equal', array['1', '2', '3']);
select is(pg_temp.shares('ab000000-0000-4000-8000-000000000003'), array[3333, 3334, 3333]::numeric[], '$100 entre 3, pagó Ana → Ana $33,34');
select is(pg_temp.balances('2'), array[-3333, 6666, -3333]::numeric[], 'el saldo exacto queda guardado: Ana +66,66');

select pg_temp.expense('ab000000-0000-4000-8000-000000000004', '2', 0.03, 'ARS', null, '2', 'equal', array['1', '3']);
select is(pg_temp.shares('ab000000-0000-4000-8000-000000000004'), array[2, 1]::numeric[], 'si el que pagó quedó excluido, el resto va al primer incluido');

select pg_temp.expense('ab000000-0000-4000-8000-000000000005', '2', 1000, 'ARS', null, '1', 'exact', array['1', '2'], array[600, 399.6]);
select is(pg_temp.shares('ab000000-0000-4000-8000-000000000005'), array[60040, 39960]::numeric[], 'montos exactos: la diferencia va al que pagó ($600,40)');

-- ── Gasto en otra moneda que el grupo ──
select pg_temp.expense('ab000000-0000-4000-8000-000000000006', '3', 100, 'USD', 1500, '1', 'equal', array['1', '2', '3']);
select is(pg_temp.shares('ab000000-0000-4000-8000-000000000006'), array[5000000, 5000000, 5000000]::numeric[], 'US$ 100 a $1.500: se convierte y después se divide');

select pg_temp.expense('ab000000-0000-4000-8000-000000000007', '3', 10.01, 'USD', 1333.33, '2', 'equal', array['1', '2', '3']);
select is(
  (select sum(s.share_minor) from private.member_shares('ab000000-0000-4000-8000-000000000007') s),
  1334663::numeric,
  'US$ 10,01 × 1333,33: las partes suman exacto $13.346,63'
);
select is(
  pg_temp.shares('ab000000-0000-4000-8000-000000000007', false),
  array[333, 335, 333]::numeric[],
  'en la moneda del gasto (my_share): US$ 3,33, US$ 3,35 y US$ 3,33'
);

select pg_temp.expense('ab000000-0000-4000-8000-000000000008', '3', 10.01, 'USD', 1333.33, '2', 'exact', array['1', '2', '3'], array[3.33, 3.34, 3.34]);
select is(
  (select s.share_minor from private.member_shares('ab000000-0000-4000-8000-000000000008') s
   where s.member_id = 'e0000000-0000-4000-8000-000000000031'),
  443999::numeric,
  'montos exactos en dólares: la parte de Vos es $4.439,99'
);
select is(
  (select sum(s.share_minor) from private.member_shares('ab000000-0000-4000-8000-000000000008') s),
  1334663::numeric,
  'montos exactos en dólares: suman exacto el total convertido'
);
select is((select sum(x) from unnest(pg_temp.balances('3')) x), 0::numeric, 'los saldos suman cero');

-- ── Umbral de "al día" (D14) ──
select ok(
  private.is_settled(99, 'ARS') and not private.is_settled(-100, 'ARS')
  and private.is_settled(0, 'USD') and not private.is_settled(-1, 'USD'),
  'al día: menos de $1 o menos de US$ 0,01'
);

select * from finish();
rollback;
