-- Cierre de grupos: save_group_expense, remove_member y delete_group (02 §7).
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

-- Ana (dueña), Beto, Caro (ex integrante), Dani (ajena) y Eli (con cuenta, nunca participó).
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'beto@test.local'),
  ('c0000000-0000-4000-8000-000000000003', 'caro@test.local'),
  ('d0000000-0000-4000-8000-000000000004', 'dani@test.local'),
  ('e1000000-0000-4000-8000-000000000005', 'eli@test.local');

insert into public.accounts (id, user_id, name, type, currency) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Caja Ana', 'bank', 'ARS'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'Caja Beto', 'bank', 'ARS');

insert into public.groups (id, name, currency) values
  ('90000000-0000-4000-8000-000000000001', 'Cabaña', 'ARS'),
  ('90000000-0000-4000-8000-000000000002', 'Fútbol', 'ARS'),
  ('90000000-0000-4000-8000-000000000003', 'Huérfano', 'ARS');
insert into public.group_members (id, group_id, user_id, display_name, left_at) values
  ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Ana', null),
  ('e0000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Beto', null),
  ('e0000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'Caro', null),
  ('e0000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000001', null, 'Juan', null),
  ('e0000000-0000-4000-8000-000000000005', '90000000-0000-4000-8000-000000000001', null, 'Lu', null),
  ('e0000000-0000-4000-8000-000000000006', '90000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000005', 'Eli', null),
  ('e0000000-0000-4000-8000-000000000007', '90000000-0000-4000-8000-000000000001', null, 'Pagador', null),
  ('e0000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004', 'Dani', null),
  ('e0000000-0000-4000-8000-000000000021', '90000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'Beto', null);
update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000001' where id = '90000000-0000-4000-8000-000000000001';
update public.groups set owner_member_id = 'e0000000-0000-4000-8000-000000000011' where id = '90000000-0000-4000-8000-000000000002';
-- Huérfano queda sin dueño.

-- Un gasto viejo donde participó Caro, que después se va. Juan solo aparece en un pago.
insert into public.group_expenses (id, group_id, date, description, amount, currency, payer_member_id, split_mode) values
  ('ab000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '2026-09-01', 'Viejo', 3000, 'ARS',
   'e0000000-0000-4000-8000-000000000001', 'equal');
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 1),
  ('90000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 1);
insert into public.group_payments (group_id, from_member_id, to_member_id, amount, date, deleted_at) values
  ('90000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', 100, '2026-09-02', now());
-- Un gasto borrado pagado por "Pagador": participó aunque no cuente.
insert into public.group_expenses (id, group_id, date, description, amount, currency, payer_member_id, split_mode, deleted_at) values
  ('ab000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', '2026-09-03', 'Borrado', 500, 'ARS',
   'e0000000-0000-4000-8000-000000000007', 'equal', now());
insert into public.group_expense_parts (group_id, group_expense_id, member_id, value) values
  ('90000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 1);
update public.group_members set left_at = now() where id = 'e0000000-0000-4000-8000-000000000003';

select is(
  (select jsonb_object_agg(m.display_name, b.balance_minor)
   from private.group_balances('90000000-0000-4000-8000-000000000001') b
   join public.group_members m on m.id = b.member_id where m.display_name in ('Ana', 'Pagador')),
  '{"Ana": 150000, "Pagador": 0}'::jsonb,
  'un gasto borrado y un pago anulado no cuentan para los saldos'
);

set local role authenticated;

-- ═════════════════════════ save_group_expense ═════════════════════════
set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is(
  public.save_group_expense('ab000000-0000-4000-8000-000000000010', '90000000-0000-4000-8000-000000000001',
    '2026-10-01', 'Asado', 90000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'equal', '00000000-0000-4000-8000-000000000002',
    '[{"member_id": "e0000000-0000-4000-8000-000000000001", "value": "999"}, {"member_id": "e0000000-0000-4000-8000-000000000002"},
      {"member_id": "e0000000-0000-4000-8000-000000000004"}]'),
  'ab000000-0000-4000-8000-000000000010'::uuid,
  'partes iguales: guarda gasto y partes'
);
select results_eq(
  $$select value from public.group_expense_parts where group_expense_id = 'ab000000-0000-4000-8000-000000000010'$$,
  $$values (1::numeric), (1), (1)$$,
  'en partes iguales cada parte se guarda en 1, aunque llegue otro valor'
);
select lives_ok(
  $$select public.save_group_expense('ab000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Súper', 1000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'exact', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000002", "value": "600.00"}, {"member_id": "e0000000-0000-4000-8000-000000000001", "value": "399.60"}]')$$,
  'montos exactos con $0,40 de diferencia se aceptan'
);
reset role;
select is(
  (select s.share_minor from private.member_shares('ab000000-0000-4000-8000-000000000011') s
   where s.member_id = 'e0000000-0000-4000-8000-000000000002'),
  60040::numeric,
  'la diferencia va al que pagó: $600,40'
);
set local role authenticated;
select throws_ok(
  $$select public.save_group_expense(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Trampa', 1000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'exact', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000002", "value": "600.00"}, {"member_id": "e0000000-0000-4000-8000-000000000001", "value": "399.40"}]')$$,
  '22023', null,
  'montos exactos que no suman el total ($0,60 de diferencia) se rechazan, aunque se llame a la API directo'
);
select throws_ok(
  $$select public.save_group_expense(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Trampa', 1000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'exact', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000002", "value": "1500.00"}, {"member_id": "e0000000-0000-4000-8000-000000000001", "value": "-500.00"}]')$$,
  '22023', null,
  'una parte exacta negativa se rechaza'
);
select throws_ok(
  $$select public.save_group_expense(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Trampa', 1000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'exact', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000002"}]')$$,
  '22023', null,
  'una parte exacta sin monto se rechaza'
);
select throws_ok(
  $$select public.save_group_expense(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Nadie', 1000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'equal', null, '[]')$$,
  '22023', null,
  'partes iguales sin nadie se rechaza'
);
select throws_ok(
  $$select public.save_group_expense(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Doble', 1000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'equal', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000002"}, {"member_id": "e0000000-0000-4000-8000-000000000002"}]')$$,
  '22023', null,
  'un integrante repetido se rechaza'
);
select throws_ok(
  $$select public.save_group_expense(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Con Dani', 1000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'equal', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000011"}]')$$,
  '22023', null,
  'una parte de un integrante de otro grupo se rechaza'
);
select throws_ok(
  $$select public.save_group_expense(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Con Caro', 1000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'equal', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000003"}]')$$,
  '22023', null,
  'un gasto nuevo no incluye a quien ya se fue'
);
select throws_ok(
  $$select public.save_group_expense(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Pagó Caro', 1000, 'ARS', null, 'e0000000-0000-4000-8000-000000000003', 'equal', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000002"}]')$$,
  '22023', null,
  'un gasto nuevo no lo paga quien ya se fue'
);
select lives_ok(
  $$select public.save_group_expense('ab000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
      '2026-09-01', 'Viejo corregido', 3000, 'ARS', null, 'e0000000-0000-4000-8000-000000000001', 'equal', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000001"}, {"member_id": "e0000000-0000-4000-8000-000000000003"}]')$$,
  'editar un gasto viejo deja a quien ya se fue si ya participaba'
);
select throws_ok(
  $$select public.save_group_expense(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Sin cotización', 100, 'USD', null, 'e0000000-0000-4000-8000-000000000002', 'equal', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000002"}]')$$,
  '22023', null,
  'un gasto en dólares en un grupo en pesos exige cotización'
);
select throws_ok(
  $$select public.save_group_expense(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Cotización de más', 100, 'ARS', 1500, 'e0000000-0000-4000-8000-000000000002', 'equal', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000002"}]')$$,
  '22023', null,
  'un gasto en la moneda del grupo no lleva cotización'
);
select throws_ok(
  $$select public.save_group_expense(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Cero', 0, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'equal', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000002"}]')$$,
  '22023', null,
  'un gasto de $0 se rechaza'
);

-- Editar: reemplaza las partes y guarda quién editó.
select lives_ok(
  $$select public.save_group_expense('ab000000-0000-4000-8000-000000000010', '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Asado', 90000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'equal', '00000000-0000-4000-8000-000000000002',
      '[{"member_id": "e0000000-0000-4000-8000-000000000001"}, {"member_id": "e0000000-0000-4000-8000-000000000002"}]')$$,
  'editar el gasto para excluir a Juan'
);
select is(
  (select count(*)::int from public.group_expense_parts where group_expense_id = 'ab000000-0000-4000-8000-000000000010'),
  2,
  'las partes se reemplazan: Juan ya no está'
);

-- Directo a la API: todo rechazado.
select throws_ok(
  $$update public.group_expense_parts set value = 5000 where group_expense_id = 'ab000000-0000-4000-8000-000000000011'$$,
  '42501', null, 'cambiar el valor de una parte directo se rechaza'
);
select throws_ok(
  $$delete from public.group_expense_parts where group_expense_id = 'ab000000-0000-4000-8000-000000000011'$$,
  '42501', null, 'borrar partes directo se rechaza'
);
select throws_ok(
  $$update public.group_expenses set amount = 1 where id = 'ab000000-0000-4000-8000-000000000011'$$,
  '42501', null, 'cambiar el monto directo se rechaza'
);
select throws_ok(
  $$insert into public.group_expenses (group_id, date, description, amount, currency, payer_member_id, split_mode)
    values ('90000000-0000-4000-8000-000000000001', '2026-10-01', 'Directo', 1, 'ARS', 'e0000000-0000-4000-8000-000000000002', 'equal')$$,
  '42501', null, 'crear un gasto directo se rechaza'
);
select lives_ok(
  $$update public.group_expenses set deleted_at = now() where id = 'ab000000-0000-4000-8000-000000000011'$$,
  'el borrado lógico sigue siendo directo'
);
select throws_ok(
  $$select public.save_group_expense('ab000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Revivido', 1000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'equal', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000002"}]')$$,
  '55000', null,
  'un gasto borrado no se edita'
);

set local request.jwt.claims = '{"sub": "d0000000-0000-4000-8000-000000000004", "role": "authenticated"}';
select throws_ok(
  $$select public.save_group_expense(gen_random_uuid(), '90000000-0000-4000-8000-000000000001',
      '2026-10-01', 'Colado', 1000, 'ARS', null, 'e0000000-0000-4000-8000-000000000002', 'equal', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000002"}]')$$,
  '42501', null,
  'una ajena no carga gastos en el grupo'
);
select throws_ok(
  $$select public.save_group_expense('ab000000-0000-4000-8000-000000000010', '90000000-0000-4000-8000-000000000002',
      '2026-10-01', 'Robado', 1, 'ARS', null, 'e0000000-0000-4000-8000-000000000011', 'equal', null,
      '[{"member_id": "e0000000-0000-4000-8000-000000000011"}]')$$,
  '42501', null,
  'el UUID de un gasto de otro grupo no se pisa'
);

-- ═════════════════════════ remove_member ═════════════════════════
set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok($$select public.remove_member('e0000000-0000-4000-8000-000000000005')$$,
  '42501', null, 'un integrante que no es dueño no quita a nadie');

set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok($$select public.remove_member('e0000000-0000-4000-8000-000000000005')$$,
  'la dueña quita a un provisorio que nunca participó');
select lives_ok($$select public.remove_member('e0000000-0000-4000-8000-000000000006')$$,
  'la dueña quita a alguien con cuenta que nunca participó');
select is_empty(
  $$select 1 from public.group_members where id in ('e0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000006')$$,
  'las filas se borran: no quedan como ex integrantes'
);
select throws_ok($$select public.remove_member('e0000000-0000-4000-8000-000000000002')$$,
  '55000', null, 'no se quita a quien participó en un gasto');
select throws_ok($$select public.remove_member('e0000000-0000-4000-8000-000000000004')$$,
  '55000', null, 'tampoco a quien solo aparece en un pago anulado');
select throws_ok($$select public.remove_member('e0000000-0000-4000-8000-000000000007')$$,
  '55000', null, 'tampoco a quien pagó un gasto borrado');
select throws_ok($$select public.remove_member('e0000000-0000-4000-8000-000000000001')$$,
  '55000', null, 'la dueña no se quita a sí misma: sale con leave_group');
select throws_ok($$select public.remove_member('e0000000-0000-4000-8000-000000000011')$$,
  'P0002', null, 'no se quita a alguien de un grupo ajeno');
reset role;
select is(
  (select count(*)::int from public.notifications where user_id = 'e1000000-0000-4000-8000-000000000005' and title = 'Te quitaron de Cabaña'),
  1,
  'se avisa a quien tenía cuenta'
);

-- ═════════════════════════ delete_group ═════════════════════════
-- Ana y Beto tienen gastos personales que vienen de Cabaña.
insert into public.movements (user_id, type, date, description, amount, currency, account_id, group_expense_id, my_share) values
  ('b0000000-0000-4000-8000-000000000002', 'expense', '2026-10-01', 'Asado', 90000, 'ARS', 'b1000000-0000-4000-8000-000000000002',
   'ab000000-0000-4000-8000-000000000010', 45000),
  ('a0000000-0000-4000-8000-000000000001', 'expense', '2026-09-01', 'Viejo', 3000, 'ARS', 'a1000000-0000-4000-8000-000000000001',
   'ab000000-0000-4000-8000-000000000001', 1500);
update public.groups set invite_token_hash = encode(sha256(convert_to('tok', 'UTF8')), 'hex') where id = '90000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok($$select public.delete_group('90000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'un integrante que no es dueño no elimina el grupo');
select throws_ok($$select public.delete_group('90000000-0000-4000-8000-000000000003')$$,
  '42501', null, 'un grupo sin dueño no lo puede eliminar nadie');

set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok($$select public.delete_group('90000000-0000-4000-8000-000000000001')$$, 'la dueña elimina el grupo');
select ok(not public.is_group_member('90000000-0000-4000-8000-000000000001'), 'el grupo ya no se ve');
select throws_ok($$select public.delete_group('90000000-0000-4000-8000-000000000001')$$,
  'P0002', null, 'eliminarlo de nuevo falla');

reset role;
select results_eq(
  $$select count(*)::int from public.movements where group_expense_id is not null or my_share is not null$$,
  $$values (0)$$,
  'los gastos personales de Ana y Beto que venían del grupo vuelven a contar completos'
);
select results_eq(
  $$select deleted_at is not null, invite_token_hash is null from public.groups where id = '90000000-0000-4000-8000-000000000001'$$,
  $$values (true, true)$$,
  'borrado lógico y link revocado'
);
select is(
  (select count(*)::int from public.notifications where title = 'Se eliminó Cabaña'),
  1,
  'se avisa a Beto (Caro ya se había ido y a Ana no hace falta)'
);

select * from finish();
rollback;
