-- "¿Ya lo pagaste?" con un gasto de grupo (9/10): save_group_expense_with_movement suma
-- `payments`, los pagos nuevos de la tarjeta de tu movimiento, con el mismo formato que
-- save_expense_with_payments. Todo en una transacción. El resto de la función no cambia.

drop function public.save_group_expense_with_movement(uuid, uuid, date, text, numeric, text, numeric, uuid, text, uuid, jsonb, jsonb);

create function public.save_group_expense_with_movement(
  expense_id uuid,
  group_id uuid,
  expense_date date,
  description text,
  amount numeric,
  currency text,
  fx_rate numeric,
  payer_member_id uuid,
  split_mode text,
  category_id uuid,
  parts jsonb,
  movement jsonb default null,
  payments jsonb default '[]'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  existing record;
  saved uuid;
  payer_user uuid;
  money_changed boolean := false;
  mine uuid;
  card uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select e.* into existing from public.group_expenses e
  where e.id = save_group_expense_with_movement.expense_id for update;

  if existing.id is not null then
    money_changed := existing.amount <> save_group_expense_with_movement.amount
      or existing.currency <> save_group_expense_with_movement.currency
      or existing.payer_member_id <> save_group_expense_with_movement.payer_member_id;
  end if;

  saved := public.save_group_expense(
    save_group_expense_with_movement.expense_id, save_group_expense_with_movement.group_id, expense_date,
    save_group_expense_with_movement.description, save_group_expense_with_movement.amount,
    save_group_expense_with_movement.currency, save_group_expense_with_movement.fx_rate,
    save_group_expense_with_movement.payer_member_id, save_group_expense_with_movement.split_mode,
    save_group_expense_with_movement.category_id, parts
  );

  select m.user_id into payer_user from public.group_members m
  where m.id = save_group_expense_with_movement.payer_member_id;

  -- Si quien pagó pasa a ser otro, la compra deja de ser tuya: se borra tu movimiento.
  if existing.id is not null and existing.payer_member_id <> save_group_expense_with_movement.payer_member_id then
    delete from public.movements mv where mv.group_expense_id = saved and mv.user_id = uid;
  end if;

  if movement is not null and coalesce((movement ->> 'remove')::boolean, false) then
    delete from public.movements mv where mv.group_expense_id = saved and mv.user_id = uid;
  elsif movement is not null then
    if payer_user is distinct from uid then
      raise exception 'only the payer can add the expense to their finances' using errcode = '22023';
    end if;

    select mv.id into mine from public.movements mv
    where mv.group_expense_id = saved and mv.user_id = uid and mv.origin <> 'claim'
    limit 1;

    if mine is null then
      insert into public.movements (
        id, user_id, type, origin, date, description, amount, currency, card_id, account_id,
        installments, category_id, debited_amount, group_expense_id
      ) values (
        (movement ->> 'id')::uuid, uid, 'expense', coalesce(movement ->> 'origin', 'manual'), expense_date,
        save_group_expense_with_movement.description, save_group_expense_with_movement.amount,
        save_group_expense_with_movement.currency,
        nullif(movement ->> 'card_id', '')::uuid, nullif(movement ->> 'account_id', '')::uuid,
        coalesce((movement ->> 'installments')::smallint, 1), save_group_expense_with_movement.category_id,
        nullif(movement ->> 'debited_amount', '')::numeric, saved
      )
      on conflict (id) do nothing;
    else
      update public.movements mv set
        date = expense_date,
        description = save_group_expense_with_movement.description,
        amount = save_group_expense_with_movement.amount,
        currency = save_group_expense_with_movement.currency,
        card_id = nullif(movement ->> 'card_id', '')::uuid,
        account_id = nullif(movement ->> 'account_id', '')::uuid,
        installments = coalesce((movement ->> 'installments')::smallint, 1),
        category_id = save_group_expense_with_movement.category_id,
        debited_amount = nullif(movement ->> 'debited_amount', '')::numeric
      where mv.id = mine;
    end if;
  elsif money_changed then
    -- Quien pagó cambió el monto sin mandar su movimiento: se mantiene en sync.
    update public.movements mv set
      amount = save_group_expense_with_movement.amount,
      currency = save_group_expense_with_movement.currency
    where mv.group_expense_id = saved and mv.user_id = uid;
  end if;

  -- Tu parte, recalculada en todos los movimientos vinculados (cualquiera puede cambiar la división).
  update public.movements mv set my_share = coalesce((
    select s.share_minor / 100
    from private.member_shares(saved, false) s
    join public.group_members m on m.id = s.member_id
    where m.user_id = mv.user_id
  ), 0)
  where mv.group_expense_id = saved;

  -- "¿Ya lo pagaste?" (02 §3): los pagos nuevos van a la tarjeta de tu movimiento.
  -- Reintentar con los mismos ids no los duplica.
  if jsonb_array_length(coalesce(payments, '[]')) > 0 then
    select mv.card_id into card from public.movements mv
    where mv.group_expense_id = saved and mv.user_id = uid and mv.origin <> 'claim'
    limit 1;
    if card is null then
      raise exception 'payments need a card expense' using errcode = '22023';
    end if;

    insert into public.statement_payments (
      id, user_id, card_id, period, applies_to, amount, from_account_id, debited_amount, fx_card_rate, paid_at
    )
    select
      coalesce(nullif(p ->> 'id', '')::uuid, gen_random_uuid()),
      uid,
      card,
      (p ->> 'period')::date,
      p ->> 'applies_to',
      (p ->> 'amount')::numeric,
      (p ->> 'from_account_id')::uuid,
      (p ->> 'debited_amount')::numeric,
      nullif(p ->> 'fx_card_rate', '')::numeric,
      ((p ->> 'paid_on')::date + time '12:00') at time zone 'America/Argentina/Buenos_Aires'
    from jsonb_array_elements(payments) p
    on conflict (id) do nothing;
  end if;

  return saved;
end;
$$;

revoke execute on function public.save_group_expense_with_movement(uuid, uuid, date, text, numeric, text, numeric, uuid, text, uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_group_expense_with_movement(uuid, uuid, date, text, numeric, text, numeric, uuid, text, uuid, jsonb, jsonb, jsonb) to authenticated;
