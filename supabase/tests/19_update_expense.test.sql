-- Lista de movimientos (L-3): update_expense_with_payments edita un gasto
-- personal, completa un "Sin medio de pago" (L7) y guarda los pagos de
-- "¿Ya lo pagaste?" (L8, 02 §5 "Editar y borrar un gasto").
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Ana (a…01) y Beto (b…02).
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'beto@test.local');

insert into public.accounts (id, user_id, name, type, currency, opening_balance) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Caja Galicia', 'bank', 'ARS', 500000),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Caja Beto', 'bank', 'ARS', 0);

-- Visa de Ana: cierra el 30 y vence el 10 (ejemplo de 02 §5).
insert into public.cards (id, user_id, bank, name, network, last4, close_day, due_day, credit_limit) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Galicia', 'Visa', 'VISA', '4532', 30, 10, 2000000),
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Nación', 'Visa Beto', 'VISA', '1111', 30, 10, 1000000);

-- Cotizaciones de prueba en fechas sin otras filas: MEP $1.100 el 10/3/2025 y $1.200 el 20/3/2025.
insert into public.fx_rates (source, kind, sell, fetched_at) values
  ('test', 'mep', 1100, '2025-03-10 12:00-03'), ('test', 'oficial', 1000, '2025-03-10 12:00-03'), ('test', 'blue', 1150, '2025-03-10 12:00-03'),
  ('test', 'mep', 1200, '2025-03-20 12:00-03'), ('test', 'oficial', 1050, '2025-03-20 12:00-03'), ('test', 'blue', 1250, '2025-03-20 12:00-03');

insert into public.movements (id, user_id, type, origin, date, description, amount, currency, card_id, account_id, installments, my_share) values
  -- "farmacia" por $12.000 en el resumen de septiembre de la Visa.
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'expense', 'text', '2026-09-28', 'farmacia', 12000, 'ARS', 'a2000000-0000-4000-8000-000000000001', null, 1, null),
  -- Un "Sin medio de pago" del reclamo: $48.000, tu parte $16.000.
  ('a3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'expense', 'claim', '2026-09-20', 'asado', 48000, 'ARS', null, null, 1, 16000),
  ('a3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'adjustment', 'manual', '2026-09-20', 'ajuste', -500, 'ARS', null, 'a1000000-0000-4000-8000-000000000001', 1, null),
  ('a3000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'expense', 'purge', '2026-09-20', 'purgado', 500, 'ARS', null, 'a1000000-0000-4000-8000-000000000001', 1, null),
  ('a3000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'expense', 'manual', '2025-03-10', 'viejo', 1000, 'ARS', null, 'a1000000-0000-4000-8000-000000000001', 1, null),
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'expense', 'manual', '2026-09-20', 'de Beto', 1000, 'ARS', 'b2000000-0000-4000-8000-000000000001', null, 1, null);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- ── Editar: "farmacia" de $12.000 a $15.000 con el pago de $3.000 (02 §5) ──
select lives_ok(
  $$select public.update_expense_with_payments(
    '{"id": "a3000000-0000-4000-8000-000000000001", "date": "2026-09-27", "description": "Farmacia del centro", "amount": "15000.00",
      "currency": "ARS", "card_id": "a2000000-0000-4000-8000-000000000001", "installments": 3,
      "category_id": "00000000-0000-4000-8000-000000000006"}',
    '[{"id": "a4000000-0000-4000-8000-000000000001", "period": "2026-09-01", "applies_to": "ARS", "amount": "3000.00",
       "from_account_id": "a1000000-0000-4000-8000-000000000001", "debited_amount": "3000.00", "paid_on": "2026-10-06"}]')$$,
  'Ana edita "farmacia" y registra el pago de $3.000'
);
select results_eq(
  $$select date, description, amount, installments, category_id, origin from public.movements where id = 'a3000000-0000-4000-8000-000000000001'$$,
  $$values ('2026-09-27'::date, 'Farmacia del centro', 15000.00::numeric, 3::smallint, '00000000-0000-4000-8000-000000000006'::uuid, 'text')$$,
  'El gasto queda con lo nuevo y conserva su origen'
);
select is(
  (select sum(amount) from public.statement_payments where card_id = 'a2000000-0000-4000-8000-000000000001'),
  3000.00,
  'Y el pago de $3.000 queda guardado'
);

-- Reintento con el mismo pago: no lo duplica.
select lives_ok(
  $$select public.update_expense_with_payments(
    '{"id": "a3000000-0000-4000-8000-000000000001", "date": "2026-09-27", "description": "Farmacia del centro", "amount": "15000.00",
      "currency": "ARS", "card_id": "a2000000-0000-4000-8000-000000000001", "installments": 3,
      "category_id": "00000000-0000-4000-8000-000000000006"}',
    '[{"id": "a4000000-0000-4000-8000-000000000001", "period": "2026-09-01", "applies_to": "ARS", "amount": "3000.00",
       "from_account_id": "a1000000-0000-4000-8000-000000000001", "debited_amount": "3000.00", "paid_on": "2026-10-06"}]')$$,
  'El reintento no falla'
);
select is(
  (select count(*)::int from public.statement_payments),
  1,
  'Y no suma otro pago'
);

