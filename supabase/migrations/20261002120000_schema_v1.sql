-- Esquema de la v1 (T5). Fuente de verdad: docs/03-modelo-de-datos.md.
-- Montos en numeric(14,2) y cotizaciones en numeric(14,4); nunca float.
-- Fuera de esta migración (T6 y siguientes): trigger de cotizaciones, cron,
-- claim_member, undo_claim, transfer_ownership, leave_group, delete_account,
-- export_account y purge_archived_cards.

create schema if not exists private;

-- ───────────────────────── Usuarios ─────────────────────────

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text,
  display_currency text not null default 'ARS' check (display_currency in ('ARS', 'USD')),
  fx_reference text not null default 'mep' check (fx_reference in ('mep', 'oficial', 'blue')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  notify_push boolean not null default true,
  quiet_from smallint check (quiet_from between 0 and 23),
  quiet_to smallint check (quiet_to between 0 and 23),
  goal text check (goal in ('control', 'save', 'invest')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────── Cuentas y tarjetas ─────────────────────

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  type text not null check (type in ('bank', 'wallet', 'cash')),
  currency text not null check (currency in ('ARS', 'USD')),
  opening_balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Destino de las FK compuestas: nadie referencia una cuenta ajena.
  unique (user_id, id)
);

-- Solo tarjetas de crédito en la v1 (sin `kind` ni `account_id`).
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  bank text not null,
  name text not null,
  network text not null check (network in ('VISA', 'MC', 'AMEX', 'CABAL')),
  last4 char(4) not null check (last4 ~ '^[0-9]{4}$'),
  expiry char(5) check (expiry ~ '^(0[1-9]|1[0-2])/[0-9]{2}$'),
  color text,
  is_favorite boolean not null default false,
  close_day smallint not null check (close_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  credit_limit numeric(14, 2) check (credit_limit >= 0),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (user_id, id)
);

create unique index cards_one_favorite_idx on public.cards (user_id)
  where is_favorite and archived_at is null;

create table public.statement_overrides (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null,
  period date not null check (extract(day from period) = 1),
  close_date date not null,
  due_date date not null,
  primary key (card_id, period),
  foreign key (user_id, card_id) references public.cards (user_id, id) on delete cascade,
  check (due_date > close_date)
);

create table public.statement_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null,
  period date not null check (extract(day from period) = 1),
  applies_to text not null check (applies_to in ('ARS', 'USD')),
  amount numeric(14, 2) not null check (amount > 0),
  from_account_id uuid not null,
  debited_amount numeric(14, 2) not null check (debited_amount > 0),
  fx_card_rate numeric(14, 4) check (fx_card_rate > 0),
  paid_at timestamptz not null default now(),
  reverted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (user_id, card_id) references public.cards (user_id, id) on delete cascade,
  foreign key (user_id, from_account_id) references public.accounts (user_id, id)
);

create index statement_payments_card_period_idx on public.statement_payments (card_id, period);

-- ───────────────────────── Categorías ─────────────────────────

-- Las 6 fijas de la beta son del sistema (`user_id` nulo) y las comparten
-- todos, así un gasto de grupo tiene la misma categoría para cada integrante.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  icon text not null,
  color text not null,
  sort smallint not null default 0,
  is_system boolean not null default false,
  check (is_system = (user_id is null))
);

insert into public.categories (id, name, icon, color, sort, is_system) values
  ('00000000-0000-4000-8000-000000000001', 'Supermercado', 'cart', 'c1', 1, true),
  ('00000000-0000-4000-8000-000000000002', 'Salidas', 'food', 'c2', 2, true),
  ('00000000-0000-4000-8000-000000000003', 'Transporte', 'bus', 'c3', 3, true),
  ('00000000-0000-4000-8000-000000000004', 'Servicios', 'bolt', 'c4', 4, true),
  ('00000000-0000-4000-8000-000000000005', 'Suscripciones', 'play', 'c5', 5, true),
  ('00000000-0000-4000-8000-000000000006', 'Otros', 'box', 'c6', 6, true);

create table public.category_keywords (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  word text not null check (length(word) > 0 and word = lower(word)),
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (user_id, word)
);

-- ───────────────────────── Cotizaciones ─────────────────────────

-- Vacía hasta T6: la cargan los cron desde el backend.
create table public.fx_rates (
  id bigint generated always as identity primary key,
  source text not null,
  kind text not null check (kind in ('mep', 'oficial', 'blue', 'tarjeta', 'ccl', 'cripto')),
  buy numeric(14, 4) check (buy > 0),
  sell numeric(14, 4) not null check (sell > 0),
  fetched_at timestamptz not null default now()
);

