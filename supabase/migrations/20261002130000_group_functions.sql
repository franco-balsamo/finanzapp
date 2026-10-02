-- Funciones de grupo (02 §7): reclamar y deshacer el reclamo, salir del grupo,
-- anular pagos y el link de invitación. Decisiones en
-- docs/decisiones/2026-10-02-spec-funciones-de-grupo.md.

-- ─────────────────────── Cambios de tablas ───────────────────────

-- Un pago entre integrantes nunca se edita: se anula y se registra de nuevo.
alter table public.group_payments
  add column deleted_at timestamptz,
  add column voided_by uuid references auth.users (id) on delete set null;

-- Quién editó un gasto de grupo por última vez.
alter table public.group_expenses
  add column updated_by uuid references auth.users (id) on delete set null;

drop trigger group_expenses_updated_at on public.group_expenses;

create function private.set_group_expense_audit() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger group_expenses_audit before update on public.group_expenses
  for each row execute function private.set_group_expense_audit();

-- ─────────────────── Saldos (copia de packages/core) ───────────────────
-- Tienen que dar exactamente lo mismo que shares() y groupBalances() de
-- core: los tests de 05_group_balances usan los mismos ejemplos de 02 §7.
-- Se usan solo dentro de la base (salir del grupo y reclamar un lugar).

-- n / d redondeado half-up, para n >= 0 y d > 0, con aritmética exacta.
create function private.round_div(n numeric, d numeric) returns numeric
language sql immutable set search_path = '' as $$
  select div(2 * n + d, 2 * d);
$$;

-- convert() de core: cotización en pesos por dólar, al centavo.
create function private.convert_minor(minor numeric, from_currency text, to_currency text, rate numeric)
returns numeric
language plpgsql immutable set search_path = '' as $$
declare
  scaled numeric;
begin
  if from_currency = to_currency then
    return minor;
  end if;
  if rate is null then
    raise exception 'missing fx rate' using errcode = '22023';
  end if;
  scaled := rate * 10000;
  if to_currency = 'ARS' then
    return private.round_div(minor * scaled, 10000);
  end if;
  return private.round_div(minor * 10000, scaled);
end;
$$;

-- shares() de core: la parte de cada incluido, en centavos. Con
-- in_group_currency = false, la misma división sobre el monto en la moneda
-- del gasto (para my_share, sin convertir de ida y vuelta).
create function private.member_shares(expense_id uuid, in_group_currency boolean default true)
returns table (member_id uuid, share_minor numeric)
language sql stable set search_path = '' as $$
  with t as (
    select e.*, x.target, private.convert_minor(e.amount * 100, e.currency, x.target, e.fx_rate) as total
    from public.group_expenses e
    join public.groups g on g.id = e.group_id
    cross join lateral (select case when in_group_currency then g.currency else e.currency end as target) x
    where e.id = expense_id
  ),
  -- Incluidos en el orden de ingreso al grupo.
  included as (
    select p.member_id, p.value,
           row_number() over (order by m.joined_at, m.id) as pos,
           count(*) over () as n
    from public.group_expense_parts p
    join public.group_members m on m.id = p.member_id
    where p.group_expense_id = expense_id
  ),
  base as (
    select i.member_id, i.pos,
           case when t.split_mode = 'equal' then div(t.total, i.n)
                else private.convert_minor(i.value * 100, t.currency, t.target, t.fx_rate) end as share_minor
    from included i cross join t
  ),
  -- El resto va al que pagó, o al primer incluido si el que pagó quedó afuera.
  remainder as (
    select coalesce(
             (select b.member_id from base b join t on b.member_id = t.payer_member_id),
             (select b.member_id from base b where b.pos = 1)
           ) as to_member,
           (select t.total from t) - (select sum(b.share_minor) from base b) as amount
  )
  select b.member_id, b.share_minor + case when b.member_id = r.to_member then r.amount else 0 end
  from base b cross join remainder r;
$$;

-- groupBalances() de core, en centavos de la moneda del grupo. Ignora los
-- gastos borrados y los pagos anulados. Positivo: le deben.
create function private.group_balances(gid uuid)
returns table (member_id uuid, balance_minor numeric)
language sql stable set search_path = '' as $$
  with shares as (
    select e.id as expense_id, e.payer_member_id, s.member_id, s.share_minor
    from public.group_expenses e
    cross join lateral private.member_shares(e.id) s
    where e.group_id = gid and e.deleted_at is null
  ),
  deltas as (
    -- Al que pagó se le suma la suma de las partes: así los saldos dan cero.
    select payer_member_id as member_id, share_minor as delta from shares
    union all
    select member_id, -share_minor from shares
    union all
    select from_member_id, amount * 100 from public.group_payments
    where group_id = gid and deleted_at is null
    union all
    select to_member_id, -amount * 100 from public.group_payments
    where group_id = gid and deleted_at is null
  )
  select m.id, coalesce(sum(d.delta), 0)
  from public.group_members m
  left join deltas d on d.member_id = m.id
  where m.group_id = gid
  group by m.id;
