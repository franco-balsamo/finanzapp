# Eng review: plan técnico de la v1 de Mangos

Generado por /plan-eng-review el 2026-10-01
Objetivo (fijo): `docs/02-reglas-de-negocio.md`, `docs/03-modelo-de-datos.md` y el plan recortado (`~/.gstack/projects/finanzas/fbalsamo-nogit-ceo-review-20261001.md`). También se tienen en cuenta `docs/01-alcance-v1.md` y `docs/diseno-pantallas-v1.md`.
Stack: Expo, React Native y TypeScript. El backend está por decidir: FastAPI con Postgres o Supabase.
El repo no tiene código de la app: no hay `package.json` ni tests. Toda la evidencia sale de los documentos y del prototipo.

## Alcance (Scope Challenge A)

- **Qué ya existe:** la lógica del prototipo (`prototipo/mangos.html`: `stmtFor`, `simplify`, `gBal`), las reglas con ejemplos numéricos de 02 y el modelo propuesto en 03.
- **Componentes nuevos:**
  - App Expo.
  - Backend (base de datos, autenticación, seguridad por fila).
  - Proceso de cotizaciones cada 10 minutos.
  - Tareas diarias: cierre, vencimiento y purga de tarjetas archivadas.
  - Notificaciones.
  - Web de invitados de solo lectura.
  - Paquete de cálculos compartido.
  - Cola de gastos guardados sin conexión (diseño, 7A).

  Son más de 8 archivos y más de 2 servicios nuevos, así que corresponde la pregunta de estructura.
- **Fuera de la v1** según decisiones anteriores: comprobantes (C5), presupuestos, alerta de dólar, débito como tipo propio (C3), categorías editables (C6) y los modos Porcentaje y Partes.
- **Hallazgo de alcance S1 (P2, confianza 9/10):** `docs/02-reglas-de-negocio.md` todavía especifica funciones que salieron de la v1 (§4 débito, §5 comprobante, §6 presupuestos y categorías editables, §7 porcentaje y partes, §9 alertas de precio y de presupuesto). Si no se marcan, alguien las va a programar o testear.

**Registro de alcance (Scope Challenge B):** no se propusieron recortes de funciones; la estructura es D1 "Smaller arrangement". El alcance aceptado es un repo con `apps/mobile` (Expo Router, que también publica las rutas web `/g/[token]` para invitados) y `packages/core` (cálculos en TypeScript), más el backend que se decida. Remedios pendientes: S1 y los de las secciones 1 a 4. Resultado: el alcance se acepta tal cual (FULL_REVIEW).

## Decision ledger

### S1: marcar en 02 las secciones que salieron de la v1
- Estado: aprobado (D2, opción A). Alcance aceptado: notas "Fuera de la v1" en §4, §5 (comprobante), §6 (categorías editables, presupuesto y avisos), §7 (Porcentaje y Partes, que pasan a fase 2) y §9 (Precio y Presupuesto pasan a después de la beta; se suma la fila de Cierre de tarjeta, aprobada en office hours). El texto original no se borró. Aplicado.

### A1: backend
- Estado: aprobado (D3, opción A). Alcance aceptado: Supabase, con autenticación por mail con código, Postgres, políticas por fila, pg_cron con Edge Functions en TypeScript para las cotizaciones cada 10 minutos y las tareas diarias, y el plan pago para la beta (hay que verificar el precio y cómo pausa los proyectos inactivos). Se resuelve la decisión abierta 2 de 01-alcance-v1.md.

### A2: dónde viven los cálculos
- Estado: aprobado (D4, opción A). Alcance aceptado: `packages/core` en TypeScript puro, sin dependencias ni acceso a la base (recibe filas y devuelve resultados). Lo usan la app y las Edge Functions. Los tests van con Vitest sobre los ejemplos de 02. Hay que verificar que Deno pueda importar el paquete en el build; si no puede, se copia al hacer deploy.

### A3: lectura de la web de invitados
- Estado: aprobado (D5, opción A). Alcance aceptado:
  - `groups.invite_token_hash` (SHA-256 de un token aleatorio de 128 bits) en lugar de `invite_code`.
  - `get_guest_group(token)` es una función security definer que devuelve nombre, moneda, gastos, saldos y nombres, sin `payment_alias` ni `user_id`.
  - El rol anónimo no puede leer ninguna tabla. Regenerar o revocar el link cambia el hash.
  - Tests que prueben que la función no devuelve de más.

