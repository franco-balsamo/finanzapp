# /plan-eng-review · 1 de octubre de 2026

Revisión técnica de 02, 03 y el plan recortado: 18 preguntas, todas respondidas. La arquitectura, los diagramas, la matriz de tests y los riesgos están en [../05-plan-tecnico.md](../05-plan-tecnico.md), y el informe completo, con el registro de decisiones, en [2026-10-01-eng-review-informe.md](2026-10-01-eng-review-informe.md). Lo resuelto ya está aplicado en `02-reglas-de-negocio.md` y `03-modelo-de-datos.md`, que desde ahora son la fuente de verdad.

## Qué se decidió

| # | Decisión |
|---|---|
| D1 | **Repo:** `apps/mobile` (Expo Router, con la web de invitados en `/g/[token]`) y `packages/core` |
| D2 | **02 marca las secciones** que salieron de la v1 |
| D3 | **Backend: Supabase.** Autenticación por mail con código, Postgres, políticas por fila, pg_cron y Edge Functions en TypeScript. Plan pago para la beta |
| D4 | **Cálculos compartidos en `packages/core`** (TypeScript puro), usados por la app y las Edge Functions, con tests en Vitest |
| D5 | **Web de invitados:** `get_guest_group(token)` security definer, sin `payment_alias` ni `user_id`, y el token guardado con hash |
| D6 | **Sin duplicados:** el teléfono genera el UUID de cada gasto y el servidor guarda con upsert |
| D7 | **Cotización por movimiento:** la completa un trigger con la venta de la fecha del gasto, en hora de Argentina. Si falta, queda `fx_pending` |
| D8 | **Dinero en centavos enteros** en el código, con `convert()` half-up |
| D9 | **Restos:** van a la primera cuota y al que pagó. Montos exactos con diferencia de hasta $0,50: la diferencia va al que pagó |
| D10 | **`statementFor` recibe los cierres corregidos.** La corrección se valida a ±10 días y entre los cierres vecinos |
| D11 | **Días 29 a 31:** se comparan los días configurados y después se ajusta al último día del mes |
| D12 | **`debited_amount`** cuando el gasto está en otra moneda que la cuenta, propuesto con el dólar tarjeta |
| D13 | **La purga de tarjetas** convierte los pagos en movimientos de la cuenta antes de borrar |
| D14 | **Umbral de cero por moneda:** menos de $1 en ARS y menos de US$ 0,01 en USD |
| D15 | **4 tests E2E con Maestro** |
| D16 | **`is_group_member`** con índices para las políticas de grupo |
| D17 | **Borrar la cuenta y exportar los datos** entra en la v1 |
| D18 | **Ocultar montos en las notificaciones** pasa a `TODOS.md` |

## Qué se descartó

- FastAPI con Postgres.
- Una web de invitados aparte.
- Cálculos en SQL o solo en el servidor.
- Políticas por fila para el rol anónimo.
- Deduplicar por contenido.
- Que la app complete la cotización.
- Una librería de decimales.
- Redondear cada parte por su lado.
- Que el cierre real sea solo visual.
- Ajustar al último día del mes antes de comparar.
- Calcular al leer lo descontado en otra moneda.
- El borrado en cascada de los pagos.
- Un umbral único para todas las monedas.
- Un checklist manual en lugar de los tests de punta a punta.
- Subconsultas en cada política.

## Qué quedó abierto

- **T9:** verificar que las Edge Functions (Deno) puedan importar `packages/core`.
- **T12:** verificar el precio del plan pago de Supabase y cómo pausa los proyectos inactivos.
- **R-LEGAL** (de la revisión de alcance).
- **En 02:** qué pago se ajusta cuando un gasto tardío cae en un resumen con varios pagos, y cómo se ajusta un gasto tardío en dólares (R3-3 y R3-4). El rango de cuotas (1 a 24) sigue como "conviene unificar".
- **Plazo:** borrar la cuenta (~2 días) y Maestro (~2 días) suman trabajo. Supabase le devuelve al plan unas 2 a 3 semanas frente a FastAPI.
