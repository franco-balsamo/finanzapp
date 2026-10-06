-- Grupos en la app (G-1, spec docs/specs/2026-10-06-epica-grupos-en-la-app.md).
-- Decisiones en docs/decisiones/2026-10-06-spec-grupos-en-la-app.md.
--
-- - save_group_expense_with_movement: gasto de grupo, partes y tu movimiento
--   personal en una transacción (D3), con la regla de edición de D5.
-- - delete_group_expense: borrado lógico; el movimiento de quien pagó pierde
--   el vínculo y vuelve a contar completo (D6).
-- - register_group_payment: pago entre integrantes que opcionalmente mueve el
--   saldo de una de tus cuentas (D7). void_group_payment borra ese movimiento.
-- - Las reglas de D5 y D6 viven en triggers de group_expenses, así valen
--   también para save_group_expense y para el update directo de deleted_at.

alter table public.movements
  add column group_payment_id uuid references public.group_payments (id) on delete cascade;

create index movements_group_payment_idx on public.movements (group_payment_id) where group_payment_id is not null;
create index movements_group_expense_idx on public.movements (group_expense_id) where group_expense_id is not null;

-- ─────────────── Gasto de grupo con tu movimiento ───────────────

-- `movement`:
--   null               → tu movimiento no cambia (en un alta, no se crea);
--   {"remove": true}   → se borra tu movimiento vinculado ("No sumarlo a mis finanzas");
--   {id, card_id | account_id, installments, debited_amount, origin}
--                      → se crea o se actualiza tu movimiento. Solo si el que pagó sos vos.
-- Monto, moneda, fecha, descripción y categoría salen del gasto; my_share es tu
-- parte en la moneda del gasto (private.member_shares). Reintentar con los mismos
-- ids no duplica nada.
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
  movement jsonb default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  existing record;
  saved uuid;
  payer_user uuid;
  money_changed boolean := false;
  mine uuid;
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

  return saved;
end;
$$;

-- ─────────────── Reglas sobre group_expenses (D5 y D6) ───────────────

-- D5: el monto, la moneda y quién pagó los cambia solo quien tiene el gasto en
-- sus finanzas. Vale para save_group_expense y para esta función.
create function private.guard_group_expense_money() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.amount <> old.amount or new.currency <> old.currency or new.payer_member_id <> old.payer_member_id)
     and exists (
       select 1 from public.movements mv
       where mv.group_expense_id = old.id and mv.user_id is distinct from (select auth.uid())
     ) then
    raise exception 'only the payer can change the amount, currency or payer' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger group_expenses_guard_money before update on public.group_expenses
  for each row execute function private.guard_group_expense_money();

-- D6: un gasto de grupo borrado deja de estar vinculado. Los movimientos de todos
-- vuelven a contar completos (security definer: son de otros usuarios).
create function private.unlink_deleted_group_expense() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.movements set group_expense_id = null, my_share = null where group_expense_id = new.id;
  return new;
end;
$$;

create trigger group_expenses_unlink_deleted after update of deleted_at on public.group_expenses
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function private.unlink_deleted_group_expense();

-- ─────────────────── Borrar un gasto de grupo ───────────────────