### A4: gastos duplicados
- Estado: aprobado (D6, opción A). Alcance aceptado:
  - El teléfono genera el UUID de cada gasto al crearlo, y el servidor guarda con `insert … on conflict (id) do nothing`.
  - Una tanda de "Guardar N gastos" se manda en una sola llamada.
  - Test de políticas por fila con dos usuarios, para que nadie pueda usar el id de otro.

### A5: cotización por movimiento
- Estado: aprobado (D7, opción A). Alcance aceptado:
  - Un trigger `before insert` en `movements` completa `fx_mep`, `fx_oficial` y `fx_blue` con la cotización de venta de la fecha del gasto, en hora `America/Argentina/Buenos_Aires`: la última de ese día, o la del último día hábil anterior.
  - Las fechas viejas usan el historial cargado desde ArgentinaDatos. La app no manda cotizaciones.
  - Si falta historial para una fecha, el gasto queda con `fx_pending = true` y una tarea lo completa después.

### C1: dinero en packages/core
- Estado: aprobado (D8, opción A). Alcance aceptado:
  - `Money = { minor: number (entero), currency: 'ARS' | 'USD' }`.
  - `convert(money, rate)` redondea al centavo con half-up y es la única vía de conversión.
  - La base guarda `numeric(14,2)` y la conversión se hace en el borde (lectura y escritura), con tipo nominal y tests.

### C2: resto al dividir
- Estado: aprobado (D9, opción A). Alcance aceptado:
  - Cuotas: la primera lleva el resto.
  - Partes iguales: el resto va al que pagó, o al primer incluido si el que pagó quedó excluido.
  - Montos exactos con diferencia de $0,50 o menos: la diferencia va al que pagó (o al primer incluido). Reemplaza el reescalado del prototipo.
  - Escrito en 02 §3 y §7, con ejemplos. Aplicado.

### C3: cierre real en el cálculo
- Estado: aprobado (D10, opción A). Alcance aceptado:
  - `statementFor(card, date, overrides)`: cada fecha cae en exactamente un período y se usa el cierre real cuando existe.
  - La corrección se valida a ±10 días del estimado y entre el cierre anterior y el siguiente; si no, aparece "Revisá la fecha: queda fuera del período".
  - Tests de correcciones vecinas y de cruce de año.
  - 03 actualizado.

### C4: días 29 a 31
- Estado: aprobado (D11, opción A). Alcance aceptado: el mes de vencimiento se calcula comparando `due_day` con `close_day` configurados y después se ajusta cada fecha al último día del mes. El ejemplo (cierre 31 y vencimiento 30) quedó en 02 §3. Aplicado.

### C5: gasto en otra moneda que la cuenta
- Estado: aprobado (D12, opción A). Alcance aceptado:
  - `movements.debited_amount` en la moneda de la cuenta. La app lo propone con el dólar tarjeta del día (el último que tenga guardado si está sin conexión) y la persona lo puede corregir.
  - El saldo de la cuenta suma `debited_amount`.
  - 02 §2 y 03 actualizados (03 también documenta `fx_pending` y el trigger de A5). Aplicado.

### C6: purga de tarjetas archivadas
- Estado: aprobado (D13, opción A). Alcance aceptado:
  - La purga es una función con transacción.
  - Primero convierte cada pago no revertido en un movimiento de la cuenta ("Pago de tarjeta … (eliminada)", con el mismo monto y fecha). Después borra la tarjeta, los consumos y los pagos.
  - Test: los saldos de las cuentas son iguales antes y después de purgar.
  - 02 §3 y 03 actualizados. Aplicado.

### C7: umbral de cero en grupos en dólares
- Estado: aprobado (D14, opción A). Alcance aceptado: menos de $1 en ARS y menos de US$ 0,01 en USD, solo para mostrar y simplificar. 02 §7 actualizado. Aplicado.

### T1: pruebas de punta a punta
- Estado: aprobado (D15, opción A). Alcance aceptado: 4 tests E2E con Maestro contra Supabase local:
  - Carga cronometrada (menos de 10 s).
  - Sin conexión y reconexión, con un solo gasto guardado.
  - Tanda de 8 líneas.
  - Reclamo de lugar desde `/g/[token]`.

### P1: membresía en las políticas por fila
- Estado: aprobado (D16, opción A). Alcance aceptado:
  - `is_group_member(gid)` es security definer y stable, con `search_path` fijo y `left_at is null`, y la usan todas las políticas de grupo.
  - Índices: `group_members(user_id, group_id)`, `movements(user_id, card_id, date)` y `group_expenses(group_id, date)`.
  - La función tiene un test propio.

