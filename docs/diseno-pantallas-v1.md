# Diseño de las pantallas de la v1

Especificación que salió de `/plan-design-review` (1 de octubre de 2026) sobre la tabla "Pantallas de la v1" de [01-alcance-v1.md](01-alcance-v1.md). La referencia visual es `prototipo/mangos.html` y los tokens y componentes están en [DESIGN.md](../DESIGN.md). Acá solo se anota lo que Fran aprobó, punto por punto.

Foco de la revisión (D1): cargar un gasto, la Billetera con el detalle de tarjeta y el detalle de grupo, a fondo. El resto de las pantallas tuvo una pasada rápida.

## Cargar gasto (hoja)

**Orden y botón Guardar** (decisión 2A):

```
┌──────────────────────────────────────┐
│ Cargar gasto                      ✕  │
│ ┌ Escribí: 12000 súper visa ──────┐  │  ← carga por texto, plegada (se abre al tocar)
│ └─────────────────────────────────┘  │
│ Monto                                │
│ ┌──────────────────────┐ [$ | US$]   │  ← foco al abrir; moneda al lado del monto
│ │ 86.500               │             │
│ └──────────────────────┘             │
│ Medio de pago                        │
│ (★Visa ··2337)(MP)(Master ··0763)(Otro…)│  ← ninguna preseleccionada
│ Descripción  [ Supermercado Coto  ]  │
│ Categoría  (chip)(chip)(chip)…       │
│ ▸ Hoy · Sin grupo · 1 cuota          │  ← se abre: fecha, grupo, cuotas
│ Entra en el resumen que cierra el…   │  ← texto de ayuda del prototipo, se mantiene
├──────────────────────────────────────┤
│ [ Cancelar ]   [ Guardar gasto ]     │  ← fijo arriba del teclado
└──────────────────────────────────────┘
          (teclado numérico)
```

- Si el medio elegido es una tarjeta de crédito, las cuotas salen de la línea plegada y se muestran solas abajo del medio de pago.
- El bloque "Adjuntar comprobante" del prototipo no va (recorte C5).

**Monto** (decisión 11A):
- Usa el teclado decimal del sistema (`keyboardType="decimal-pad"`).
- Se formatea mientras se escribe, con punto de miles y coma decimal: se teclea 86500 y se ve "86.500".
- Admite como máximo 2 decimales. Se guarda como decimal exacto, nunca como `float`.
- Si se pega un texto, se interpreta con las mismas reglas de monto que la carga por texto. Si queda ambiguo ("12.5"), el campo se marca en `error` con el mensaje "Revisá el monto".

**Medio de pago** (decisión 3A):
- Se muestran fichas (`Chip` de DESIGN.md): primero la favorita y después los dos medios más usados en los últimos 30 días, sin repetir, y al final "Otro…".
- Cada ficha muestra la red y los últimos 4 números ("Visa ·· 2337"), o el nombre si es una cuenta ("Mercado Pago").
- **Ninguna viene marcada**: la regla de 01-alcance-v1.md se mantiene.
- "Otro…" abre una hoja con todos los medios agrupados en Tarjetas y Cuentas. El medio que se elige ahí reemplaza a la tercera ficha mientras dura esta carga.
- Sin medios cargados, en lugar de las fichas va el botón "Sumá una tarjeta o una cuenta".

**Categoría** (decisión 4A):
- La hoja abre **sin "Supermercado" preseleccionado**.
- Mientras se escribe la descripción, la categoría se deduce con las mismas palabras clave que la carga por texto. Cuando cambia sola, la ficha nueva se marca con una transición corta (`motion.micro`).
- Si no hay ninguna coincidencia, queda "Otros".
- Si la persona corrige la categoría, la primera palabra de la descripción queda asociada a la categoría nueva para ese usuario. **Esto cambia lo que decía el diseño de office hours**, donde las correcciones del formulario común no enseñaban nada.

**Descripción** (decisión 13B): sigue siendo obligatoria, como dice `02-reglas-de-negocio.md`. Es la que alimenta la categoría deducida (4A).

**Tiempo estimado de una carga típica** (con tarjeta, sin grupo):

