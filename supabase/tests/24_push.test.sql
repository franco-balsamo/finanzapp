-- P-2 de la spec del push: tokens de dispositivo y qué avisos se mandan.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Vos (a…01) con dos teléfonos; Ana (b…02) con uno y el push apagado; Leo (c…03) sin teléfono.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'vos@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'ana@test.local'),
  ('c0000000-0000-4000-8000-000000000003', 'leo@test.local');

-- ───────────── register / unregister ─────────────

set local role authenticated;
set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.register_push_token('ExponentPushToken[telefono-1]');

set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.register_push_token('ExponentPushToken[telefono-1]');
select public.register_push_token('ExponentPushToken[telefono-2]');
select public.register_push_token('ExponentPushToken[telefono-2]');

select throws_ok(
  $$select token from public.push_tokens$$,
  '42501', null, 'authenticated no lee push_tokens directamente'
);
select throws_ok(
  $$select public.register_push_token('no-es-un-token')$$,
  '23514', null, 'un token con formato inválido se rechaza'
);

set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.register_push_token('ExponentPushToken[ana]');
select public.unregister_push_token('ExponentPushToken[telefono-2]');

reset role;
select results_eq(
  $$select token, user_id from public.push_tokens order by token$$,
  $$values ('ExponentPushToken[ana]', 'b0000000-0000-4000-8000-000000000002'::uuid),
           ('ExponentPushToken[telefono-1]', 'a0000000-0000-4000-8000-000000000001'::uuid),
           ('ExponentPushToken[telefono-2]', 'a0000000-0000-4000-8000-000000000001'::uuid)$$,
  'el mismo teléfono pasa a la cuenta nueva, registrar dos veces no duplica y unregister no borra el token de otro'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.unregister_push_token('ExponentPushToken[telefono-2]');
reset role;
select is(
  (select count(*)::int from public.push_tokens where user_id = 'a0000000-0000-4000-8000-000000000001'), 1,
  'unregister borra el token propio'
);

-- ───────────── claim_push_batch ─────────────

update public.user_settings set notify_push = false where user_id = 'b0000000-0000-4000-8000-000000000002';
insert into public.push_tokens (token, user_id) values ('ExponentPushToken[telefono-2]', 'a0000000-0000-4000-8000-000000000001');

insert into public.notifications (id, user_id, title, body, data, deliver_after, sent_at) values
  ('a5000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Cerró tu Visa', 'Te vienen $1.000', '{"card_ids": ["x"]}', now() - interval '1 minute', null),
  ('a5000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Futuro', 'no molestar', null, now() + interval '1 hour', null),
  ('a5000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Viejo', 'más de 24 h', null, now() - interval '25 hours', null),
  ('a5000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Enviado', 'ya salió', null, now() - interval '1 hour', now() - interval '1 hour'),
  ('b5000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'Ana', 'push apagado', null, now() - interval '1 minute', null),
  ('c5000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000003', 'Leo', 'sin token', null, now() - interval '1 minute', null);

set local role anon;
select throws_ok($$select * from public.claim_push_batch()$$, '42501', null, 'anon no puede llamar a claim_push_batch');
set local role authenticated;
select throws_ok($$select * from public.claim_push_batch()$$, '42501', null, 'authenticated no puede llamar a claim_push_batch');
select throws_ok($$select public.drop_push_tokens(array['ExponentPushToken[ana]'])$$, '42501', null, 'authenticated no puede llamar a drop_push_tokens');
set local role anon;
select throws_ok($$select public.drop_push_tokens(array['ExponentPushToken[ana]'])$$, '42501', null, 'anon no puede llamar a drop_push_tokens');

set local role service_role;
create temp table claimed as select * from public.claim_push_batch();
reset role;

select results_eq(
  $$select notification_id, token, title, body, data from claimed order by token$$,
  $$values ('a5000000-0000-4000-8000-000000000001'::uuid, 'ExponentPushToken[telefono-1]', 'Cerró tu Visa', 'Te vienen $1.000', '{"card_ids": ["x"]}'::jsonb),
           ('a5000000-0000-4000-8000-000000000001'::uuid, 'ExponentPushToken[telefono-2]', 'Cerró tu Visa', 'Te vienen $1.000', '{"card_ids": ["x"]}'::jsonb)$$,
  'solo el aviso vencido, dentro de las 24 h, sin enviar, con push prendido y con token; una fila por teléfono'
);
select isnt(
  (select sent_at from public.notifications where id = 'a5000000-0000-4000-8000-000000000001'), null,
  'el aviso tomado queda marcado como enviado'
);
select is(
  (select count(*)::int from public.notifications where sent_at is null), 4,
  'los demás quedan sin enviar (futuro, viejo, push apagado y sin token)'
);

set local role service_role;
select is_empty($$select * from public.claim_push_batch()$$, 'un segundo claim no devuelve nada');

-- El no molestar termina: el aviso futuro sale.
reset role;
update public.notifications set deliver_after = now() where id = 'a5000000-0000-4000-8000-000000000002';
set local role service_role;
select is(
  (select count(*)::int from public.claim_push_batch()), 2,
  'cuando vence deliver_after, sale a los dos teléfonos'
);

-- Leo registra un teléfono: su aviso pendiente sale.
reset role;
insert into public.push_tokens (token, user_id) values ('ExponentPushToken[leo]', 'c0000000-0000-4000-8000-000000000003');
set local role service_role;
select is(
  (select title from public.claim_push_batch()), 'Leo',
  'el usuario que registra un token recibe su aviso pendiente'
);

-- drop_push_tokens
select public.drop_push_tokens(array['ExponentPushToken[leo]', 'ExponentPushToken[telefono-2]']);
reset role;
select results_eq(
  $$select token from public.push_tokens order by token$$,
  $$values ('ExponentPushToken[ana]'), ('ExponentPushToken[telefono-1]')$$,
  'drop_push_tokens borra los tokens muertos'
);

-- Al borrar el usuario, sus tokens se van en cascada.
delete from auth.users where id = 'b0000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::int from public.push_tokens where token = 'ExponentPushToken[ana]'), 0,
  'borrar la cuenta borra sus tokens'
);

select * from finish();
rollback;
