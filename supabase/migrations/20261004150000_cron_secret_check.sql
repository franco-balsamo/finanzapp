-- El secreto de los cron vive solo en Vault (fx_cron_secret). Las Edge
-- Functions que llama pg_cron le preguntan a la base si el que les llegó es
-- el correcto, así no hay una segunda copia en las variables de las
-- funciones y se rota en un solo lugar. Decisiones en
-- docs/decisiones/2026-10-04-primer-deploy.md.

-- Compara los SHA-256 y no los textos: la comparación no filtra el secreto
-- aunque no sea de tiempo constante.
create function public.cron_secret_matches(token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select sha256(convert_to(s.decrypted_secret, 'UTF8')) = sha256(convert_to(token, 'UTF8'))
    from vault.decrypted_secrets s
    where s.name = 'fx_cron_secret'
  ), false)
  and token is not null and length(token) > 0;
$$;

revoke all on function public.cron_secret_matches(text) from public, anon, authenticated;
grant execute on function public.cron_secret_matches(text) to service_role;