-- ── De tarjeta a cuenta: card_id queda en null ──
select lives_ok(
  $$select public.update_expense_with_payments(
    '{"id": "a3000000-0000-4000-8000-000000000001", "date": "2026-09-27", "description": "Farmacia del centro", "amount": "15000.00",
      "currency": "ARS", "account_id": "a1000000-0000-4000-8000-000000000001"}', '[]')$$,
  'Pasa "farmacia" a la caja'
);
select results_eq(
  $$select card_id, account_id, installments from public.movements where id = 'a3000000-0000-4000-8000-000000000001'$$,
  $$values (null::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 1::smallint)$$,
  'Sin tarjeta y en 1 pago'
);

-- ── Completar un "Sin medio de pago" (L7) ──
select lives_ok(
  $$select public.update_expense_with_payments(
    '{"id": "a3000000-0000-4000-8000-000000000002", "date": "2026-10-01", "description": "Asado en lo de Juan", "amount": "1.00",
      "currency": "USD", "card_id": "a2000000-0000-4000-8000-000000000001", "installments": 2,
      "category_id": "00000000-0000-4000-8000-000000000002"}', '[]')$$,
  'Ana completa el "Sin medio de pago" con la Visa: pasa la restricción de medio de pago'
);
select results_eq(
  $$select date, amount, currency, my_share, origin, card_id, installments, description, category_id
    from public.movements where id = 'a3000000-0000-4000-8000-000000000002'$$,
  $$values ('2026-09-20'::date, 48000.00::numeric, 'ARS', 16000.00::numeric, 'claim', 'a2000000-0000-4000-8000-000000000001'::uuid,
            2::smallint, 'Asado en lo de Juan', '00000000-0000-4000-8000-000000000002'::uuid)$$,
  'Cambian el medio, las cuotas, la descripción y la categoría; monto, moneda, fecha, tu parte y el origen no'
);

-- ── Lo que no se edita ──
select throws_ok(
  $$select public.update_expense_with_payments('{"id": "b3000000-0000-4000-8000-000000000001", "date": "2026-09-20",
    "description": "x", "amount": "1.00", "currency": "ARS", "card_id": "b2000000-0000-4000-8000-000000000001"}', '[]')$$,
  'P0002', null, 'Ana no ve el gasto de Beto'
);
select throws_ok(
  $$select public.update_expense_with_payments('{"id": "a3000000-0000-4000-8000-000000000003", "date": "2026-09-20",
    "description": "x", "amount": "1.00", "currency": "ARS", "account_id": "a1000000-0000-4000-8000-000000000001"}', '[]')$$,
  'P0002', null, 'Un ajuste no se edita'
);
select throws_ok(
  $$select public.update_expense_with_payments('{"id": "a3000000-0000-4000-8000-000000000004", "date": "2026-09-20",
    "description": "x", "amount": "1.00", "currency": "ARS", "account_id": "a1000000-0000-4000-8000-000000000001"}', '[]')$$,
  'P0002', null, 'Un movimiento de la purga no se edita'
);

-- ── La cotización sigue a la fecha ──
select is(
  (select fx_mep from public.movements where id = 'a3000000-0000-4000-8000-000000000005'),
  1100.0000,
  'El gasto del 10/3/2025 tiene el MEP de ese día'
);
select lives_ok(
  $$select public.update_expense_with_payments('{"id": "a3000000-0000-4000-8000-000000000005", "date": "2025-03-20",
    "description": "viejo", "amount": "1000.00", "currency": "ARS", "account_id": "a1000000-0000-4000-8000-000000000001"}', '[]')$$,
  'Ana le cambia la fecha al 20/3/2025'
);
select is(
  (select fx_mep from public.movements where id = 'a3000000-0000-4000-8000-000000000005'),
  1200.0000,
  'Y guarda el MEP de la fecha nueva'
);

-- ── Un pago inválido no deja el gasto cambiado ──
select throws_ok(
  $$select public.update_expense_with_payments(
    '{"id": "a3000000-0000-4000-8000-000000000002", "date": "2026-09-20", "description": "cambiado", "amount": "48000.00",
      "currency": "ARS", "card_id": "a2000000-0000-4000-8000-000000000001", "installments": 2}',
    '[{"period": "2026-09-01", "applies_to": "ARS", "amount": "5000.00", "from_account_id": "b1000000-0000-4000-8000-000000000001",
       "debited_amount": "5000.00", "paid_on": "2026-10-06"}]')$$,
  '23503', null, 'Un pago desde una cuenta de Beto falla'
);
select is(
  (select description from public.movements where id = 'a3000000-0000-4000-8000-000000000002'),
  'Asado en lo de Juan',
  'Y el gasto no cambia'
);

select throws_ok(
  $$select public.update_expense_with_payments(
    '{"id": "a3000000-0000-4000-8000-000000000005", "date": "2025-03-20", "description": "viejo", "amount": "1000.00",
      "currency": "ARS", "account_id": "a1000000-0000-4000-8000-000000000001"}',
    '[{"period": "2025-03-01", "applies_to": "ARS", "amount": "5000.00", "from_account_id": "a1000000-0000-4000-8000-000000000001",
       "debited_amount": "5000.00", "paid_on": "2025-04-06"}]')$$,
  '22023', null, 'Pagos sin tarjeta fallan, como al cargar'
);

select * from finish();
rollback;
