-- GENERADO por `pnpm gen:sql-fixtures` desde packages/core/fixtures/group-balances.json.
-- No lo edites a mano: cambiá el JSON y volvé a correr el script.
-- Los saldos en SQL (private.member_shares y private.group_balances) tienen que dar
-- lo mismo que shares() y groupBalances() de core, que leen el mismo JSON en Vitest.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- 1. Ejemplo de 02 §7: Vos +60.000, Ana −10.000, Juan −50.000 (T-10)
insert into public.groups (id, name, currency) values ('90000000-0000-4000-8000-000000000001', 'caso 1', 'ARS');
insert into public.group_members (id, group_id, display_name, joined_at) values
  ('e0000000-0000-4000-8000-000001000001', '90000000-0000-4000-8000-000000000001', 'vos', now() + interval '0 seconds'),
  ('e0000000-0000-4000-8000-000001000002', '90000000-0000-4000-8000-000000000001', 'ana', now() + interval '1 seconds'),
  ('e0000000-0000-4000-8000-000001000003', '90000000-0000-4000-8000-000000000001', 'juan', now() + interval '2 seconds');
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000001000001', '90000000-0000-4000-8000-000000000001', '2026-10-01', 'g1', 90000.00, 'ARS', null, 'e0000000-0000-4000-8000-000001000001', 'equal');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000001000001', 'e0000000-0000-4000-8000-000001000001', 1),
  ('90000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000001000001', 'e0000000-0000-4000-8000-000001000002', 1),
  ('90000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000001000001', 'e0000000-0000-4000-8000-000001000003', 1);
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000001000002', '90000000-0000-4000-8000-000000000001', '2026-10-01', 'g2', 30000.00, 'ARS', null, 'e0000000-0000-4000-8000-000001000002', 'exact');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000001000002', 'e0000000-0000-4000-8000-000001000002', 10000.00),
  ('90000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000001000002', 'e0000000-0000-4000-8000-000001000003', 20000.00);
select is(
  (select jsonb_object_agg(m.display_name, b.balance_minor)
   from private.group_balances('90000000-0000-4000-8000-000000000001') b join public.group_members m on m.id = b.member_id),
  '{"vos":6000000,"ana":-1000000,"juan":-5000000}'::jsonb,
  'Ejemplo de 02 §7: Vos +60.000, Ana −10.000, Juan −50.000 (T-10): saldos'
);

-- 2. Un pago de Juan a Vos baja la deuda
insert into public.groups (id, name, currency) values ('90000000-0000-4000-8000-000000000002', 'caso 2', 'ARS');
insert into public.group_members (id, group_id, display_name, joined_at) values
  ('e0000000-0000-4000-8000-000002000001', '90000000-0000-4000-8000-000000000002', 'vos', now() + interval '0 seconds'),
  ('e0000000-0000-4000-8000-000002000002', '90000000-0000-4000-8000-000000000002', 'ana', now() + interval '1 seconds'),
  ('e0000000-0000-4000-8000-000002000003', '90000000-0000-4000-8000-000000000002', 'juan', now() + interval '2 seconds');
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000002000001', '90000000-0000-4000-8000-000000000002', '2026-10-01', 'g1', 90000.00, 'ARS', null, 'e0000000-0000-4000-8000-000002000001', 'equal');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000002000001', 'e0000000-0000-4000-8000-000002000001', 1),
  ('90000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000002000001', 'e0000000-0000-4000-8000-000002000002', 1),
  ('90000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000002000001', 'e0000000-0000-4000-8000-000002000003', 1);
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000002000002', '90000000-0000-4000-8000-000000000002', '2026-10-01', 'g2', 30000.00, 'ARS', null, 'e0000000-0000-4000-8000-000002000002', 'exact');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000002000002', 'e0000000-0000-4000-8000-000002000002', 10000.00),
  ('90000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000002000002', 'e0000000-0000-4000-8000-000002000003', 20000.00);
