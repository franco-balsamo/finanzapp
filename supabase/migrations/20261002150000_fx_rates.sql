-- Cotizaciones (T6, 02 §1 y D7): cada movimiento guarda la venta de MEP,
-- oficial y blue de la fecha del gasto, en hora de Argentina. Las cargan dos
-- cron desde Edge Functions (DolarApi cada 10 minutos, ArgentinaDatos una vez
-- por día). Decisiones en docs/decisiones/2026-10-02-spec-t6-cotizaciones.md.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ───────────────────────── fx_rates ─────────────────────────

-- El día de la cotización en hora de Argentina. fetched_at es la hora que
-- informa la fuente, no la del cron: el sábado DolarApi sigue devolviendo la
-- del viernes y así queda como del viernes.
alter table public.fx_rates
  add column rate_date date generated always as
    ((fetched_at at time zone 'America/Argentina/Buenos_Aires')::date) stored,
  add constraint fx_rates_source_kind_fetched_key unique (source, kind, fetched_at);

drop index public.fx_rates_kind_fetched_idx;
create index fx_rates_kind_date_idx on public.fx_rates (kind, rate_date desc, fetched_at desc);

-- La venta más reciente desde el día pedido hasta 4 días antes: cubre fines
-- de semana y feriados puente (02 §1). Sin nada en esa ventana, null.
create function private.fx_sell_on(kind text, on_date date) returns numeric
language sql stable security definer set search_path = '' as $$
  select r.sell from public.fx_rates r
  where r.kind = fx_sell_on.kind and r.rate_date between on_date - 4 and on_date
  order by r.rate_date desc, r.fetched_at desc
  limit 1;
$$;

-- ───────────────────── Trigger de movimientos ─────────────────────

-- La app nunca manda cotizaciones: lo que venga en fx_* se pisa. Se calcula
-- al crear, al cambiar la fecha y mientras el movimiento siga pendiente; si
-- no, queda lo que ya estaba guardado.
create function private.fill_movement_fx() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.date = old.date and not old.fx_pending then
    new.fx_mep := old.fx_mep;
    new.fx_oficial := old.fx_oficial;
    new.fx_blue := old.fx_blue;
    new.fx_pending := false;
    return new;
  end if;

  new.fx_mep := private.fx_sell_on('mep', new.date);
  new.fx_oficial := private.fx_sell_on('oficial', new.date);
  new.fx_blue := private.fx_sell_on('blue', new.date);
  new.fx_pending := new.fx_mep is null or new.fx_oficial is null or new.fx_blue is null;
  return new;
end;
$$;

create trigger movements_fx before insert or update on public.movements
  for each row execute function private.fill_movement_fx();

-- ───────────────────────── Ingesta ─────────────────────────

-- La hora de una fila de la API, o null si no se puede leer.
-- dolarapi: fechaActualizacion (ISO). argentinadatos: fecha (AAAA-MM-DD), que
-- se guarda a las 23:59:59 de Argentina para que el cierre le gane a las del día.
create function private.fx_row_time(source text, r jsonb) returns timestamptz
language plpgsql stable set search_path = '' as $$
begin
  if source = 'dolarapi' then
    return (r ->> 'fechaActualizacion')::timestamptz;
  end if;
  if (r ->> 'fecha') !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return ((r ->> 'fecha')::date + time '23:59:59') at time zone 'America/Argentina/Buenos_Aires';
exception when others then
  return null;
end;
$$;

-- La llaman las Edge Functions con service_role. Guarda las cotizaciones sin
-- duplicar, saltea las filas que no se pueden leer y después completa los
-- movimientos pendientes. Devuelve cuántas filas nuevas guardó.
create function public.ingest_fx_rates(source text, payload jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  inserted integer;
begin
  if ingest_fx_rates.source is null or ingest_fx_rates.source not in ('dolarapi', 'argentinadatos') then
    raise exception 'unknown fx source %', ingest_fx_rates.source using errcode = '22023';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'array' then
    raise exception 'payload must be a JSON array' using errcode = '22023';
  end if;

  insert into public.fx_rates (source, kind, buy, sell, fetched_at)
  select ingest_fx_rates.source, x.kind,
    case when jsonb_typeof(x.r -> 'compra') = 'number'
          and round((x.r ->> 'compra')::numeric, 4) > 0 and (x.r ->> 'compra')::numeric < 1e10
         then (x.r ->> 'compra')::numeric end,
    (x.r ->> 'venta')::numeric,
    x.at
  from (
    select r,
      case r ->> 'casa'
        when 'bolsa' then 'mep'
        when 'contadoconliqui' then 'ccl'
        when 'oficial' then 'oficial'
        when 'blue' then 'blue'
        when 'tarjeta' then 'tarjeta'
        when 'cripto' then 'cripto'
      end as kind,
      private.fx_row_time(ingest_fx_rates.source, r) as at
    from jsonb_array_elements(payload) as r
    where jsonb_typeof(r) = 'object'
  ) x
  where x.kind is not null
    and x.at is not null
    and jsonb_typeof(x.r -> 'venta') = 'number'
    and round((x.r ->> 'venta')::numeric, 4) > 0
    and (x.r ->> 'venta')::numeric < 1e10
  on conflict on constraint fx_rates_source_kind_fetched_key do nothing;
  get diagnostics inserted = row_count;

  -- El trigger vuelve a calcular las filas pendientes.
  update public.movements set fx_pending = true where fx_pending;

  return inserted;
end;
$$;

-- Los permisos por defecto de Supabase le dan execute a authenticated.
revoke all on function public.ingest_fx_rates(text, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_fx_rates(text, jsonb) to service_role;

-- ───────────────────────── Cron ─────────────────────────

-- Llama a una Edge Function con el secreto compartido. La URL base
-- (…/functions/v1) y el secreto viven en Vault; si falta alguno, avisa y no
-- hace nada, así la base local sin configurar no falla.
create function private.call_edge(fn text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  base text;
  secret text;
begin
  select s.decrypted_secret into base from vault.decrypted_secrets s where s.name = 'functions_url';
  select s.decrypted_secret into secret from vault.decrypted_secrets s where s.name = 'fx_cron_secret';
  if base is null or secret is null then
    raise warning 'call_edge(%): functions_url or fx_cron_secret missing in Vault', fn;
    return null;
  end if;

  return net.http_post(
    url := rtrim(base, '/') || '/' || fn,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

-- pg_cron usa UTC: 06:00 UTC son las 3:00 en Argentina.
select cron.schedule('fx-rates', '*/10 * * * *', $$select private.call_edge('fx-rates')$$);
select cron.schedule('fx-history', '0 6 * * *', $$select private.call_edge('fx-history')$$);

revoke all on function
  private.fx_sell_on(text, date),
  private.fill_movement_fx(),
  private.fx_row_time(text, jsonb),
  private.call_edge(text)
from public, anon, authenticated;
