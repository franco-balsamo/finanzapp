-- Avisos de cierre y de vencimiento (02 §9): los datos que leen las Edge
-- Functions, lo que guardan, el "no molestar", permisos y cron.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- Ana: Visa y Master activas, Amex archivada, no molestar de 22 a 8.
-- Beto: sin tarjetas. Caro: una tarjeta.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'beto@test.local'),
  ('c0000000-0000-4000-8000-000000000003', 'caro@test.local');
update public.user_settings set quiet_from = 22, quiet_to = 8 where user_id = 'a0000000-0000-4000-8000-000000000001';

insert into public.accounts (id, user_id, name, type, currency) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Caja Ana', 'bank', 'ARS');
insert into public.cards (id, user_id, bank, name, network, last4, close_day, due_day, credit_limit, archived_at, created_at) values
  ('a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'Galicia', 'Visa', 'VISA', '2337', 24, 6, 1000000, null, '2026-01-01'),
  ('a2000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000001', 'BBVA', 'Master', 'MC', '1111', 25, 7, null, null, '2026-01-02'),
  ('a2000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-000000000001', 'Santander', 'Amex', 'AMEX', '9999', 24, 6, null, now(), '2026-01-03'),
  ('c2000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000003', 'Nación', 'Cabal', 'CABAL', '4444', 10, 20, null, null, '2026-01-01');
insert into public.movements (user_id, type, date, description, amount, currency, card_id, installments) values
  ('a0000000-0000-4000-8000-000000000001', 'expense', '2026-09-10', 'Súper', 187000, 'ARS', 'a2000000-0000-4000-8000-00000000000a', 1),
  ('a0000000-0000-4000-8000-000000000001', 'expense', '2026-09-12', 'Netflix', 50, 'USD', 'a2000000-0000-4000-8000-00000000000a', 3);
insert into public.statement_payments (user_id, card_id, period, applies_to, amount, from_account_id, debited_amount, fx_card_rate, paid_at) values
  ('a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-00000000000a', '2026-08-01', 'USD', 20,
   'a1000000-0000-4000-8000-000000000001', 40560, 2028, '2026-09-06 02:00+00');
insert into public.statement_overrides (user_id, card_id, period, close_date, due_date) values
  ('a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-00000000000a', '2026-10-01', '2026-10-27', '2026-11-08');
-- Master: sin aviso de cierre y vencimiento a 5 días.
insert into public.alerts (user_id, type, enabled, params) values
  ('a0000000-0000-4000-8000-000000000001', 'card_closing', false, '{"card_id": "a2000000-0000-4000-8000-00000000000b"}'),
  ('a0000000-0000-4000-8000-000000000001', 'card_due', true, '{"card_id": "a2000000-0000-4000-8000-00000000000b", "days_before": 5}');

-- ═════════════════════════ card_notice_input ═════════════════════════

create temp table input as select public.card_notice_input() as j;
create temp view ana as
  select u as j from input, jsonb_array_elements(input.j) u where u ->> 'user_id' = 'a0000000-0000-4000-8000-000000000001';
create temp view visa as
  select c as j from ana, jsonb_array_elements(ana.j -> 'cards') c where c ->> 'name' = 'Visa';
create temp view master as
  select c as j from ana, jsonb_array_elements(ana.j -> 'cards') c where c ->> 'name' = 'Master';

select is(
  (select array_agg(u ->> 'user_id' order by u ->> 'user_id') from input, jsonb_array_elements(input.j) u),
  array['a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003'],
  'trae solo a los usuarios con tarjetas activas'
);
select is(
  (select array_agg(c ->> 'name') from ana, jsonb_array_elements(ana.j -> 'cards') c),
  array['Visa', 'Master'],
  'no trae las tarjetas archivadas'
);
select is(
  (select row(j ->> 'notify_push', j ->> 'quiet_from', j ->> 'quiet_to')::text from ana),
  row('true', '22', '8')::text,
  'trae los ajustes de aviso del usuario'
);
select is(
  (select j -> 'expenses' -> 1 from visa),
  jsonb_build_object('id', (select id from public.movements where description = 'Netflix'), 'date', '2026-09-12',
    'amount', '50.00', 'currency', 'USD', 'installments', 3),
  'los consumos traen el monto como texto, la moneda y las cuotas'
);
select is(
  (select (j -> 'payments' -> 0) - 'id' from visa),
  '{"period": "2026-08", "applies_to": "USD", "amount": "20.00", "debited_amount": "40560.00", "debited_currency": "ARS",
    "fx_card_rate": "2028.0000", "paid_at": "2026-09-05", "reverted_at": null}'::jsonb,
  'los pagos traen lo descontado con la moneda de la cuenta y la fecha en hora de Argentina'
);
select is(
  (select j -> 'overrides' from visa),
  '[{"period": "2026-10", "close_date": "2026-10-27", "due_date": "2026-11-08"}]'::jsonb,
  'trae los cierres corregidos'
);
select is(
  (select row(j ->> 'credit_limit', j ->> 'closing_enabled', j ->> 'due_enabled', j ->> 'due_days_before')::text from visa),
  row('1000000.00', 'true', 'true', '2')::text,
  'sin alertas configuradas: avisos prendidos y vencimiento a 2 días'
);
select is(
  (select row(j ->> 'credit_limit', j ->> 'closing_enabled', j ->> 'due_enabled', j ->> 'due_days_before')::text from master),
  row('0', 'false', 'true', '5')::text,
  'con alertas: respeta las apagadas y los días configurados'
);

