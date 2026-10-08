# Historial de ArgentinaDatos a las 00:00 de su fecha (8/10/2026)

**Qué pasaba:** el arreglo del 7/10 (`2026-10-07-cotizacion-del-dia.md`) evitó que `fx-history` guardara filas con la fecha de hoy, pero no alcanzó. ArgentinaDatos no publica el cierre de su fecha: su fila del día se actualiza solo durante la mañana y queda con el valor de la víspera. Guardada a las 23:59:59, le seguía ganando al cierre real de DolarApi de ese día.

En `mangos`, el 8/10 la fila de ArgentinaDatos del 7/10 tenía MEP 1.539,60 / 1.544,40 (cierre del 6/10), y el cierre de DolarApi del 7/10 era 1.534,90 / 1.541,80. El 6/10 pasaba lo mismo: 1.537,90 (valor de la mañana) contra un cierre de 1.544,40.

**Decisión** (migración `20261008120000_fx_history_start_of_day.sql`):
- `private.fx_row_time` guarda las filas de ArgentinaDatos a las 00:00 de Argentina de su fecha: es lo que se conocía al abrir el día. Cualquier fila de DolarApi de ese día le gana.
- Un día sin DolarApi (fin de semana, días viejos) sigue usando el historial.
- Las filas ya guardadas pasan a las 00:00 del mismo día; `rate_date` no cambia.
- Los movimientos ya guardados conservan su cotización.

**Tests:** `supabase/tests/18_fx_history_start_of_day.test.sql` (4) y el ajuste de `08_fx_rates.test.sql`. Suite completa: 458, todos pasan.