$$;

-- isSettled() de core: menos de $1 o de US$ 0,01 (D14, 02 §7).
create function private.is_settled(balance_minor numeric, currency text) returns boolean
language sql immutable set search_path = '' as $$
  select abs(balance_minor) < case currency when 'ARS' then 100 else 1 end;
$$;

-- ─────────────────────────── Auxiliares ───────────────────────────

create function private.notify(target uuid, title text, body text) returns void
language sql set search_path = '' as $$
  insert into public.notifications (user_id, title, body) values (target, title, body);
$$;

-- Al irse el dueño (o deshacerse su reclamo): el rol pasa al azar a otro
-- integrante activo con cuenta y se avisa a todos. Si no hay, queda sin dueño.
create function private.transfer_ownership(gid uuid, leaving_member uuid) returns void
language plpgsql set search_path = '' as $$
declare
  g record;
  heir record;
  r record;
begin
  select * into g from public.groups where id = gid;

  select m.id, m.display_name into heir
  from public.group_members m
  where m.group_id = gid and m.id <> leaving_member and m.user_id is not null and m.left_at is null
  order by random()
  limit 1;

  update public.groups set owner_member_id = heir.id where id = gid;

  if heir.id is not null then
    for r in
      select m.user_id from public.group_members m
      where m.group_id = gid and m.user_id is not null and m.left_at is null and m.id <> leaving_member
    loop
      perform private.notify(
        r.user_id,
        format('%s es el nuevo dueño de %s', heir.display_name, g.name),
        'El dueño anterior dejó el grupo.'
      );
    end loop;
  end if;
end;
$$;

-- ─────────────────────── Funciones de grupo ───────────────────────

