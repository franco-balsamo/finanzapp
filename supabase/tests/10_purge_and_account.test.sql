-- Purga de tarjetas archivadas (T7, T-19), borrar la cuenta (T10, T-26) y
-- exportar los datos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

-- Ana (la que purga, exporta y borra), Beto (con cuenta, en sus grupos).
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'beto@test.local');

insert into public.accounts (id, user_id, name, type, currency, opening_balance) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Caja Ana', 'bank', 'ARS', 500000),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Caja Ana USD', 'bank', 'USD', 1000),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Caja Beto', 'bank', 'ARS', 0);

-- V: archivada hace 8 días (se purga). M: hace 6 (todavía no). A: activa.
-- F: hace 10, pero borrarla va a fallar.
insert into public.cards (id, user_id, bank, name, network, last4, close_day, due_day, archived_at, credit_limit) values
  ('a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'Galicia', 'Visa', 'VISA', '2337', 24, 6, now() - interval '8 days', 1000000),
  ('a2000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000001', 'BBVA', 'Master', 'MC', '1111', 24, 6, now() - interval '6 days', 1000000),
  ('a2000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-000000000001', 'Santander', 'Amex', 'AMEX', '9999', 24, 6, null, 1000000),
  ('a2000000-0000-4000-8000-00000000000d', 'a0000000-0000-4000-8000-000000000001', 'Credicoop', 'Cabal', 'CABAL', '4444', 24, 6, now() - interval '10 days', 1000000);

insert into public.movements (id, user_id, type, date, description, amount, currency, card_id, account_id, category_id) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'expense', '2026-09-10', 'Consumo Visa', 50000, 'ARS',
   'a2000000-0000-4000-8000-00000000000a', null, '00000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'expense', '2026-09-11', 'Consumo Master', 20000, 'ARS',
   'a2000000-0000-4000-8000-00000000000b', null, null),
  ('a3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'expense', '2026-09-12', 'Efectivo', 10000, 'ARS',
   null, 'a1000000-0000-4000-8000-000000000001', null),
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'income', '2026-09-12', 'Sueldo Beto', 1000, 'ARS',
   null, 'b1000000-0000-4000-8000-000000000001', null);

-- Pagos de la Visa: uno en pesos (02:00 UTC del 6/9 = 5/9 en Argentina), US$ 50
-- pagados en pesos, uno revertido y US$ 20 desde la caja en dólares.
insert into public.statement_payments (id, user_id, card_id, period, applies_to, amount, from_account_id, debited_amount, fx_card_rate, paid_at, reverted_at) values
  ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-00000000000a', '2026-08-01', 'ARS', 120000,
   'a1000000-0000-4000-8000-000000000001', 120000, null, '2026-09-06 02:00+00', null),
  ('a4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-00000000000a', '2026-08-01', 'USD', 50,
   'a1000000-0000-4000-8000-000000000001', 101400, 2028, '2026-09-06 15:00+00', null),
  ('a4000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-00000000000a', '2026-08-01', 'ARS', 30000,
   'a1000000-0000-4000-8000-000000000001', 30000, null, '2026-09-07 15:00+00', '2026-09-08 15:00+00'),
  ('a4000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-00000000000a', '2026-08-01', 'USD', 20,
   'a1000000-0000-4000-8000-000000000002', 20, null, '2026-09-06 15:00+00', null),
  ('a4000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-00000000000d', '2026-08-01', 'ARS', 5000,
   'a1000000-0000-4000-8000-000000000001', 5000, null, '2026-09-06 15:00+00', null);
insert into public.statement_overrides (user_id, card_id, period, close_date, due_date) values
  ('a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-00000000000a', '2026-09-01', '2026-09-25', '2026-10-07');
