-- ArgentinaDatos no publica el cierre de su fecha: la fila del día se actualiza
-- solo durante la mañana y queda con el valor de la víspera (la del 7/10/2026
-- quedó con el cierre del 6/10). Guardada a las 23:59:59, le ganaba al cierre
-- real de DolarApi. Ahora se guarda a las 00:00 de su fecha: es lo que se
-- conocía al abrir el día, y cualquier fila de DolarApi de ese día le gana.
create or replace function private.fx_row_time(source text, r jsonb) returns timestamptz
language plpgsql stable set search_path = '' as $$
begin
  if source = 'dolarapi' then
    return (r ->> 'fechaActualizacion')::timestamptz;
  end if;
  if (r ->> 'fecha') !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return (r ->> 'fecha')::date::timestamp at time zone 'America/Argentina/Buenos_Aires';
exception when others then
  return null;
end;
$$;

-- El historial ya guardado pasa a las 00:00 del mismo día (rate_date no cambia).
-- Los movimientos ya guardados conservan su cotización.
update public.fx_rates
set fetched_at = rate_date::timestamp at time zone 'America/Argentina/Buenos_Aires'
where source = 'argentinadatos';