### TODO-1: borrar cuenta y exportar datos
- Estado: aprobado (D17, opción C: se construye en la v1). Alcance aceptado:
  - "Borrar mi cuenta" en Ajustes: borra cuentas, tarjetas y movimientos. En los grupos, su lugar pasa a ser un integrante sin cuenta con el mismo nombre, así los saldos de los demás no cambian.
  - "Exportar mis datos" arma un JSON con todo lo del usuario.
  - Tests de borrado completo. Suma ~2 días.

### TODO-2: montos en la pantalla bloqueada
- Estado: pasado a TODOS.md (D18, opción A). Aplicado.

Approval readiness: PASS. Filas revisadas: S1 (D2), A1 (D3), A2 (D4), A3 (D5), A4 (D6), A5 (D7), C1 (D8), C2 (D9), C3 (D10), C4 (D11), C5 (D12), C6 (D13), C7 (D14), T1 (D15), P1 (D16), TODO-1 (D17) y TODO-2 (D18, pasado a TODOS.md).

## Entregables

Están en `docs/05-plan-tecnico.md`: la arquitectura, la implementación de cada "✅ Decidido" con sus problemas, cuatro diagramas, la matriz de tests (T-01 a T-26 y E-1 a E-4) y los riesgos de seguridad. Se actualizaron `docs/02-reglas-de-negocio.md` (S1, C2, C4, C5, C6 y C7) y `docs/03-modelo-de-datos.md` (C3, C5, C6 y A5). El plan de QA está en `~/.gstack/projects/finanzas/fbalsamo-nogit-eng-review-test-plan-20261001-182706.md`.

## Fuera del alcance

- **Comprobantes y su almacenamiento:** recorte C5, fase 2. Supabase Storage los resuelve cuando lleguen.
- **Ocultar montos en las notificaciones:** está en TODOS.md (D18).
- **Grupos sin conexión y en dos monedas:** fase 2 (01-alcance-v1.md).

## Lo que ya existe

- **Prototipo:** `stmtFor`, `simplify` y `gBal` en `prototipo/mangos.html`. Se portan a `packages/core` con los cambios de C2, C3, C4 y C7, no se copian tal cual.
- **Reglas:** los ejemplos con números de 02 son los primeros tests.
- **Supabase:** autenticación, políticas por fila, pg_cron y Edge Functions reemplazan lo que con FastAPI había que construir.

## Fallas posibles

| Camino | Falla | Test o manejo | ¿El usuario se entera? |
|---|---|---|---|
| Cola sin conexión | El envío falla por validación | "No se pudo guardar" con Reintentar o Editar (diseño 7A) y E-2 | Sí |
| Trigger fx | Falta historial para la fecha | `fx_pending` y una tarea que lo completa después; T-17 | Sí (pastilla), se corrige solo |
| Cron de cotizaciones | DolarApi caído | Se muestra la última cotización con su hora (02 §1) | Sí |
| Aviso de cierre | El cron corre dos veces | Un envío por tarjeta y ciclo (recorte, Sección 2) | No hace falta |
| Purga | Error a mitad de camino | Todo en una transacción; T-19 | No hace falta (se reintenta al día siguiente) |
| Web de invitados | Token revocado | "Este link ya no funciona" (diseño de office hours) | Sí |

Fallas críticas sin test, sin manejo y silenciosas: 0.

## Paralelización

| Paso | Módulos | Depende de |
|---|---|---|
| Cálculos | packages/core | — |
| Base | supabase/ (migraciones, RLS, triggers, cron) | — |
| Edge Functions | supabase/functions | Cálculos, Base |
| App | apps/mobile | Cálculos, Base |
| E2E | apps/mobile/e2e (Maestro) | App |

- **Carril A:** cálculos y después las Edge Functions.
- **Carril B:** base.
- **Orden:** se arrancan A y B juntos, se integran, y después la app y los E2E.
- **Conflicto:** las firmas de `packages/core` las usan dos carriles, así que conviene fijarlas primero.

## Implementation Tasks

Salen de los hallazgos de esta revisión. Hay que correrlos con Claude Code o Codex e ir tildándolos a medida que se terminan.

- [ ] **T1 (P1, vos solo: ~1 día / CC: ~1 h):** repo. Armar el monorepo con `apps/mobile` (Expo Router con web) y `packages/core`, con Vitest.
  - Viene de: D1 y D4. Verificación: `vitest` corre y la ruta `/g/test` exporta a web.
- [ ] **T2 (P1, vos solo: ~1 día / CC: ~1 h):** core. Tipo `Money`, `convert()` con half-up y conversión en el borde de la base.
  - Viene de: D8. Verificación: T-23 y T-24.
