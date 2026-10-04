-- Avisos de cierre y de vencimiento de tarjeta (02 §9). Qué avisar y el texto
-- los calcula packages/core (closingNotices, dueNotices) en las Edge Functions
-- card-closing-notices y card-due-notices; acá están los datos que leen, lo que
-- guardan y los cron. Decisiones en docs/decisiones/2026-10-04-spec-avisos-de-tarjeta.md.

-- ───────────────────────── notifications ─────────────────────────

-- kind: de qué aviso es (nulo en los de grupo). data: lo que la app necesita
-- para abrir el detalle ({"card_ids": [...]}). deliver_after: cuándo puede
-- salir el push, respetando el "no molestar"; el envío llega con la app.
alter table public.notifications
  add column kind text check (kind in ('card_closing', 'card_due')),
  add column data jsonb,
  add column deliver_after timestamptz not null default now();

-- ───────────────────────── Qué ya se avisó ─────────────────────────

-- Una vez por tarjeta, tipo y resumen (02 §9). Si el cron corre dos veces,
-- el único frena el segundo aviso.
create table private.card_notices (
  card_id uuid not null references public.cards (id) on delete cascade,
  kind text not null check (kind in ('card_closing', 'card_due')),
  period date not null check (extract(day from period) = 1),
  notification_id uuid references public.notifications (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (card_id, kind, period)
);

revoke all on private.card_notices from public, anon, authenticated;

-- ───────────────────────── No molestar ─────────────────────────

-- Si `at` cae en el horario de no molestar (horas de Argentina, de quiet_from
-- a quiet_to, que puede pasar la medianoche), el próximo quiet_to:00; si no, `at`.
create function private.deliver_after(quiet_from smallint, quiet_to smallint, at timestamptz) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare
  local_at timestamp := at at time zone 'America/Argentina/Buenos_Aires';
  h integer := extract(hour from local_at);
  day date := local_at::date;
begin
  if quiet_from is null or quiet_to is null or quiet_from = quiet_to then
    return at;
  end if;
  if quiet_from < quiet_to then
    if h < quiet_from or h >= quiet_to then
      return at;
    end if;
  else
    if h < quiet_from and h >= quiet_to then
      return at;
    end if;
    -- Pasa la medianoche: si ya es de noche, sale al día siguiente.
    if h >= quiet_from then
      day := day + 1;
    end if;
  end if;
  return (day + make_time(quiet_to, 0, 0)) at time zone 'America/Argentina/Buenos_Aires';
end;
$$;

-- ───────────────────────── Lo que leen las Edge Functions ─────────────────────────

-- Por usuario con tarjetas no archivadas: sus ajustes de aviso y, por tarjeta,
-- lo que necesita cardState (días, cierres corregidos, consumos y pagos), sus
-- alertas y lo que ya se avisó. Montos como texto y fechas en hora de Argentina.
create function public.card_notice_input() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(u.payload order by u.user_id), '[]'::jsonb)
  from (
    select s.user_id, jsonb_build_object(
      'user_id', s.user_id,
      'notify_push', s.notify_push,
      'quiet_from', s.quiet_from,
      'quiet_to', s.quiet_to,
      'cards', (
        select jsonb_agg(jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'close_day', c.close_day,
          'due_day', c.due_day,
          'credit_limit', coalesce(c.credit_limit, 0)::text,
          'overrides', coalesce((
            select jsonb_agg(jsonb_build_object(
              'period', to_char(o.period, 'YYYY-MM'), 'close_date', o.close_date, 'due_date', o.due_date))
            from public.statement_overrides o where o.card_id = c.id
          ), '[]'::jsonb),
          'expenses', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', m.id, 'date', m.date, 'amount', m.amount::text, 'currency', m.currency,
              'installments', m.installments) order by m.date, m.id)
            from public.movements m where m.card_id = c.id and m.type = 'expense'
          ), '[]'::jsonb),
          'payments', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', p.id, 'period', to_char(p.period, 'YYYY-MM'), 'applies_to', p.applies_to,
              'amount', p.amount::text, 'debited_amount', p.debited_amount::text, 'debited_currency', a.currency,
              'fx_card_rate', p.fx_card_rate::text,
              'paid_at', (p.paid_at at time zone 'America/Argentina/Buenos_Aires')::date,
              'reverted_at', (p.reverted_at at time zone 'America/Argentina/Buenos_Aires')::date) order by p.paid_at, p.id)
            from public.statement_payments p
            join public.accounts a on a.id = p.from_account_id and a.user_id = p.user_id
            where p.card_id = c.id
          ), '[]'::jsonb),
          -- Sin fila de alerta, el aviso está prendido y el vencimiento es a 2 días.
          'closing_enabled', coalesce((
            select al.enabled from public.alerts al
            where al.user_id = c.user_id and al.type = 'card_closing' and al.params ->> 'card_id' = c.id::text
          ), true),
          'due_enabled', coalesce((
            select al.enabled from public.alerts al
            where al.user_id = c.user_id and al.type = 'card_due' and al.params ->> 'card_id' = c.id::text
          ), true),
          'due_days_before', coalesce((
            select (al.params ->> 'days_before')::integer from public.alerts al
            where al.user_id = c.user_id and al.type = 'card_due' and al.params ->> 'card_id' = c.id::text
          ), 2),
          'noticed', coalesce((
            select jsonb_agg(jsonb_build_object('kind', n.kind, 'period', to_char(n.period, 'YYYY-MM')))
            from private.card_notices n where n.card_id = c.id
          ), '[]'::jsonb)
        ) order by c.created_at, c.id)
        from public.cards c
        where c.user_id = s.user_id and c.archived_at is null
      )
    ) as payload
    from public.user_settings s
    where exists (select 1 from public.cards c where c.user_id = s.user_id and c.archived_at is null)
  ) u;
