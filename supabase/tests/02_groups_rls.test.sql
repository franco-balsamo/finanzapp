-- T-25 y permisos de grupo (02 §7): is_group_member en todas las políticas,
-- permisos por columna, sin delete y sin referencias a otro grupo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

-- Ana (dueña), Beto (integrante), Caro (ex integrante) y Dani (ajena, con su propio grupo).
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'beto@test.local'),
  ('c0000000-0000-4000-8000-000000000003', 'caro@test.local'),
  ('d0000000-0000-4000-8000-000000000004', 'dani@test.local');

insert into public.accounts (id, user_id, name, type, currency) values
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'Caja Beto', 'bank', 'ARS'),
  ('d1000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 'Caja Dani', 'bank', 'ARS');

insert into public.groups (id, name, currency) values
  ('90000000-0000-4000-8000-000000000001', 'Cabaña', 'ARS'),
  ('90000000-0000-4000-8000-000000000002', 'Fútbol', 'ARS');
insert into public.group_members (id, group_id, user_id, display_name, payment_alias, left_at) values
  ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Ana', 'ana.mp', null),
  ('e0000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Beto', 'beto.mp', null),
  ('e0000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'Caro', null, now()),
  ('e0000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000001', null, 'Juan', null, null),
  ('e0000000-0000-4000-8000-000000000005', '90000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004', 'Dani', null, null);
update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000001' where id = '90000000-0000-4000-8000-000000000001';
update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000005' where id = '90000000-0000-4000-8000-000000000002';

insert into public.group_expenses (id, group_id, date, description, amount, currency, payer_member_id, split_mode, created_by) values
  ('f0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '2026-10-01', 'Cabaña', 90000, 'ARS',
   'e0000000-0000-4000-8000-000000000001', 'equal', 'a0000000-0000-4000-8000-000000000001');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 1),
  ('90000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 1),
  ('90000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004', 1);
insert into public.group_payments (group_id, from_member_id, to_member_id, amount, date) values
  ('90000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', 30000, '2026-10-02');

set local role authenticated;

-- ── T-25 ──
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select is(public.is_group_member('90000000-0000-4000-8000-000000000001'), true, 'T-25: integrante → true');
set local request.jwt.claims = '{"sub": "c0000000-0000-4000-8000-000000000003", "role": "authenticated"}';
select is(public.is_group_member('90000000-0000-4000-8000-000000000001'), false, 'T-25: ex integrante (left_at) → false');
set local request.jwt.claims = '{"sub": "d0000000-0000-4000-8000-000000000004", "role": "authenticated"}';
select is(public.is_group_member('90000000-0000-4000-8000-000000000001'), false, 'T-25: ajeno → false');

-- ── Dani, ajena: no ve ni escribe nada de Cabaña ──
select is_empty($$select 1 from public.groups where id = '90000000-0000-4000-8000-000000000001'$$, 'la ajena no ve el grupo');
select is_empty($$select 1 from public.group_members where group_id = '90000000-0000-4000-8000-000000000001'$$, 'la ajena no ve los integrantes');
select is_empty($$select 1 from public.group_expenses where group_id = '90000000-0000-4000-8000-000000000001'$$, 'la ajena no ve los gastos');
select is_empty($$select 1 from public.group_expense_parts where group_id = '90000000-0000-4000-8000-000000000001'$$, 'la ajena no ve las partes');
select is_empty($$select 1 from public.group_payments where group_id = '90000000-0000-4000-8000-000000000001'$$, 'la ajena no ve los pagos');
select throws_ok(
  $$insert into public.group_expenses (group_id, date, description, amount, currency, payer_member_id, split_mode)
    values ('90000000-0000-4000-8000-000000000001', '2026-10-02', 'colada', 1000, 'ARS', 'e0000000-0000-4000-8000-000000000001', 'equal')$$,
  '42501', null,
  'la ajena no carga gastos en el grupo'
);
select throws_ok(
  $$insert into public.group_members (group_id, display_name) values ('90000000-0000-4000-8000-000000000001', 'Colado')$$,
  '42501', null,
  'la ajena no suma personas al grupo'
);
select throws_ok(
  $$insert into public.movements (type, date, description, amount, currency, account_id, group_expense_id, my_share)
    values ('expense', '2026-10-01', 'Cabaña', 90000, 'ARS', 'd1000000-0000-4000-8000-000000000004',
            'f0000000-0000-4000-8000-000000000001', 30000)$$,
  '23503', null,
  'la ajena no vincula un movimiento a un gasto del grupo'
);

-- ── Caro, ex integrante ──
set local request.jwt.claims = '{"sub": "c0000000-0000-4000-8000-000000000003", "role": "authenticated"}';
select is_empty($$select 1 from public.group_expenses$$, 'la ex integrante ya no ve los gastos');

-- ── Beto, integrante: no referencia a integrantes de otro grupo ──
set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select lives_ok(
  $$insert into public.group_expenses (id, group_id, date, description, amount, currency, payer_member_id, split_mode)
    values ('f0000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', '2026-10-02', 'Asado', 30000, 'ARS',
            'e0000000-0000-4000-8000-000000000002', 'equal')$$,
  'un integrante carga un gasto'
);
select throws_ok(
  $$insert into public.group_expenses (group_id, date, description, amount, currency, payer_member_id, split_mode)
    values ('90000000-0000-4000-8000-000000000001', '2026-10-02', 'Pagó Dani', 1000, 'ARS', 'e0000000-0000-4000-8000-000000000005', 'equal')$$,
  '23503', null,
  'un gasto con un pagador de otro grupo se rechaza'
);
select throws_ok(
  $$insert into public.group_expense_parts (group_id, group_expense_id, member_id, value)
    values ('90000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000005', 1)$$,
  '23503', null,
  'una parte para un integrante de otro grupo se rechaza'
);
select throws_ok(
  $$insert into public.group_payments (group_id, from_member_id, to_member_id, amount, date)
    values ('90000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000005', 100, '2026-10-02')$$,
  '23503', null,
  'un pago a un integrante de otro grupo se rechaza'
);
select throws_ok(
  $$insert into public.group_payments (group_id, from_member_id, to_member_id, amount, date)
    values ('90000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000002', 100, '2026-10-02')$$,
  '23503', null,
  'un pago desde un integrante de otro grupo se rechaza'
);
select lives_ok(
  $$insert into public.group_payments (group_id, from_member_id, to_member_id, amount, date)
    values ('90000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 10000, '2026-10-02')$$,
  'un integrante registra un pago'
);
select lives_ok(
  $$insert into public.movements (type, date, description, amount, currency, account_id, group_expense_id, my_share)
    values ('expense', '2026-10-02', 'Asado', 30000, 'ARS', 'b1000000-0000-4000-8000-000000000002',
            'f0000000-0000-4000-8000-000000000002', 10000)$$,
  'un integrante vincula su movimiento a un gasto del grupo'
);
select throws_ok(
  $$insert into public.group_expenses (group_id, date, description, amount, currency, payer_member_id, split_mode, category_id)
    values ('90000000-0000-4000-8000-000000000001', '2026-10-02', 'Sin categoría ajena', 1000, 'ARS',
            'e0000000-0000-4000-8000-000000000002', 'equal', '00000000-0000-4000-8000-0000000000ff')$$,
  '23503', null,
  'un gasto de grupo con una categoría inexistente se rechaza'
);
select lives_ok(
  $$update public.group_members set payment_alias = 'beto.nuevo' where id = 'e0000000-0000-4000-8000-000000000002'$$,
  'cada uno edita su propio alias'
);

-- ── Ana, dueña: permisos por columna ──
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$update public.groups set name = 'Cabaña 2026' where id = '90000000-0000-4000-8000-000000000001'$$,
  'un integrante cambia el nombre del grupo'
);
select throws_ok(
  $$update public.groups set deleted_at = now() where id = '90000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'deleted_at no se toca directo'
);
select throws_ok(
  $$update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000002' where id = '90000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'owner_member_id no se toca directo'
);
select throws_ok(
  $$update public.groups set invite_token_hash = repeat('0', 64) where id = '90000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'invite_token_hash no se toca directo'
);
select throws_ok(
  $$update public.groups set currency = 'USD' where id = '90000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'la moneda del grupo no se toca directo'
);
select throws_ok(
  $$insert into public.group_members (group_id, display_name, user_id)
    values ('90000000-0000-4000-8000-000000000001', 'Dani', 'd0000000-0000-4000-8000-000000000004')$$,
  '42501', null,
  'nadie asigna un user_id directo'
);
select lives_ok(
  $$insert into public.group_members (group_id, display_name) values ('90000000-0000-4000-8000-000000000001', 'Lu')$$,
  'un integrante suma un provisorio'
);
select throws_ok(
  $$update public.group_members set left_at = now() where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'left_at no se toca directo, ni en la fila propia'
);
select lives_ok(
  $$update public.group_members set display_name = 'Juancho' where id = 'e0000000-0000-4000-8000-000000000004'$$,
  'un integrante edita el nombre de un provisorio'
);
select lives_ok(
  $$update public.group_members set display_name = 'Betito' where id = 'e0000000-0000-4000-8000-000000000002'$$,
  'intenta editar el nombre de otro integrante con cuenta'
);
select throws_ok(
  $$update public.group_members set payment_alias = 'robado' where id = 'e0000000-0000-4000-8000-000000000004'$$,
  '42501', null,
  'nadie edita el alias de un provisorio'
);
select lives_ok(
  $$update public.group_members set payment_alias = 'robado' where id = 'e0000000-0000-4000-8000-000000000002'$$,
  'intenta editar el alias de otro integrante con cuenta'
);
select lives_ok(
  $$update public.group_expenses set deleted_at = now() where id = 'f0000000-0000-4000-8000-000000000002'$$,
  'un integrante borra (lógico) un gasto'
);
select throws_ok($$delete from public.group_expenses$$, '42501', null, 'no hay delete de gastos de grupo');
select throws_ok($$delete from public.groups$$, '42501', null, 'no hay delete de grupos');
select throws_ok($$delete from public.group_members$$, '42501', null, 'no hay delete de integrantes');
select throws_ok($$delete from public.group_payments$$, '42501', null, 'no hay delete de pagos');

-- create_group: Ana queda como integrante y dueña.
select lives_ok($$select public.create_group('Viaje', 'USD', 'Ana')$$, 'create_group crea el grupo');
select ok(
  (select g.owner_member_id = m.id
   from public.groups g join public.group_members m on m.group_id = g.id
   where g.name = 'Viaje' and m.user_id = auth.uid()),
  'create_group deja a quien lo crea como integrante y dueño'
);

set local request.jwt.claims = '{"role": "authenticated"}';
select throws_ok($$select public.create_group('Sin sesión', 'ARS', 'Nadie')$$, '42501', null, 'create_group sin usuario falla');

-- ── Lo que no debía cambiar ──
reset role;
select results_eq(
  $$select display_name, payment_alias from public.group_members where id in
    ('e0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000004') order by display_name$$,
  $$values ('Beto', 'beto.nuevo'), ('Juancho', null)$$,
  'Ana solo cambió el nombre del provisorio; el alias de Beto lo cambió Beto'
);

-- Un grupo eliminado deja de ser visible para sus integrantes.
update public.groups set deleted_at = now() where id = '90000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claims = '{"sub": "d0000000-0000-4000-8000-000000000004", "role": "authenticated"}';
select is(public.is_group_member('90000000-0000-4000-8000-000000000002'), false, 'en un grupo eliminado nadie es integrante');

select * from finish();
rollback;