insert into public.group_payments (id, group_id, from_member_id, to_member_id, amount, date, deleted_at) values
  ('70000000-0000-4000-8000-000002000001', '90000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000002000003', 'e0000000-0000-4000-8000-000002000001', 50000.00, '2026-10-02', null);
select is(
  (select jsonb_object_agg(m.display_name, b.balance_minor)
   from private.group_balances('90000000-0000-4000-8000-000000000002') b join public.group_members m on m.id = b.member_id),
  '{"vos":1000000,"ana":-1000000,"juan":0}'::jsonb,
  'Un pago de Juan a Vos baja la deuda: saldos'
);

-- 3. Un pago anulado no cuenta
insert into public.groups (id, name, currency) values ('90000000-0000-4000-8000-000000000003', 'caso 3', 'ARS');
insert into public.group_members (id, group_id, display_name, joined_at) values
  ('e0000000-0000-4000-8000-000003000001', '90000000-0000-4000-8000-000000000003', 'vos', now() + interval '0 seconds'),
  ('e0000000-0000-4000-8000-000003000002', '90000000-0000-4000-8000-000000000003', 'ana', now() + interval '1 seconds'),
  ('e0000000-0000-4000-8000-000003000003', '90000000-0000-4000-8000-000000000003', 'juan', now() + interval '2 seconds');
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000003000001', '90000000-0000-4000-8000-000000000003', '2026-10-01', 'g1', 90000.00, 'ARS', null, 'e0000000-0000-4000-8000-000003000001', 'equal');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000003000001', 'e0000000-0000-4000-8000-000003000001', 1),
  ('90000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000003000001', 'e0000000-0000-4000-8000-000003000002', 1),
  ('90000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000003000001', 'e0000000-0000-4000-8000-000003000003', 1);
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000003000002', '90000000-0000-4000-8000-000000000003', '2026-10-01', 'g2', 30000.00, 'ARS', null, 'e0000000-0000-4000-8000-000003000002', 'exact');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000003000002', 'e0000000-0000-4000-8000-000003000002', 10000.00),
  ('90000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000003000002', 'e0000000-0000-4000-8000-000003000003', 20000.00);
insert into public.group_payments (id, group_id, from_member_id, to_member_id, amount, date, deleted_at) values
  ('70000000-0000-4000-8000-000003000001', '90000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000003000003', 'e0000000-0000-4000-8000-000003000001', 50000.00, '2026-10-02', now());
select is(
  (select jsonb_object_agg(m.display_name, b.balance_minor)
   from private.group_balances('90000000-0000-4000-8000-000000000003') b join public.group_members m on m.id = b.member_id),
  '{"vos":6000000,"ana":-1000000,"juan":-5000000}'::jsonb,
  'Un pago anulado no cuenta: saldos'
);

-- 4. $100 entre 3, pagó Ana: Ana $33,34 y el saldo exacto queda guardado (T-12)
insert into public.groups (id, name, currency) values ('90000000-0000-4000-8000-000000000004', 'caso 4', 'ARS');
insert into public.group_members (id, group_id, display_name, joined_at) values
  ('e0000000-0000-4000-8000-000004000001', '90000000-0000-4000-8000-000000000004', 'vos', now() + interval '0 seconds'),
  ('e0000000-0000-4000-8000-000004000002', '90000000-0000-4000-8000-000000000004', 'ana', now() + interval '1 seconds'),
  ('e0000000-0000-4000-8000-000004000003', '90000000-0000-4000-8000-000000000004', 'juan', now() + interval '2 seconds');
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000004000001', '90000000-0000-4000-8000-000000000004', '2026-10-01', 'g1', 100.00, 'ARS', null, 'e0000000-0000-4000-8000-000004000002', 'equal');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000004000001', 'e0000000-0000-4000-8000-000004000001', 1),
  ('90000000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000004000001', 'e0000000-0000-4000-8000-000004000002', 1),
  ('90000000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000004000001', 'e0000000-0000-4000-8000-000004000003', 1);
