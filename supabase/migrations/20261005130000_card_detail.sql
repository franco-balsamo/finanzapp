-- Detalle de tarjeta (spec del 5/10, D-1): límite obligatorio, favorita en una
-- transacción y gasto cargado tarde con sus pagos ("¿Ya lo pagaste?" → Sí, 02 §3).

-- Límite obligatorio y mayor a cero (02 §3, D3). NOT VALID: no revisa las tarjetas
-- que ya existen, pero sí cualquier insert o update, así que editar una tarjeta
-- sin límite obliga a cargarlo.
alter table public.cards
  add constraint cards_credit_limit_required check (credit_limit is not null and credit_limit > 0) not valid;

-- Una sola favorita entre las tarjetas activas. Con dos updates desde la app,
-- el índice único parcial (cards_one_favorite_idx) choca si el orden sale mal.
-- Security invoker: RLS limita todo a las tarjetas del usuario.
create function public.set_favorite_card(card_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.cards c where c.id = set_favorite_card.card_id and c.archived_at is null
  ) then
    raise exception 'card not found' using errcode = 'P0002';
  end if;
  update public.cards c set is_favorite = false
    where c.is_favorite and c.id <> set_favorite_card.card_id;
  update public.cards c set is_favorite = true
    where c.id = set_favorite_card.card_id;
end;
$$;

-- Gasto y pagos en una transacción: o se guarda todo o nada (D2).
-- `expense`: {id, origin, date, description, amount, currency, card_id, account_id,
--   installments, category_id, debited_amount}, con el id que generó el teléfono.
-- `payments`: [{period, applies_to, amount, from_account_id, debited_amount,
--   fx_card_rate, paid_on}], todos de la tarjeta del gasto. `paid_on` es la fecha
--   en hora de Argentina; se guarda a las 12:00 de ese día, así la fecha no cambia
--   al leerla en cualquier zona horaria.
-- Si el id ya existe (un reintento que sí había llegado), no hace nada y devuelve
-- false: nunca duplica el gasto ni los pagos.
-- Security invoker: RLS y las FK compuestas impiden usar tarjetas o cuentas ajenas.
create function public.save_expense_with_payments(expense jsonb, payments jsonb default '[]')
returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  inserted integer;
  card uuid := nullif(expense ->> 'card_id', '')::uuid;
begin
  if jsonb_array_length(coalesce(payments, '[]')) > 0 and card is null then
    raise exception 'payments need a card expense' using errcode = '22023';
  end if;

  insert into public.movements (
    id, type, origin, date, description, amount, currency, card_id, account_id,
    installments, category_id, debited_amount
  ) values (
    (expense ->> 'id')::uuid,
    'expense',
    coalesce(expense ->> 'origin', 'manual'),
    (expense ->> 'date')::date,
    coalesce(expense ->> 'description', ''),
    (expense ->> 'amount')::numeric,
    expense ->> 'currency',
    card,
    nullif(expense ->> 'account_id', '')::uuid,
    coalesce((expense ->> 'installments')::smallint, 1),
    nullif(expense ->> 'category_id', '')::uuid,
    nullif(expense ->> 'debited_amount', '')::numeric
  )
  on conflict (id) do nothing;

  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;

  insert into public.statement_payments (
    card_id, period, applies_to, amount, from_account_id, debited_amount, fx_card_rate, paid_at
  )
  select
    card,
    (p ->> 'period')::date,
    p ->> 'applies_to',
    (p ->> 'amount')::numeric,
    (p ->> 'from_account_id')::uuid,
    (p ->> 'debited_amount')::numeric,
    nullif(p ->> 'fx_card_rate', '')::numeric,
    ((p ->> 'paid_on')::date + time '12:00') at time zone 'America/Argentina/Buenos_Aires'
  from jsonb_array_elements(coalesce(payments, '[]')) p;

  return true;
end;
$$;

revoke execute on function public.set_favorite_card(uuid) from public, anon;
revoke execute on function public.save_expense_with_payments(jsonb, jsonb) from public, anon;
grant execute on function public.set_favorite_card(uuid) to authenticated;
grant execute on function public.save_expense_with_payments(jsonb, jsonb) to authenticated;