insert into public.alerts (user_id, type, params) values
  ('a0000000-0000-4000-8000-000000000001', 'card_closing', '{"card_id": "a2000000-0000-4000-8000-00000000000a"}'),
  ('a0000000-0000-4000-8000-000000000001', 'card_closing', '{"card_id": "a2000000-0000-4000-8000-00000000000c"}');

-- Saldo de una cuenta con la fórmula de accountBalance (core).
create function pg_temp.balance(acc uuid) returns numeric language sql as $$
  select a.opening_balance
    - coalesce((select sum(coalesce(m.debited_amount, m.amount)) from public.movements m
                where m.account_id = acc and m.type in ('expense', 'card_payment', 'transfer')), 0)
    + coalesce((select sum(coalesce(m.debited_amount, m.amount)) from public.movements m
                where m.account_id = acc and m.type = 'income'), 0)
    + coalesce((select sum(m.amount) from public.movements m where m.account_id = acc and m.type = 'adjustment'), 0)
    + coalesce((select sum(m.amount) from public.movements m where m.to_account_id = acc and m.type = 'transfer'), 0)
    - coalesce((select sum(p.debited_amount) from public.statement_payments p
                where p.from_account_id = acc and p.reverted_at is null), 0)
  from public.accounts a where a.id = acc;
$$;

create temp table balances_before as
select id, pg_temp.balance(id) as balance from public.accounts;

-- La Cabal falla al borrarse.
create function private.test_fail_card() returns trigger language plpgsql as $$
begin
  raise exception 'boom';
end;
$$;
create trigger test_fail_card before delete on public.cards
  for each row when (old.id = 'a2000000-0000-4000-8000-00000000000d') execute function private.test_fail_card();

-- ═════════════════════════ Purga ═════════════════════════

select is(private.purge_archived_cards(), 1, 'se purga solo la Visa (archivada hace 8 días; la Cabal falla)');
select is(
  (select array_agg(b.balance = pg_temp.balance(b.id) order by b.id) from balances_before b),
  array[true, true, true],
  'T-19: los saldos de todas las cuentas son iguales antes y después de purgar'
);
select is(
  (select array_agg(row(m.date, m.amount, m.currency, m.account_id)::text order by m.date, m.amount)
   from public.movements m where m.origin = 'purge'),
  array[
    row('2026-09-05'::date, 120000::numeric(14,2), 'ARS'::text, 'a1000000-0000-4000-8000-000000000001'::uuid)::text,
    row('2026-09-06'::date, 20::numeric(14,2), 'USD'::text, 'a1000000-0000-4000-8000-000000000002'::uuid)::text,
    row('2026-09-06'::date, 101400::numeric(14,2), 'ARS'::text, 'a1000000-0000-4000-8000-000000000001'::uuid)::text
  ],
  'cada pago no revertido es un movimiento de su cuenta, por lo que restaba y con la fecha en hora de Argentina'
);
select is(
  (select array_agg(distinct m.description || ' ' || m.type) from public.movements m where m.origin = 'purge'),
  array['Pago de tarjeta Visa ··2337 (eliminada) card_payment'],
  'los movimientos dicen de qué tarjeta eran'
);
select is(
  (select row(
     (select count(*) from public.cards where id = 'a2000000-0000-4000-8000-00000000000a'),
     (select count(*) from public.movements where card_id = 'a2000000-0000-4000-8000-00000000000a'),
     (select count(*) from public.statement_payments where card_id = 'a2000000-0000-4000-8000-00000000000a'),
     (select count(*) from public.statement_overrides where card_id = 'a2000000-0000-4000-8000-00000000000a'),
     (select count(*) from public.alerts where params ->> 'card_id' = 'a2000000-0000-4000-8000-00000000000a'))::text),
  row(0, 0, 0, 0, 0)::text,
  'la tarjeta se borra con sus consumos, pagos, cierres corregidos y alertas'
);
select is(
  (select array_agg(network order by network) from public.cards where user_id = 'a0000000-0000-4000-8000-000000000001'),
  array['AMEX', 'CABAL', 'MC'],
  'quedan la activa, la archivada hace 6 días y la que falló'
);
select is(
  (select count(*)::int from public.alerts where params ->> 'card_id' = 'a2000000-0000-4000-8000-00000000000c'),
  1,
  'las alertas de otras tarjetas no se tocan'
);
select is(
  (select row(
     (select count(*) from public.statement_payments where card_id = 'a2000000-0000-4000-8000-00000000000d'),
     (select count(*) from public.movements where origin = 'purge' and description like '%4444%'))::text),
  row(1, 0)::text,
  'la tarjeta que falló queda entera, sin movimientos a medias'
);
select is(
  (select row(job, ref_id, error) from private.job_failures),
  row('purge_archived_cards'::text, 'a2000000-0000-4000-8000-00000000000d'::uuid, 'boom'::text),
  'la falla queda en private.job_failures'
);
select isnt((select failed_at from private.job_failures), null, 'con la hora de la falla');
select is(private.purge_archived_cards(), 0, 'correrla otra vez no purga nada nuevo');
drop trigger test_fail_card on public.cards;

