# /spec de avisos de cierre y de vencimiento de tarjeta · 4 de octubre de 2026

- **Core:**
  - `packages/core/src/notices/`: `format.ts`, `notices.ts`, `fromDb.ts` y `notices.test.ts`, con 25 tests.
- **Migración:** `supabase/migrations/20261004140000_card_notices.sql`.
- **Edge Functions:**
  - nuevas: `card-closing-notices`, `card-due-notices` y `_shared/card-notices.ts`;
  - `_shared/cron.ts` junta el secreto y la RPC, que antes estaban en `_shared/fx.ts`.
- **Tests:** `supabase/tests/11_card_notices.test.sql`, con 30 asserts.
- **Terminado:**
  - 386 asserts pgTAP en verde;
  - Vitest con 167 tests;
  - los dos typecheck y `db lint` sin errores.
- **Prueba manual** (`functions serve` con datos en la base local):
  - **`card-closing-notices`:** "Cerró tu Visa: te vienen $187.000 + US$ 50. ¿Te falta cargar algo?" y, la segunda vez, 0;
  - **`card-due-notices`:** "Tu Master vence el martes 6/10: quedan $80.000 por pagar." y, la segunda vez, 0;
  - **`fx-rates`:** sigue andando con el `_shared` nuevo.
- **Revisión externa:** no corrió el gate con `codex` (no está instalado). Sin `gh`, no se abrió issue.

## Pedido

Avisos de 02 §9:
- **Cierre:** a las 20:00, con `packages/core`; una vez por tarjeta y ciclo; agrupado si cierran varias el mismo día; con el cierre real si se corrigió; con los textos de 02 §9.
- **Vencimiento:** a las 10:00, de 1 a 5 días antes.
- **Los dos:** respetan el no molestar.

## Decisiones aprobadas (las dos recomendadas; el borrador lo aprobó Fran con "lo que mejor sea")

1. **Guardar ahora y mandar el push después:**
   - los avisos quedan en `notifications` con `kind`, `data` y `deliver_after`;
   - el envío por Expo Push va cuando la app registre tokens de dispositivo, porque sin app no se puede probar.
2. **Avisos atrasados:**
   - **cierre:** sale hasta un día después, con "Ayer cerró…";
   - **vencimiento:** sale mientras no haya vencido; el día del vencimiento, ya no.

## Decisiones de la implementación

- **Qué resumen cierra en una fecha:** `statementFor(card, fecha)`, y se compara su `closeDate` con la fecha. Respeta los cierres corregidos, incluso los que pasan al mes anterior (está en los tests).
- **Total del aviso de cierre:** sale de `cardState(...).statements`. Las cuotas cuentan solo lo de ese resumen. Si es $0, se avisa solo si el ciclo anterior tuvo consumos.
- **Textos nuevos:** 02 no tenía los del vencimiento ni los agrupados. Quedaron en 02 §9:
  - vencimiento: "Tu Visa vence el martes 6/10: quedan $80.000 por pagar.";
  - vencimiento agrupado: "Vencen tu Visa (martes 6/10, $80.000) y tu Master (miércoles 7/10, US$ 50).";
  - cierre agrupado: "Cerraron tu Visa ($187.000) y tu Master (sin consumos cargados). ¿Te falta cargar algo?".
  - Informan hechos y no recomiendan nada.
- **Hoy y ayer en el mismo día:** si una tarjeta cerró hoy y otra ayer sin avisar, van en dos avisos, porque el texto de cada uno es distinto.
- **Formato de montos:** `formatMoney` usa punto para los miles y coma para los decimales, y muestra los decimales solo si no son ,00: `$187.000`, `$187.000,50`, `US$ 50`. `formatTotal` une las monedas con " + ".
- **Sin fila en `alerts`:** el aviso está prendido y el vencimiento es a 2 días. La app no tiene que crear filas por tarjeta; una fila con `enabled = false` lo apaga.
- **Tarjetas archivadas:** no reciben avisos (`card_notice_input` no las trae).
- **No repetir:**
  - `private.card_notices` tiene único por (tarjeta, tipo, resumen);
  - `record_card_notices` saltea el aviso entero si alguna referencia ya está;
  - si dos corridas guardan a la vez, la segunda choca con el único y se descarta sin registrarlo como falla.
- **Seguridad:**
  - `record_card_notices` rechaza referencias a tarjetas de otro usuario;
  - las dos funciones son solo para `service_role`;
  - las fallas van a `private.job_failures`.
- **No molestar:** `private.deliver_after` maneja horarios que pasan la medianoche (de 22 a 8). Si `quiet_from = quiet_to`, no hay horario.
- **El mapeo de la respuesta de la base va en core** (`noticeInputFromDb`, `todayInArgentina`), así queda probado con Vitest y las Edge Functions quedan en unas pocas líneas.

## Abierto

- **Envío del push:** la tabla de tokens y una Edge Function que mande las notificaciones con `deliver_after` vencido, `sent_at` nulo y `notify_push`. Va con la app.
- **`card_notice_input` trae todas las tarjetas activas** de todos los usuarios en cada corrida. Para la beta alcanza; si crece, filtrar por las que cierran o vencen cerca.
- **T9 en deploy:** estas son las primeras funciones reales que importan core. En el primer deploy hay que confirmar que arrancan.
