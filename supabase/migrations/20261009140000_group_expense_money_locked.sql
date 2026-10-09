-- D5 en la hoja (9/10): la app no ve los movimientos de otros, así que bloqueaba el monto
-- siempre que quien pagó tuviera cuenta. Esta función responde lo mismo que mira el trigger
-- group_expenses_guard_money: si otro usuario tiene el gasto vinculado en sus finanzas.
create function public.group_expense_money_locked(expense_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  gid uuid;
begin
  select e.group_id into gid from public.group_expenses e where e.id = group_expense_money_locked.expense_id;
  if gid is null or not public.is_group_member(gid) then
    raise exception 'expense % not found', group_expense_money_locked.expense_id using errcode = 'P0002';
  end if;
  return exists (
    select 1 from public.movements mv
    where mv.group_expense_id = group_expense_money_locked.expense_id and mv.user_id is distinct from (select auth.uid())
  );
end;
$$;

revoke execute on function public.group_expense_money_locked(uuid) from public, anon;
grant execute on function public.group_expense_money_locked(uuid) to authenticated;
