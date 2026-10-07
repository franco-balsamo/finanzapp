-- Cotizaciones: el historial de ArgentinaDatos ya no le gana a DolarApi en el día
-- (decisión docs/decisiones/2026-10-07-cotizacion-del-dia.md).
--
-- fx-history corre a las 3:00 y ArgentinaDatos ya trae una fila con la fecha de
-- hoy, con el cierre de ayer. Guardada a las 23:59:59 de hoy, le ganaba todo el
-- día a DolarApi, y como el conflicto no hacía nada, el cierre real nunca la
-- corregía. Ahora:
--   - se saltean las filas de ArgentinaDatos de hoy en adelante;
--   - una fila de ArgentinaDatos que ya estaba se corrige si cambió el valor.
-- Devuelve cuántas filas guardó o corrigió. Los movimientos ya guardados no
-- cambian: quedan con la cotización que se conocía al cargarlos.

create or replace function public.ingest_fx_rates(source text, payload jsonb) returns integer
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
  -- Con do update, dos filas del lote con la misma casa y hora harían fallar todo.
  select distinct on (x.kind, x.at) ingest_fx_rates.source, x.kind,
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
    -- El día de ArgentinaDatos que todavía no terminó trae el cierre de la víspera.
    and (ingest_fx_rates.source <> 'argentinadatos'
         or (x.at at time zone 'America/Argentina/Buenos_Aires')::date
            < (now() at time zone 'America/Argentina/Buenos_Aires')::date)
  on conflict on constraint fx_rates_source_kind_fetched_key do update
    set buy = excluded.buy, sell = excluded.sell
    -- Solo el historial se corrige; DolarApi repite la misma hora con el mismo valor.
    where excluded.source = 'argentinadatos'
      and (fx_rates.buy, fx_rates.sell) is distinct from (excluded.buy, excluded.sell);
  get diagnostics inserted = row_count;

  -- El trigger vuelve a calcular las filas pendientes.
  update public.movements set fx_pending = true where fx_pending;

  return inserted;
end;
$$;
