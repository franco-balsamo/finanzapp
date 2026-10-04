-- Cotizaciones (T6): ingesta, trigger de movimientos (T-17), permisos y cron.
-- Calendario: viernes 2/10/2026, sábado 3/10, lunes 5/10.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000001', 'ana@test.local');
insert into public.accounts (id, user_id, name, type, currency) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Caja Ana', 'bank', 'ARS');

-- ═════════════════════════ ingest_fx_rates ═════════════════════════

select throws_ok($$select public.ingest_fx_rates('otra', '[]')$$, '22023', null, 'una fuente desconocida se rechaza');
select throws_ok($$select public.ingest_fx_rates('dolarapi', '{}')$$, '22023', null, 'el payload tiene que ser una lista');

-- Respuesta real de DolarApi /v1/dolares del viernes 2/10.
create temp table dolarapi_friday as select $json$[
  {"moneda": "USD", "casa": "oficial", "nombre": "Oficial", "compra": 1490, "venta": 1540, "fechaActualizacion": "2026-10-02T15:55:00.000Z"},
  {"moneda": "USD", "casa": "blue", "nombre": "Blue", "compra": 1540, "venta": 1560, "fechaActualizacion": "2026-10-02T18:59:00.000Z"},
  {"moneda": "USD", "casa": "bolsa", "nombre": "Bolsa", "compra": 1549.1, "venta": 1551.5, "fechaActualizacion": "2026-10-02T18:59:00.000Z"},
  {"moneda": "USD", "casa": "contadoconliqui", "nombre": "Contado con liquidación", "compra": 1621.5, "venta": 1622.3, "fechaActualizacion": "2026-10-02T18:59:00.000Z"},
  {"moneda": "USD", "casa": "mayorista", "nombre": "Mayorista", "compra": 1513, "venta": 1522, "fechaActualizacion": "2026-10-02T14:47:00.000Z"},
  {"moneda": "USD", "casa": "cripto", "nombre": "Cripto", "compra": 1617.54, "venta": 1619.69, "fechaActualizacion": "2026-10-02T18:59:00.000Z"},
  {"moneda": "USD", "casa": "tarjeta", "nombre": "Tarjeta", "compra": 1937, "venta": 2002, "fechaActualizacion": "2026-10-02T15:55:00.000Z"}
]$json$::jsonb as payload;

select is(public.ingest_fx_rates('dolarapi', (select payload from dolarapi_friday)), 6, 'DolarApi: 7 casas guardan 6 filas (mayorista no)');
select is(
  (select array_agg(kind order by kind) from public.fx_rates where source = 'dolarapi'),
  array['blue', 'ccl', 'cripto', 'mep', 'oficial', 'tarjeta'],
  'bolsa pasa a mep y contadoconliqui a ccl'
);
select is(
  (select fetched_at from public.fx_rates where source = 'dolarapi' and kind = 'blue'),
  '2026-10-02 18:59:00+00'::timestamptz,
  'fetched_at es la hora que informa DolarApi, no la del cron'
);
select is(
  (select buy from public.fx_rates where source = 'dolarapi' and kind = 'mep'),
  1549.1::numeric,
  'se guarda también la compra'
);
select is(public.ingest_fx_rates('dolarapi', (select payload from dolarapi_friday)), 0, 'el mismo payload dos veces no duplica');

-- Historial de ArgentinaDatos con filas que no se pueden leer.
select is(
  public.ingest_fx_rates('argentinadatos', $json$[
    {"casa": "bolsa", "compra": 1539, "venta": 1545.6, "fecha": "2026-09-25"},
    {"casa": "oficial", "compra": 1480, "venta": 1530, "fecha": "2026-09-25"},
    {"casa": "blue", "compra": 1530, "venta": 1550, "fecha": "2026-09-25"},
    {"casa": "solidario", "compra": 1900, "venta": 2000, "fecha": "2026-09-25"},
    {"casa": "blue", "compra": 1530, "venta": 0, "fecha": "2026-09-24"},
    {"casa": "blue", "compra": 1530, "venta": 0.00001, "fecha": "2026-09-23"},
    {"casa": "oficial", "compra": 1480, "venta": "1530", "fecha": "2026-09-24"},
    {"casa": "bolsa", "compra": 1539, "venta": 1545.6, "fecha": "2026-02-30"},
    {"casa": "bolsa", "compra": 1539, "venta": 1545.6},
    "basura"
  ]$json$),
  3,
  'ArgentinaDatos: solidario se ignora y las filas inválidas se saltean sin frenar el lote'
);
select is(
  (select row(rate_date, fetched_at) from public.fx_rates where source = 'argentinadatos' and kind = 'mep'),
  row('2026-09-25'::date, '2026-09-25 23:59:59-03'::timestamptz),
  'el historial queda en su fecha, a las 23:59:59 de Argentina'
);