-- Cualquier integrante (02 §7). Los movimientos vinculados pierden el vínculo y
-- vuelven a contar completos en la categoría, como al eliminar un grupo (D6).
create function public.delete_group_expense(expense_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e record;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select x.* into e from public.group_expenses x where x.id = delete_group_expense.expense_id for update;
  if e.id is null or not public.is_group_member(e.group_id) then
    raise exception 'expense % not found', delete_group_expense.expense_id using errcode = 'P0002';
  end if;
  if e.deleted_at is not null then
    return;
  end if;

  -- El trigger group_expenses_unlink_deleted desvincula los movimientos.
  update public.group_expenses set deleted_at = now() where id = e.id;
end;
$$;

-- ─────────────────────── Registrar un pago ───────────────────────

-- Mangos registra el pago; no mueve plata. Con `account_id` (solo si sos el que
-- paga o el que cobra, con una cuenta tuya en la moneda del grupo), también se
-- mueve el saldo: si cobrás, un 'income'; si pagás, un 'adjustment' negativo.
-- Ninguno cuenta en el gasto por categoría. Reintentar con el mismo id no duplica.
create function public.register_group_payment(
  payment_id uuid,
  group_id uuid,
  from_member_id uuid,
  to_member_id uuid,
  amount numeric,
  payment_date date,
  account_id uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  g record;
  me uuid;
  other_name text;
  inserted integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select gr.* into g from public.groups gr
  where gr.id = register_group_payment.group_id and gr.deleted_at is null;
  if g.id is null or not public.is_group_member(g.id) then
    raise exception 'not a member of group %', register_group_payment.group_id using errcode = '42501';
  end if;

  if register_group_payment.from_member_id = register_group_payment.to_member_id then
    raise exception 'a payment needs two different people' using errcode = '22023';
  end if;
  if (select count(*) from public.group_members m
      where m.group_id = g.id and m.left_at is null
        and m.id in (register_group_payment.from_member_id, register_group_payment.to_member_id)) <> 2 then
    raise exception 'both people must be active members of the group' using errcode = '22023';
  end if;
  if register_group_payment.amount is null or register_group_payment.amount <= 0
     or register_group_payment.amount <> round(register_group_payment.amount, 2) then
    raise exception 'amount must be positive with at most 2 decimals' using errcode = '22023';
  end if;

  if register_group_payment.account_id is not null then
    select m.id into me from public.group_members m
    where m.group_id = g.id and m.user_id = uid and m.left_at is null;
    if me is null or me not in (register_group_payment.from_member_id, register_group_payment.to_member_id) then
      raise exception 'only who pays or who gets paid can move an account balance' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.accounts a
      where a.id = register_group_payment.account_id and a.user_id = uid
        and a.deleted_at is null and a.currency = g.currency
    ) then
      raise exception 'account must be yours and in the group currency' using errcode = '22023';
    end if;
  end if;

  insert into public.group_payments (id, group_id, from_member_id, to_member_id, amount, date, created_by)
  values (register_group_payment.payment_id, g.id, register_group_payment.from_member_id,
          register_group_payment.to_member_id, register_group_payment.amount, payment_date, uid)
  on conflict (id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 or register_group_payment.account_id is null then
    return;
  end if;

  select m.display_name into other_name from public.group_members m
  where m.id = case when me = register_group_payment.to_member_id
                    then register_group_payment.from_member_id else register_group_payment.to_member_id end;

  insert into public.movements (user_id, type, date, description, amount, currency, account_id, group_payment_id)
  values (
    uid,
    case when me = register_group_payment.to_member_id then 'income' else 'adjustment' end,
    payment_date,
    case when me = register_group_payment.to_member_id
         then format('Pago de %s (%s)', other_name, g.name)
         else format('Pago a %s (%s)', other_name, g.name) end,
    case when me = register_group_payment.to_member_id
         then register_group_payment.amount else -register_group_payment.amount end,
    g.currency,
    register_group_payment.account_id,
    register_group_payment.payment_id
  );
end;
$$;

-- Anular un pago también borra el movimiento de cuenta que había generado (D7).
create or replace function public.void_group_payment(payment_id uuid) returns void
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
  delete from public.movements where group_payment_id = p.id;
end;
$$;

-- ─────────────────────────── Permisos ───────────────────────────

revoke execute on function
  public.save_group_expense_with_movement(uuid, uuid, date, text, numeric, text, numeric, uuid, text, uuid, jsonb, jsonb),
  public.delete_group_expense(uuid),
  public.register_group_payment(uuid, uuid, uuid, uuid, numeric, date, uuid)
from public, anon;
grant execute on function
  public.save_group_expense_with_movement(uuid, uuid, date, text, numeric, text, numeric, uuid, text, uuid, jsonb, jsonb),
  public.delete_group_expense(uuid),
  public.register_group_payment(uuid, uuid, uuid, uuid, numeric, date, uuid)
to authenticated;
