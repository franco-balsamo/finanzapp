-- D-6: los pagos de save_expense_with_payments aceptan el id que generó el
-- teléfono. Así el "Deshacer" del toast revierte exactamente esos pagos
-- (reverted_at) además de borrar el gasto. Sin id, se genera como antes.

create or replace function public.save_expense_with_payments(expense jsonb, payments jsonb default '[]')
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
    id, card_id, period, applies_to, amount, from_account_id, debited_amount, fx_card_rate, paid_at
  )
  select
    coalesce(nullif(p ->> 'id', '')::uuid, gen_random_uuid()),
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
