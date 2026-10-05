-- El secreto de los cron vive solo en Vault: cron_secret_matches.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

delete from vault.secrets where name = 'fx_cron_secret';
select is(public.cron_secret_matches('cualquiera'), false, 'sin secreto en Vault no autoriza nada');

select vault.create_secret('s3cret-largo', 'fx_cron_secret');
select is(public.cron_secret_matches('s3cret-largo'), true, 'el secreto correcto autoriza');
select is(public.cron_secret_matches('s3cret-larg'), false, 'uno parecido no');
select is(public.cron_secret_matches(''), false, 'vacío no');
select is(public.cron_secret_matches(null), false, 'nulo no');

select ok(
  has_function_privilege('service_role', 'public.cron_secret_matches(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.cron_secret_matches(text)', 'execute')
  and not has_function_privilege('anon', 'public.cron_secret_matches(text)', 'execute'),
  'solo service_role la ejecuta'
);

select * from finish();
rollback;
