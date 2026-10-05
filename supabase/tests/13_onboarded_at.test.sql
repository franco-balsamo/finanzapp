-- Marca de bienvenida hecha: el dueño la escribe y otro usuario no.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- Ana (a…01) y Beto (b…02). user_settings se crea sola al registrarse.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'beto@test.local');

select is(
  (select onboarded_at from public.user_settings where user_id = 'a0000000-0000-4000-8000-000000000001'),
  null,
  'Un usuario nuevo arranca sin la bienvenida hecha'
);

-- ── Ana ──
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$update public.user_settings
    set onboarded_at = now(), goal = 'control', fx_reference = 'blue', display_currency = 'USD'
    where user_id = 'a0000000-0000-4000-8000-000000000001'$$,
  'Ana guarda la bienvenida'
);

-- Beto: la fila no se ve por RLS, así que el update no toca nada.
update public.user_settings set onboarded_at = now() where user_id = 'b0000000-0000-4000-8000-000000000002';

reset role;

select isnt(
  (select onboarded_at from public.user_settings where user_id = 'a0000000-0000-4000-8000-000000000001'),
  null,
  'La bienvenida de Ana queda hecha'
);
select is(
  (select onboarded_at from public.user_settings where user_id = 'b0000000-0000-4000-8000-000000000002'),
  null,
  'Ana no puede marcar la bienvenida de Beto'
);

select * from finish();
rollback;