create index fx_rates_kind_fetched_idx on public.fx_rates (kind, fetched_at desc);

-- ─────────────────────────── Grupos ───────────────────────────

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  owner_member_id uuid,
  -- SHA-256 en hex de un token aleatorio de 128 bits; el token nunca se guarda.
  invite_token_hash text unique check (invite_token_hash ~ '^[0-9a-f]{64}$'),
  invite_token_created_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  -- Nulo si es provisorio. Solo lo asigna claim_member.
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null check (length(trim(display_name)) > 0),
  -- Alias o CBU para saldar. Nunca sale en la web de invitados.
  payment_alias text,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  claimed_at timestamptz,
  unclaimed_at timestamptz,
  unclaimed_by uuid references auth.users (id) on delete set null,
  unique (group_id, id)
);

-- D16: lo usa is_group_member en cada política de grupo. Además, una
-- persona ocupa como mucho un lugar activo por grupo.
create unique index group_members_user_group_idx on public.group_members (user_id, group_id)
  where user_id is not null and left_at is null;

-- El dueño es un integrante del mismo grupo.
alter table public.groups
  add foreign key (id, owner_member_id) references public.group_members (group_id, id);

create table public.group_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  date date not null,
  description text not null check (length(trim(description)) > 0),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  -- Cotización fija del día, si la moneda difiere de la del grupo.
  fx_rate numeric(14, 4) check (fx_rate > 0),
  payer_member_id uuid not null,
  split_mode text not null check (split_mode in ('equal', 'exact')),
  category_id uuid references public.categories (id),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (group_id, id),
  foreign key (group_id, payer_member_id) references public.group_members (group_id, id)
);

-- D16
create index group_expenses_group_date_idx on public.group_expenses (group_id, date);

create table public.group_expense_parts (
  group_id uuid not null,
  group_expense_id uuid not null,
  member_id uuid not null,
  -- 1 en partes iguales; el monto en exactos.
  value numeric(14, 2) not null check (value >= 0),
  primary key (group_expense_id, member_id),
  foreign key (group_id, group_expense_id) references public.group_expenses (group_id, id) on delete cascade,
  foreign key (group_id, member_id) references public.group_members (group_id, id)
);

create table public.group_payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_member_id uuid not null,
  to_member_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  date date not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_member_id <> to_member_id),
  foreign key (group_id, from_member_id) references public.group_members (group_id, id),
  foreign key (group_id, to_member_id) references public.group_members (group_id, id)
);

create index group_payments_group_date_idx on public.group_payments (group_id, date);

-- ───────────────────────── Movimientos ─────────────────────────

create table public.movements (
  -- Lo genera el teléfono; el servidor guarda con on conflict (id) do nothing.
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('expense', 'income', 'transfer', 'adjustment', 'card_payment')),
  origin text not null default 'manual' check (origin in ('manual', 'text', 'claim', 'purge')),
  date date not null,
  description text not null default '',
  amount numeric(14, 2) not null,
  currency text not null check (currency in ('ARS', 'USD')),
  card_id uuid,
  account_id uuid,
  -- En una transferencia, `amount` es lo que entra a esta cuenta y
  -- `debited_amount` lo que sale de `account_id`.
  to_account_id uuid,
  installments smallint not null default 1 check (installments between 1 and 24),
  category_id uuid references public.categories (id),
  my_share numeric(14, 2) check (my_share >= 0),
  group_expense_id uuid references public.group_expenses (id) on delete set null,
  -- Las completa el trigger de T6.
  fx_mep numeric(14, 4),
  fx_oficial numeric(14, 4),
  fx_blue numeric(14, 4),
  fx_pending boolean not null default false,
  debited_amount numeric(14, 2) check (debited_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, card_id) references public.cards (user_id, id) on delete cascade,
  foreign key (user_id, account_id) references public.accounts (user_id, id),
  foreign key (user_id, to_account_id) references public.accounts (user_id, id),
  -- Tarjeta o cuenta, nunca las dos. Sin ninguna: solo ajustes y los
  -- "Sin medio de pago" que entran al reclamar un lugar (02 §5 y §7).
  constraint movements_payment_method check (
    not (card_id is not null and account_id is not null)
    and (card_id is not null or account_id is not null or type = 'adjustment' or origin = 'claim')
  ),
  constraint movements_installments_need_card check (installments = 1 or card_id is not null),
  constraint movements_transfer check (
    (type = 'transfer') = (to_account_id is not null)
    and (type <> 'transfer' or (account_id is not null and account_id <> to_account_id))
  ),
  constraint movements_amount check (amount > 0 or (type = 'adjustment' and amount <> 0))
);

