# /plan-ceo-review · 1 de octubre de 2026

Revisión en modo **reducción de alcance**, para que la beta entre en 3 meses con una sola persona. La revisión completa está en `~/.gstack/projects/finanzas/fbalsamo-nogit-ceo-review-20261001.md`.

**Restricciones que no se tocaron:**
- Cargar un gasto lleva menos de 10 segundos.
- Los grupos entran en la v1.
- Mangos no mueve plata ni recomienda inversiones.

## Qué se decidió

| # | Decisión |
|---|---|
| D1 | **Decisión abierta 1, invitados:** web de **solo lectura** con reclamo del lugar al instalar. Los gastos los cargan los integrantes con la app |
| — | **Decisión abierta 3, presupuestos:** salen de la v1 (ya se había aprobado en office hours) |
| D2.0 | **Recortes C1 a C9** pasan a `TODOS.md`: datos de ejemplo, login con Google y Apple (queda mail con código), débito y prepagas como tipo propio, carrusel, adjuntar comprobante, categorías editables, "dato del ciclo", código de reclamo de 6 caracteres y la pantalla propia "Cerró tu tarjeta" (el aviso abre el detalle de la tarjeta) |
| D3 | **Control en la semana 4** con un plan B en este orden: carga por texto de una sola línea, deshacer el reclamo a mano y solo pagos totales |

**Ahorro estimado:** unas 6,75 semanas, justo el mínimo que hacía falta.

## Qué se descartó

- **Web de invitados completa** (ver, cargar y reclamar), porque son unas 2,5 semanas.
- **Sin web, todos instalan la app**, porque se pierde contra Sesterce.
- **Control en la semana 4 sin plan B, o sin control.**

## Qué quedó abierto

- **R-BACKEND:** se resolvió después, en `/plan-eng-review` (Supabase).
- **R-LEGAL:** consultar con un abogado e inscribir la base (Ley 25.326) antes de la beta.
- **Sin margen:** las revisiones de diseño y técnica sumaron trabajo (unos 7 días y unos 4 días) a un plan que no tenía margen. Hay que llevarlo al control de la semana 4.
