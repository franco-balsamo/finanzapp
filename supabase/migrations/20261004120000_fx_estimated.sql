-- Ajustes de T6 (4/10, 02 §1, §2 y §3): los pendientes de más de 2 días se
-- resuelven con la última cotización anterior y quedan estimados, y la app
-- pide el dólar tarjeta de una fecha con fx_rate_on. Decisiones en
-- docs/decisiones/2026-10-02-spec-t6-cotizaciones.md ("Ajustes del 4/10").

-- La cotización salió de fuera de la ventana de 4 días: hay que revisarla.
alter table public.movements add column fx_estimated boolean not null default false;

-- La última venta anterior a la fecha, sin límite de días. Si la fecha es
-- anterior a todo el historial de ese tipo, la primera disponible.
create function private.fx_sell_fallback(kind text, on_date date) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select r.sell from public.fx_rates r
     where r.kind = fx_sell_fallback.kind and r.rate_date <= on_date
     order by r.rate_date desc, r.fetched_at desc limit 1),
    (select r.sell from public.fx_rates r
     where r.kind = fx_sell_fallback.kind
     order by r.rate_date, r.fetched_at limit 1)
  );
$$;

-- Igual que en T6, más fx_estimated. Solo private.resolve_stale_fx prende
-- mangos.fx_resolve_stale: así la estimación la hace la tarea diaria, nunca
-- una carga o una edición.
create or replace function private.fill_movement_fx() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  stale boolean := tg_op = 'UPDATE'
    and current_setting('mangos.fx_resolve_stale', true) = 'on'
    and new.date < (now() at time zone 'America/Argentina/Buenos_Aires')::date - 2;
begin
  if tg_op = 'UPDATE' and new.date = old.date and not old.fx_pending then
    new.fx_mep := old.fx_mep;
    new.fx_oficial := old.fx_oficial;
    new.fx_blue := old.fx_blue;
    new.fx_pending := false;
    new.fx_estimated := old.fx_estimated;
    return new;
  end if;

  new.fx_mep := private.fx_sell_on('mep', new.date);
  new.fx_oficial := private.fx_sell_on('oficial', new.date);
  new.fx_blue := private.fx_sell_on('blue', new.date);
  new.fx_estimated := false;

  if stale and (new.fx_mep is null or new.fx_oficial is null or new.fx_blue is null) then
    new.fx_mep := coalesce(new.fx_mep, private.fx_sell_fallback('mep', new.date));
    new.fx_oficial := coalesce(new.fx_oficial, private.fx_sell_fallback('oficial', new.date));
    new.fx_blue := coalesce(new.fx_blue, private.fx_sell_fallback('blue', new.date));
    new.fx_estimated := true;
  end if;

  new.fx_pending := new.fx_mep is null or new.fx_oficial is null or new.fx_blue is null;
  return new;
end;
$$;

-- Tarea diaria: resuelve los pendientes cuya fecha tiene más de 2 días.
-- Devuelve cuántos movimientos tocó.
create function private.resolve_stale_fx() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  touched integer;
begin
  perform set_config('mangos.fx_resolve_stale', 'on', true);
  update public.movements set fx_pending = true
  where fx_pending and date < (now() at time zone 'America/Argentina/Buenos_Aires')::date - 2;
  get diagnostics touched = row_count;
  perform set_config('mangos.fx_resolve_stale', 'off', true);
  return touched;
end;
$$;

-- Una hora después del historial (pg_cron usa UTC: 4:00 en Argentina).
select cron.schedule('fx-resolve-stale', '0 7 * * *', $$select private.resolve_stale_fx()$$);

-- ───────────────────────── fx_rate_on ─────────────────────────

-- Para la app: la venta de un tipo en una fecha, con la misma ventana de 4
-- días que el trigger. La usa con 'tarjeta' para proponer debited_amount y
-- los pagos de dólares en pesos (02 §2 y §3). Sin datos, null.
create function public.fx_rate_on(kind text, on_date date) returns numeric
language plpgsql stable security definer set search_path = '' as $$
begin
  if kind is null or kind not in ('mep', 'oficial', 'blue', 'tarjeta', 'ccl', 'cripto') then
    raise exception 'unknown fx kind %', kind using errcode = '22023';
  end if;
  return private.fx_sell_on(kind, on_date);
end;
$$;

revoke all on function
  public.fx_rate_on(text, date),
  private.fx_sell_fallback(text, date),
  private.resolve_stale_fx(),
  private.fill_movement_fx()
from public, anon, authenticated;
grant execute on function public.fx_rate_on(text, date) to authenticated;