-- ═════════════════════════ Grupos para T-26 ═════════════════════════

insert into public.groups (id, name, currency) values
  ('90000000-0000-4000-8000-000000000001', 'Cabaña', 'ARS'),
  ('90000000-0000-4000-8000-000000000002', 'Solo Ana', 'ARS'),
  ('90000000-0000-4000-8000-000000000003', 'Viejo', 'ARS');
insert into public.group_members (id, group_id, user_id, display_name, payment_alias, claimed_at, left_at) values
  ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Ana', 'ana.mp', now(), null),
  ('e0000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Beto', 'beto.mp', null, null),
  ('e0000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', null, 'Juan', null, null, null),
  ('e0000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Ana', 'ana.mp', null, null),
  ('e0000000-0000-4000-8000-000000000012', '90000000-0000-4000-8000-000000000002', null, 'Lu', null, null, null),
  ('e0000000-0000-4000-8000-000000000021', '90000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Ana', 'ana.viejo', null, now()),
  ('e0000000-0000-4000-8000-000000000022', '90000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'Beto', 'beto.mp', null, null);
update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000001' where id = '90000000-0000-4000-8000-000000000001';
update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000011' where id = '90000000-0000-4000-8000-000000000002';
update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000022' where id = '90000000-0000-4000-8000-000000000003';

-- El asado lo cargó Ana y lo editó Beto por última vez.
insert into public.group_expenses (id, group_id, date, description, amount, currency, payer_member_id, split_mode, created_by, updated_by, updated_at) values
  ('ab000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '2026-09-20', 'Asado', 90000, 'ARS',
   'e0000000-0000-4000-8000-000000000001', 'equal', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', '2026-09-23 12:00+00'),
  ('ab000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000002', '2026-09-21', 'Pizza', 3000, 'ARS',
   'e0000000-0000-4000-8000-000000000012', 'equal', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '2026-09-23 12:00+00');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 1),
  ('90000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 1),
  ('90000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 1),
  ('90000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000011', 1),
  ('90000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000012', 1);
insert into public.group_payments (group_id, from_member_id, to_member_id, amount, date, created_by) values
  ('90000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 10000, '2026-09-22',
   'a0000000-0000-4000-8000-000000000001');
-- Un gasto propio que vino del grupo y una palabra aprendida.
insert into public.movements (user_id, type, date, description, amount, currency, account_id, group_expense_id, my_share) values
  ('a0000000-0000-4000-8000-000000000001', 'expense', '2026-09-20', 'Asado', 90000, 'ARS', 'a1000000-0000-4000-8000-000000000001',
   'ab000000-0000-4000-8000-000000000001', 30000);
insert into public.category_keywords (user_id, word, category_id) values
  ('a0000000-0000-4000-8000-000000000001', 'chino', '00000000-0000-4000-8000-000000000001');
insert into public.notifications (user_id, title, body) values
  ('a0000000-0000-4000-8000-000000000001', 'Cierre', 'Mañana cierra la Amex.');

create temp table group_balances_before as
select g.id as group_id, b.member_id, b.balance_minor
from public.groups g cross join lateral private.group_balances(g.id) b;
grant select on group_balances_before to authenticated;

-- ═════════════════════════ export_account ═════════════════════════

set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', 'a0000000-0000-4000-8000-000000000001', 'role', 'authenticated',
  'iat', extract(epoch from now())::bigint,
  'amr', json_build_array(json_build_object('method', 'otp', 'timestamp', extract(epoch from now())::bigint - 60)))::text, true);

-- export_account es security definer: lee la sesión de los claims, no del rol.
reset role;
create temp table export as select public.export_account() as e;
grant select on export to authenticated;
set local role authenticated;

select is(
  (select array_agg(k order by k) from export, jsonb_object_keys(e) k),
  array['accounts', 'alerts', 'cards', 'category_keywords', 'exported_at', 'groups', 'movements', 'notifications',
        'statement_overrides', 'statement_payments', 'user', 'version'],
  'el export trae todas las secciones'
);
select is(
  (select row(e -> 'user' ->> 'email', jsonb_array_length(e -> 'accounts'), jsonb_array_length(e -> 'cards'),
              jsonb_array_length(e -> 'statement_payments'), jsonb_array_length(e -> 'category_keywords'),
              jsonb_array_length(e -> 'notifications'), e -> 'user' -> 'settings' ->> 'fx_reference')::text from export),
  row('ana@test.local', 2, 3, 1, 1, 1, 'mep')::text,
  'trae los datos personales de Ana'
);
select is(
  (select jsonb_typeof(e -> 'accounts' -> 0 -> 'opening_balance') || ' ' || jsonb_typeof(e -> 'movements' -> 0 -> 'amount') from export),
  'string string',
  'los montos van como texto'
);
select ok(
  (select e::text not like '%beto.mp%' and e::text not like '%b0000000-0000-4000-8000-000000000002%' from export),
  'no trae el alias ni el user_id de Beto'
);
select ok(
  (select e::text like '%ana.mp%' from export),
  'trae el alias de Ana'
);
select is(
  (select row(jsonb_array_length(g -> 'members'), jsonb_array_length(g -> 'expenses'), jsonb_array_length(g -> 'payments'),
              g -> 'me' ->> 'payment_alias')::text
   from export, jsonb_array_elements(e -> 'groups') g where g ->> 'name' = 'Cabaña'),
  row(3, 1, 1, 'ana.mp')::text,
  'un grupo activo va como lo ve en la app'
);
select is(
  (select (g ? 'expenses')::text || ' ' || (g ? 'members')::text || ' ' || (g -> 'me' ->> 'left_at' is not null)::text
   from export, jsonb_array_elements(e -> 'groups') g where g ->> 'name' = 'Viejo'),
  'false false true',
  'un grupo que dejó va solo con el nombre y su lugar'
);
select ok(
  (select not (e::text like '%"user_id"%' or e::text like '%"created_by"%') from export),
  'ninguna fila trae user_id ni created_by'
);

-- ═════════════════════════ delete_account: sesión ═════════════════════════

-- Login de hace 11 minutos con un refresh de hace 1: iat no alcanza.
select set_config('request.jwt.claims', json_build_object(
  'sub', 'a0000000-0000-4000-8000-000000000001', 'role', 'authenticated',
  'iat', extract(epoch from now())::bigint - 60,
  'amr', json_build_array(json_build_object('method', 'otp', 'timestamp', extract(epoch from now())::bigint - 660)))::text, true);
select throws_ok($$select public.delete_account()$$, '42501', 'reauthentication required',
  'con el código ingresado hace 11 minutos pide volver a ingresar, aunque el iat sea reciente');

select set_config('request.jwt.claims', json_build_object(
  'sub', 'a0000000-0000-4000-8000-000000000001', 'role', 'authenticated', 'iat', extract(epoch from now())::bigint)::text, true);
select throws_ok($$select public.delete_account()$$, '42501', 'reauthentication required', 'sin amr no borra');

select set_config('request.jwt.claims', json_build_object(
  'sub', 'a0000000-0000-4000-8000-000000000001', 'role', 'authenticated',
  'amr', json_build_array(json_build_object('method', 'oauth', 'timestamp', extract(epoch from now())::bigint)))::text, true);
select throws_ok($$select public.delete_account()$$, '42501', 'reauthentication required', 'otro método de login no cuenta');

select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok($$select public.delete_account()$$, '42501', 'not authenticated', 'sin sesión no borra');
select throws_ok($$select public.export_account()$$, '42501', 'not authenticated', 'sin sesión no exporta');

reset role;
select is((select count(*)::int from auth.users where id = 'a0000000-0000-4000-8000-000000000001'), 1, 'Ana sigue existiendo');

-- ═════════════════════════ delete_account ═════════════════════════

set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', 'a0000000-0000-4000-8000-000000000001', 'role', 'authenticated',
  'iat', extract(epoch from now())::bigint,
  'amr', json_build_array(json_build_object('method', 'otp', 'timestamp', extract(epoch from now())::bigint - 120)))::text, true);
