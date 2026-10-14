-- Push de los avisos (02 §9, spec docs/specs/2026-10-14-epica-push-de-avisos.md).
-- La app registra el token de Expo de cada teléfono; el cron send-push toma los
-- avisos listos con claim_push_batch y la Edge Function los manda a Expo.

-- ───────────────────────── Tokens ─────────────────────────

-- Un token es un teléfono: si otra cuenta lo registra, pasa a esa cuenta.
create table public.push_tokens (
  token text primary key check (token ~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$' and length(token) <= 200),
  user_id uuid not null references auth.users on delete cascade,
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- Sin políticas: solo por las funciones de abajo.
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from public, anon, authenticated;

create function public.register_push_token(token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, user_id) values (register_push_token.token, auth.uid())
  on conflict on constraint push_tokens_pkey do update set user_id = excluded.user_id, updated_at = now();
end;
$$;

-- Si el token no es tuyo, no hace nada.
create function public.unregister_push_token(token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_tokens t where t.token = unregister_push_token.token and t.user_id = auth.uid();
$$;

-- ───────────────────────── Envío ─────────────────────────

-- Marca como enviados y devuelve, una fila por token, los avisos listos: sin
-- enviar, con deliver_after vencido hace menos de 24 h (los más viejos no salen
-- por push, D3), notify_push prendido y algún token. sent_at se marca antes de
-- llamar a Expo: cada aviso sale a lo sumo una vez (D6).
create function public.claim_push_batch(max_rows int default 500)
returns table (notification_id uuid, token text, title text, body text, data jsonb)
language sql security definer set search_path = '' as $$
  with ready as (
    select n.id
    from public.notifications n
    join public.user_settings s on s.user_id = n.user_id and s.notify_push
    where n.sent_at is null
      and n.deliver_after <= now()
      and n.deliver_after > now() - interval '24 hours'
      and exists (select 1 from public.push_tokens t where t.user_id = n.user_id)
    order by n.deliver_after
    limit max_rows
    for update of n skip locked
  ), sent as (
    update public.notifications n set sent_at = now()
    from ready where n.id = ready.id
    returning n.id, n.user_id, n.title, n.body, n.data
  )
  select sent.id, t.token, sent.title, sent.body, sent.data
  from sent join public.push_tokens t on t.user_id = sent.user_id;
$$;

-- Los tokens a los que Expo respondió DeviceNotRegistered.
create function public.drop_push_tokens(tokens text[]) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_tokens where token = any (tokens);
$$;

-- ───────────────────────── Cron y permisos ─────────────────────────

select cron.schedule('send-push', '*/5 * * * *', $$select private.call_edge('send-push')$$);

revoke all on function
  public.register_push_token(text),
  public.unregister_push_token(text),
  public.claim_push_batch(int),
  public.drop_push_tokens(text[])
from public, anon, authenticated;
grant execute on function public.register_push_token(text), public.unregister_push_token(text) to authenticated;
grant execute on function public.claim_push_batch(int), public.drop_push_tokens(text[]) to service_role;