$$;

-- ───────────────────────── Lo que guardan ─────────────────────────

-- notices: [{"user_id", "kind", "title", "body", "refs": [{"card_id", "period": "AAAA-MM"}]}].
-- Cada aviso en su propio bloque: si alguna de sus tarjetas y resúmenes ya se
-- avisó (o se avisa a la vez en otra corrida), se saltea entero. Las
-- referencias tienen que ser tarjetas de ese usuario. Lo que falla queda en
-- private.job_failures. Devuelve cuántas notificaciones guardó.
create function public.record_card_notices(notices jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n jsonb;
  uid uuid;
  settings record;
  notification uuid;
  ref_count integer;
  inserted integer := 0;
begin
  if notices is null or jsonb_typeof(notices) <> 'array' then
    raise exception 'notices must be a JSON array' using errcode = '22023';
  end if;

  for n in select * from jsonb_array_elements(notices) loop
    begin
      uid := (n ->> 'user_id')::uuid;
      if n ->> 'kind' not in ('card_closing', 'card_due') or jsonb_typeof(n -> 'refs') <> 'array'
         or jsonb_array_length(n -> 'refs') = 0 then
        raise exception 'invalid notice' using errcode = '22023';
      end if;

      select s.quiet_from, s.quiet_to into settings from public.user_settings s where s.user_id = uid;
      if not found then
        raise exception 'user % not found', uid using errcode = '23503';
      end if;

      select count(*) into ref_count
      from jsonb_array_elements(n -> 'refs') r
      join public.cards c on c.id = (r ->> 'card_id')::uuid and c.user_id = uid;
      if ref_count <> jsonb_array_length(n -> 'refs') then
        raise exception 'notice refs cards that are not from user %', uid using errcode = '42501';
      end if;

      if exists (
        select 1 from jsonb_array_elements(n -> 'refs') r
        join private.card_notices cn
          on cn.card_id = (r ->> 'card_id')::uuid and cn.kind = n ->> 'kind'
         and cn.period = to_date(r ->> 'period', 'YYYY-MM')
      ) then
        continue;
      end if;

      insert into public.notifications (user_id, title, body, kind, data, deliver_after)
      values (
        uid, n ->> 'title', n ->> 'body', n ->> 'kind',
        jsonb_build_object('card_ids', (select jsonb_agg(r -> 'card_id') from jsonb_array_elements(n -> 'refs') r)),
        private.deliver_after(settings.quiet_from, settings.quiet_to, now())
      )
      returning id into notification;

      insert into private.card_notices (card_id, kind, period, notification_id)
      select (r ->> 'card_id')::uuid, n ->> 'kind', to_date(r ->> 'period', 'YYYY-MM'), notification
      from jsonb_array_elements(n -> 'refs') r;

      inserted := inserted + 1;
    exception
      -- Otra corrida lo avisó al mismo tiempo: no es una falla.
      when unique_violation then
        null;
      when others then
        raise warning 'record_card_notices: % failed: %', n ->> 'user_id', sqlerrm;
        insert into private.job_failures (job, ref_id, error)
        values ('record_card_notices', case when n ->> 'user_id' ~ '^[0-9a-f-]{36}$' then (n ->> 'user_id')::uuid end, sqlerrm);
    end;
  end loop;
  return inserted;
end;
$$;

-- ───────────────────────── Cron y permisos ─────────────────────────

-- pg_cron usa UTC: 23:00 UTC son las 20:00 en Argentina y 13:00 UTC, las 10:00.
select cron.schedule('card-closing-notices', '0 23 * * *', $$select private.call_edge('card-closing-notices')$$);
select cron.schedule('card-due-notices', '0 13 * * *', $$select private.call_edge('card-due-notices')$$);

revoke all on function
  public.card_notice_input(),
  public.record_card_notices(jsonb),
  private.deliver_after(smallint, smallint, timestamptz)
from public, anon, authenticated;
grant execute on function public.card_notice_input(), public.record_card_notices(jsonb) to service_role;