select is(
  (select jsonb_object_agg(m.display_name, s.share_minor)
   from private.member_shares('ab000000-0000-4000-8000-000004000001') s join public.group_members m on m.id = s.member_id),
  '{"vos":3333,"ana":3334,"juan":3333}'::jsonb,
  '$100 entre 3, pagó Ana: Ana $33,34 y el saldo exacto queda guardado (T-12): partes de g1'
);
select is(
  (select jsonb_object_agg(m.display_name, b.balance_minor)
   from private.group_balances('90000000-0000-4000-8000-000000000004') b join public.group_members m on m.id = b.member_id),
  '{"vos":-3333,"ana":6666,"juan":-3333}'::jsonb,
  '$100 entre 3, pagó Ana: Ana $33,34 y el saldo exacto queda guardado (T-12): saldos'
);

-- 5. Si el que pagó quedó excluido, el resto va al primer incluido (T-13)
insert into public.groups (id, name, currency) values ('90000000-0000-4000-8000-000000000005', 'caso 5', 'ARS');
insert into public.group_members (id, group_id, display_name, joined_at) values
  ('e0000000-0000-4000-8000-000005000001', '90000000-0000-4000-8000-000000000005', 'vos', now() + interval '0 seconds'),
  ('e0000000-0000-4000-8000-000005000002', '90000000-0000-4000-8000-000000000005', 'ana', now() + interval '1 seconds'),
  ('e0000000-0000-4000-8000-000005000003', '90000000-0000-4000-8000-000000000005', 'juan', now() + interval '2 seconds');
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000005000001', '90000000-0000-4000-8000-000000000005', '2026-10-01', 'g1', 0.03, 'ARS', null, 'e0000000-0000-4000-8000-000005000002', 'equal');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000005', 'ab000000-0000-4000-8000-000005000001', 'e0000000-0000-4000-8000-000005000001', 1),
  ('90000000-0000-4000-8000-000000000005', 'ab000000-0000-4000-8000-000005000001', 'e0000000-0000-4000-8000-000005000003', 1);
select is(
  (select jsonb_object_agg(m.display_name, s.share_minor)
   from private.member_shares('ab000000-0000-4000-8000-000005000001') s join public.group_members m on m.id = s.member_id),
  '{"vos":2,"juan":1}'::jsonb,
  'Si el que pagó quedó excluido, el resto va al primer incluido (T-13): partes de g1'
);
select is(
  (select jsonb_object_agg(m.display_name, b.balance_minor)
   from private.group_balances('90000000-0000-4000-8000-000000000005') b join public.group_members m on m.id = b.member_id),
  '{"vos":-2,"ana":3,"juan":-1}'::jsonb,
  'Si el que pagó quedó excluido, el resto va al primer incluido (T-13): saldos'
);

-- 6. Montos exactos: la diferencia de hasta $0,50 va al que pagó ($600,40)
insert into public.groups (id, name, currency) values ('90000000-0000-4000-8000-000000000006', 'caso 6', 'ARS');
insert into public.group_members (id, group_id, display_name, joined_at) values
  ('e0000000-0000-4000-8000-000006000001', '90000000-0000-4000-8000-000000000006', 'vos', now() + interval '0 seconds'),
  ('e0000000-0000-4000-8000-000006000002', '90000000-0000-4000-8000-000000000006', 'ana', now() + interval '1 seconds'),
  ('e0000000-0000-4000-8000-000006000003', '90000000-0000-4000-8000-000000000006', 'juan', now() + interval '2 seconds');
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000006000001', '90000000-0000-4000-8000-000000000006', '2026-10-01', 'g1', 1000.00, 'ARS', null, 'e0000000-0000-4000-8000-000006000001', 'exact');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000006', 'ab000000-0000-4000-8000-000006000001', 'e0000000-0000-4000-8000-000006000001', 600.00),
  ('90000000-0000-4000-8000-000000000006', 'ab000000-0000-4000-8000-000006000001', 'e0000000-0000-4000-8000-000006000002', 399.60);