-- 01:00 UTC del sábado son las 22:00 del viernes en Argentina.
insert into public.fx_rates (source, kind, sell, fetched_at) values ('test', 'mep', 1560, '2026-10-03 01:00:00+00');
select is(
  (select rate_date from public.fx_rates where source = 'test'),
  '2026-10-02'::date,
  'rate_date usa la hora de Argentina'
);

-- ═════════════════════════ Trigger de movimientos ═════════════════════════

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- La app intenta mandar sus propias cotizaciones.
insert into public.movements (id, type, date, description, amount, currency, account_id, fx_mep, fx_oficial, fx_blue, fx_pending) values
  ('a3000000-0000-4000-8000-000000000001', 'expense', '2026-10-03', 'Sábado', 1000, 'ARS', 'a1000000-0000-4000-8000-000000000001', 1, 1, 1, false),
  ('a3000000-0000-4000-8000-000000000002', 'expense', '2026-09-25', 'Viernes viejo', 1000, 'ARS', 'a1000000-0000-4000-8000-000000000001', null, null, null, true),
  ('a3000000-0000-4000-8000-000000000003', 'expense', '2026-09-29', 'Cuatro días', 1000, 'ARS', 'a1000000-0000-4000-8000-000000000001', null, null, null, false),
  ('a3000000-0000-4000-8000-000000000004', 'expense', '2026-09-30', 'Cinco días', 1000, 'ARS', 'a1000000-0000-4000-8000-000000000001', 9, 9, 9, false);

