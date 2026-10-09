-- D5 en la hoja: group_expense_money_locked dice si el trigger group_expenses_guard_money
-- te rechazaría cambiar el monto, la moneda o quién pagó.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Vos (a…01) y Ana (b…02) tienen cuenta; Carla (c…03) no es del grupo.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'vos@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'ana@test.local'),
  ('c0000000-0000-4000-8000-000000000003', 'carla@test.local');

insert into public.cards (id, user_id, bank, name, network, last4, close_day, due_day, credit_limit) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Galicia', 'Visa', 'VISA', '4532', 24, 6, 2000000);

insert into public.groups (id, name, currency) values ('90000000-0000-4000-8000-000000000001', 'Cabaña', 'ARS');
insert into public.group_members (id, group_id, user_id, display_name, joined_at) values
  ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Vos', '2026-10-01 10:00-03'),
  ('e0000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Ana', '2026-10-01 10:01-03');
update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000001' where id = '90000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- Vos pagás $90.000 con la Visa y lo sumás a tus finanzas.
select public.save_group_expense_with_movement('ab000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
  '2026-10-02', 'Súper', 90000, 'ARS', null, 'e0000000-0000-4000-8000-000000000001', 'equal', '00000000-0000-4000-8000-000000000002',
  '[{"member_id": "e0000000-0000-4000-8000-000000000001"}, {"member_id": "e0000000-0000-4000-8000-000000000002"}]',
  '{"id": "a3000000-0000-4000-8000-000000000001", "card_id": "a2000000-0000-4000-8000-000000000001", "installments": 1}');
select is(public.group_expense_money_locked('ab000000-0000-4000-8000-000000000001'), false, 'vos lo tenés en tus finanzas: podés cambiar el monto');

-- Ana paga $40.000 y no lo suma a sus finanzas.
set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.save_group_expense('ab000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001',
  '2026-10-03', 'Nafta', 40000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'equal', null,
  '[{"member_id": "e0000000-0000-4000-8000-000000000001"}, {"member_id": "e0000000-0000-4000-8000-000000000002"}]');
select is(public.group_expense_money_locked('ab000000-0000-4000-8000-000000000001'), true, 'Ana no puede cambiar el monto de tu gasto');

set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select is(public.group_expense_money_locked('ab000000-0000-4000-8000-000000000002'), false,
  'Ana pagó pero no lo tiene en sus finanzas: vos podés cambiar el monto');
select lives_ok(
  $$select public.save_group_expense('ab000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001',
    '2026-10-03', 'Nafta', 45000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'equal', null,
    '[{"member_id": "e0000000-0000-4000-8000-000000000001"}, {"member_id": "e0000000-0000-4000-8000-000000000002"}]')$$,
  'y la base lo acepta'
);

set local request.jwt.claims = '{"sub": "c0000000-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok(
  $$select public.group_expense_money_locked('ab000000-0000-4000-8000-000000000001')$$,
  'P0002', null, 'Carla no es del grupo: no ve el gasto'
);

select * from finish();
rollback;
