-- Antes de la beta: cada clave foránea tiene un índice que empieza por sus columnas
-- (lo que pide el advisor de Supabase, "unindexed_foreign_keys").
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select is_empty(
  $$select c.conrelid::regclass::text || ' ' || c.conname
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where c.contype = 'f'
      and n.nspname in ('public', 'private')
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
          and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey
      )$$,
  'todas las claves foráneas tienen un índice que las cubre'
);

select * from finish();
rollback;
