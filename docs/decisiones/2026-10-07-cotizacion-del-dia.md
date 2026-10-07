# Cotización del día: ArgentinaDatos solo guarda días terminados (7/10/2026)

**Qué pasaba:** `fx-history` corre a las 3:00 y ArgentinaDatos ya trae una fila con la fecha de hoy, con el valor del cierre de ayer. Se guardaba a las 23:59:59 de hoy (decisión de T6, para que el cierre le gane a las del día), así que le ganaba todo el día a las de DolarApi. Como el conflicto era `do nothing`, al día siguiente el cierre real no la corregía: cada día quedaba guardado con el cierre de la víspera.

Se vio en la primera prueba en el teléfono contra `mangos`: los gastos del 7/10 guardaron MEP 1.544,40 (cierre del 6/10) cuando DolarApi informaba 1.542,50. La Billetera también usaba ese valor como dólar de referencia. Rompía "cada movimiento guarda la cotización del día".

**Decisión** (migración `20261007150000_fx_history_closed_days.sql`):
- `ingest_fx_rates` saltea las filas de ArgentinaDatos con fecha de hoy o posterior, en hora de Argentina.
- Para ArgentinaDatos, una fila que ya estaba se corrige (`do update`) si cambió el valor; así la corrida del día siguiente deja el cierre real. DolarApi sigue igual: la misma hora no pisa lo guardado.
- `distinct on (kind, at)`, porque con `do update` dos filas iguales en un lote harían fallar toda la carga.
- La función devuelve cuántas filas guardó o corrigió.
- Los movimientos ya guardados no cambian: quedan con la cotización que se conocía al cargarlos.

**En `mangos`:** migración aplicada por el MCP, con la versión corregida a la del archivo. Se borraron las 6 filas de ArgentinaDatos con fecha 7/10. Ya no quedan cotizaciones con hora futura.

**Tests:** `supabase/tests/17_fx_history_closed_days.test.sql` (10). Suite completa: 454, todos pasan. Contraprueba: sin la migración fallan 3.