select is(
  (select jsonb_object_agg(m.display_name, s.share_minor)
   from private.member_shares('ab000000-0000-4000-8000-000006000001') s join public.group_members m on m.id = s.member_id),
  '{"vos":60040,"ana":39960}'::jsonb,
  'Montos exactos: la diferencia de hasta $0,50 va al que pagó ($600,40): partes de g1'
);
select is(
  (select jsonb_object_agg(m.display_name, b.balance_minor)
   from private.group_balances('90000000-0000-4000-8000-000000000006') b join public.group_members m on m.id = b.member_id),
  '{"vos":39960,"ana":-39960,"juan":0}'::jsonb,
  'Montos exactos: la diferencia de hasta $0,50 va al que pagó ($600,40): saldos'
);

-- 7. US$ 100 a $1.500 en un grupo en pesos: se convierte y después se divide
insert into public.groups (id, name, currency) values ('90000000-0000-4000-8000-000000000007', 'caso 7', 'ARS');
insert into public.group_members (id, group_id, display_name, joined_at) values
  ('e0000000-0000-4000-8000-000007000001', '90000000-0000-4000-8000-000000000007', 'vos', now() + interval '0 seconds'),
  ('e0000000-0000-4000-8000-000007000002', '90000000-0000-4000-8000-000000000007', 'ana', now() + interval '1 seconds'),
  ('e0000000-0000-4000-8000-000007000003', '90000000-0000-4000-8000-000000000007', 'juan', now() + interval '2 seconds');
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000007000001', '90000000-0000-4000-8000-000000000007', '2026-10-01', 'g1', 100.00, 'USD', 1500.00, 'e0000000-0000-4000-8000-000007000001', 'equal');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000007', 'ab000000-0000-4000-8000-000007000001', 'e0000000-0000-4000-8000-000007000001', 1),
  ('90000000-0000-4000-8000-000000000007', 'ab000000-0000-4000-8000-000007000001', 'e0000000-0000-4000-8000-000007000002', 1),
  ('90000000-0000-4000-8000-000000000007', 'ab000000-0000-4000-8000-000007000001', 'e0000000-0000-4000-8000-000007000003', 1);
select is(
  (select jsonb_object_agg(m.display_name, s.share_minor)
   from private.member_shares('ab000000-0000-4000-8000-000007000001') s join public.group_members m on m.id = s.member_id),
  '{"vos":5000000,"ana":5000000,"juan":5000000}'::jsonb,
  'US$ 100 a $1.500 en un grupo en pesos: se convierte y después se divide: partes de g1'
);
select is(
  (select jsonb_object_agg(m.display_name, b.balance_minor)
   from private.group_balances('90000000-0000-4000-8000-000000000007') b join public.group_members m on m.id = b.member_id),
  '{"vos":10000000,"ana":-5000000,"juan":-5000000}'::jsonb,
  'US$ 100 a $1.500 en un grupo en pesos: se convierte y después se divide: saldos'
);

-- 8. US$ 10,01 × 1333,33: las partes suman exacto $13.346,63
insert into public.groups (id, name, currency) values ('90000000-0000-4000-8000-000000000008', 'caso 8', 'ARS');
insert into public.group_members (id, group_id, display_name, joined_at) values
  ('e0000000-0000-4000-8000-000008000001', '90000000-0000-4000-8000-000000000008', 'vos', now() + interval '0 seconds'),
  ('e0000000-0000-4000-8000-000008000002', '90000000-0000-4000-8000-000000000008', 'ana', now() + interval '1 seconds'),
  ('e0000000-0000-4000-8000-000008000003', '90000000-0000-4000-8000-000000000008', 'juan', now() + interval '2 seconds');
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000008000001', '90000000-0000-4000-8000-000000000008', '2026-10-01', 'g1', 10.01, 'USD', 1333.33, 'e0000000-0000-4000-8000-000008000002', 'equal');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000008', 'ab000000-0000-4000-8000-000008000001', 'e0000000-0000-4000-8000-000008000001', 1),
  ('90000000-0000-4000-8000-000000000008', 'ab000000-0000-4000-8000-000008000001', 'e0000000-0000-4000-8000-000008000002', 1),
  ('90000000-0000-4000-8000-000000000008', 'ab000000-0000-4000-8000-000008000001', 'e0000000-0000-4000-8000-000008000003', 1);
