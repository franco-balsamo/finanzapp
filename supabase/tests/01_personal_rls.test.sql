-- T-20 y dos usuarios: ninguno ve ni modifica lo del otro, ni referencia
-- sus filas adivinando un UUID.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- Ana (a…01) y Beto (b…02).
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'beto@test.local');

insert into public.accounts (id, user_id, name, type, currency) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Caja Ana', 'bank', 'ARS'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'Caja Beto', 'bank', 'ARS');
insert into public.cards (id, user_id, bank, name, network, last4, close_day, due_day) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Galicia', 'Visa Ana', 'VISA', '4532', 24, 6),
  ('b2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'Nación', 'Master Beto', 'MC', '1111', 30, 10);
insert into public.statement_overrides (user_id, card_id, period, close_date, due_date) values
  ('a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', '2026-10-01', '2026-10-27', '2026-11-08');
insert into public.statement_payments (user_id, card_id, period, applies_to, amount, from_account_id, debited_amount) values
  ('a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', '2026-09-01', 'ARS', 120000, 'a1000000-0000-4000-8000-000000000001', 120000);
insert into public.category_keywords (user_id, word, category_id) values
  ('a0000000-0000-4000-8000-000000000001', 'coto', '00000000-0000-4000-8000-000000000001');
insert into public.alerts (user_id, type, params) values
  ('a0000000-0000-4000-8000-000000000001', 'card_due', '{"card_id": "a2000000-0000-4000-8000-000000000001", "days_before": 2}');
insert into public.notifications (user_id, title, body) values
  ('a0000000-0000-4000-8000-000000000001', 'Tu Visa vence en 2 días', 'Vence el 6/11');

-- ── Ana ──
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$insert into public.movements (id, type, date, description, amount, currency, card_id, category_id)
    values ('a3000000-0000-4000-8000-000000000001', 'expense', '2026-10-02', 'súper', 12000, 'ARS',
            'a2000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
    on conflict (id) do nothing$$,
  'Ana carga un gasto'
);
select lives_ok(
  $$insert into public.movements (id, type, date, description, amount, currency, card_id)
    values ('a3000000-0000-4000-8000-000000000001', 'expense', '2026-10-02', 'súper', 12000, 'ARS',
            'a2000000-0000-4000-8000-000000000001')
    on conflict (id) do nothing$$,
  'el reintento con el mismo UUID no falla'
);
select is(
  (select count(*)::int from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  1,
  'T-20: el mismo UUID dos veces deja 1 fila'
);
select is(
  (select count(*)::int from public.user_settings),
  1,
  'al registrarse, cada usuario recibe su fila de ajustes'
);

-- ── Beto ──
set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is_empty($$select 1 from public.accounts where user_id <> auth.uid()$$, 'Beto no ve las cuentas de Ana');
select is_empty($$select 1 from public.cards where user_id <> auth.uid()$$, 'Beto no ve las tarjetas de Ana');
select is_empty($$select 1 from public.statement_overrides$$, 'Beto no ve los cierres corregidos de Ana');
select is_empty($$select 1 from public.statement_payments$$, 'Beto no ve los pagos de resumen de Ana');
select is_empty($$select 1 from public.movements$$, 'Beto no ve los movimientos de Ana');
select is_empty($$select 1 from public.category_keywords$$, 'Beto no ve las palabras aprendidas de Ana');
select is_empty($$select 1 from public.alerts$$, 'Beto no ve las alertas de Ana');
select is_empty($$select 1 from public.notifications$$, 'Beto no ve las notificaciones de Ana');
select is_empty($$select 1 from public.user_settings where user_id <> auth.uid()$$, 'Beto no ve los ajustes de Ana');
select is((select count(*)::int from public.categories), 6, 'Beto ve las 6 categorías del sistema');

-- T-20: el UUID de un gasto de Ana.
select lives_ok(
  $$insert into public.movements (id, type, date, description, amount, currency, card_id)
    values ('a3000000-0000-4000-8000-000000000001', 'expense', '2026-10-02', 'pisado', 1, 'ARS',
            'b2000000-0000-4000-8000-000000000002')
    on conflict (id) do nothing$$,
  'el upsert de Beto con el UUID de Ana no hace nada'
);
select throws_ok(
  $$insert into public.movements (id, type, date, description, amount, currency, card_id)
    values ('a3000000-0000-4000-8000-000000000001', 'expense', '2026-10-02', 'pisado', 1, 'ARS',
            'b2000000-0000-4000-8000-000000000002')
    on conflict (id) do update set description = excluded.description$$,
  '42501', null,
  'T-20: el upsert que pisa con el UUID de Ana se rechaza'
);
select throws_ok(
  $$insert into public.movements (user_id, type, date, description, amount, currency, account_id)
    values ('a0000000-0000-4000-8000-000000000001', 'expense', '2026-10-02', 'a nombre de Ana', 1, 'ARS',
            'a1000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'Beto no carga filas a nombre de Ana'
);

select lives_ok($$update public.movements set description = 'pisado'$$, 'Beto intenta editar todo');
select lives_ok($$delete from public.movements$$, 'Beto intenta borrar todo');
select lives_ok($$update public.user_settings set theme = 'dark'$$, 'Beto cambia sus ajustes');

-- FK compuestas: adivinar el UUID de una fila de Ana no sirve.
select throws_ok(
  $$insert into public.movements (type, date, description, amount, currency, card_id)
    values ('expense', '2026-10-02', 'con la Visa de Ana', 1000, 'ARS', 'a2000000-0000-4000-8000-000000000001')$$,
  '23503', null,
  'Beto no carga un gasto con la tarjeta de Ana'
);
select throws_ok(
  $$insert into public.movements (type, date, description, amount, currency, account_id)
    values ('expense', '2026-10-02', 'con la caja de Ana', 1000, 'ARS', 'a1000000-0000-4000-8000-000000000001')$$,
  '23503', null,
  'Beto no carga un gasto con la cuenta de Ana'
);
select throws_ok(
  $$insert into public.movements (type, date, description, amount, currency, account_id, to_account_id, debited_amount)
    values ('transfer', '2026-10-02', 'a la caja de Ana', 1000, 'ARS',
            'b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 1000)$$,
  '23503', null,
  'Beto no transfiere a una cuenta de Ana'
);
select throws_ok(
  $$insert into public.statement_payments (card_id, period, applies_to, amount, from_account_id, debited_amount)
    values ('a2000000-0000-4000-8000-000000000001', '2026-09-01', 'ARS', 1, 'b1000000-0000-4000-8000-000000000002', 1)$$,
  '23503', null,
  'Beto no paga un resumen de la tarjeta de Ana'
);
select throws_ok(
  $$insert into public.statement_payments (card_id, period, applies_to, amount, from_account_id, debited_amount)
    values ('b2000000-0000-4000-8000-000000000002', '2026-09-01', 'ARS', 1, 'a1000000-0000-4000-8000-000000000001', 1)$$,
  '23503', null,
  'Beto no paga su resumen desde la cuenta de Ana'
);
select throws_ok(
  $$insert into public.statement_overrides (card_id, period, close_date, due_date)
    values ('a2000000-0000-4000-8000-000000000001', '2026-11-01', '2026-11-25', '2026-12-07')$$,
  '23503', null,
  'Beto no corrige un cierre de la tarjeta de Ana'
);
select throws_ok(
  $$insert into public.alerts (type, params)
    values ('card_due', '{"card_id": "a2000000-0000-4000-8000-000000000001", "days_before": 2}')$$,
  '23503', null,
  'Beto no crea un aviso sobre la tarjeta de Ana'
);

-- ── Lo de Ana quedó igual ──
reset role;
select is(
  (select description from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  'súper',
  'el gasto de Ana sigue igual y sigue siendo de Ana'
);
select is(
  (select theme from public.user_settings where user_id = 'a0000000-0000-4000-8000-000000000001'),
  'system',
  'los ajustes de Ana siguen igual'
);

-- ── El "Deshacer" de Ana borra su gasto ──
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$delete from public.movements where id = 'a3000000-0000-4000-8000-000000000001'$$,
  'Ana deshace su gasto'
);
select is_empty($$select 1 from public.movements$$, 'el gasto de Ana ya no está');

select * from finish();
rollback;
