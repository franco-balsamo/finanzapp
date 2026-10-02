-- Cierre de grupos (02 §7): gastos de grupo validados en la base, quitar a
-- un integrante y eliminar el grupo. Decisiones en
-- docs/decisiones/2026-10-02-spec-cierre-de-grupos.md.

-- ───────────── Los gastos y sus partes se escriben solo por función ─────────────

-- Si se pudiera cambiar el monto directo, las partes guardadas dejarían de
-- sumar. Queda directo solo el borrado lógico (deleted_at).
revoke insert, update on public.group_expenses from authenticated;
revoke insert, update, delete on public.group_expense_parts from authenticated;
grant update (deleted_at) on public.group_expenses to authenticated;

drop policy members_insert on public.group_expenses;
drop policy members_all on public.group_expense_parts;
create policy members_read on public.group_expense_parts for select to authenticated
  using (public.is_group_member(group_id));

-- Crea o edita un gasto de grupo con sus partes, en una transacción.
-- parts: [{"member_id": uuid, "value": "123.45" | null}]. En partes iguales
-- el valor se ignora (se guarda 1); en exactos va en la moneda del gasto.
-- Las partes se guardan como se cargaron: la diferencia de hasta $0,50 va
-- al que pagó al calcular (member_shares y shares() de core).
create function public.save_group_expense(
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
  parts jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  g record;
  existing record;
  saved uuid;
  -- Integrantes que el gasto ya tenía: pueden quedar aunque se hayan ido.
  previous uuid[] := '{}'::uuid[];
  part jsonb;
  part_member uuid;
  part_value numeric;
  seen uuid[] := '{}'::uuid[];
  exact_sum numeric := 0;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select gr.* into g from public.groups gr
  where gr.id = save_group_expense.group_id and gr.deleted_at is null;
  if g.id is null or not public.is_group_member(g.id) then
    raise exception 'not a member of group %', save_group_expense.group_id using errcode = '42501';
  end if;

  select e.* into existing from public.group_expenses e where e.id = save_group_expense.expense_id for update;
  if existing.id is not null then
    if existing.group_id <> g.id then
      raise exception 'expense % belongs to another group', expense_id using errcode = '42501';
    end if;
    if existing.deleted_at is not null then
      raise exception 'expense % is deleted', expense_id using errcode = '55000';
    end if;
    select array_agg(p.member_id) || existing.payer_member_id into previous
    from public.group_expense_parts p where p.group_expense_id = existing.id;
  end if;

  -- Validaciones (02 §7).
  if save_group_expense.split_mode not in ('equal', 'exact') then
    raise exception 'invalid split mode %', save_group_expense.split_mode using errcode = '22023';
  end if;
  if save_group_expense.amount is null or save_group_expense.amount <= 0
     or save_group_expense.amount <> round(save_group_expense.amount, 2) then
    raise exception 'amount must be positive with at most 2 decimals' using errcode = '22023';
  end if;
  if (save_group_expense.currency = g.currency) <> (save_group_expense.fx_rate is null) then
    raise exception 'fx_rate is required only when the expense currency differs from the group' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.group_members m
    where m.id = save_group_expense.payer_member_id and m.group_id = g.id
      and (m.left_at is null or m.id = any (previous))
  ) then
    raise exception 'payer % is not an active member of the group', payer_member_id using errcode = '22023';
  end if;

  if parts is null or jsonb_typeof(parts) <> 'array' or jsonb_array_length(parts) = 0 then
    raise exception 'an expense needs at least one person' using errcode = '22023';
  end if;

  for part in select * from jsonb_array_elements(parts) loop
    part_member := (part ->> 'member_id')::uuid;
    if part_member = any (seen) then
      raise exception 'member % appears twice', part_member using errcode = '22023';
    end if;
    seen := seen || part_member;

    if not exists (
      select 1 from public.group_members m
      where m.id = part_member and m.group_id = g.id
        and (m.left_at is null or m.id = any (previous))
    ) then
      raise exception 'member % is not an active member of the group', part_member using errcode = '22023';
    end if;

    if save_group_expense.split_mode = 'exact' then
      part_value := (part ->> 'value')::numeric;
      if part_value is null or part_value < 0 or part_value <> round(part_value, 2) then
        raise exception 'exact part of % must be zero or more, with at most 2 decimals', part_member using errcode = '22023';
      end if;
      exact_sum := exact_sum + part_value;
    end if;
  end loop;

  if save_group_expense.split_mode = 'exact' and abs(exact_sum - save_group_expense.amount) > 0.50 then
    raise exception 'exact parts add up to % but the expense is %', exact_sum, save_group_expense.amount
      using errcode = '22023';
  end if;

  -- Guardar.
  if existing.id is null then
    insert into public.group_expenses
      (id, group_id, date, description, amount, currency, fx_rate, payer_member_id, split_mode, category_id, created_by)
    values
      (coalesce(save_group_expense.expense_id, gen_random_uuid()), g.id, expense_date, save_group_expense.description,
       save_group_expense.amount, save_group_expense.currency, save_group_expense.fx_rate,
       save_group_expense.payer_member_id, save_group_expense.split_mode, save_group_expense.category_id, uid)
    returning id into saved;
  else
    saved := existing.id;
    update public.group_expenses e set
      date = expense_date,
      description = save_group_expense.description,
      amount = save_group_expense.amount,
      currency = save_group_expense.currency,
      fx_rate = save_group_expense.fx_rate,
      payer_member_id = save_group_expense.payer_member_id,
      split_mode = save_group_expense.split_mode,
      category_id = save_group_expense.category_id
    where e.id = existing.id;
    delete from public.group_expense_parts p where p.group_expense_id = existing.id;
  end if;

  insert into public.group_expense_parts (group_id, group_expense_id, member_id, value)
  select g.id, saved, (x ->> 'member_id')::uuid,
         case when save_group_expense.split_mode = 'equal' then 1 else (x ->> 'value')::numeric end
  from jsonb_array_elements(parts) x;

  return saved;
