-- Cotizaciones: ArgentinaDatos solo guarda días terminados y corrige los que ya
-- tenía (docs/decisiones/2026-10-07-cotizacion-del-dia.md). Las fechas salen de
-- hoy en Argentina, porque eso es lo que compara la función.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

delete from public.fx_rates;

create temp table d as select
  (now() at time zone 'America/Argentina/Buenos_Aires')::date as today,
  (now() at time zone 'America/Argentina/Buenos_Aires')::date - 1 as yesterday;

create function pg_temp.ad(casa text, venta numeric, fecha date) returns jsonb
language sql as $$ select jsonb_build_object('casa', casa, 'compra', venta - 5, 'venta', venta, 'fecha', fecha::text) $$;

insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000001', 'ana@test.local');
insert into public.accounts (id, user_id, name, type, currency) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Caja Ana', 'bank', 'ARS');

-- ═════════════════════════ Días sin terminar ═════════════════════════

select is(
  public.ingest_fx_rates('argentinadatos', jsonb_build_array(pg_temp.ad('bolsa', 1544.4, (select today from d)))),
  0,
  'ArgentinaDatos: la fila de hoy se saltea (trae el cierre de ayer)'
);
select is(
  public.ingest_fx_rates('argentinadatos', jsonb_build_array(pg_temp.ad('bolsa', 1544.4, (select today + 1 from d)))),
  0,
  'una fila con fecha futura también'
);
select is(
  public.ingest_fx_rates('argentinadatos', jsonb_build_array(pg_temp.ad('bolsa', 1537.9, (select yesterday from d)))),
  1,
  'la de ayer, que ya cerró, entra'
);

-- ═════════════════════════ Corrección del historial ═════════════════════════

select is(
  public.ingest_fx_rates('argentinadatos', jsonb_build_array(pg_temp.ad('bolsa', 1537.9, (select yesterday from d)))),
  0,
  'el mismo valor otra vez no cuenta'
);
select is(
  public.ingest_fx_rates('argentinadatos', jsonb_build_array(pg_temp.ad('bolsa', 1544.4, (select yesterday from d)))),
  1,
  'un valor distinto para un día que ya estaba lo corrige'
);
select is(
  (select row(buy, sell) from public.fx_rates where source = 'argentinadatos' and kind = 'mep'),
  row(1539.4::numeric, 1544.4::numeric),
  'quedan la compra y la venta nuevas, en una sola fila'
);
select is(
  public.ingest_fx_rates('argentinadatos', jsonb_build_array(
    pg_temp.ad('blue', 1550, (select yesterday from d)),
    pg_temp.ad('blue', 1555, (select yesterday from d))
  )),
  1,
  'dos filas iguales en el mismo lote no frenan la carga'
);

-- DolarApi no se corrige: la misma hora con otro valor se ignora, como antes.
select public.ingest_fx_rates('dolarapi', jsonb_build_array(jsonb_build_object(
  'casa', 'bolsa', 'compra', 1540, 'venta', 1542.5, 'fechaActualizacion', to_char(now() - interval '1 hour', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))));
select is(
  public.ingest_fx_rates('dolarapi', jsonb_build_array(jsonb_build_object(
    'casa', 'bolsa', 'compra', 1, 'venta', 2, 'fechaActualizacion', to_char(now() - interval '1 hour', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))),
  0,
  'DolarApi con la misma hora no pisa lo guardado'
);

-- ═════════════════════════ El caso del 7/10 ═════════════════════════

-- fx-history de las 3:00 trae hoy con el cierre de ayer; un gasto de hoy usa DolarApi.
select public.ingest_fx_rates('argentinadatos', jsonb_build_array(pg_temp.ad('bolsa', 1600, (select today from d))));
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
insert into public.movements (id, type, date, description, amount, currency, account_id) values
  ('a3000000-0000-4000-8000-000000000001', 'expense', (now() at time zone 'America/Argentina/Buenos_Aires')::date, 'Café', 3500, 'ARS', 'a1000000-0000-4000-8000-000000000001');
reset role;
select is(
  (select fx_mep from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  1542.5::numeric,
  'un gasto de hoy guarda el MEP de DolarApi, no el de ArgentinaDatos'
);
select is(
  (select count(*)::int from public.fx_rates where fetched_at > now()),
  0,
  'no queda ninguna cotización con hora futura'
);

select * from finish();
rollback;
