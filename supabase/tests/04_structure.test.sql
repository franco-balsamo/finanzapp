-- Estructura: índices de D16, políticas y funciones security definer.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_index('public', 'group_members', 'group_members_user_group_idx', array['user_id', 'group_id'], 'D16: group_members(user_id, group_id)');
select has_index('public', 'movements', 'movements_user_card_date_idx', array['user_id', 'card_id', 'date'], 'D16: movements(user_id, card_id, date)');
select has_index('public', 'group_expenses', 'group_expenses_group_date_idx', array['group_id', 'date'], 'D16: group_expenses(group_id, date)');

select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity$$,
  'todas las tablas de public tienen políticas por fila'
);
select is_empty(
  $$select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('groups', 'group_members', 'group_expenses', 'group_expense_parts', 'group_payments')
      and coalesce(qual, '') || coalesce(with_check, '') not like '%is_group_member%'$$,
  'todas las políticas de grupo usan is_group_member'
);
select is_empty(
  $$select tablename, policyname from pg_policies where schemaname = 'public' and roles <> '{authenticated}'$$,
  'ninguna política es para el rol anónimo'
);
select is_empty(
  $$select table_name, privilege_type from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'$$,
  'el rol anónimo no tiene permisos sobre ninguna tabla'
);
select is_empty(
  $$select table_name from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'DELETE'
      and table_name in ('groups', 'group_members', 'group_expenses', 'group_payments')$$,
  'no hay delete en las tablas de grupo'
);

select ok(
  (select prosecdef and provolatile = 's' and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.is_group_member(uuid)'::regprocedure),
  'is_group_member: security definer, stable y search_path fijo'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.get_guest_group(text)'::regprocedure),
  'get_guest_group: security definer y search_path fijo'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.create_group(text, text, text)'::regprocedure),
  'create_group: security definer y search_path fijo'
);
select is(
  (select array_agg(p.proname::text order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  array['get_guest_group'],
  'get_guest_group es la única función que ejecuta el rol anónimo'
);

select * from finish();
rollback;
