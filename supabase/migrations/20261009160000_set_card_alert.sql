-- Guarda un aviso de tarjeta (02 §9). Una fila por tarjeta y tipo: el índice único es
-- sobre una expresión y PostgREST no puede hacer upsert contra él.
create function public.set_card_alert(card_id uuid, alert_type text, enabled boolean, days_before integer default null)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if alert_type not in ('card_closing', 'card_due') then
    raise exception 'invalid alert type' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.cards c
    where c.id = set_card_alert.card_id and c.user_id = (select auth.uid())
  ) then
    raise exception 'card not found' using errcode = '42501';
  end if;

  insert into public.alerts (type, enabled, params)
  values (
    alert_type, set_card_alert.enabled,
    case when alert_type = 'card_due'
      then jsonb_build_object('card_id', set_card_alert.card_id, 'days_before', coalesce(set_card_alert.days_before, 2))
      else jsonb_build_object('card_id', set_card_alert.card_id) end
  )
  on conflict (user_id, type, (params ->> 'card_id')) do update
    set enabled = excluded.enabled, params = excluded.params;
end;
$$;

revoke execute on function public.set_card_alert(uuid, text, boolean, integer) from public, anon;
grant execute on function public.set_card_alert(uuid, text, boolean, integer) to authenticated;