select is(
  (select row(fx_mep, fx_oficial, fx_blue, fx_pending) from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  row(1560::numeric, 1540::numeric, 1560::numeric, false),
  'T-17: un gasto del sábado guarda la última venta del viernes e ignora lo que mandó la app'
);
select is(
  (select row(fx_mep, fx_oficial, fx_blue, fx_pending) from public.movements where id = 'a3000000-0000-4000-8000-000000000002'),
  row(1545.6::numeric, 1530::numeric, 1550::numeric, false),
  'un día con cotización usa la suya'
);
select is(
  (select row(fx_mep, fx_oficial, fx_blue, fx_pending) from public.movements where id = 'a3000000-0000-4000-8000-000000000003'),
  row(1545.6::numeric, 1530::numeric, 1550::numeric, false),
  'con datos de hace 4 días, los usa'
);
select is(
  (select row(fx_mep, fx_oficial, fx_blue, fx_pending) from public.movements where id = 'a3000000-0000-4000-8000-000000000004'),
  row(null::numeric, null::numeric, null::numeric, true),
  'T-17: con datos de hace 5 días queda pendiente, sin cotizaciones'
);

-- Editar: la descripción no toca las cotizaciones, aunque haya entrado una más nueva del viernes.
reset role;
select is(
  public.ingest_fx_rates('dolarapi', '[{"casa": "blue", "compra": 1580, "venta": 1600, "fechaActualizacion": "2026-10-02T23:00:00.000Z"}]'),
  1,
  'entra un blue más nuevo del viernes'
);
set local role authenticated;
update public.movements set description = 'Sábado editado' where id = 'a3000000-0000-4000-8000-000000000001';
select is(
  (select fx_blue from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  1560::numeric,
  'editar la descripción conserva la cotización guardada'
);
update public.movements set fx_blue = 1, fx_mep = null, fx_pending = true where id = 'a3000000-0000-4000-8000-000000000001';
select is(
  (select row(fx_mep, fx_blue, fx_pending) from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  row(1560::numeric, 1560::numeric, false),
  'la app no puede cambiar las cotizaciones ni marcar pendiente al editar'
);
update public.movements set date = '2026-10-05' where id = 'a3000000-0000-4000-8000-000000000001';
select is(
  (select row(fx_mep, fx_oficial, fx_blue, fx_pending) from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  row(1560::numeric, 1540::numeric, 1600::numeric, false),
  'cambiar la fecha recalcula (el lunes sin datos usa los del viernes)'
);
update public.movements set date = '2026-09-25' where id = 'a3000000-0000-4000-8000-000000000001';
select is(
  (select fx_mep from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  1545.6::numeric,
  'pasar la fecha a otro día toma la cotización de ese día'
);
update public.movements set date = '2026-08-01' where id = 'a3000000-0000-4000-8000-000000000001';
select is(
  (select row(fx_mep, fx_pending) from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  row(null::numeric, true),
  'pasar la fecha a un día sin historial lo deja pendiente'
);

-- ═════════════════════════ Pendientes ═════════════════════════

-- Solo MEP para el 10/8.
insert into public.movements (id, type, date, description, amount, currency, account_id) values
  ('a3000000-0000-4000-8000-000000000005', 'expense', '2026-08-10', 'Solo MEP', 1000, 'ARS', 'a1000000-0000-4000-8000-000000000001');
reset role;
select is(
  public.ingest_fx_rates('argentinadatos', $json$[
    {"casa": "bolsa", "compra": 1300, "venta": 1310, "fecha": "2026-08-10"},
    {"casa": "bolsa", "compra": 1540, "venta": 1550.25, "fecha": "2026-09-30"},
    {"casa": "oficial", "compra": 1490, "venta": 1535, "fecha": "2026-09-30"},
    {"casa": "blue", "compra": 1540, "venta": 1555, "fecha": "2026-09-30"}
  ]$json$),
  4,
  'entra historial del 10/8 (solo MEP) y del 30/9'
);
select is(
  (select row(fx_mep, fx_oficial, fx_blue, fx_pending) from public.movements where id = 'a3000000-0000-4000-8000-000000000004'),
  row(1550.25::numeric, 1535::numeric, 1555::numeric, false),
  'T-17: el pendiente se completa cuando llega el historial de su fecha'
);
select is(
  (select row(fx_mep, fx_oficial, fx_blue, fx_pending) from public.movements where id = 'a3000000-0000-4000-8000-000000000005'),
  row(1310::numeric, null::numeric, null::numeric, true),
  'con solo MEP guarda esa y sigue pendiente'
);
select is(
  (select row(fx_mep, fx_pending) from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  row(null::numeric, true),
  'un pendiente sin historial en su ventana sigue pendiente'
);
select is(
  (select fx_blue from public.movements where id = 'a3000000-0000-4000-8000-000000000002'),
  1550::numeric,
  'completar pendientes no toca los que ya estaban completos'
);

-- ═════════════════════════ Permisos ═════════════════════════

select ok(
  not has_function_privilege('anon', 'public.ingest_fx_rates(text, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.ingest_fx_rates(text, jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.ingest_fx_rates(text, jsonb)', 'execute'),
  'solo service_role ejecuta ingest_fx_rates'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.ingest_fx_rates(text, jsonb)'::regprocedure),
  'ingest_fx_rates: security definer y search_path fijo'
);
select ok(
  not has_function_privilege('authenticated', 'private.fx_sell_on(text, date)', 'execute')
  and not has_function_privilege('authenticated', 'private.fill_movement_fx()', 'execute')
  and not has_function_privilege('authenticated', 'private.fx_row_time(text, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'private.call_edge(text)', 'execute'),
  'la app no ejecuta las funciones internas de cotizaciones'
);
select ok(
  not has_table_privilege('authenticated', 'public.fx_rates', 'insert')
  and not has_table_privilege('authenticated', 'public.fx_rates', 'update')
  and not has_table_privilege('authenticated', 'public.fx_rates', 'delete')
  and has_table_privilege('authenticated', 'public.fx_rates', 'select'),
  'la app solo lee fx_rates'
);
set local role authenticated;
select throws_ok($$select public.ingest_fx_rates('dolarapi', '[]')$$, '42501', null, 'un usuario no puede ingerir cotizaciones');
select throws_ok(
  $$insert into public.fx_rates (source, kind, sell) values ('app', 'mep', 1)$$,
  '42501', null, 'un usuario no puede escribir en fx_rates'
);
set local role service_role;
select is(public.ingest_fx_rates('dolarapi', '[]'), 0, 'service_role ingiere');
reset role;

-- ═════════════════════════ Cron ═════════════════════════

select is(
  (select array_agg(jobname || ' ' || schedule order by jobname) from cron.job where jobname like 'fx-%'),
  array['fx-history 0 6 * * *', 'fx-rates */10 * * * *'],
  'los dos cron de cotizaciones están programados'
);
select is(
  (select array_agg(command order by jobname) from cron.job where jobname like 'fx-%'),
  array['select private.call_edge(''fx-history'')', 'select private.call_edge(''fx-rates'')'],
  'cada cron llama a su Edge Function'
);

create temp table queue_before as select count(*) as n from net.http_request_queue;
select is(private.call_edge('fx-rates'), null, 'sin secretos en Vault, call_edge no hace nada');
select is((select count(*) from net.http_request_queue), (select n from queue_before), 'y no encola ningún pedido');

select vault.create_secret('http://kong:8000/functions/v1/', 'functions_url');
select vault.create_secret('s3cret', 'fx_cron_secret');
select isnt(private.call_edge('fx-rates'), null, 'con secretos, call_edge encola el pedido');
select is(
  (select row(method::text, url, headers ->> 'Authorization') from net.http_request_queue order by id desc limit 1),
  row('POST'::text, 'http://kong:8000/functions/v1/fx-rates'::text, 'Bearer s3cret'::text),
  'el pedido va por POST a la Edge Function con el secreto'
);

select * from finish();
rollback;
