-- Lista de movimientos (L-3): editar un gasto personal y completar un "Sin
-- medio de pago" del reclamo, con los pagos de "¿Ya lo pagaste?" en la misma
-- transacción (02 §5, "Editar y borrar un gasto").
--
-- `expense`: {id, date, description, amount, currency, card_id, account_id,
--   installments, category_id, debited_amount}. Se reemplazan siempre card_id
--   y account_id: pasar de tarjeta a cuenta deja card_id en null.
-- `payments`: como en save_expense_with_payments, con el id del teléfono, así
--   un reintento no los duplica.
-- Un gasto del reclamo (origin = 'claim') solo cambia el medio de pago, las
-- cuotas, la descripción y la categoría (L7): monto, moneda y fecha copian el
-- gasto del grupo. El trigger movements_fx recalcula las cotizaciones si cambia
-- la fecha.

create function public.update_expense_with_payments(expense jsonb, payments jsonb default '[]')
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  card uuid := nullif(expense ->> 'card_id', '')::uuid;
begin
  if jsonb_array_length(coalesce(payments, '[]')) > 0 and card is null then
    raise exception 'payments need a card expense' using errcode = '22023';
  end if;

  update public.movements m set
    card_id = card,
    account_id = nullif(expense ->> 'account_id', '')::uuid,
    installments = coalesce((expense ->> 'installments')::smallint, 1),
    description = coalesce(expense ->> 'description', ''),
    category_id = nullif(expense ->> 'category_id', '')::uuid,
    debited_amount = nullif(expense ->> 'debited_amount', '')::numeric,
    date = case when m.origin = 'claim' then m.date else (expense ->> 'date')::date end,
    amount = case when m.origin = 'claim' then m.amount else (expense ->> 'amount')::numeric end,
    currency = case when m.origin = 'claim' then m.currency else expense ->> 'currency' end
  where m.id = (expense ->> 'id')::uuid and m.type = 'expense' and m.origin <> 'purge';

  if not found then
    raise exception 'expense not found' using errcode = 'P0002';
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
  from jsonb_array_elements(coalesce(payments, '[]')) p
  on conflict (id) do nothing;
end;
$$;