select lives_ok($$select public.delete_account()$$, 'con el código ingresado hace 2 minutos, borra');
reset role;

select is(
  (select sum(n)::int from (
     select count(*) as n from auth.users where id = 'a0000000-0000-4000-8000-000000000001'
     union all select count(*) from public.user_settings where user_id = 'a0000000-0000-4000-8000-000000000001'
     union all select count(*) from public.accounts where user_id = 'a0000000-0000-4000-8000-000000000001'
     union all select count(*) from public.cards where user_id = 'a0000000-0000-4000-8000-000000000001'
     union all select count(*) from public.statement_overrides where user_id = 'a0000000-0000-4000-8000-000000000001'
     union all select count(*) from public.statement_payments where user_id = 'a0000000-0000-4000-8000-000000000001'
     union all select count(*) from public.movements where user_id = 'a0000000-0000-4000-8000-000000000001'
     union all select count(*) from public.category_keywords where user_id = 'a0000000-0000-4000-8000-000000000001'
     union all select count(*) from public.categories where user_id = 'a0000000-0000-4000-8000-000000000001'
     union all select count(*) from public.alerts where user_id = 'a0000000-0000-4000-8000-000000000001'
     union all select count(*) from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000001'
     union all select count(*) from public.group_members where user_id = 'a0000000-0000-4000-8000-000000000001'
  ) t),
  0,
  'T-26: no queda nada personal de Ana'
);
select is(
  (select array_agg(row(display_name, user_id, payment_alias, claimed_at)::text order by id)
   from public.group_members where id in ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000011',
                                          'e0000000-0000-4000-8000-000000000021')),
  array[row('Ana', null::uuid, null::text, null::timestamptz)::text, row('Ana', null::uuid, null::text, null::timestamptz)::text,
        row('Ana', null::uuid, null::text, null::timestamptz)::text],
  'en cada grupo su lugar queda sin cuenta, con el mismo nombre y sin alias'
);
select is_empty(
  $$select group_id, member_id, balance_minor from group_balances_before
    except
    select g.id, b.member_id, b.balance_minor from public.groups g cross join lateral private.group_balances(g.id) b$$,
  'T-26: los saldos de todos en sus grupos no cambian'
);
select is(
  (select row(
     (select count(*) from public.group_expenses where group_id = '90000000-0000-4000-8000-000000000001'),
     (select count(*) from public.group_expense_parts where group_id = '90000000-0000-4000-8000-000000000001'),
     (select count(*) from public.group_payments where group_id = '90000000-0000-4000-8000-000000000001'),
     (select created_by from public.group_expenses where id = 'ab000000-0000-4000-8000-000000000001'))::text),
  row(1, 3, 1, null::uuid)::text,
  'los gastos, partes y pagos del grupo siguen, sin el created_by de Ana'
);
select is(
  (select array_agg(row(created_by, updated_by, updated_at)::text order by id) from public.group_expenses
   where id in ('ab000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000002')),
  array[row(null::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid, '2026-09-23 12:00+00'::timestamptz)::text,
        row(null::uuid, null::uuid, '2026-09-23 12:00+00'::timestamptz)::text],
  'borrar a Ana no cuenta como edición: se conserva quién editó por última vez y cuándo'
);
select is(
  (select owner_member_id from public.groups where id = '90000000-0000-4000-8000-000000000001'),
  'e0000000-0000-4000-8000-000000000002'::uuid,
  'Beto, el otro integrante con cuenta, es el nuevo dueño de Cabaña'
);
select is(
  (select owner_member_id from public.groups where id = '90000000-0000-4000-8000-000000000002'),
  null::uuid,
  'sin nadie más con cuenta, Solo Ana queda sin dueño'
);
select is(
  (select owner_member_id from public.groups where id = '90000000-0000-4000-8000-000000000003'),
  'e0000000-0000-4000-8000-000000000022'::uuid,
  'en un grupo donde no era dueña, el dueño no cambia'
);
select is(
  (select count(*)::int from public.notifications
   where user_id = 'b0000000-0000-4000-8000-000000000002' and title = 'Beto es el nuevo dueño de Cabaña'),
  1,
  'a Beto le llega el aviso de que es el nuevo dueño'
);
select is(
  (select row(
     (select count(*) from public.accounts where user_id = 'b0000000-0000-4000-8000-000000000002'),
     (select count(*) from public.movements where user_id = 'b0000000-0000-4000-8000-000000000002'),
     (select payment_alias from public.group_members where id = 'e0000000-0000-4000-8000-000000000002'))::text),
  row(1, 1, 'beto.mp')::text,
  'lo de Beto no se toca'
);
select ok(
  (select private.group_snapshot('90000000-0000-4000-8000-000000000001') -> 'members' @> '[{"display_name": "Ana", "has_account": false}]'),
  'los demás ven a Ana como integrante sin cuenta'
);

