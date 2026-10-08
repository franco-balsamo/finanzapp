-- Cotizaciones: el historial de ArgentinaDatos se guarda a las 00:00 de su
-- fecha, así el cierre de DolarApi de ese día le gana
-- (docs/decisiones/2026-10-08-historial-al-abrir-el-dia.md).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

delete from public.fx_rates;

insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000001', 'ana@test.local');
insert into public.accounts (id, user_id, name, type, currency) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Caja Ana', 'bank', 'ARS');

-- ArgentinaDatos del 15/9 trae el cierre del 14/9 (1600); DolarApi cerró el 15/9 en 1542,5.
select public.ingest_fx_rates('argentinadatos', '[
  {"casa": "bolsa", "compra": 1595, "venta": 1600, "fecha": "2026-09-15"},
  {"casa": "bolsa", "compra": 1605, "venta": 1610, "fecha": "2026-09-16"}
]'::jsonb);
select public.ingest_fx_rates('dolarapi', '[
  {"casa": "bolsa", "compra": 1540, "venta": 1542.5, "fechaActualizacion": "2026-09-15T20:56:00.000Z"}
]'::jsonb);

select is(
  (select fetched_at from public.fx_rates where source = 'argentinadatos' and rate_date = '2026-09-15'),
  '2026-09-15 00:00:00-03'::timestamptz,
  'el historial queda a las 00:00 de Argentina de su fecha'
);
select is(
  (select rate_date from public.fx_rates where source = 'argentinadatos' and sell = 1610),
  '2026-09-16'::date,
  'y en su misma fecha'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
insert into public.movements (id, type, date, description, amount, currency, account_id) values
  ('a3000000-0000-4000-8000-000000000001', 'expense', '2026-09-15', 'Café', 3500, 'ARS', 'a1000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000002', 'expense', '2026-09-16', 'Café', 3500, 'ARS', 'a1000000-0000-4000-8000-000000000001');
reset role;

select is(
  (select fx_mep from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  1542.5::numeric,
  'un día con DolarApi usa su cierre, no el de ArgentinaDatos'
);
select is(
  (select fx_mep from public.movements where id = 'a3000000-0000-4000-8000-000000000002'),
  1610::numeric,
  'un día sin DolarApi usa el historial'
);

select * from finish();
rollback;