-- ═════════════════════════ record_card_notices ═════════════════════════

select throws_ok($$select public.record_card_notices('{}')$$, '22023', null, 'tiene que ser una lista');

select is(
  public.record_card_notices($json$[{
    "user_id": "a0000000-0000-4000-8000-000000000001", "kind": "card_closing", "title": "Cierre de tarjeta",
    "body": "Cerró tu Visa: te vienen $187.000. ¿Te falta cargar algo?",
    "refs": [{"card_id": "a2000000-0000-4000-8000-00000000000a", "period": "2026-09"}]
  }]$json$),
  1,
  'guarda el aviso'
);
select is(
  (select row(title, body, kind, data, severity, read_at, sent_at)::text from public.notifications
   where user_id = 'a0000000-0000-4000-8000-000000000001'),
  row('Cierre de tarjeta', 'Cerró tu Visa: te vienen $187.000. ¿Te falta cargar algo?', 'card_closing',
      '{"card_ids": ["a2000000-0000-4000-8000-00000000000a"]}'::jsonb, 'info', null::timestamptz, null::timestamptz)::text,
  'la notificación tiene el texto, el tipo y las tarjetas para abrir el detalle'
);
select is(
  (select deliver_after from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000001'),
  private.deliver_after(22::smallint, 8::smallint, now()),
  'deliver_after respeta el no molestar del usuario'
);
select is(
  (select row(kind, period, notification_id is not null)::text from private.card_notices),
  row('card_closing', '2026-09-01'::date, true)::text,
  'queda registrado qué se avisó'
);

select is(
  public.record_card_notices($json$[{
    "user_id": "a0000000-0000-4000-8000-000000000001", "kind": "card_closing", "title": "Cierre de tarjeta", "body": "otra vez",
    "refs": [{"card_id": "a2000000-0000-4000-8000-00000000000a", "period": "2026-09"}]
  }]$json$),
  0,
  'el mismo aviso dos veces no se repite'
);
select is(
  public.record_card_notices($json$[{
    "user_id": "a0000000-0000-4000-8000-000000000001", "kind": "card_closing", "title": "Cierre de tarjeta", "body": "las dos",
    "refs": [{"card_id": "a2000000-0000-4000-8000-00000000000a", "period": "2026-09"},
             {"card_id": "a2000000-0000-4000-8000-00000000000b", "period": "2026-09"}]
  }]$json$),
  0,
  'un aviso con una tarjeta ya avisada se saltea entero'
);
select is((select count(*)::int from public.notifications), 1, 'sigue habiendo una sola notificación');
select is(
  public.record_card_notices($json$[{
    "user_id": "a0000000-0000-4000-8000-000000000001", "kind": "card_due", "title": "Vencimiento de tarjeta", "body": "vence",
    "refs": [{"card_id": "a2000000-0000-4000-8000-00000000000a", "period": "2026-09"}]
  }]$json$),
  1,
  'el de vencimiento del mismo resumen es otro aviso'
);

-- Uno con la tarjeta de otro usuario, uno de un usuario que no existe y uno bueno.
select is(
  public.record_card_notices($json$[
    {"user_id": "a0000000-0000-4000-8000-000000000001", "kind": "card_closing", "title": "Cierre de tarjeta", "body": "ajena",
     "refs": [{"card_id": "c2000000-0000-4000-8000-00000000000a", "period": "2026-09"}]},
    {"user_id": "f0000000-0000-4000-8000-000000000009", "kind": "card_closing", "title": "Cierre de tarjeta", "body": "nadie",
     "refs": [{"card_id": "c2000000-0000-4000-8000-00000000000a", "period": "2026-09"}]},
    {"user_id": "c0000000-0000-4000-8000-000000000003", "kind": "card_closing", "title": "Cierre de tarjeta", "body": "Cerró tu Cabal",
     "refs": [{"card_id": "c2000000-0000-4000-8000-00000000000a", "period": "2026-09"}]}
  ]$json$),
  1,
  'los avisos inválidos se saltean y los demás se guardan'
);
select is(
  (select array_agg(ref_id::text order by ref_id) from private.job_failures where job = 'record_card_notices'),
  array['a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000009'],
  'los inválidos quedan en job_failures'
);
select is(
  (select jsonb_agg(n order by n ->> 'kind') from visa, jsonb_array_elements(
     (select c from jsonb_array_elements(public.card_notice_input() -> 0 -> 'cards') c where c ->> 'name' = 'Visa') -> 'noticed') n),
  '[{"kind": "card_closing", "period": "2026-09"}, {"kind": "card_due", "period": "2026-09"}]'::jsonb,
  'card_notice_input trae lo ya avisado'
);

-- ═════════════════════════ No molestar ═════════════════════════

select is(private.deliver_after(22::smallint, 8::smallint, '2026-10-04 23:00-03'), '2026-10-05 08:00-03'::timestamptz,
  'de 22 a 8: a las 23 sale a las 8 del día siguiente');
select is(private.deliver_after(22::smallint, 8::smallint, '2026-10-05 03:00-03'), '2026-10-05 08:00-03'::timestamptz,
  'de 22 a 8: a las 3 sale a las 8 del mismo día');
select is(private.deliver_after(22::smallint, 8::smallint, '2026-10-04 20:00-03'), '2026-10-04 20:00-03'::timestamptz,
  'de 22 a 8: a las 20 sale en el momento');
select is(private.deliver_after(13::smallint, 15::smallint, '2026-10-04 14:00-03'), '2026-10-04 15:00-03'::timestamptz,
  'de 13 a 15: a las 14 sale a las 15');
select is(private.deliver_after(13::smallint, 15::smallint, '2026-10-04 15:00-03'), '2026-10-04 15:00-03'::timestamptz,
  'de 13 a 15: a las 15 ya sale');
select is(private.deliver_after(null, null, '2026-10-04 23:00-03'), '2026-10-04 23:00-03'::timestamptz,
  'sin no molestar sale en el momento');

-- ═════════════════════════ Permisos y cron ═════════════════════════

select ok(
  has_function_privilege('service_role', 'public.card_notice_input()', 'execute')
  and has_function_privilege('service_role', 'public.record_card_notices(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.card_notice_input()', 'execute')
  and not has_function_privilege('authenticated', 'public.record_card_notices(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.card_notice_input()', 'execute'),
  'solo service_role lee los datos y guarda los avisos'
);
select ok(
  not has_table_privilege('authenticated', 'private.card_notices', 'select')
  and not has_function_privilege('authenticated', 'private.deliver_after(smallint, smallint, timestamptz)', 'execute'),
  'la app no ve card_notices ni deliver_after'
);
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where oid in ('public.card_notice_input()'::regprocedure, 'public.record_card_notices(jsonb)'::regprocedure)),
  'security definer y search_path fijo'
);
select is(
  (select array_agg(jobname || ' ' || schedule || ' ' || command order by jobname) from cron.job where jobname like 'card-%'),
  array['card-closing-notices 0 23 * * * select private.call_edge(''card-closing-notices'')',
        'card-due-notices 0 13 * * * select private.call_edge(''card-due-notices'')'],
  'cierre a las 20:00 y vencimiento a las 10:00 de Argentina'
);

select * from finish();
rollback;