- [ ] **T3 (P1, vos solo: ~3 días / CC: ~3 h):** core. `statementFor` con cierres corregidos, días 29 a 31, cuotas con resto y `cardState`.
  - Viene de: D9, D10 y D11. Verificación: T-01 a T-09.
- [ ] **T4 (P1, vos solo: ~2 días / CC: ~2 h):** core. `groupBalances`, `simplifyDebts` con umbral por moneda y `netWorth`.
  - Viene de: D9 y D14. Verificación: T-10 a T-16.
- [ ] **T5 (P1, vos solo: ~3 días / CC: ~3 h):** base. Migraciones de 03 con `debited_amount`, `fx_pending` e `invite_token_hash`, más las políticas por fila con `is_group_member` y los índices.
  - Viene de: D5, D12 y D16. Verificación: T-20, T-21 y T-25 con pgTAP.
- [ ] **T6 (P1, vos solo: ~1 día / CC: ~1 h):** base. Trigger de cotización por fecha del gasto y cron cada 10 minutos más el del historial.
  - Viene de: D7 y D3. Verificación: T-17.
- [ ] **T7 (P1, vos solo: ~0,5 día / CC: ~30 min):** base. Purga en transacción, con los pagos convertidos en movimientos.
  - Viene de: D13. Verificación: T-19.
- [ ] **T8 (P1, vos solo: ~1 día / CC: ~1 h):** app. Cola sin conexión con UUID del teléfono y upsert por tandas.
  - Viene de: D6. Verificación: T-20, E-2 y E-3.
- [ ] **T9 (P1, vos solo: ~0,5 día / CC: ~30 min):** Edge Functions. Verificar que puedan importar `packages/core`; si no pueden, copiarlo al hacer deploy.
  - Viene de: D4. Verificación: deploy de prueba.
- [ ] **T10 (P1, vos solo: ~2 días / CC: ~2 h):** app y base. "Borrar mi cuenta" y "Exportar mis datos".
  - Viene de: D17. Verificación: T-26.
- [ ] **T11 (P1, vos solo: ~2 días / CC: ~4 h):** E2E. Maestro con los flujos E-1 a E-4 contra Supabase local.
  - Viene de: D15. Verificación: los 4 flujos pasan.
- [ ] **T12 (P2, vos solo: ~1 h):** cuenta. Verificar el precio del plan pago de Supabase y cómo pausa los proyectos inactivos.
  - Viene de: D3. Verificación: anotarlo en `docs/decisiones/`.

**Impacto en el plazo:** T10 (borrar cuenta, ~2 días) y T11 (Maestro, ~2 días) no estaban en el recorte. Supabase (D3) le devuelve al plan unas 2 a 3 semanas frente a FastAPI.

## Decisiones abiertas que pueden traer problemas

Ninguna de esta revisión: las 18 preguntas tienen respuesta. Quedan dos verificaciones (T9 y T12) y una decisión de revisiones anteriores (R-LEGAL).

## Resumen

- Paso 0, Scope Challenge: el alcance se acepta tal cual, con la estructura más chica (D1).
- Arquitectura: 5 hallazgos, todos resueltos.
- Calidad de código: 7 hallazgos, todos resueltos.
- Tests: diagrama hecho, 1 hueco (los E2E, resuelto con D15); 30 casos en la matriz.
- Rendimiento: 1 hallazgo, resuelto.
- Fuera del alcance: escrito.
- Lo que ya existe: escrito.
- TODOS.md: 2 propuestos (1 se construye en la v1, 1 pasó a TODOS.md).
- Fallas posibles: 0 críticas.
- Decisiones abiertas: 0 en esta revisión.
- Segunda opinión: codex no disponible (no está instalado; no hay espera acotada para un subagente).
- Paralelización: 2 carriles en paralelo, y después la app en secuencia.
- Lake Score: 13/13 (todas las preguntas con puntaje eligieron la opción completa).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | ISSUES OPEN | mode: SCOPE_REDUCTION, 0 critical gaps |
| Outside Review | codex (not installed) | Independent 2nd opinion | 2 | unavailable | no completed external review |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES OPEN | 14 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | ISSUES OPEN | score: 2/10 → 8/10, 13 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, plan-review (CEO and Eng): unavailable, CLI not installed and native bounded wait not supported. No findings.
- **VERDICT:** no review cleared; eng review has 14 resolved findings recorded as issues_open (mapped work, 0 unresolved, 0 critical gaps). Ready to implement after T9/T12 verifications; eng review required to re-run clean if scope changes.

**UNRESOLVED DECISIONS:**
- + 5 unresolved from prior reviews