-- Reclamar un lugar provisorio desde el link de invitación. Los gastos que
-- pagó ese lugar entran a las finanzas de quien reclama "Sin medio de pago"
-- (origin = claim), con su parte en my_share.
create function public.claim_member(token text, member_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  g record;
  m record;
  r record;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select gr.* into g from public.groups gr
  where token is not null
    and gr.invite_token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')
    and gr.deleted_at is null;
  if g.id is null then
    raise exception 'invalid invite' using errcode = 'P0002';
  end if;

  select gm.* into m from public.group_members gm
  where gm.id = member_id and gm.group_id = g.id
  for update;
  if m.id is null then
    raise exception 'member % is not in this group', member_id using errcode = 'P0002';
  end if;
  if m.user_id is not null or m.left_at is not null then
    raise exception 'member % is not a provisional place', member_id using errcode = '55000';
  end if;
  if exists (
    select 1 from public.group_members gm
    where gm.group_id = g.id and gm.user_id = uid and gm.left_at is null
  ) then
    raise exception 'already a member of this group' using errcode = '55000';
  end if;

  update public.group_members
  set user_id = uid, claimed_at = now(), unclaimed_at = null, unclaimed_by = null
  where id = m.id;

  insert into public.movements
    (user_id, type, origin, date, description, amount, currency, category_id, my_share, group_expense_id)
  select uid, 'expense', 'claim', e.date, e.description, e.amount, e.currency, e.category_id,
         coalesce((select s.share_minor from private.member_shares(e.id, false) s where s.member_id = m.id), 0) / 100,
         e.id
  from public.group_expenses e
  where e.group_id = g.id and e.payer_member_id = m.id and e.deleted_at is null;

  for r in
    select gm.user_id from public.group_members gm
    where gm.group_id = g.id and gm.user_id is not null and gm.left_at is null and gm.user_id <> uid
  loop
    perform private.notify(r.user_id, format('%s se sumó a %s', m.display_name, g.name), 'Reclamó su lugar en el grupo.');
  end loop;

  return g.id;
end;
$$;

-- Deshacer un reclamo (02 §7): el dueño o quien reclamó, dentro de los 7
-- días. Solo corta el vínculo: los gastos y pagos del grupo no cambian.
create function public.undo_claim(member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  m record;
  g record;
  claimer uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select gm.* into m from public.group_members gm where gm.id = member_id for update;
  select gr.* into g from public.groups gr where gr.id = m.group_id and gr.deleted_at is null;
  if m.id is null or g.id is null or not public.is_group_member(g.id) then
    raise exception 'member % not found', member_id using errcode = 'P0002';
  end if;
  if m.user_id is null or m.claimed_at is null or m.left_at is not null then
    raise exception 'member % has no claim to undo', member_id using errcode = '55000';
  end if;
  if m.user_id <> uid and not exists (
    select 1 from public.group_members o where o.id = g.owner_member_id and o.user_id = uid
  ) then
    raise exception 'only the owner or the claimer can undo a claim' using errcode = '42501';
  end if;
  if now() > m.claimed_at + interval '7 days' then
    raise exception 'the claim is older than 7 days' using errcode = '55000';
  end if;

  claimer := m.user_id;

  -- Los "Sin medio de pago" eran del lugar provisorio: se borran.
  delete from public.movements mv
  where mv.user_id = claimer and mv.origin = 'claim'
    and mv.group_expense_id in (select e.id from public.group_expenses e where e.group_id = g.id);

  -- Los que cargó la persona desde el grupo pierden el vínculo y cuentan completos.
  update public.movements mv set group_expense_id = null, my_share = null
  where mv.user_id = claimer
    and mv.group_expense_id in (select e.id from public.group_expenses e where e.group_id = g.id);

  -- El alias es de la persona, no del lugar.
  update public.group_members
  set user_id = null, claimed_at = null, payment_alias = null, unclaimed_at = now(), unclaimed_by = uid
  where id = m.id;

  if g.owner_member_id = m.id then
    perform private.transfer_ownership(g.id, m.id);
  end if;

  if claimer <> uid then
    perform private.notify(
      claimer,
      format('Te desvincularon de %s', g.name),
      format('Tu lugar como %s volvió a ser de un integrante sin cuenta.', m.display_name)
    );
  end if;
end;
$$;

-- Salir del grupo estando al día. Si es el dueño, el rol pasa.
create function public.leave_group(gid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  g record;
  m record;
  balance numeric;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select gr.* into g from public.groups gr where gr.id = gid and gr.deleted_at is null for update;
  select gm.* into m from public.group_members gm
  where gm.group_id = gid and gm.user_id = uid and gm.left_at is null
  for update;
  if g.id is null or m.id is null then
    raise exception 'not a member of group %', gid using errcode = '42501';
  end if;

  select b.balance_minor into balance from private.group_balances(gid) b where b.member_id = m.id;
  if not private.is_settled(balance, g.currency) then
    raise exception 'balance is not settled' using errcode = '55000';
  end if;

  update public.group_members set left_at = now() where id = m.id;

  if g.owner_member_id = m.id then
    perform private.transfer_ownership(gid, m.id);
  end if;
end;
$$;

-- Anular un pago entre integrantes. Anular uno ya anulado no hace nada.
create function public.void_group_payment(payment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  p record;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select gp.* into p from public.group_payments gp where gp.id = payment_id for update;
  if p.id is null or not public.is_group_member(p.group_id) then
    raise exception 'payment % not found', payment_id using errcode = 'P0002';
  end if;
  if p.deleted_at is not null then
    return;
  end if;

  update public.group_payments set deleted_at = now(), voided_by = uid where id = p.id;
end;
$$;

-- Link de invitación: token aleatorio de 128 bits en base64url. Se devuelve
-- una sola vez; en la base queda solo su SHA-256. El link anterior deja de andar.
create function public.rotate_invite_token(gid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  token text;
begin
  if not public.is_group_member(gid) then
    raise exception 'not a member of group %', gid using errcode = '42501';
  end if;

  token := rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '=');
  update public.groups
  set invite_token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex'), invite_token_created_at = now()
  where id = gid;

  return token;
end;
$$;

create function public.revoke_invite_token(gid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_group_member(gid) then
    raise exception 'not a member of group %', gid using errcode = '42501';
  end if;

  update public.groups set invite_token_hash = null, invite_token_created_at = null where id = gid;
end;
$$;

-- ───────────────── Web de invitados: sin pagos anulados ─────────────────

create or replace function public.get_guest_group(token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with g as (
    select gr.id, gr.name, gr.currency
    from public.groups gr
    where token is not null
      and gr.invite_token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')
      and gr.deleted_at is null
  )
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
  from g;
$$;

-- ─────────────────────────── Permisos ───────────────────────────

revoke all on all functions in schema private from public, anon, authenticated;
-- La usa el trigger de categorías, que corre como quien escribe.
grant execute on function private.category_available(uuid, uuid) to authenticated;

grant execute on function
  public.claim_member(text, uuid),
  public.undo_claim(uuid),
  public.leave_group(uuid),
  public.void_group_payment(uuid),
  public.rotate_invite_token(uuid),
  public.revoke_invite_token(uuid)
to authenticated;
