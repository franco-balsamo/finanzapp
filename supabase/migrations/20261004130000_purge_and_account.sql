-- Purga de tarjetas archivadas (T7, 02 §3, D13), borrar la cuenta y exportar
-- los datos (T10, 02 §10, D17). Decisiones en
-- docs/decisiones/2026-10-04-spec-purga-y-cuenta.md.

-- ───────────────────────── Fallas de tareas ─────────────────────────

-- Lo que una tarea diaria no pudo hacer, para revisarlo. La app no lo ve.
create table private.job_failures (
  id bigint generated always as identity primary key,
  job text not null,
  ref_id uuid,
  error text not null,
  failed_at timestamptz not null default now()
);

revoke all on private.job_failures from public, anon, authenticated;

-- ───────────────────────── Purga (T7) ─────────────────────────

-- Cada tarjeta archivada hace 7 días o más, en su propio bloque: los pagos no
-- revertidos pasan a ser movimientos de la cuenta de la que salieron (lo
-- mismo que restaban, así el saldo no cambia) y después se borra la tarjeta,
-- con sus consumos, correcciones de cierre y pagos en cascada. Si una falla,
-- queda en job_failures y las demás siguen. Devuelve cuántas se purgaron.
create function private.purge_archived_cards() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  purged integer := 0;
begin
  for c in
    select * from public.cards
    where archived_at <= now() - interval '7 days'
    order by archived_at, id
  loop
    begin
      insert into public.movements (user_id, type, origin, date, description, amount, currency, account_id)
      select p.user_id, 'card_payment', 'purge',
        (p.paid_at at time zone 'America/Argentina/Buenos_Aires')::date,
        format('Pago de tarjeta %s ··%s (eliminada)',
          case c.network when 'VISA' then 'Visa' when 'MC' then 'Mastercard' when 'AMEX' then 'Amex' when 'CABAL' then 'Cabal' end,
          c.last4),
        p.debited_amount, a.currency, p.from_account_id
      from public.statement_payments p
      join public.accounts a on a.id = p.from_account_id and a.user_id = p.user_id
      where p.card_id = c.id and p.reverted_at is null
      order by p.paid_at, p.id;

      -- Las alertas guardan la tarjeta en params, sin FK.
      delete from public.alerts where user_id = c.user_id and params ->> 'card_id' = c.id::text;
      delete from public.cards where id = c.id;
      purged := purged + 1;
    exception when others then
      raise warning 'purge_archived_cards: card % failed: %', c.id, sqlerrm;
      insert into private.job_failures (job, ref_id, error) values ('purge_archived_cards', c.id, sqlerrm);
    end;
  end loop;
  return purged;
end;
$$;

-- pg_cron usa UTC: 6:30 UTC son las 3:30 en Argentina.
select cron.schedule('purge-archived-cards', '30 6 * * *', $$select private.purge_archived_cards()$$);

-- ───────────────────────── Borrar la cuenta (T10) ─────────────────────────

-- Ingresó el código (o la contraseña) hace menos de 10 minutos. Se mira amr y
-- no iat: iat se renueva en cada refresh, así que una sesión robada siempre
-- tiene un iat reciente; amr guarda la hora del login y se mantiene.
create function private.recent_login() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((
    select bool_or(
      a ->> 'method' in ('otp', 'password')
      and jsonb_typeof(a -> 'timestamp') = 'number'
      and (a ->> 'timestamp')::numeric >= extract(epoch from now()) - 600
    )
    from jsonb_array_elements(
      case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end
    ) as a
  ), false);
$$;

-- Borra todo lo personal (cascada desde auth.users). En cada grupo el lugar
-- queda como integrante sin cuenta con el mismo nombre (user_id pasa a null
-- por la FK), sin alias; los gastos, partes y pagos no se tocan, así los
-- saldos de los demás no cambian. Si era dueño, el rol pasa al azar a otro
-- integrante con cuenta, aunque tenga saldo (02 §10).
create function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  m record;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not private.recent_login() then
    raise exception 'reauthentication required' using errcode = '42501';
  end if;

  for m in
    select gm.id, gm.group_id
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.user_id = uid and g.owner_member_id = gm.id and g.deleted_at is null
  loop
    perform private.transfer_ownership(m.group_id, m.id);
  end loop;

  update public.group_members set payment_alias = null, claimed_at = null where user_id = uid;

  delete from auth.users where id = uid;
end;
$$;

-- Al borrar un usuario, las FK ponen en null created_by y updated_by de los
-- gastos de grupo. Esa actualización no es una edición: si se auditara,
-- updated_by volvería a apuntar al usuario que se está borrando y rompería la
-- FK. Nadie más escribe esas columnas en un update (la app no tiene permiso).
create or replace function private.set_group_expense_audit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.created_by is distinct from old.created_by or new.updated_by is distinct from old.updated_by then
    return new;
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

-- ───────────────────────── Exportar (T10) ─────────────────────────