| Paso | Tiempo |
|---|---|
| Tocar el FAB | ~1 s |
| Escribir el monto | ~2 s |
| Tocar la ficha del medio de pago | ~1 s |
| Escribir la descripción | ~3 s (la categoría se deduce sola) |
| Tocar Guardar | ~1 s |
| **Total** | **~8 s**, dentro de la meta de 10 |

Hay que medirlo en la beta con el evento `expense_created` y el tiempo desde que se abre la hoja.

**Sin conexión** (decisión 7A, solo gastos personales; los grupos sin conexión siguen en la fase 2):
- Al tocar "Guardar", el gasto se guarda en el teléfono, la hoja se cierra y el gasto aparece enseguida en la lista con la pastilla `neutral` "Pendiente".
- Cuando vuelve la señal se manda solo. El servidor completa la cotización con la fecha del gasto y la pastilla desaparece.
- Si el envío falla por algo que no es la conexión, por ejemplo una validación, la fila muestra "No se pudo guardar" en `error` con dos acciones: "Reintentar" y "Editar".
- **Esto suma de 3 a 4 días al plan del recorte**, que no tenía margen (ver el control de la semana 4).

## Billetera, pestaña Tarjetas

**Cada tarjeta es una fila con miniatura** (decisión 5A):

```
┌──────────────────────────────────────┐
│ [▆▆▆] Visa Galicia ★      $ 187.000  │  ← miniatura 56×36, color del banco
│       ·· 2337           cierra 24/10 │
├──────────────────────────────────────┤
│ [▆▆▆] Mastercard BBVA      $ 53.000  │
│       ·· 0763           cierra 18/10 │
└──────────────────────────────────────┘
```

- La miniatura usa el mismo degradado `base` → `end` de `cardColors`, sin el patrón de anillos.
- La fila sigue la grilla de `MovementRow`. A la derecha va el total del resumen en curso ("Te vienen") en `money`, con la fecha de cierre debajo en `caption`.
- La favorita va primera y lleva la ★.
- El plástico completo (`CreditCard` de DESIGN.md) es el encabezado del **detalle de la tarjeta**, no de la lista.

## Detalle de tarjeta de crédito

También es la pantalla que abre el aviso de cierre (recorte C9). **Orden en el teléfono** (decisión 6A):

```
┌──────────────────────────────────────┐
│ ‹ Billetera                          │
│ ┌──────────────────────────────────┐ │
│ │ (plástico: CreditCard)           │ │  ← total del resumen, vence 6/11
│ └──────────────────────────────────┘ │
│   ‹   Resumen de octubre   ›         │
│       (pill: A pagar)                │
│ ┌ ¿Te falta cargar algo? ──────────┐ │  ← carga por texto
│ └──────────────────────────────────┘ │
│ [        Pagar resumen        ]      │  ← primary
├──────────────────────────────────────┤
│ Cuotas que siguen                    │
│ nov $ 120.000 · dic $ 95.000 · …     │
├──────────────────────────────────────┤
│ Consumos de este resumen · 14        │
│ (filas de movimiento, "cuota 3/6")   │
├──────────────────────────────────────┤
│ Límite de compra  [▆▆▆▆▆░░░] 62%     │
├──────────────────────────────────────┤
│ Configuración: editar · archivar     │
└──────────────────────────────────────┘
```

## Detalle de grupo

**Orden en el teléfono** (decisión 1A):

```
┌──────────────────────────────────────┐
│ ‹ Grupos                             │
│ 4 personas · pesos                   │
│ Cabaña en Bariloche        (ca)(ju)… │
│ +$ 60.000  te deben                  │  ← tu saldo (moneyLg, success/error)
│ Total gastado: $ 480.000             │
│ [+ Gasto]  [Compartir link]   [⋯]    │  ← ⋯ = Editar grupo
├──────────────────────────────────────┤
│ Cómo saldar · 2 transferencias       │
│ Juan → Vos  $ 50.000     [Registrar] │
│ Ana  → Vos  $ 10.000     [Registrar] │
├──────────────────────────────────────┤
│ Integrantes                          │
│ (V) Vos                   +$ 60.000  │
│ (J) Juan  · sin cuenta    −$ 50.000  │  ← marca de provisorio
│ (A) Ana   · se sumó 2/10  −$ 10.000  │  ← reclamado: "Deshacer" en ⋯ de la fila, 7 días
├──────────────────────────────────────┤
│ Gastos · 12                          │
│ (filas de movimiento)                │
├──────────────────────────────────────┤
│ ▸ Pagos registrados (3)              │  ← plegado
└──────────────────────────────────────┘
```