-- D16
create index movements_user_card_date_idx on public.movements (user_id, card_id, date);

-- ─────────────────── Alertas y notificaciones ───────────────────

-- En la v1, solo aviso de cierre y de vencimiento (02 §9).
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('card_closing', 'card_due')),
  enabled boolean not null default true,
  params jsonb not null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(params -> 'card_id') = 'string'),
  check (
    type <> 'card_due'
    or (jsonb_typeof(params -> 'days_before') = 'number' and (params ->> 'days_before')::numeric in (1, 2, 3, 4, 5))
  )
);

create unique index alerts_user_type_card_idx on public.alerts (user_id, type, (params ->> 'card_id'));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  alert_id uuid references public.alerts (id) on delete set null,
  title text not null,
  body text not null,
  severity text not null default 'info' check (severity in ('info', 'warning')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- ─────────────────────────── Triggers ───────────────────────────

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function private.set_updated_at();
create trigger movements_updated_at before update on public.movements
  for each row execute function private.set_updated_at();
create trigger group_expenses_updated_at before update on public.group_expenses
  for each row execute function private.set_updated_at();

-- Al registrarse, cada usuario recibe su fila de ajustes.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Lo que las FK compuestas no cubren. Corren como el usuario que escribe,
-- así que solo ven lo que sus políticas le dejan ver; además comparan
-- contra el user_id de la fila para valer también desde funciones del sistema.
create function private.category_available(category uuid, owner uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.categories c
    where c.id = category and (c.user_id is null or c.user_id = owner)
  );
$$;

create function private.check_movement_refs() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.category_id is not null
     and (tg_op = 'INSERT' or new.category_id is distinct from old.category_id)
     and not private.category_available(new.category_id, new.user_id) then
    raise exception 'category % is not available', new.category_id using errcode = '23503';
  end if;

  -- Solo se vincula un gasto de un grupo donde el usuario es integrante activo.
  -- Si después sale del grupo, el vínculo que ya tenía se mantiene.
  if new.group_expense_id is not null
     and (tg_op = 'INSERT' or new.group_expense_id is distinct from old.group_expense_id)
     and not exists (
       select 1
       from public.group_expenses e
       join public.groups g on g.id = e.group_id
       join public.group_members m on m.group_id = e.group_id
       where e.id = new.group_expense_id
         and g.deleted_at is null
         and m.user_id = new.user_id
         and m.left_at is null
     ) then
    raise exception 'group expense % is not available', new.group_expense_id using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger movements_check_refs before insert or update on public.movements
  for each row execute function private.check_movement_refs();

create function private.check_keyword_category() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not private.category_available(new.category_id, new.user_id) then
    raise exception 'category % is not available', new.category_id using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger category_keywords_check_category before insert or update on public.category_keywords
  for each row execute function private.check_keyword_category();

create function private.check_group_expense_category() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Un gasto de grupo solo usa categorías del sistema, que ven todos.
  if new.category_id is not null
     and not exists (select 1 from public.categories c where c.id = new.category_id and c.user_id is null) then
    raise exception 'category % is not available', new.category_id using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger group_expenses_check_category before insert or update on public.group_expenses
  for each row execute function private.check_group_expense_category();

create function private.check_alert_card() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.cards c
    where c.id = (new.params ->> 'card_id')::uuid and c.user_id = new.user_id
  ) then
    raise exception 'card % is not available', new.params ->> 'card_id' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger alerts_check_card before insert or update on public.alerts
  for each row execute function private.check_alert_card();

-- Cada uno edita solo su propio alias. Las funciones security definer
-- (corren como su dueño, no como `authenticated`) quedan afuera.
create function private.guard_member_alias() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated'
     and new.payment_alias is distinct from old.payment_alias
     and old.user_id is distinct from (select auth.uid()) then
    raise exception 'only the member can edit their payment alias' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger group_members_guard_alias before update on public.group_members
  for each row execute function private.guard_member_alias();

-- ─────────────────────── Funciones de la base ───────────────────────

-- D16: la usan todas las políticas de grupo. Integrante activo de un grupo
-- que no fue eliminado.
create function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_members m
    join public.groups g on g.id = m.group_id
    where m.group_id = gid
      and m.user_id = (select auth.uid())
      and m.left_at is null
      and g.deleted_at is null
  );
$$;

