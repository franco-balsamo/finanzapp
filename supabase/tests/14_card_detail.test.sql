-- Detalle de tarjeta (D-1): límite obligatorio, set_favorite_card y
-- save_expense_with_payments con el ejemplo de R3-3 (02 §3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Ana (a…01) y Beto (b…02).
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'beto@test.local');

insert into public.accounts (id, user_id, name, type, currency, opening_balance) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Caja Galicia', 'bank', 'ARS', 500000),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Mercado Pago', 'wallet', 'ARS', 200000),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Caja Beto', 'bank', 'ARS', 0);

-- Visa de Ana: cierra el 30 y vence el 10 (ejemplo de R3-3).
insert into public.cards (id, user_id, bank, name, network, last4, close_day, due_day, credit_limit, is_favorite) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Galicia', 'Visa', 'VISA', '4532', 30, 10, 2000000, true),
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'BBVA', 'Master', 'MC', '0763', 24, 6, 1000000, false),
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Nación', 'Visa Beto', 'VISA', '1111', 30, 10, 1000000, true);

-- Resumen de septiembre: $100.000, pagado con $60.000 (Galicia, 3/10) y $40.000 (Mercado Pago, 6/10).
insert into public.movements (id, user_id, type, date, description, amount, currency, card_id) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'expense', '2026-09-15', 'heladera', 100000, 'ARS', 'a2000000-0000-4000-8000-000000000001');
insert into public.statement_payments (user_id, card_id, period, applies_to, amount, from_account_id, debited_amount, paid_at) values
  ('a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', '2026-09-01', 'ARS', 60000, 'a1000000-0000-4000-8000-000000000001', 60000, '2026-10-03 12:00-03'),
  ('a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', '2026-09-01', 'ARS', 40000, 'a1000000-0000-4000-8000-000000000002', 40000, '2026-10-06 12:00-03');

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- ── Límite obligatorio ──
select throws_ok(
  $$insert into public.cards (bank, name, network, last4, close_day, due_day) values ('ICBC', 'Visa ICBC', 'VISA', '2222', 24, 6)$$,
  '23514', null, 'Una tarjeta nueva sin límite no se guarda'
);
select throws_ok(
  $$insert into public.cards (bank, name, network, last4, close_day, due_day, credit_limit) values ('ICBC', 'Visa ICBC', 'VISA', '2222', 24, 6, 0)$$,
  '23514', null, 'Con límite 0 tampoco'
);
select throws_ok(
  $$update public.cards set credit_limit = null where id = 'a2000000-0000-4000-8000-000000000002'$$,
  '23514', null, 'Editar una tarjeta no puede dejarla sin límite'
);

-- ── set_favorite_card ──
select lives_ok($$select public.set_favorite_card('a2000000-0000-4000-8000-000000000002')$$, 'Ana marca la Master como favorita');
select results_eq(
  $$select id from public.cards where is_favorite$$,
  $$values ('a2000000-0000-4000-8000-000000000002'::uuid)$$,
  'Queda una sola favorita, la Master'
);
select throws_ok(
  $$select public.set_favorite_card('b2000000-0000-4000-8000-000000000001')$$,
  'P0002', 'card not found', 'Ana no puede marcar una tarjeta de Beto'
);

-- ── save_expense_with_payments: ejemplo de R3-3 ──
select is(
  public.save_expense_with_payments(
    '{"id": "a3000000-0000-4000-8000-000000000002", "origin": "text", "date": "2026-09-28", "description": "farmacia",
      "amount": "12000.00", "currency": "ARS", "card_id": "a2000000-0000-4000-8000-000000000001", "installments": 1,
      "category_id": "00000000-0000-4000-8000-000000000006"}',
    '[{"period": "2026-09-01", "applies_to": "ARS", "amount": "12000.00", "from_account_id": "a1000000-0000-4000-8000-000000000002",
       "debited_amount": "12000.00", "fx_card_rate": null, "paid_on": "2026-10-06"}]'
  ),
  true,
  'Guarda el gasto de $12.000 y el pago nuevo'
);
select is(
  (select sum(amount) from public.statement_payments
    where card_id = 'a2000000-0000-4000-8000-000000000001' and period = '2026-09-01' and reverted_at is null),
  112000.00,
  'El resumen de septiembre queda pagado: $112.000'
);
select is(
  (select sum(debited_amount) from public.statement_payments where from_account_id = 'a1000000-0000-4000-8000-000000000002'),
  52000.00,
  'Mercado Pago (la cuenta del último pago) baja $12.000 más'
);
select is(
  (select (paid_at at time zone 'America/Argentina/Buenos_Aires')::date from public.statement_payments where amount = 12000),
  '2026-10-06'::date,
  'El pago nuevo lleva la fecha del último pago (6/10, en hora de Argentina)'
);

-- Reintento con el mismo id: no duplica nada.
select is(
  public.save_expense_with_payments(
    '{"id": "a3000000-0000-4000-8000-000000000002", "date": "2026-09-28", "description": "farmacia", "amount": "12000.00",
      "currency": "ARS", "card_id": "a2000000-0000-4000-8000-000000000001"}',
    '[{"period": "2026-09-01", "applies_to": "ARS", "amount": "12000.00", "from_account_id": "a1000000-0000-4000-8000-000000000002",
       "debited_amount": "12000.00", "paid_on": "2026-10-06"}]'
  ),
  false,
  'El reintento devuelve false'
);
select is(
  (select count(*)::int from public.statement_payments where card_id = 'a2000000-0000-4000-8000-000000000001'),
  3,
  'Y no suma otro pago'
);

-- Pago desde una cuenta ajena: falla y tampoco queda el gasto.
select throws_ok(
  $$select public.save_expense_with_payments(
    '{"id": "a3000000-0000-4000-8000-000000000003", "date": "2026-09-28", "description": "otra", "amount": "5000.00",
      "currency": "ARS", "card_id": "a2000000-0000-4000-8000-000000000001"}',
    '[{"period": "2026-09-01", "applies_to": "ARS", "amount": "5000.00", "from_account_id": "b1000000-0000-4000-8000-000000000001",
       "debited_amount": "5000.00", "paid_on": "2026-10-06"}]')$$,
  '23503', null, 'Un pago desde una cuenta de Beto falla'
);
select is(
  (select count(*)::int from public.movements where id = 'a3000000-0000-4000-8000-000000000003'),
  0,
  'Y el gasto tampoco queda guardado'
);

select * from finish();
rollback;