- "Compartir link" abre la hoja de compartir del sistema con el link de solo lectura. Desde "Editar grupo" se puede revocar o regenerar el link.
- Integrantes reemplaza a "Saldo de cada uno" del prototipo. Las barras de saldo se pueden mantener adentro de cada fila.

## Estados de las tres zonas

Decisión 8A. Suma unos 2 días al plan.

| Pantalla | Cargando | Vacío | Error | Contenido largo |
|---|---|---|---|---|
| Lista de tarjetas | 3 filas esqueleto en `surface2` | "Sumá tu primera tarjeta de crédito para saber cuánto te viene." con botón `primary` | "No pudimos traer tus tarjetas." con "Reintentar". Si hay datos guardados, se muestran con "Actualizado hace X" | Nombre del banco cortado con "…" |
| Detalle de tarjeta | El plástico con los datos guardados y los montos en esqueleto | Resumen sin consumos: "No cargaste nada en este resumen." con el campo de texto a la vista | Igual que la lista | Más de 30 consumos: se muestran 30 y "Ver todos (N)" |
| Detalle de grupo | Esqueleto del encabezado y de 3 filas | Grupo sin gastos: "Todavía no hay gastos. Cargá el primero o compartí el link para que lo carguen los demás." | Igual que la lista | 12 integrantes: las caritas se cortan en "+8" y los nombres largos con "…" |
| Hoja de carga | "Guardar" con spinner (menos de 1 s, si no se guarda en el teléfono) | — | Validación debajo del campo, con los textos en voseo del prototipo | Descripción de 60 caracteres como máximo |

## Recorrido de la carga

| Paso | Qué hace | Qué siente | Dónde se define |
|---|---|---|---|
| 1 | Paga en la caja y abre la app | Apuro, una mano ocupada | FAB "+ Gasto" |
| 2 | Monto, medio de pago, descripción | "Esto es rápido" | Decisiones 2A, 3A y 4A |
| 3 | Toca Guardar | ¿Se guardó? ¿Y si me equivoqué? | Decisión 9A |
| 4 | Vuelve a lo que estaba haciendo | "Ya sé cuánto me viene" | Decisión 9A |

**Después de guardar** (decisión 9A): aparece un toast (`Toast` de DESIGN.md) durante 5 segundos con un botón "Deshacer".
- Con tarjeta de crédito: "Guardado · entra en el resumen del 24/10 (te vienen $ 273.500)".
- Con cuenta: "Guardado · se descontó de Mercado Pago".
- De grupo: "Guardado · tu parte $ 30.000; te deben $ 60.000".
- Si quedó guardado en el teléfono sin conexión (decisión 7A): "Guardado en el teléfono · se envía cuando tengas señal".
- "Deshacer" borra el gasto.

## Accesibilidad

Decisión 12A. Aplica a las tres zonas y suma medio día de QA por zona.
- **Tamaño de toque:** todo lo que se toca mide al menos 44 × 44. Las fichas, los íconos y el "Deshacer" del toast llegan con `hitSlop`.
- **Lector de pantalla:** cada monto lleva un `accessibilityLabel` en palabras ("ochenta y seis mil quinientos pesos", "cincuenta dólares"). Las filas se leen en orden, como una sola unidad: descripción, medio, monto y categoría. Las fichas y los selectores anuncian el estado elegido.
- **Texto agrandado:** la app respeta el tamaño de texto del sistema. Los montos de 24 o más (`moneyHero`, `moneyLg`, `moneyInput`, `moneyCard`) usan `maxFontSizeMultiplier={1.3}` para que la línea no se rompa.
- **Contraste:** se resuelve con I-6 de DESIGN.md, que sigue pendiente.
- **Verificación:** probar cada zona con VoiceOver (iOS), TalkBack (Android) y el texto del sistema en el tamaño más grande.

## Diferencias con el prototipo que ya estaban decididas

No hacen falta decisiones nuevas. El prototipo todavía no las refleja:

