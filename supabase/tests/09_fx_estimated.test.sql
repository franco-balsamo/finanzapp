-- Ajustes de T6 (4/10): pendientes de más de 2 días estimados por la tarea
-- diaria, y fx_rate_on para el dólar tarjeta de una fecha (02 §1, §2 y §3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Sin lo que haya quedado en la base local.
delete from public.fx_rates;

insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000001', 'ana@test.local');
insert into public.accounts (id, user_id, name, type, currency) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Caja Ana', 'bank', 'ARS');

-- Historial viejo: el blue arranca el 2/1/2019; MEP, oficial y blue tienen el 10/1/2020.
select is(
  public.ingest_fx_rates('argentinadatos', $json$[
    {"casa": "blue", "compra": 37, "venta": 37.5, "fecha": "2019-01-02"},
    {"casa": "bolsa", "compra": 77, "venta": 78, "fecha": "2020-01-10"},
    {"casa": "oficial", "compra": 60, "venta": 63, "fecha": "2020-01-10"},
    {"casa": "blue", "compra": 78, "venta": 78.5, "fecha": "2020-01-10"}
  ]$json$),
  4,
  'entra el historial viejo'
);
-- La casa "tarjeta" de DolarApi del viernes 2/10/2026.
select is(
  public.ingest_fx_rates('dolarapi', '[{"casa": "tarjeta", "compra": 1937, "venta": 2002, "fechaActualizacion": "2026-10-02T15:55:00.000Z"}]'),
  1,
  'DolarApi guarda la casa tarjeta'
);
select is(
  (select row(kind, sell, rate_date) from public.fx_rates where source = 'dolarapi'),
  row('tarjeta'::text, 2002::numeric, '2026-10-02'::date),
  'el dólar tarjeta queda con su venta y su fecha'
);

create temp table today as select (now() at time zone 'America/Argentina/Buenos_Aires')::date as d;
grant select on today to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

insert into public.movements (id, type, date, description, amount, currency, account_id, fx_estimated) values
  ('a3000000-0000-4000-8000-000000000001', 'expense', '2020-02-01', 'Después del 10/1', 1000, 'ARS', 'a1000000-0000-4000-8000-000000000001', true),
  ('a3000000-0000-4000-8000-000000000002', 'expense', '2015-06-01', 'Antes de todo', 1000, 'ARS', 'a1000000-0000-4000-8000-000000000001', false),
  ('a3000000-0000-4000-8000-000000000003', 'expense', (select d - 3 from today), 'Hace 3 días', 1000, 'ARS', 'a1000000-0000-4000-8000-000000000001', false),
  ('a3000000-0000-4000-8000-000000000004', 'expense', (select d - 2 from today), 'Hace 2 días', 1000, 'ARS', 'a1000000-0000-4000-8000-000000000001', false),
  ('a3000000-0000-4000-8000-000000000005', 'expense', (select d - 1 from today), 'Ayer', 1000, 'ARS', 'a1000000-0000-4000-8000-000000000001', false),
  ('a3000000-0000-4000-8000-000000000006', 'expense', '2020-01-12', 'Domingo con datos', 1000, 'ARS', 'a1000000-0000-4000-8000-000000000001', false);

select is(
  (select row(fx_mep, fx_pending, fx_estimated) from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  row(null::numeric, true, false),
  'al cargar, una fecha sin datos en la ventana queda pendiente y la app no puede marcarla estimada'
);
select is(
  (select row(fx_mep, fx_oficial, fx_blue, fx_pending, fx_estimated) from public.movements where id = 'a3000000-0000-4000-8000-000000000006'),
  row(78::numeric, 63::numeric, 78.5::numeric, false, false),
  'con datos en la ventana no se estima'
);

-- Editar un pendiente viejo desde la app no lo estima: eso lo hace solo la tarea diaria.
update public.movements set description = 'Después del 10/1, editado' where id = 'a3000000-0000-4000-8000-000000000001';
select is(
  (select row(fx_mep, fx_pending, fx_estimated) from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  row(null::numeric, true, false),
  'editar un pendiente viejo desde la app lo deja pendiente'
);

-- ═════════════════════════ Tarea diaria ═════════════════════════

reset role;
select is(private.resolve_stale_fx(), 3, 'la tarea toca los 3 pendientes con más de 2 días');
select is(
  (select row(fx_mep, fx_oficial, fx_blue, fx_pending, fx_estimated) from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  row(78::numeric, 63::numeric, 78.5::numeric, false, true),
  'usa la última cotización anterior a la fecha, sin límite de días, y queda estimado'
);
select is(
  (select row(fx_mep, fx_oficial, fx_blue, fx_pending, fx_estimated) from public.movements where id = 'a3000000-0000-4000-8000-000000000002'),
  row(78::numeric, 63::numeric, 37.5::numeric, false, true),
  'antes de todo el historial usa la primera disponible de cada tipo y queda estimado'
);
select is(
  (select row(fx_mep, fx_pending, fx_estimated) from public.movements where id = 'a3000000-0000-4000-8000-000000000003'),
  row(78::numeric, false, true),
  'una fecha de hace 3 días también se estima'
);
select is(
  (select row(fx_mep, fx_pending, fx_estimated) from public.movements where id = 'a3000000-0000-4000-8000-000000000004'),
  row(null::numeric, true, false),
  'una fecha de hace 2 días sigue pendiente'
);
select is(
  (select row(fx_mep, fx_pending, fx_estimated) from public.movements where id = 'a3000000-0000-4000-8000-000000000005'),
  row(null::numeric, true, false),
  'la de ayer sigue pendiente'
);
select is(
  (select row(fx_mep, fx_estimated) from public.movements where id = 'a3000000-0000-4000-8000-000000000006'),
  row(78::numeric, false),
  'la tarea no toca los que no estaban pendientes'
);
select is(private.resolve_stale_fx(), 0, 'correrla otra vez no toca nada');
select is(current_setting('mangos.fx_resolve_stale', true), 'off', 'la tarea apaga su marca al terminar');

-- Ingestar más historial no toca los estimados (ya no están pendientes).
select is(
  public.ingest_fx_rates('argentinadatos', '[{"casa": "bolsa", "compra": 80, "venta": 81, "fecha": "2020-02-01"}]'),
  1,
  'entra el MEP del 1/2/2020'
);
select is(
  (select row(fx_mep, fx_estimated) from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  row(78::numeric, true),
  'un estimado no cambia solo cuando llega historial nuevo'
);

-- ═════════════════════════ Editar un estimado ═════════════════════════

set local role authenticated;
update public.movements set description = 'Antes de todo, editado', fx_estimated = false, fx_mep = 1
where id = 'a3000000-0000-4000-8000-000000000002';
select is(
  (select row(fx_mep, fx_estimated) from public.movements where id = 'a3000000-0000-4000-8000-000000000002'),
  row(78::numeric, true),
  'la app no puede sacar la marca ni cambiar la cotización de un estimado'
);
update public.movements set date = '2020-02-01' where id = 'a3000000-0000-4000-8000-000000000001';
select is(
  (select row(fx_mep, fx_estimated) from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  row(78::numeric, true),
  'guardar la misma fecha no recalcula'
);
update public.movements set date = '2020-02-02' where id = 'a3000000-0000-4000-8000-000000000001';
select is(
  (select row(fx_mep, fx_oficial, fx_pending, fx_estimated) from public.movements where id = 'a3000000-0000-4000-8000-000000000001'),
  row(81::numeric, null::numeric, true, false),
  'cambiar la fecha recalcula con la ventana: sin oficial queda pendiente, ya no estimado'
);

-- ═════════════════════════ fx_rate_on ═════════════════════════

select is(public.fx_rate_on('tarjeta', '2026-10-03'), 2002::numeric, 'el sábado devuelve el dólar tarjeta del viernes');
select is(public.fx_rate_on('tarjeta', '2026-10-07'), null::numeric, 'a más de 4 días de la última, null');
select is(public.fx_rate_on('mep', '2020-01-12'), 78::numeric, 'sirve para cualquier tipo');
select throws_ok($$select public.fx_rate_on('mayorista', '2026-10-02')$$, '22023', null, 'un tipo desconocido se rechaza');
reset role;

-- ═════════════════════════ Permisos y cron ═════════════════════════

select ok(
  has_function_privilege('authenticated', 'public.fx_rate_on(text, date)', 'execute')
  and not has_function_privilege('anon', 'public.fx_rate_on(text, date)', 'execute'),
  'fx_rate_on la usa la app, no el rol anónimo'
);
select ok(
  not has_function_privilege('authenticated', 'private.resolve_stale_fx()', 'execute')
  and not has_function_privilege('authenticated', 'private.fx_sell_fallback(text, date)', 'execute'),
  'la app no ejecuta la tarea diaria ni la búsqueda sin límite'
);
select is(
  (select jobname || ' ' || schedule || ' ' || command from cron.job where jobname = 'fx-resolve-stale'),
  'fx-resolve-stale 0 7 * * * select private.resolve_stale_fx()',
  'la tarea diaria corre a las 4:00 de Argentina, una hora después del historial'
);

select * from finish();
rollback;
