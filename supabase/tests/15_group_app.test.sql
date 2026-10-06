-- Grupos en la app (G-1): save_group_expense_with_movement, las reglas de D5 y D6,
-- delete_group_expense, register_group_payment y void_group_payment con movimiento.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Vos (a…01) y Ana (b…02) tienen cuenta; Juan es provisorio. Ejemplo de 02 §7.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'vos@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'ana@test.local');

insert into public.accounts (id, user_id, name, type, currency) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Caja Galicia', 'bank', 'ARS'),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Caja USD', 'bank', 'USD'),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Caja Ana', 'bank', 'ARS');
insert into public.cards (id, user_id, bank, name, network, last4, close_day, due_day, credit_limit) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Galicia', 'Visa', 'VISA', '4532', 24, 6, 2000000);

insert into public.groups (id, name, currency) values ('90000000-0000-4000-8000-000000000001', 'Cabaña', 'ARS');
insert into public.group_members (id, group_id, user_id, display_name, joined_at) values
  ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Vos', '2026-10-01 10:00-03'),
  ('e0000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Ana', '2026-10-01 10:01-03'),
  ('e0000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', null, 'Juan', '2026-10-01 10:02-03');
update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000001' where id = '90000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- ── Gasto que pagaste vos, con tu movimiento (D3) ──
select is(
  public.save_group_expense_with_movement('ab000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
    '2026-10-02', 'Súper', 90000, 'ARS', null, 'e0000000-0000-4000-8000-000000000001', 'equal', '00000000-0000-4000-8000-000000000002',
    '[{"member_id": "e0000000-0000-4000-8000-000000000001"}, {"member_id": "e0000000-0000-4000-8000-000000000002"},
      {"member_id": "e0000000-0000-4000-8000-000000000003"}]',
    '{"id": "a3000000-0000-4000-8000-000000000001", "card_id": "a2000000-0000-4000-8000-000000000001", "installments": 1}'),
  'ab000000-0000-4000-8000-000000000001'::uuid,
  'Vos pagás $90.000 con la Visa en partes iguales'
);
select results_eq(
  $$select amount, my_share, card_id, group_expense_id from public.movements where id = 'a3000000-0000-4000-8000-000000000001'$$,
  $$values (90000.00::numeric, 30000.00::numeric, 'a2000000-0000-4000-8000-000000000001'::uuid, 'ab000000-0000-4000-8000-000000000001'::uuid)$$,
  'tu movimiento: $90.000 en la Visa y tu parte $30.000'
);

-- Reintento con los mismos ids.
select lives_ok(
  $$select public.save_group_expense_with_movement('ab000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
    '2026-10-02', 'Súper', 90000, 'ARS', null, 'e0000000-0000-4000-8000-000000000001', 'equal', '00000000-0000-4000-8000-000000000002',
    '[{"member_id": "e0000000-0000-4000-8000-000000000001"}, {"member_id": "e0000000-0000-4000-8000-000000000002"},
      {"member_id": "e0000000-0000-4000-8000-000000000003"}]',
    '{"id": "a3000000-0000-4000-8000-000000000001", "card_id": "a2000000-0000-4000-8000-000000000001", "installments": 1}')$$,
  'el reintento no falla'
);
select is(
  (select count(*)::int from public.movements where group_expense_id = 'ab000000-0000-4000-8000-000000000001'),
  1,
  'y no duplica el movimiento'
);

-- ── Ana: gasto propio sin sumarlo a sus finanzas, y la regla de D5 ──
set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select lives_ok(
  $$select public.save_group_expense_with_movement('ab000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001',
    '2026-10-03', 'Nafta', 30000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'exact', null,
    '[{"member_id": "e0000000-0000-4000-8000-000000000002", "value": "10000"}, {"member_id": "e0000000-0000-4000-8000-000000000003", "value": "20000"}]',
    null)$$,
  'Ana paga $30.000 en montos exactos, sin sumarlo a sus finanzas'
);
select is(
  (select count(*)::int from public.movements where group_expense_id = 'ab000000-0000-4000-8000-000000000002'),
  0,
  'sin movimiento para nadie'
);
select throws_ok(
  $$select public.save_group_expense_with_movement('ab000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001',
    '2026-10-03', 'Otro', 1000, 'ARS', null, 'e0000000-0000-4000-8000-000000000001', 'equal', null,
    '[{"member_id": "e0000000-0000-4000-8000-000000000001"}]',
    '{"id": "b3000000-0000-4000-8000-000000000001", "account_id": "b1000000-0000-4000-8000-000000000001"}')$$,
  '22023', 'only the payer can add the expense to their finances',
  'Ana no puede sumar a sus finanzas un gasto que pagó Vos'
);
select lives_ok(
  $$select public.save_group_expense_with_movement('ab000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
    '2026-10-02', 'Súper', 90000, 'ARS', null, 'e0000000-0000-4000-8000-000000000001', 'equal', '00000000-0000-4000-8000-000000000002',
    '[{"member_id": "e0000000-0000-4000-8000-000000000001"}, {"member_id": "e0000000-0000-4000-8000-000000000002"}]', null)$$,
  'D5: Ana saca a Juan de la división del gasto de Vos'
);
select throws_ok(
  $$select public.save_group_expense_with_movement('ab000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
    '2026-10-02', 'Súper', 80000, 'ARS', null, 'e0000000-0000-4000-8000-000000000001', 'equal', '00000000-0000-4000-8000-000000000002',
    '[{"member_id": "e0000000-0000-4000-8000-000000000001"}, {"member_id": "e0000000-0000-4000-8000-000000000002"}]', null)$$,
  '42501', 'only the payer can change the amount, currency or payer',
  'D5: Ana no puede cambiar el monto'
);
select throws_ok(
  $$select public.save_group_expense('ab000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
    '2026-10-02', 'Súper', 80000, 'ARS', null, 'e0000000-0000-4000-8000-000000000001', 'equal', null,
    '[{"member_id": "e0000000-0000-4000-8000-000000000001"}]')$$,
  '42501', 'only the payer can change the amount, currency or payer',
  'D5 vale también con save_group_expense'
);

