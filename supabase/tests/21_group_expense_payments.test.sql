-- "¿Ya lo pagaste?" con un gasto de grupo (9/10): save_group_expense_with_movement
-- guarda el gasto, tu movimiento y los pagos nuevos de la tarjeta en una transacción.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'vos@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'ana@test.local');
insert into public.accounts (id, user_id, name, type, currency) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Caja Galicia', 'bank', 'ARS');
insert into public.cards (id, user_id, bank, name, network, last4, close_day, due_day, credit_limit) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Galicia', 'Visa', 'VISA', '4532', 30, 10, 2000000);
insert into public.groups (id, name, currency) values ('90000000-0000-4000-8000-000000000001', 'Cabaña', 'ARS');
insert into public.group_members (id, group_id, user_id, display_name, joined_at) values
  ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Vos', '2026-10-01 10:00-03'),
  ('e0000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Ana', '2026-10-01 10:01-03');
update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000001' where id = '90000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- Ejemplo de 02 §3: el resumen de septiembre ya estaba pagado. El 5/10 cargás "28/09 12000 farmacia visa"
-- en el grupo, contestás "Sí" y se registra un pago nuevo de $12.000 desde la caja, con fecha 6/10.
create temp table call (sql text);
insert into call values ($$select public.save_group_expense_with_movement('ab000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000001', '2026-09-28', 'Farmacia', 12000, 'ARS', null, 'e0000000-0000-4000-8000-000000000001',
  'equal', '00000000-0000-4000-8000-000000000002',
  '[{"member_id": "e0000000-0000-4000-8000-000000000001"}, {"member_id": "e0000000-0000-4000-8000-000000000002"}]',
  '{"id": "a3000000-0000-4000-8000-000000000001", "card_id": "a2000000-0000-4000-8000-000000000001", "installments": 1}',
  '[{"id": "a4000000-0000-4000-8000-000000000001", "period": "2026-09-01", "applies_to": "ARS", "amount": "12000.00",
     "from_account_id": "a1000000-0000-4000-8000-000000000001", "debited_amount": "12000.00", "paid_on": "2026-10-06"}]')$$);
grant select on call to authenticated;

select lives_ok((select sql from call), 'guarda el gasto de grupo con el pago');
select results_eq(
  $$select card_id, period, amount, from_account_id, (paid_at at time zone 'America/Argentina/Buenos_Aires')::date
    from public.statement_payments where id = 'a4000000-0000-4000-8000-000000000001'$$,
  $$values ('a2000000-0000-4000-8000-000000000001'::uuid, '2026-09-01'::date, 12000.00::numeric,
            'a1000000-0000-4000-8000-000000000001'::uuid, '2026-10-06'::date)$$,
  'el pago queda en la Visa, resumen de septiembre, $12.000 desde la caja el 6/10'
);

select lives_ok((select sql from call), 'el reintento no falla');
select is((select count(*)::int from public.statement_payments), 1, 'y no duplica el pago');

-- Sin tu movimiento con tarjeta no hay resumen al que pagarle.
select throws_ok(
  $$select public.save_group_expense_with_movement('ab000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000001', '2026-09-28', 'Nafta', 10000, 'ARS', null, 'e0000000-0000-4000-8000-000000000001',
    'equal', null, '[{"member_id": "e0000000-0000-4000-8000-000000000001"}]', null,
    '[{"period": "2026-09-01", "applies_to": "ARS", "amount": "10000.00",
       "from_account_id": "a1000000-0000-4000-8000-000000000001", "debited_amount": "10000.00", "paid_on": "2026-10-06"}]')$$,
  '22023', 'payments need a card expense', 'pagos sin tu gasto con tarjeta: error'
);

select * from finish();
rollback;
