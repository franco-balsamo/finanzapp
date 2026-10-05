# Decisiones

| Archivo | Qué es |
|---|---|
| [2026-10-01-reglas-de-negocio.md](2026-10-01-reglas-de-negocio.md) | Respuestas a los pendientes de las reglas de negocio |
| [2026-10-01-office-hours.md](2026-10-01-office-hours.md) | /office-hours: enfoque de la v1 |
| [2026-10-01-ceo-review.md](2026-10-01-ceo-review.md) | /plan-ceo-review: recorte para 3 meses |
| [2026-10-01-design-review.md](2026-10-01-design-review.md) | /plan-design-review y /design-consultation (`DESIGN.md` en la raíz) |
| [2026-10-01-eng-review.md](2026-10-01-eng-review.md) | /plan-eng-review: stack, cambios de tablas y casos borde |
| [2026-10-01-eng-review-informe.md](2026-10-01-eng-review-informe.md) | Informe completo de la revisión técnica |
| [2026-10-02-revision-claude.md](2026-10-02-revision-claude.md) | Revisión de las decisiones del 1/10. Fran aprobó todas las propuestas de la §2 y ya están aplicadas en 02, `producto-y-lanzamiento.md` y 01 |
| [2026-10-02-spec-core.md](2026-10-02-spec-core.md) | /spec de `packages/core`: monorepo, `Money`, tarjetas, grupos, categorías, cuentas y patrimonio (T1 a T4) |
| [2026-10-02-spec-t5-supabase.md](2026-10-02-spec-t5-supabase.md) | /spec de T5: migraciones, políticas por fila, FK compuestas, `is_group_member`, `get_guest_group`, `create_group` y tests pgTAP |
| [2026-10-02-spec-funciones-de-grupo.md](2026-10-02-spec-funciones-de-grupo.md) | /spec de funciones de grupo: reclamar y deshacer, salir, anular pagos, link de invitación y saldos en SQL |
| [2026-10-02-spec-cierre-de-grupos.md](2026-10-02-spec-cierre-de-grupos.md) | /spec de cierre de grupos: `save_group_expense` validado en la base, quitar a un integrante, eliminar el grupo y ejemplos de saldos compartidos entre core y SQL |
| [2026-10-02-spec-t6-cotizaciones.md](2026-10-02-spec-t6-cotizaciones.md) | /spec de T6: trigger de cotización por fecha del gasto, cron de DolarApi y ArgentinaDatos, Edge Functions y pendientes |
| [2026-10-04-spec-purga-y-cuenta.md](2026-10-04-spec-purga-y-cuenta.md) | /spec de T7 y T10 (base): purga de tarjetas archivadas, `delete_account` con login reciente (`amr`), `export_account` y `private.job_failures` |
| [2026-10-04-t9-core-en-edge.md](2026-10-04-t9-core-en-edge.md) | T9: las Edge Functions importan `packages/core` (imports con `.ts`); falta confirmarlo en el primer deploy |
| [2026-10-04-spec-avisos-de-tarjeta.md](2026-10-04-spec-avisos-de-tarjeta.md) | /spec de avisos de cierre y de vencimiento: textos y agrupado en core, `card_notice_input`, `record_card_notices`, no molestar y cron; el push queda para cuando haya app |
| [2026-10-04-primer-deploy.md](2026-10-04-primer-deploy.md) | Primer deploy al proyecto `mangos`: migraciones verificadas por hash, Edge Functions, historial cargado, T9 confirmado y el secreto de los cron solo en Vault |

La fuente de verdad es `02-reglas-de-negocio.md` junto con `03-modelo-de-datos.md`.

## Correcciones de la revisión de Claude (2/10)