-- ── Vos ve el resultado y cambia el monto ──
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select my_share from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  45000.00,
  'tu parte se recalcula a $45.000'
);
select lives_ok(
  $$select public.save_group_expense_with_movement('ab000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
    '2026-10-02', 'Súper', 99000, 'ARS', null, 'e0000000-0000-4000-8000-000000000001', 'equal', '00000000-0000-4000-8000-000000000002',
    '[{"member_id": "e0000000-0000-4000-8000-000000000001"}, {"member_id": "e0000000-0000-4000-8000-000000000002"}]',
    '{"id": "a3000000-0000-4000-8000-000000000001", "card_id": "a2000000-0000-4000-8000-000000000001", "installments": 3}')$$,
  'Vos sí cambia el monto'
);
select results_eq(
  $$select amount, my_share, installments from public.movements where id = 'a3000000-0000-4000-8000-000000000001'$$,
  $$values (99000.00::numeric, 49500.00::numeric, 3::smallint)$$,
  'tu movimiento queda en $99.000, en 3 cuotas, con tu parte $49.500'
);

-- ── Borrar (D6) ──
select lives_ok(
  $$select public.delete_group_expense('ab000000-0000-4000-8000-000000000001')$$,
  'borrar el gasto de grupo'
);
select results_eq(
  $$select group_expense_id, my_share, amount from public.movements where id = 'a3000000-0000-4000-8000-000000000001'$$,
  $$values (null::uuid, null::numeric, 99000.00::numeric)$$,
  'tu movimiento queda, sin vínculo: vuelve a contar completo'
);

-- El borrado directo (update de deleted_at) también desvincula.
select lives_ok(
  $$select public.save_group_expense_with_movement('ab000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000001',
    '2026-10-04', 'Leña', 6000, 'ARS', null, 'e0000000-0000-4000-8000-000000000001', 'equal', null,
    '[{"member_id": "e0000000-0000-4000-8000-000000000001"}, {"member_id": "e0000000-0000-4000-8000-000000000002"}]',
    '{"id": "a3000000-0000-4000-8000-000000000002", "account_id": "a1000000-0000-4000-8000-000000000001"}')$$,
  'otro gasto con tu movimiento desde la caja'
);
update public.group_expenses set deleted_at = now() where id = 'ab000000-0000-4000-8000-000000000004';
select is(
  (select group_expense_id from public.movements where id = 'a3000000-0000-4000-8000-000000000002'),
  null,
  'el update directo de deleted_at también desvincula'
);

-- ── Pagos (D7) ──
select lives_ok(
  $$select public.register_group_payment('70000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 50000, '2026-10-05',
    'a1000000-0000-4000-8000-000000000001')$$,
  'Juan → Vos $50.000, moviendo el saldo a la caja'
);
select public.register_group_payment('70000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 50000, '2026-10-05',
  'a1000000-0000-4000-8000-000000000001');
select results_eq(
  $$select type, amount, account_id, description from public.movements where group_payment_id = '70000000-0000-4000-8000-000000000001'$$,
  $$values ('income'::text, 50000.00::numeric, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Pago de Juan (Cabaña)'::text)$$,
  'un solo ingreso de $50.000 en la caja, aunque se reintente'
);
select public.void_group_payment('70000000-0000-4000-8000-000000000001');
select is(
  (select count(*)::int from public.movements where group_payment_id = '70000000-0000-4000-8000-000000000001'),
  0,
  'anular el pago borra el movimiento de la caja'
);
select lives_ok(
  $$select public.register_group_payment('70000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 10000, '2026-10-05',
    'a1000000-0000-4000-8000-000000000001')$$,
  'Vos → Ana $10.000 desde la caja'
);
select is(
  (select amount from public.movements where group_payment_id = '70000000-0000-4000-8000-000000000002' and type = 'adjustment'),
  -10000.00,
  'si pagás, un ajuste negativo (no cuenta en la categoría)'
);
select throws_ok(
  $$select public.register_group_payment(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 100, '2026-10-05',
    'a1000000-0000-4000-8000-000000000002')$$,
  '22023', 'account must be yours and in the group currency',
  'una cuenta en dólares en un grupo en pesos falla'
);

set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$select public.register_group_payment(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 100, '2026-10-05',
    'b1000000-0000-4000-8000-000000000001')$$,
  '22023', 'only who pays or who gets paid can move an account balance',
  'Ana no mueve su caja con un pago entre Juan y Vos'
);

select * from finish();
rollback;
