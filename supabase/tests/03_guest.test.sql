-- T-21: la web de invitados entra solo por get_guest_group(token).
-- No devuelve payment_alias ni user_id, y el rol anónimo no lee ninguna tabla.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'beto@test.local');

insert into public.groups (id, name, currency, invite_token_hash, invite_token_created_at) values
  ('90000000-0000-4000-8000-000000000001', 'Cabaña', 'ARS', encode(sha256(convert_to('token-uno', 'UTF8')), 'hex'), now());
insert into public.group_members (id, group_id, user_id, display_name, payment_alias, left_at) values
  ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Ana', 'ana.alias.secreto', null),
  ('e0000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Beto', 'cbu-secreto-0000', null),
  ('e0000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', null, 'Juan', null, null);
update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000001';
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode, category_id, created_by) values
  ('f0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '2026-10-01', 'Cabaña', 90000, 'ARS', null,
   'e0000000-0000-4000-8000-000000000001', 'equal', '00000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', '2026-10-01', 'Nafta', 20, 'USD', 1500,
   'e0000000-0000-4000-8000-000000000002', 'exact', null, 'b0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', '2026-10-01', 'Borrado', 5000, 'ARS', null,
   'e0000000-0000-4000-8000-000000000002', 'equal', null, 'b0000000-0000-4000-8000-000000000002');
update public.group_expenses set deleted_at = now() where id = 'f0000000-0000-4000-8000-000000000003';
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 1),
  ('90000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 1),
  ('90000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 1),
  ('90000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 10),
  ('90000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003', 10);
insert into public.group_payments (id, group_id, from_member_id, to_member_id, amount, date, created_by) values
  ('70000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000001', 30000, '2026-10-02', 'a0000000-0000-4000-8000-000000000001');

-- ── Invitado sin sesión ──
set local role anon;

create temporary table guest on commit drop as select public.get_guest_group('token-uno') as g;
grant select on guest to anon;

select isnt((select g from guest), null, 'T-21: con el token válido devuelve el grupo');
select is((select g ->> 'name' from guest), 'Cabaña', 'devuelve el nombre');
select is((select g ->> 'currency' from guest), 'ARS', 'devuelve la moneda');
select is(
  (select array_agg(k order by k) from guest, jsonb_object_keys(g) k),
  array['currency', 'expenses', 'members', 'name', 'payments'],
  'el grupo trae solo nombre, moneda, integrantes, gastos y pagos'
);
select is(
  (select array_agg(distinct k order by k) from guest, jsonb_array_elements(g -> 'members') m, jsonb_object_keys(m) k),
  array['active', 'display_name', 'has_account', 'id'],
  'cada integrante trae solo id, nombre, si tiene cuenta y si sigue en el grupo'
);
select is(
  (select array_agg(distinct k order by k) from guest, jsonb_array_elements(g -> 'expenses') e, jsonb_object_keys(e) k),
  array['amount', 'currency', 'date', 'description', 'fx_rate', 'id', 'parts', 'payer_member_id', 'split_mode'],
  'cada gasto trae solo lo necesario para calcular saldos (sin created_by ni categoría)'
);
select is(
  (select array_agg(distinct k order by k) from guest, jsonb_array_elements(g -> 'expenses') e,
     jsonb_array_elements(e -> 'parts') p, jsonb_object_keys(p) k),
  array['member_id', 'value'],
  'cada parte trae solo integrante y valor'
);
select is(
  (select array_agg(distinct k order by k) from guest, jsonb_array_elements(g -> 'payments') p, jsonb_object_keys(p) k),
  array['amount', 'date', 'from_member_id', 'id', 'to_member_id'],
  'cada pago trae solo fecha, de quién, a quién y monto'
);
select ok((select g::text not like '%secreto%' from guest), 'T-21: ningún payment_alias sale en la respuesta');
select ok((select g::text not like '%a0000000-0000-4000-8000-000000000001%' from guest), 'T-21: el user_id de Ana no sale');
select ok((select g::text not like '%b0000000-0000-4000-8000-000000000002%' from guest), 'T-21: el user_id de Beto no sale');
select is((select jsonb_array_length(g -> 'members') from guest), 3, 'trae los 3 integrantes');
select is(
  (select jsonb_agg(m ->> 'has_account' order by m ->> 'display_name') from guest, jsonb_array_elements(g -> 'members') m),
  '["true", "true", "false"]'::jsonb,
  'Juan figura como provisorio, para poder reclamar el lugar'
);
select is((select jsonb_array_length(g -> 'expenses') from guest), 2, 'los gastos borrados no salen');
select is(
  (select e ->> 'amount' from guest, jsonb_array_elements(g -> 'expenses') e where e ->> 'description' = 'Nafta'),
  '20.00',
  'los montos van como texto exacto'
);
select is(
  (select e ->> 'fx_rate' from guest, jsonb_array_elements(g -> 'expenses') e where e ->> 'description' = 'Nafta'),
  '1500.0000',
  'la cotización fija del gasto va como texto exacto'
);

select is(public.get_guest_group('token-equivocado'), null, 'un token equivocado no devuelve nada');
select is(public.get_guest_group(null), null, 'sin token no devuelve nada');
select is(public.get_guest_group(''), null, 'un token vacío no devuelve nada');

-- El rol anónimo no lee ninguna tabla.
select throws_ok($$select 1 from public.user_settings$$, '42501', null, 'anónimo: user_settings');
select throws_ok($$select 1 from public.accounts$$, '42501', null, 'anónimo: accounts');
select throws_ok($$select 1 from public.cards$$, '42501', null, 'anónimo: cards');
select throws_ok($$select 1 from public.statement_overrides$$, '42501', null, 'anónimo: statement_overrides');
select throws_ok($$select 1 from public.statement_payments$$, '42501', null, 'anónimo: statement_payments');
select throws_ok($$select 1 from public.movements$$, '42501', null, 'anónimo: movements');
select throws_ok($$select 1 from public.categories$$, '42501', null, 'anónimo: categories');
select throws_ok($$select 1 from public.category_keywords$$, '42501', null, 'anónimo: category_keywords');
select throws_ok($$select 1 from public.fx_rates$$, '42501', null, 'anónimo: fx_rates');
select throws_ok($$select 1 from public.groups$$, '42501', null, 'anónimo: groups');
select throws_ok($$select 1 from public.group_members$$, '42501', null, 'anónimo: group_members');
select throws_ok($$select 1 from public.group_expenses$$, '42501', null, 'anónimo: group_expenses');
select throws_ok($$select 1 from public.group_expense_parts$$, '42501', null, 'anónimo: group_expense_parts');
select throws_ok($$select 1 from public.group_payments$$, '42501', null, 'anónimo: group_payments');
select throws_ok($$select 1 from public.alerts$$, '42501', null, 'anónimo: alerts');
select throws_ok($$select 1 from public.notifications$$, '42501', null, 'anónimo: notifications');
select throws_ok(
  $$select public.is_group_member('90000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'anónimo no ejecuta is_group_member'
);
select throws_ok($$select public.create_group('Colado', 'ARS', 'Nadie')$$, '42501', null, 'anónimo no ejecuta create_group');

-- ── Token regenerado: el viejo deja de funcionar ──
reset role;
update public.groups set invite_token_hash = encode(sha256(convert_to('token-dos', 'UTF8')), 'hex'), invite_token_created_at = now();
set local role anon;
select is(public.get_guest_group('token-uno'), null, 'T-21: el token viejo ya no devuelve nada');
select isnt(public.get_guest_group('token-dos'), null, 'T-21: el token nuevo sí');

select * from finish();
rollback;