-- El grupo como lo ve un integrante: nombres, gastos no borrados con sus
-- partes y pagos no anulados, sin payment_alias, user_id ni created_by.
-- Los montos van como texto. Lo usan get_guest_group y export_account.
create function private.group_snapshot(gid uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'name', g.name,
    'currency', g.currency,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'display_name', m.display_name,
        'has_account', m.user_id is not null,
        'active', m.left_at is null
      ) order by m.joined_at, m.id)
      from public.group_members m
      where m.group_id = g.id
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'date', e.date,
        'description', e.description,
        'amount', e.amount::text,
        'currency', e.currency,
        'fx_rate', e.fx_rate::text,
        'payer_member_id', e.payer_member_id,
        'split_mode', e.split_mode,
        'parts', coalesce((
          select jsonb_agg(jsonb_build_object('member_id', p.member_id, 'value', p.value::text) order by p.member_id)
          from public.group_expense_parts p
          where p.group_expense_id = e.id
        ), '[]'::jsonb)
      ) order by e.date, e.created_at, e.id)
      from public.group_expenses e
      where e.group_id = g.id and e.deleted_at is null
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'date', p.date,
        'from_member_id', p.from_member_id,
        'to_member_id', p.to_member_id,
        'amount', p.amount::text
      ) order by p.date, p.created_at, p.id)
      from public.group_payments p
      where p.group_id = g.id and p.deleted_at is null
    ), '[]'::jsonb)
  )
  from public.groups g
  where g.id = gid;
$$;

create or replace function public.get_guest_group(token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.group_snapshot(gr.id)
  from public.groups gr
  where token is not null
    and gr.invite_token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')
    and gr.deleted_at is null;
$$;

-- Todo lo del usuario en un JSON (02 §10). Los montos van como texto. De los
-- grupos: los activos, como los ve en la app; los que dejó o se eliminaron,
-- solo el nombre y su propio lugar.
create function public.export_account() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'version', 1,
    'exported_at', now(),
    'user', (
      select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at,
        'settings', (select to_jsonb(s) - 'user_id' from public.user_settings s where s.user_id = uid))
      from auth.users u where u.id = uid
    ),
    'accounts', coalesce((
      select jsonb_agg(to_jsonb(a) - 'user_id' || jsonb_build_object('opening_balance', a.opening_balance::text)
        order by a.created_at, a.id)
      from public.accounts a where a.user_id = uid
    ), '[]'::jsonb),
    'cards', coalesce((
      select jsonb_agg(to_jsonb(c) - 'user_id' || jsonb_build_object('credit_limit', c.credit_limit::text)
        order by c.created_at, c.id)
      from public.cards c where c.user_id = uid
    ), '[]'::jsonb),
    'statement_overrides', coalesce((
      select jsonb_agg(to_jsonb(o) - 'user_id' order by o.card_id, o.period)
      from public.statement_overrides o where o.user_id = uid
    ), '[]'::jsonb),
    'statement_payments', coalesce((
      select jsonb_agg(to_jsonb(p) - 'user_id' || jsonb_build_object(
          'amount', p.amount::text, 'debited_amount', p.debited_amount::text, 'fx_card_rate', p.fx_card_rate::text)
        order by p.paid_at, p.id)
      from public.statement_payments p where p.user_id = uid
    ), '[]'::jsonb),
    'movements', coalesce((
      select jsonb_agg(to_jsonb(mv) - 'user_id' || jsonb_build_object(
          'amount', mv.amount::text, 'my_share', mv.my_share::text, 'debited_amount', mv.debited_amount::text,
          'fx_mep', mv.fx_mep::text, 'fx_oficial', mv.fx_oficial::text, 'fx_blue', mv.fx_blue::text)
        order by mv.date, mv.created_at, mv.id)
      from public.movements mv where mv.user_id = uid
    ), '[]'::jsonb),
    'category_keywords', coalesce((
      select jsonb_agg(to_jsonb(k) - 'user_id' order by k.word)
      from public.category_keywords k where k.user_id = uid
    ), '[]'::jsonb),
    'alerts', coalesce((
      select jsonb_agg(to_jsonb(al) - 'user_id' order by al.created_at, al.id)
      from public.alerts al where al.user_id = uid
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(n) - 'user_id' order by n.created_at, n.id)
      from public.notifications n where n.user_id = uid
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'name', g.name,
          'currency', g.currency,
          'deleted_at', g.deleted_at,
          'me', jsonb_build_object('member_id', m.id, 'display_name', m.display_name,
            'payment_alias', m.payment_alias, 'joined_at', m.joined_at, 'left_at', m.left_at)
        )
        || case when m.left_at is null and g.deleted_at is null
             then private.group_snapshot(g.id) - 'name' - 'currency'
             else '{}'::jsonb end
        order by m.joined_at, g.id)
      from public.group_members m
      join public.groups g on g.id = m.group_id
      where m.user_id = uid
    ), '[]'::jsonb)
  );
end;
$$;

-- ───────────────────────── Permisos ─────────────────────────

revoke all on function
  private.purge_archived_cards(),
  private.recent_login(),
  private.group_snapshot(uuid),
  public.delete_account(),
  public.export_account()
from public, anon, authenticated;
grant execute on function public.delete_account(), public.export_account() to authenticated;