| En el prototipo | En la v1 | Motivo |
|---|---|---|
| Bloque "Adjuntar comprobante" arriba de la hoja de carga | No va | Recorte C5 |
| Modos de división Porcentajes y Partes (hoja de carga y gasto de grupo) | Solo Iguales y Montos | Fase 2 (`01-alcance-v1.md`) |
| Invitación: "puede cargar gastos desde la web, sin instalar la app" | "Puede ver el grupo y sumarse cuando instale la app" | Decisión abierta 1 (web de solo lectura) |
| Ajustes: edición de categorías | Las 6 categorías fijas | Recorte C6 |
| Alertas: lista y creación de alertas de precio y presupuesto | Solo cierre y vencimiento, que se configuran por tarjeta | Presupuestos y alerta de dólar fuera de la v1 |
| Carrusel de tarjetas | Lista con `CardRow` | Recorte C4 y decisión 5A |
| Tarjetas de débito y prepagas con su propio detalle | No van | Recorte C3 |

Los componentes nuevos (QuickEntry, PaymentMethodChips, CardRow y Toast con acción) están en [DESIGN.md](../DESIGN.md) (decisión 10A).

## Fuera del alcance de esta revisión

- **Mockups visuales:** el generador necesita una clave de API de OpenAI (`design setup`) y el navegador sin interfaz no arranca en este entorno (falla el sandbox de Chromium). La revisión se hizo en texto, contra el código del prototipo.
- **Inicio, Ajustes, Bienvenida y Alertas:** solo tuvieron la pasada rápida, por la decisión D1.
- **Inconsistencias I-1 a I-14 de DESIGN.md:** siguen pendientes, y cada una necesita su propia decisión.

## Lo que ya existe y se reusa

- **DESIGN.md:** tokens, `Button`, `CreditCard`, `MovementRow`, `CategoryIcon`, `BottomSheet`, `Chip`, `Pill` y `Toast`, más los cuatro componentes nuevos.
- **El prototipo:**
  - El texto de ayuda "Entra en el resumen que cierra el…" de la hoja de carga.
  - Los mensajes de validación en voseo ("Elegí con qué pagaste.").
  - Los estados vacíos que dicen qué cargar.
  - El cálculo de simplificación de deudas y del resumen por cierre real.
- **El diseño de office hours y el recorte:** carga por texto, aviso de cierre, integrantes provisorios y web de solo lectura.

## Tareas de implementación

Salen de las decisiones de esta revisión. Los tiempos son aproximados, para una sola persona.

- [ ] **T1 (P1, vos solo: ~1 día / CC: ~2 h):** Hoja de carga: aplicar el orden nuevo y el botón Guardar fijo arriba del teclado.
  - Viene de: 2A. Verificación: abrir la hoja con el teclado y que Guardar se vea.
- [ ] **T2 (P1, vos solo: ~1 día / CC: ~2 h):** `PaymentMethodChips`: favorita, los 2 más usados en 30 días y "Otro…", sin preselección.
  - Viene de: 3A. Verificación: test de orden y de que ninguna venga marcada.
- [ ] **T3 (P1, vos solo: ~0,5 día / CC: ~1 h):** Categoría deducida de la descripción, con "Otros" por defecto y aprendizaje por usuario.
  - Viene de: 4A. Verificación: tests con las líneas reales de la tarea de office hours.
- [ ] **T4 (P1, vos solo: ~1 día / CC: ~2 h):** Campo Monto con decimal-pad, formato en vivo y como máximo 2 decimales.
  - Viene de: 11A. Verificación: tests de formato y de pegado, incluido el caso ambiguo "12.5".
- [ ] **T5 (P1, vos solo: ~3 a 4 días / CC: ~1 día):** Gastos guardados sin conexión, con la pastilla "Pendiente", envío automático y fila de error con Reintentar o Editar.
  - Viene de: 7A. Verificación: modo avión, cargar, reconectar y comprobar la cotización por fecha.
- [ ] **T6 (P1, vos solo: ~0,5 día / CC: ~1 h):** Toast con el impacto del gasto y "Deshacer" durante 5 segundos.
  - Viene de: 9A. Verificación: las 4 variantes de texto y que Deshacer borre el gasto.
- [ ] **T7 (P1, vos solo: ~1 día / CC: ~2 h):** `CardRow` con miniatura en la lista de la Billetera.
  - Viene de: 5A. Verificación: 4 tarjetas visibles en 390 × 844.