end;
$$;

-- ─────────────────────── Quitar a un integrante ───────────────────────

-- Solo el dueño, y solo si esa persona nunca participó en un gasto ni en un
-- pago (ni borrados ni anulados) y está al día. Como nada la referencia, la
-- fila se borra: no aparece como ex integrante.
create function public.remove_member(member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  m record;
  g record;
  balance numeric;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select gm.* into m from public.group_members gm where gm.id = member_id for update;
  select gr.* into g from public.groups gr where gr.id = m.group_id and gr.deleted_at is null;
  if m.id is null or g.id is null or not public.is_group_member(g.id) then
    raise exception 'member % not found', member_id using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.group_members o where o.id = g.owner_member_id and o.user_id = uid) then
    raise exception 'only the owner can remove members' using errcode = '42501';
  end if;
  if m.id = g.owner_member_id then
    raise exception 'the owner leaves with leave_group' using errcode = '55000';
  end if;
  if exists (select 1 from public.group_expenses e where e.payer_member_id = m.id)
     or exists (select 1 from public.group_expense_parts p where p.member_id = m.id)
     or exists (select 1 from public.group_payments p where p.from_member_id = m.id or p.to_member_id = m.id) then
    raise exception 'member % already took part in expenses or payments', member_id using errcode = '55000';
  end if;
  select b.balance_minor into balance from private.group_balances(g.id) b where b.member_id = m.id;
  if not private.is_settled(coalesce(balance, 0), g.currency) then
    raise exception 'balance is not settled' using errcode = '55000';
  end if;

  delete from public.group_members where id = m.id;

  if m.user_id is not null and m.user_id <> uid then
    perform private.notify(m.user_id, format('Te quitaron de %s', g.name), 'Ya no sos parte del grupo.');
  end if;
end;
$$;

-- ─────────────────────────── Eliminar el grupo ───────────────────────────

-- Solo el dueño (un grupo sin dueño no se puede eliminar). Borrado lógico.
-- Los movimientos personales que venían del grupo vuelven a contar completos.
create function public.delete_group(gid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  g record;
  r record;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select gr.* into g from public.groups gr where gr.id = gid and gr.deleted_at is null for update;
  if g.id is null or not public.is_group_member(g.id) then
    raise exception 'group % not found', gid using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.group_members o where o.id = g.owner_member_id and o.user_id = uid) then
    raise exception 'only the owner can delete the group' using errcode = '42501';
  end if;

  update public.movements mv set group_expense_id = null, my_share = null
  where mv.group_expense_id in (select e.id from public.group_expenses e where e.group_id = g.id);

  update public.groups
  set deleted_at = now(), invite_token_hash = null, invite_token_created_at = null
  where id = g.id;

  for r in
    select m.user_id from public.group_members m
    where m.group_id = g.id and m.user_id is not null and m.left_at is null and m.user_id <> uid
  loop
    perform private.notify(r.user_id, format('Se eliminó %s', g.name), 'Tus gastos de ese grupo vuelven a contar completos.');
  end loop;
end;
$$;

grant execute on function
  public.save_group_expense(uuid, uuid, date, text, numeric, text, numeric, uuid, text, uuid, jsonb),
  public.remove_member(uuid),
  public.delete_group(uuid)
to authenticated;
