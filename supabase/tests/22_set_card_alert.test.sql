-- A-2 de la spec de Ajustes: set_card_alert guarda un aviso de tarjeta (02 §9).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Vos (a…01) tenés la Visa; Ana (b…02) tiene la Master.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'vos@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'ana@test.local');

insert into public.cards (id, user_id, bank, name, network, last4, close_day, due_day, credit_limit) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Galicia', 'Visa', 'VISA', '4532', 24, 6, 2000000),
  ('b2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'Nación', 'Master', 'MC', '1111', 10, 20, 1000000);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select public.set_card_alert('a2000000-0000-4000-8000-000000000001', 'card_closing', false);
select results_eq(
  $$select type, enabled from public.alerts$$,
  $$values ('card_closing', false)$$,
  'sin fila, apagar el cierre crea una fila apagada'
);

select public.set_card_alert('a2000000-0000-4000-8000-000000000001', 'card_closing', true);
select results_eq(
  $$select type, enabled from public.alerts$$,
  $$values ('card_closing', true)$$,
  'volver a llamarla actualiza la misma fila'
);

select public.set_card_alert('a2000000-0000-4000-8000-000000000001', 'card_due', false, 4);
select throws_ok(
  $$select public.set_card_alert('a2000000-0000-4000-8000-000000000001', 'card_due', true, 6)$$,
  '23514', null, 'más de 5 días antes: lo rechaza la tabla'
);
select is(
  (select params ->> 'days_before' from public.alerts where type = 'card_due'), '4',
  'el vencimiento apagado guarda los 4 días'
);

select throws_ok(
  $$select public.set_card_alert('b2000000-0000-4000-8000-000000000002', 'card_closing', false)$$,
  '42501', null, 'la tarjeta de Ana no es tuya'
);
select throws_ok(
  $$select public.set_card_alert('a2000000-0000-4000-8000-000000000001', 'price', false)$$,
  '22023', null, 'un tipo que no es de tarjeta'
);

-- El cron lee el aviso de cierre apagado.
select public.set_card_alert('a2000000-0000-4000-8000-000000000001', 'card_closing', false);
reset role;
select results_eq(
  $$select c ->> 'closing_enabled', c ->> 'due_enabled', c ->> 'due_days_before'
    from jsonb_array_elements(public.card_notice_input()) u, jsonb_array_elements(u -> 'cards') c
    where c ->> 'id' = 'a2000000-0000-4000-8000-000000000001'$$,
  $$values ('false', 'false', '4')$$,
  'card_notice_input ve los avisos apagados y los 4 días'
);
select is((select count(*)::int from public.alerts where user_id = 'b0000000-0000-4000-8000-000000000002'), 0,
  'a Ana no se le creó ninguna fila');

select * from finish();
rollback;