- [ ] **T8 (P1, vos solo: ~1 día / CC: ~2 h):** Detalle de tarjeta con el orden nuevo: plástico, mes, carga por texto, pagar, cuotas, consumos, límite y configuración.
  - Viene de: 6A. Verificación: abrir desde el aviso de cierre y que el campo se vea sin bajar.
- [ ] **T9 (P1, vos solo: ~1 día / CC: ~2 h):** Detalle de grupo con el orden nuevo, Compartir link, la marca de provisorio y los pagos plegados.
  - Viene de: 1A. Verificación: grupo con 12 integrantes y nombres largos.
- [ ] **T10 (P1, vos solo: ~2 días / CC: ~4 h):** Estados de carga, vacío, error y contenido largo de las tres zonas.
  - Viene de: 8A. Verificación: cada celda de la tabla de estados.
- [ ] **T11 (P1, vos solo: ~1,5 días / CC: ~3 h):** Accesibilidad: tamaño de toque de 44, etiquetas de montos en palabras y texto agrandado con tope de 1.3.
  - Viene de: 12A. Verificación: VoiceOver, TalkBack y texto en el tamaño más grande.
- [ ] **T12 (P2, vos solo: ~1 día / CC: ~1 h):** Pasar al prototipo las diferencias ya decididas (comprobante, modos de división, texto de la invitación, categorías, alertas).
  - Viene de: Pasada 5. Verificación: que el prototipo coincida con la tabla de diferencias.

**Impacto en el plazo:** T5 (de 3 a 4 días), T10 (2 días) y T11 (1,5 días) son trabajo que el recorte del 1/10 no tenía contado. Suman unos 7 días a un plan sin margen. Conviene llevarlo al control de la semana 4 o a `/plan-eng-review`.

## Resumen

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — RESUMEN FINAL                         |
  +====================================================================+
  | Auditoría            | DESIGN.md existe; 12 pantallas en el plan   |
  | Paso 0               | 4/10; foco en 3 zonas (D1)                  |
  | Pasada 1 (Arquit.)   | 4/10 → 8/10                                 |
  | Pasada 2 (Estados)   | 2/10 → 8/10                                 |
  | Pasada 3 (Recorrido) | 3/10 → 8/10                                 |
  | Pasada 4 (Genérico)  | 8/10 → 8/10                                 |
  | Pasada 5 (Sistema)   | 6/10 → 8/10                                 |
  | Pasada 6 (Accesib.)  | 4/10 → 8/10                                 |
  | Pasada 7 (Decisiones)| 1 resuelta (13B), 3 abiertas                |
  +--------------------------------------------------------------------+
  | Fuera del alcance    | escrito (3 ítems)                           |
  | Lo que ya existe     | escrito                                     |
  | TODOS.md             | 0 ítems propuestos                          |
  | Mockups              | 0 generados (falta la clave de OpenAI)      |
  | Decisiones tomadas   | 13 sumadas al plan                          |
  | Decisiones abiertas  | 3 (listadas abajo)                          |
  | Nota general         | 2/10 → 8/10                                 |
  +====================================================================+
```

## Decisiones abiertas

- **Web de invitados y pantalla de reclamo:** no tienen referencia visual (no están en el prototipo y no se pudieron generar mockups).
- **Inicio:** solo tuvo la pasada rápida. Le falta orden de lectura y estados, como los que tienen las tres zonas.
- **Inconsistencias I-1 a I-14 de DESIGN.md:** sobre todo I-6 (contraste), que limita la pasada 6.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | ISSUES OPEN | mode: SCOPE_REDUCTION, 0 critical gaps |
| Outside Review | codex (not installed) | Independent 2nd opinion | 1 | unavailable | no completed external review |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | ISSUES OPEN | score: 2/10 → 8/10, 13 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** design phase: not offered (Codex not installed); plan-review phase (CEO): codex unavailable. No completed external review.
- **VERDICT:** no review cleared; eng review required.

**UNRESOLVED DECISIONS:**
- Web de invitados y reclamo sin referencia visual (mockups pendientes)
- Inicio con revisión rápida solamente
- Inconsistencias I-1 a I-14 de DESIGN.md pendientes
- + 2 unresolved from prior reviews