-- ═════════════════════════ Permisos y cron ═════════════════════════

select ok(
  not has_function_privilege('authenticated', 'private.purge_archived_cards()', 'execute')
  and not has_function_privilege('authenticated', 'private.recent_login()', 'execute')
  and not has_function_privilege('authenticated', 'private.group_snapshot(uuid)', 'execute'),
  'la app no ejecuta la purga ni las funciones internas'
);
select ok(
  has_function_privilege('authenticated', 'public.delete_account()', 'execute')
  and has_function_privilege('authenticated', 'public.export_account()', 'execute')
  and not has_function_privilege('anon', 'public.delete_account()', 'execute')
  and not has_function_privilege('anon', 'public.export_account()', 'execute'),
  'borrar y exportar: solo con sesión'
);
select ok(
  not has_table_privilege('authenticated', 'private.job_failures', 'select')
  and not has_table_privilege('anon', 'private.job_failures', 'select'),
  'la app no lee job_failures'
);
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where oid in ('public.delete_account()'::regprocedure, 'public.export_account()'::regprocedure,
                 'private.purge_archived_cards()'::regprocedure)),
  'delete_account, export_account y la purga: security definer y search_path fijo'
);
select is(
  (select schedule || ' ' || command from cron.job where jobname = 'purge-archived-cards'),
  '30 6 * * * select private.purge_archived_cards()',
  'la purga corre todos los días a las 3:30 de Argentina'
);

select * from finish();
rollback;