Aplicadas en 02 y 01 después de revisar cómo quedaron:
- **Días de cierre y vencimiento:** de 1 a 31; en meses cortos, el último día del mes (02 §3).
- **Gasto por categoría:** con tarjeta de crédito, cada cuota cuenta en el mes de cierre de su resumen; con cuenta o efectivo, en el mes de la fecha del gasto. Donde decía "presupuesto" (fuera de la v1) ahora dice "gasto por categoría" (02 §6 y §7).
- **Carga por texto desde el detalle de una tarjeta de crédito:** las líneas usan esa tarjeta, salvo que el texto nombre otro medio de pago. Reemplaza la excepción del botón de débito (02 §5).
- **"Sin medio de pago":** es una excepción del sistema a la validación, solo para los gastos que entran al reclamar un lugar (02 §5). Tu parte de esos gastos cuenta en el gasto por categoría aunque no afecte tarjetas ni cuentas (02 §7).
- **4 dígitos en la carga por texto:** son tarjeta solo si queda otro número para el monto; si no, son el monto. "4532 súper visa" con una Visa ··4532 da $4.532 con la Visa (02 §5).
- **Montos exactos:** se saca la mención al reescalado del prototipo (02 §7).
- **Borrar la cuenta siendo dueño:** el rol pasa al azar a otro integrante con cuenta, igual que al abandonar, aunque tenga saldo (02 §10).
- **Aviso de vencimiento:** 2 días antes, a las 10:00 (hora de Argentina), configurable por tarjeta de 1 a 5 días (02 §9).
- **01:** estado actualizado y la pestaña Tarjetas pasa a una lista con `CardRow` que abre el detalle.

Segunda tanda, aprobada por Fran el mismo día:
- **Descripción en la carga por texto:** es lo que queda de la línea después de sacar la fecha, las cuotas, el monto, la moneda y lo que eligió el medio de pago. "Sin descripción" solo pasa si no queda nada ("12000 visa"). Ya no se propone la palabra de categoría como descripción (02 §5).
- **Deshacer un reclamo equivocado:** se borran los gastos que entraron con el reclamo (`origin = claim`), aunque ya tengan medio de pago. Los que la persona cargó ella misma después pierden el vínculo, como antes (02 §7, 03 `undo_claim`).
- **Gasto tarde en un resumen pagado:** con "No", el resumen queda en "Pago parcial" o en "Vencido" si ya pasó el vencimiento. Con cuotas en varios resúmenes pagados, va un pago nuevo por resumen, con la cuenta y la fecha del último pago de cada uno (02 §3).
- **Orden de los medios de pago:** favorita, las demás tarjetas de crédito y después las cuentas; sin débito (02 §5).
- **Palabras que no enseñan:** en lugar de "visa", "master", "mp", los bancos y redes de los medios de pago del usuario (02 §5).
- **01:** suma el ajuste manual de saldo y, en Ajustes, las tarjetas archivadas, borrar mi cuenta y exportar mis datos.
- **03 alineado con 02:** aviso de vencimiento con `days_before:2` (1 a 5, a las 10:00) y `delete_account()` pasa el rol de dueño.

## Decisiones del /review de core (2/10)

Fran aprobó las tres que quedaron abiertas en el `/review` de `packages/core`. Están en 02 con ejemplos y en core con tests:
- **Patrimonio (02 §8):** cada componente se convierte una sola vez a la moneda en que se muestra, nunca de ida y vuelta.
  - En pesos: la deuda en dólares de las tarjetas, × dólar tarjeta; las cuentas en dólares, × dólar de referencia.
  - En dólares: la deuda en dólares de las tarjetas va tal cual; lo que está en pesos se divide por el dólar de referencia.
  - Antes, US$ 100 de deuda de tarjeta se mostraban como US$ 156.
- **Deudas chicas en grupos (02 §7):** el umbral de D14 (< $1 o < US$ 0,01) define "al día" para todo: mostrar, simplificar, abandonar, quitar a un integrante y eliminar el grupo. Los centavos que sobran quedan guardados. Al simplificar, pagan solo los que no están al día, a todos los que tienen saldo a favor, así una deuda visible siempre tiene sus transferencias.
- **Cierre y vencimiento (02 §3):** el formulario exige al menos 5 días entre el cierre y el vencimiento en todos los meses, contando el cambio de mes y febrero (`validateCardDays`). En core, si después del ajuste a fin de mes el vencimiento queda el día del cierre o antes, vence al día siguiente del cierre. Esto reemplaza la regla anterior de pasarlo al mes siguiente.