-- Única entrada del rol anónimo. Devuelve lo que necesita la web de
-- invitados para mostrar gastos, nombres y saldos (los calcula con
-- packages/core), sin payment_alias, user_id ni created_by.
-- Los montos van como texto para no perder decimales (fromDbNumeric).
create function public.get_guest_group(token text) returns jsonb
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
      where p.group_id = g.id
    ), '[]'::jsonb)
  )
  from g;
$$;

-- Crear un grupo: con RLS nadie podría sumarse como primer integrante.
-- Crea el grupo, el lugar de quien lo crea y lo deja como dueño.
create function public.create_group(group_name text, group_currency text, member_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  gid uuid;
  mid uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.groups (name, currency) values (group_name, group_currency)
    returning id into gid;
  insert into public.group_members (group_id, user_id, display_name) values (gid, uid, member_name)
    returning id into mid;
  update public.groups set owner_member_id = mid where id = gid;

  return gid;
end;
$$;

-- ─────────────────────────── Permisos ───────────────────────────

-- Nada por defecto: cada tabla y función recibe solo lo que necesita.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from public, anon;
-- El EXECUTE a PUBLIC de las funciones nuevas es un permiso por defecto
-- global: el de schema de arriba no lo saca.
alter default privileges revoke execute on functions from public;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.create_group(text, text, text) to authenticated;
grant execute on function public.get_guest_group(text) to anon, authenticated;

-- Las políticas de los triggers las evalúa el usuario que escribe.
grant usage on schema private to authenticated;
grant execute on function private.category_available(uuid, uuid) to authenticated;

-- Tablas personales: el dueño lee, carga, edita y borra (el "Deshacer" borra).
grant select, insert, update, delete on
  public.accounts,
  public.cards,
  public.statement_overrides,
  public.statement_payments,
  public.movements,
  public.category_keywords,
  public.alerts
to authenticated;

grant select, update (name, display_currency, fx_reference, theme, notify_push, quiet_from, quiet_to, goal)
  on public.user_settings to authenticated;
grant select, update (read_at), delete on public.notifications to authenticated;
grant select on public.categories, public.fx_rates to authenticated;

-- Grupos: sin delete (borrado lógico). Lo que cambia el dueño, la salida,
-- el token y el reclamo va por funciones.
grant select, update (name) on public.groups to authenticated;
grant select, insert (id, group_id, display_name), update (display_name, payment_alias)
  on public.group_members to authenticated;
grant select,
  insert (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode, category_id),
  update (date, description, amount, currency, fx_rate, payer_member_id, split_mode, category_id, deleted_at)
  on public.group_expenses to authenticated;
-- Las partes sí se borran: editar un gasto puede excluir a alguien.
grant select, insert, update (value), delete on public.group_expense_parts to authenticated;
grant select, insert (id, group_id, from_member_id, to_member_id, amount, date)
  on public.group_payments to authenticated;

-- ─────────────────────── Políticas por fila ───────────────────────

alter table public.user_settings enable row level security;
alter table public.accounts enable row level security;
alter table public.cards enable row level security;
alter table public.statement_overrides enable row level security;
alter table public.statement_payments enable row level security;
alter table public.categories enable row level security;
alter table public.category_keywords enable row level security;
alter table public.fx_rates enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_expenses enable row level security;
alter table public.group_expense_parts enable row level security;
alter table public.group_payments enable row level security;
alter table public.movements enable row level security;
alter table public.alerts enable row level security;
alter table public.notifications enable row level security;

create policy own_rows on public.user_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.accounts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.cards for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.statement_overrides for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.statement_payments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.category_keywords for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.movements for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.alerts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.notifications for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy system_or_own on public.categories for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy read_all on public.fx_rates for select to authenticated
  using (true);

create policy members_read on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy members_update on public.groups for update to authenticated
  using (public.is_group_member(id)) with check (public.is_group_member(id));

create policy members_read on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
-- Cualquier integrante suma provisorios (user_id queda nulo: no tiene grant).
create policy members_insert on public.group_members for insert to authenticated
  with check (public.is_group_member(group_id));
-- Cada uno edita su fila; cualquiera, el nombre de un provisorio.
create policy members_update on public.group_members for update to authenticated
  using (public.is_group_member(group_id) and (user_id = (select auth.uid()) or user_id is null))
  with check (public.is_group_member(group_id));

create policy members_read on public.group_expenses for select to authenticated
  using (public.is_group_member(group_id));
create policy members_insert on public.group_expenses for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = (select auth.uid()));
create policy members_update on public.group_expenses for update to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

create policy members_all on public.group_expense_parts for all to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

create policy members_read on public.group_payments for select to authenticated
  using (public.is_group_member(group_id));
create policy members_insert on public.group_payments for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = (select auth.uid()));
