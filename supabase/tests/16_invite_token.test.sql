-- Web de invitados (W-1): groups.invite_token se guarda al rotar, lo leen solo los
-- integrantes y se borra al revocar o eliminar. La web y la exportación no lo devuelven.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Vos (a…01, dueño) y Beto (b…02, de afuera).
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'vos@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'beto@test.local');
insert into public.groups (id, name, currency) values
  ('90000000-0000-4000-8000-000000000001', 'Cabaña', 'ARS'),
  ('90000000-0000-4000-8000-000000000002', 'Asado', 'ARS');
insert into public.group_members (id, group_id, user_id, display_name) values
  ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Vos'),
  ('e0000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', null, 'Juan'),
  ('e0000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Vos');
update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000001' where id = '90000000-0000-4000-8000-000000000001';
update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000003' where id = '90000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', 'a0000000-0000-4000-8000-000000000001', 'role', 'authenticated',
  'amr', json_build_array(json_build_object('method', 'otp', 'timestamp', extract(epoch from now())::bigint - 60)))::text, true);

create temp table tok as select public.rotate_invite_token('90000000-0000-4000-8000-000000000001') as t;

select is(
  (select invite_token from public.groups where id = '90000000-0000-4000-8000-000000000001'),
  (select t from tok),
  'rotar guarda el token y un integrante lo lee'
);
select is(
  (select invite_token_hash from public.groups where id = '90000000-0000-4000-8000-000000000001'),
  (select encode(sha256(convert_to(t, 'UTF8')), 'hex') from tok),
  'la huella sigue siendo la del token'
);
select is(
  public.get_guest_group((select t from tok)) ->> 'name',
  'Cabaña',
  'el link abre la web del grupo'
);
select ok(
  position((select t from tok) in public.get_guest_group((select t from tok))::text) = 0,
  'la web no devuelve el token'
);

reset role;
select ok(
  position((select t from tok) in public.export_account()::text) = 0,
  'la exportación no devuelve el token'
);
set local role authenticated;

-- Beto no es integrante: no ve la fila.
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select is_empty(
  $$select invite_token from public.groups where id = '90000000-0000-4000-8000-000000000001'$$,
  'alguien de afuera no ve el token'
);

select set_config('request.jwt.claims', json_build_object(
  'sub', 'a0000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);
select public.revoke_invite_token('90000000-0000-4000-8000-000000000001');
select is(
  (select invite_token from public.groups where id = '90000000-0000-4000-8000-000000000001'),
  null,
  'revocar borra el token'
);

select public.rotate_invite_token('90000000-0000-4000-8000-000000000002');
select public.delete_group('90000000-0000-4000-8000-000000000002');
reset role;
select is(
  (select invite_token from public.groups where id = '90000000-0000-4000-8000-000000000002'),
  null,
  'eliminar el grupo borra el token'
);

select * from finish();
rollback;