## Decisiones abiertas

- **CI:** sumar `pnpm gen:sql-fixtures --check` cuando haya CI.
- **Legal (R-LEGAL):** consultar con un abogado e inscribir la base (Ley 25.326) antes de la beta.
- **Verificaciones técnicas:**
  - Que las Edge Functions puedan importar `packages/core` (T9). **Pendiente:** el repo todavía no tiene el monorepo armado (no hay `package.json`, `apps/`, `packages/` ni `supabase/`). Hay que hacer la prueba apenas exista. Si Deno no resuelve el paquete del workspace, se usa un import map (`deno.json`) que apunte a `../../packages/core/src/index.ts`, siempre que el paquete no use APIs de Node. Copiarlo al hacer deploy queda como última opción (revisión del 2/10).
  - El precio del plan pago de Supabase y cómo pausa los proyectos inactivos (T12).
- **¿El aviso de cierre alcanza o hace falta un resumen mensual?** Se decide con los datos de la beta.
- **Plan gratis:** el tope de tarjetas, antes de la fase 2. El precio del plan Pro.
- **Diseño:**
  - Referencia visual de la web de invitados y del reclamo.
  - Revisión completa de Inicio.
  - Inconsistencias I-1 a I-14 de `DESIGN.md`.
- **Nombre definitivo** del producto.
- **Plazo:** las revisiones de diseño y técnica sumaron unos 11 días a un plan sin margen (queda entre 0 y +1 semana). Ya está fijo qué se corta primero si en la semana 4 vamos atrasados (`01-alcance-v1.md`); falta hacer ese control.

## Lo que el prototipo (`prototipo/mangos.html`) contradice

**Alcance (recortado):**
- Bloque "Adjuntar comprobante" con lectura por IA.
- Carrusel.
- Tarjetas de débito y prepagas con su propio detalle.
- "Ver como usuario nuevo".
- Edición de categorías.
- Presupuestos y sus avisos.
- Alertas de precio y de presupuesto.
- Vistas de Inversiones y Mercado.
- Avisos por mail y WhatsApp, y resumen semanal.
- Modos de división Porcentajes y Partes.
- La invitación dice que se pueden cargar gastos desde la web; en la v1 es de solo lectura.
- Bienvenida de 4 pasos; en la v1 son 3.

**Pantallas** (revisión de diseño):
- "Supermercado" preseleccionado (4A).
- Medio de pago en un desplegable (3A).
- Orden de la hoja de carga y Guardar al final (2A).
- Toast genérico (9A).
- Orden del detalle de grupo (1A) y del detalle de tarjeta (6A).
- Sin modo sin conexión (7A).

**Reglas:**
- La cotización se guarda solo en los gastos de grupo; en la v1 va en cada movimiento.
- El saldo se pisa; en la v1 se calcula a partir de los movimientos.
- Solo hay pago total.
- Los vencidos dejan de contar.
- Deshacer un pago no devuelve la plata.
- Eliminar una tarjeta la borra en el momento; en la v1 se archiva 7 días.
- Las cuotas cuentan en el mes de la compra; en la v1, en el mes de cierre de cada resumen.
- El dueño que se va no pasa el rol.
- Los montos exactos se reescalan; en la v1 el resto va al que pagó.
- Las cuotas se eligen entre 1, 3, 6, 9, 12 o 18 (gasto personal) y 1, 3, 6 o 12 (gasto de grupo); en la v1 son de 1 a 24, con fichas rápidas 1, 3, 6 y 12, iguales en los dos.
- El día de cierre y de vencimiento admite solo de 1 a 28.
- El código de invitación está en texto plano.

**Visual:** las inconsistencias I-1 a I-14 de `DESIGN.md`, por ejemplo el peso 600 sin cargar y los contrastes de I-6.