select is(
  (select jsonb_object_agg(m.display_name, s.share_minor)
   from private.member_shares('ab000000-0000-4000-8000-000008000001') s join public.group_members m on m.id = s.member_id),
  '{"vos":444887,"ana":444889,"juan":444887}'::jsonb,
  'US$ 10,01 × 1333,33: las partes suman exacto $13.346,63: partes de g1'
);
select is(
  (select jsonb_object_agg(m.display_name, b.balance_minor)
   from private.group_balances('90000000-0000-4000-8000-000000000008') b join public.group_members m on m.id = b.member_id),
  '{"vos":-444887,"ana":889774,"juan":-444887}'::jsonb,
  'US$ 10,01 × 1333,33: las partes suman exacto $13.346,63: saldos'
);

-- 9. Montos exactos en dólares: cada parte se convierte y el resto va al que pagó
insert into public.groups (id, name, currency) values ('90000000-0000-4000-8000-000000000009', 'caso 9', 'ARS');
insert into public.group_members (id, group_id, display_name, joined_at) values
  ('e0000000-0000-4000-8000-000009000001', '90000000-0000-4000-8000-000000000009', 'vos', now() + interval '0 seconds'),
  ('e0000000-0000-4000-8000-000009000002', '90000000-0000-4000-8000-000000000009', 'ana', now() + interval '1 seconds'),
  ('e0000000-0000-4000-8000-000009000003', '90000000-0000-4000-8000-000000000009', 'juan', now() + interval '2 seconds');
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000009000001', '90000000-0000-4000-8000-000000000009', '2026-10-01', 'g1', 10.01, 'USD', 1333.33, 'e0000000-0000-4000-8000-000009000002', 'exact');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000009', 'ab000000-0000-4000-8000-000009000001', 'e0000000-0000-4000-8000-000009000001', 3.33),
  ('90000000-0000-4000-8000-000000000009', 'ab000000-0000-4000-8000-000009000001', 'e0000000-0000-4000-8000-000009000002', 3.34),
  ('90000000-0000-4000-8000-000000000009', 'ab000000-0000-4000-8000-000009000001', 'e0000000-0000-4000-8000-000009000003', 3.34);
select is(
  (select jsonb_object_agg(m.display_name, s.share_minor)
   from private.member_shares('ab000000-0000-4000-8000-000009000001') s join public.group_members m on m.id = s.member_id),
  '{"vos":443999,"ana":445332,"juan":445332}'::jsonb,
  'Montos exactos en dólares: cada parte se convierte y el resto va al que pagó: partes de g1'
);
select is(
  (select jsonb_object_agg(m.display_name, b.balance_minor)
   from private.group_balances('90000000-0000-4000-8000-000000000009') b join public.group_members m on m.id = b.member_id),
  '{"vos":-443999,"ana":889331,"juan":-445332}'::jsonb,
  'Montos exactos en dólares: cada parte se convierte y el resto va al que pagó: saldos'
);

-- Umbral de "al día" (D14)
select is(private.is_settled(99, 'ARS'), true, 'al día: 0.99 ARS → true');
select is(private.is_settled(80, 'ARS'), true, 'al día: 0.80 ARS → true');
select is(private.is_settled(-100, 'ARS'), false, 'al día: -1.00 ARS → false');
select is(private.is_settled(0, 'USD'), true, 'al día: 0.00 USD → true');
select is(private.is_settled(80, 'USD'), false, 'al día: 0.80 USD → false');
select is(private.is_settled(-1, 'USD'), false, 'al día: -0.01 USD → false');

select * from finish();
rollback;
