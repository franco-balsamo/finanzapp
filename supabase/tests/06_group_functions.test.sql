-- Funciones de grupo (02 §7): claim_member, undo_claim, leave_group,
-- void_group_payment, rotate/revoke_invite_token y updated_by.
begin;
create extension if not exists pgtap with schema extensions;
select plan(55);

-- Ana (dueña), Beto, Caro, Dani (ajena) y Juan (reclama el lugar provisorio "Juan").
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'beto@test.local'),
  ('c0000000-0000-4000-8000-000000000003', 'caro@test.local'),
  ('d0000000-0000-4000-8000-000000000004', 'dani@test.local'),
  ('10000000-0000-4000-8000-000000000005', 'juan@test.local');

insert into public.accounts (id, user_id, name, type, currency) values
  ('11000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 'Caja Juan', 'bank', 'ARS');

insert into public.groups (id, name, currency, invite_token_hash) values
  ('90000000-0000-4000-8000-000000000001', 'Cabaña', 'ARS', encode(sha256(convert_to('tok-cabana', 'UTF8')), 'hex')),
  ('90000000-0000-4000-8000-000000000002', 'Fútbol', 'ARS', null),
  ('90000000-0000-4000-8000-000000000003', 'Solo', 'ARS', null),
  ('90000000-0000-4000-8000-000000000004', 'Centavos', 'ARS', null),
  ('90000000-0000-4000-8000-000000000005', 'Dólares', 'USD', null);
insert into public.group_members (id, group_id, user_id, display_name) values
  ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Ana'),
  ('e0000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Beto'),
  ('e0000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', null, 'Juan'),
  ('e0000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000001', null, 'Lu'),
  ('e0000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Ana'),
  ('e0000000-0000-4000-8000-000000000012', '90000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'Caro'),
  ('e0000000-0000-4000-8000-000000000013', '90000000-0000-4000-8000-000000000002', null, 'Pepe'),
  ('e0000000-0000-4000-8000-000000000021', '90000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Ana'),
  ('e0000000-0000-4000-8000-000000000022', '90000000-0000-4000-8000-000000000003', null, 'Tito'),
  ('e0000000-0000-4000-8000-000000000031', '90000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000003', 'Caro'),
  ('e0000000-0000-4000-8000-000000000032', '90000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 'Dani'),
  ('e0000000-0000-4000-8000-000000000041', '90000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000003', 'Caro'),
  ('e0000000-0000-4000-8000-000000000042', '90000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000004', 'Dani');
update public.groups g set owner_member_id = o.id
from (values
  ('90000000-0000-4000-8000-000000000001'::uuid, 'e0000000-0000-4000-8000-000000000001'::uuid),
  ('90000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000011'),
  ('90000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000021'),
  ('90000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000031'),
  ('90000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000041')
) o (gid, id)
where g.id = o.gid;

-- Cabaña: Juan pagó $30.000 y US$ 10,01; Ana pagó $90.000. Todo entre Ana, Beto y Juan.
insert into public.group_expenses (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode, category_id, deleted_at) values
  ('ab000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '2026-10-01', 'Súper', 30000, 'ARS', null,
   'e0000000-0000-4000-8000-000000000003', 'equal', '00000000-0000-4000-8000-000000000001', null),
  ('ab000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', '2026-10-01', 'Cabaña', 90000, 'ARS', null,
   'e0000000-0000-4000-8000-000000000001', 'equal', null, null),
  ('ab000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', '2026-10-01', 'Borrado', 999, 'ARS', null,
   'e0000000-0000-4000-8000-000000000003', 'equal', null, now()),
  ('ab000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000001', '2026-10-01', 'Nafta', 10.01, 'USD', 1333.33,
   'e0000000-0000-4000-8000-000000000003', 'equal', null, null);
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value)
select '90000000-0000-4000-8000-000000000001', x.id::uuid, m.id::uuid, 1
from (values ('ab000000-0000-4000-8000-000000000001'), ('ab000000-0000-4000-8000-000000000002'),
             ('ab000000-0000-4000-8000-000000000003'), ('ab000000-0000-4000-8000-000000000004')) x (id),
     (values ('e0000000-0000-4000-8000-000000000001'), ('e0000000-0000-4000-8000-000000000002'),
             ('e0000000-0000-4000-8000-000000000003')) m (id);

-- Centavos (en pesos): Caro debe $0,80. Dólares: Caro debe US$ 0,01.
insert into public.group_expenses (id, group_id, date, description, amount, currency, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000000000041', '90000000-0000-4000-8000-000000000004', '2026-10-01', 'Café', 1.60, 'ARS', 'e0000000-0000-4000-8000-000000000032', 'equal'),
  ('ab000000-0000-4000-8000-000000000051', '90000000-0000-4000-8000-000000000005', '2026-10-01', 'Chicle', 0.02, 'USD', 'e0000000-0000-4000-8000-000000000042', 'equal');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000000000041', 'e0000000-0000-4000-8000-000000000031', 1),
  ('90000000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000000000041', 'e0000000-0000-4000-8000-000000000032', 1),
  ('90000000-0000-4000-8000-000000000005', 'ab000000-0000-4000-8000-000000000051', 'e0000000-0000-4000-8000-000000000041', 1),
  ('90000000-0000-4000-8000-000000000005', 'ab000000-0000-4000-8000-000000000051', 'e0000000-0000-4000-8000-000000000042', 1);

-- Fútbol: un pago de Caro a Pepe.
insert into public.group_payments (id, group_id, from_member_id, to_member_id, amount, date) values
  ('70000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000012', 'e0000000-0000-4000-8000-000000000013', 100, '2026-10-02');

set local role authenticated;

-- ═════════════════════════ claim_member ═════════════════════════
set local request.jwt.claims = '{"sub": "10000000-0000-4000-8000-000000000005", "role": "authenticated"}';

select throws_ok($$select public.claim_member('tok-equivocado', 'e0000000-0000-4000-8000-000000000003')$$,
  'P0002', null, 'reclamar con un token equivocado falla');
select throws_ok($$select public.claim_member('tok-cabana', 'e0000000-0000-4000-8000-000000000013')$$,
  'P0002', null, 'reclamar un lugar de otro grupo falla');
select throws_ok($$select public.claim_member('tok-cabana', 'e0000000-0000-4000-8000-000000000002')$$,
  '55000', null, 'reclamar un lugar que ya tiene cuenta falla');
select is(public.claim_member('tok-cabana', 'e0000000-0000-4000-8000-000000000003'),
  '90000000-0000-4000-8000-000000000001'::uuid, 'Juan reclama su lugar');
select ok(public.is_group_member('90000000-0000-4000-8000-000000000001'), 'Juan ya es integrante');
select results_eq(
  $$select description, amount, currency, my_share, origin, card_id is null and account_id is null
    from public.movements order by description$$,
  $$values ('Nafta', 10.01::numeric, 'USD', 3.35::numeric, 'claim', true),
           ('Súper', 30000::numeric, 'ARS', 10000::numeric, 'claim', true)$$,
  'entran los gastos que pagó Juan, "Sin medio de pago", con su parte en la moneda del gasto (no el borrado ni los que pagaron otros)'
);
select is(
  (select category_id from public.movements where description = 'Súper'),
  '00000000-0000-4000-8000-000000000001'::uuid,
  'el gasto entra con la categoría del gasto de grupo'
);
select throws_ok($$select public.claim_member('tok-cabana', 'e0000000-0000-4000-8000-000000000004')$$,
  '55000', null, 'quien ya es integrante no reclama otro lugar');

-- Juan carga un gasto propio desde el grupo y su alias.
select lives_ok(
  $$insert into public.movements (id, type, date, description, amount, currency, account_id, group_expense_id, my_share)
    values ('12000000-0000-4000-8000-000000000005', 'expense', '2026-10-01', 'Mi parte de la cabaña', 30000, 'ARS',
            '11000000-0000-4000-8000-000000000005', 'ab000000-0000-4000-8000-000000000002', 30000)$$,
  'Juan vincula un gasto propio al grupo'
);
select lives_ok(
  $$update public.group_members set payment_alias = 'juan.mp' where id = 'e0000000-0000-4000-8000-000000000003'$$,
  'Juan carga su alias'
);

set local request.jwt.claims = '{"role": "authenticated"}';
select throws_ok($$select public.claim_member('tok-cabana', 'e0000000-0000-4000-8000-000000000004')$$,
  '42501', null, 'reclamar sin sesión falla');

reset role;
select is(
  (select count(*)::int from public.notifications where title = 'Juan se sumó a Cabaña'),
  2,
  'se avisa a Ana y a Beto'
);

-- ═════════════════════════ updated_by ═════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select lives_ok(
  $$update public.group_expenses set description = 'Súper Coto' where id = 'ab000000-0000-4000-8000-000000000001'$$,
  'Beto edita un gasto'
);
reset role;
select is(
  (select updated_by from public.group_expenses where id = 'ab000000-0000-4000-8000-000000000001'),
  'b0000000-0000-4000-8000-000000000002'::uuid,
  'el gasto guarda quién lo editó'
);

-- ═════════════════════════ undo_claim ═════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok($$select public.undo_claim('e0000000-0000-4000-8000-000000000003')$$,
  '42501', null, 'un integrante que no es dueño ni reclamó no deshace el reclamo');

set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok($$select public.undo_claim('e0000000-0000-4000-8000-000000000003')$$, 'la dueña deshace el reclamo');
select throws_ok($$select public.undo_claim('e0000000-0000-4000-8000-000000000003')$$,
  '55000', null, 'deshacer de nuevo falla: ya no hay reclamo');

reset role;
select results_eq(
  $$select user_id, claimed_at, payment_alias, unclaimed_by from public.group_members
    where id = 'e0000000-0000-4000-8000-000000000003'$$,
  $$values (null::uuid, null::timestamptz, null::text, 'a0000000-0000-4000-8000-000000000001'::uuid)$$,
  'el lugar vuelve a ser provisorio, sin el alias de Juan, y queda quién lo deshizo'
);
select is_empty(
  $$select 1 from public.movements where user_id = '10000000-0000-4000-8000-000000000005' and origin = 'claim'$$,
  'se borran los gastos que entraron al reclamar'
);
select results_eq(
  $$select group_expense_id, my_share from public.movements where id = '12000000-0000-4000-8000-000000000005'$$,
  $$values (null::uuid, null::numeric)$$,
  'el gasto que Juan cargó él mismo pierde el vínculo y cuenta completo'
);
select is(
  (select count(*)::int from public.notifications
   where user_id = '10000000-0000-4000-8000-000000000005' and title = 'Te desvincularon de Cabaña'),
  1,
  'se avisa a Juan'
);
select is(
  (select count(*)::int from public.group_expenses where group_id = '90000000-0000-4000-8000-000000000001'),
  4,
  'los gastos del grupo no cambian'
);

-- Pasados los 7 días ya no se puede deshacer.
set local role authenticated;
set local request.jwt.claims = '{"sub": "10000000-0000-4000-8000-000000000005", "role": "authenticated"}';
select lives_ok($$select public.claim_member('tok-cabana', 'e0000000-0000-4000-8000-000000000003')$$, 'Juan vuelve a reclamar');
reset role;
update public.group_members set claimed_at = now() - interval '8 days' where id = 'e0000000-0000-4000-8000-000000000003';
set local role authenticated;
set local request.jwt.claims = '{"sub": "10000000-0000-4000-8000-000000000005", "role": "authenticated"}';
select throws_ok($$select public.undo_claim('e0000000-0000-4000-8000-000000000003')$$,
  '55000', null, 'a los 8 días ya no se deshace');
reset role;
update public.group_members set claimed_at = now() - interval '6 days' where id = 'e0000000-0000-4000-8000-000000000003';
set local role authenticated;
select lives_ok($$select public.undo_claim('e0000000-0000-4000-8000-000000000003')$$, 'a los 6 días, quien reclamó lo deshace');
reset role;
select is(
  (select count(*)::int from public.notifications
   where user_id = '10000000-0000-4000-8000-000000000005' and title = 'Te desvincularon de Cabaña'),
  1,
  'si lo deshace quien reclamó, no se le avisa a sí mismo'
);

-- ═════════════════════════ leave_group ═════════════════════════
set local role authenticated;

-- Beto debe $10.000 + $30.000 + $4.448,87 (un tercio de US$ 10,01 × 1333,33).
set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok($$select public.leave_group('90000000-0000-4000-8000-000000000001')$$,
  '55000', null, 'Beto debe $44.448,87 y no puede salir');
select throws_ok($$update public.group_members set left_at = now() where id = 'e0000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'left_at sigue sin poder escribirse directo');

reset role;
insert into public.group_payments (group_id, from_member_id, to_member_id, amount, date) values
  ('90000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 44448, '2026-10-02');
set local role authenticated;
select lives_ok($$select public.leave_group('90000000-0000-4000-8000-000000000001')$$,
  'después de pagar $44.448 le quedan $0,87: está al día y sale');
select ok(not public.is_group_member('90000000-0000-4000-8000-000000000001'), 'Beto ya no es integrante');
select throws_ok($$select public.leave_group('90000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'salir de un grupo del que ya salió falla');

-- Umbral por moneda.
set local request.jwt.claims = '{"sub": "c0000000-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok($$select public.leave_group('90000000-0000-4000-8000-000000000005')$$,
  '55000', null, 'en dólares, US$ 0,01 de deuda no está al día');
select lives_ok($$select public.leave_group('90000000-0000-4000-8000-000000000004')$$,
  'en pesos, $0,80 de deuda está al día: la dueña sale');
reset role;
select is(
  (select owner_member_id from public.groups where id = '90000000-0000-4000-8000-000000000004'),
  'e0000000-0000-4000-8000-000000000032'::uuid,
  'el rol pasa al único integrante con cuenta (Dani)'
);
select is(
  (select count(*)::int from public.notifications
   where user_id = 'd0000000-0000-4000-8000-000000000004' and title = 'Dani es el nuevo dueño de Centavos'),
  1,
  'se avisa del nuevo dueño'
);

-- Sin nadie con cuenta, el grupo queda sin dueño.
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok($$select public.leave_group('90000000-0000-4000-8000-000000000003')$$, 'la dueña de Solo sale');
reset role;
select is(
  (select owner_member_id from public.groups where id = '90000000-0000-4000-8000-000000000003'),
  null::uuid,
  'solo quedan provisorios: el grupo queda sin dueño'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "d0000000-0000-4000-8000-000000000004", "role": "authenticated"}';
select throws_ok($$select public.leave_group('90000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'una ajena no sale de un grupo que no es suyo');

-- ═════════════════════════ void_group_payment ═════════════════════════
select throws_ok($$select public.void_group_payment('70000000-0000-4000-8000-000000000001')$$,
  'P0002', null, 'una ajena no anula pagos');

set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok($$update public.group_payments set amount = 1$$, '42501', null, 'un pago nunca se edita');
select throws_ok($$update public.group_payments set deleted_at = now()$$, '42501', null, 'tampoco se anula a mano');
select lives_ok($$select public.void_group_payment('70000000-0000-4000-8000-000000000001')$$, 'cualquier integrante anula un pago');

set local request.jwt.claims = '{"sub": "c0000000-0000-4000-8000-000000000003", "role": "authenticated"}';
select lives_ok($$select public.void_group_payment('70000000-0000-4000-8000-000000000001')$$, 'anular de nuevo no falla');
select results_eq(
  $$select voided_by, deleted_at is not null from public.group_payments where id = '70000000-0000-4000-8000-000000000001'$$,
  $$values ('a0000000-0000-4000-8000-000000000001'::uuid, true)$$,
  'queda anulado por quien lo anuló primero'
);

-- ═════════════════════════ Link de invitación ═════════════════════════
create temporary table tokens (n int, token text) on commit drop;
grant all on tokens to authenticated, anon;

set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
insert into tokens select 1, public.rotate_invite_token('90000000-0000-4000-8000-000000000002');
select ok((select token ~ '^[A-Za-z0-9_-]{22}$' from tokens where n = 1), 'el token tiene 128 bits en base64url (22 caracteres)');

set local role anon;
select isnt(public.get_guest_group((select token from tokens where n = 1)), null, 'el link nuevo abre la web de invitados');
select is(
  (select jsonb_array_length(public.get_guest_group((select token from tokens where n = 1)) -> 'payments')),
  0,
  'la web de invitados no muestra pagos anulados'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "c0000000-0000-4000-8000-000000000003", "role": "authenticated"}';
insert into tokens select 2, public.rotate_invite_token('90000000-0000-4000-8000-000000000002');
set local role anon;
select is(public.get_guest_group((select token from tokens where n = 1)), null, 'al regenerarlo, el link viejo deja de andar');
select isnt(public.get_guest_group((select token from tokens where n = 2)), null, 'y el nuevo anda');
select throws_ok($$select public.rotate_invite_token('90000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'el rol anónimo no regenera el link');

set local role authenticated;
select lives_ok($$select public.revoke_invite_token('90000000-0000-4000-8000-000000000002')$$, 'un integrante revoca el link');
set local role anon;
select is(public.get_guest_group((select token from tokens where n = 2)), null, 'el link revocado no devuelve nada');

set local role authenticated;
set local request.jwt.claims = '{"sub": "d0000000-0000-4000-8000-000000000004", "role": "authenticated"}';
select throws_ok($$select public.rotate_invite_token('90000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'una ajena no regenera el link');
select throws_ok($$select public.revoke_invite_token('90000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'una ajena no revoca el link');
set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok($$select public.rotate_invite_token('90000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'un ex integrante no regenera el link');

select * from finish();
rollback;
