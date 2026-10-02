# Revisión de las decisiones del 1 de octubre · 2 de octubre de 2026

Revisión hecha por Claude (fuera del repo) sobre:
- `docs/decisiones/`: office hours, CEO review, design review, eng review y su informe, reglas de negocio y README;
- `docs/producto-y-lanzamiento.md`;
- `docs/diseno-pantallas-v1.md`.

No se revisaron `01-alcance-v1.md`, `02-reglas-de-negocio.md`, `03-modelo-de-datos.md`, `05-plan-tecnico.md` ni `DESIGN.md`, porque no estaban entre los archivos recibidos.

**Veredicto:** las cuatro revisiones son coherentes entre sí. No hay contradicciones de fondo. Hay tres cosas para atender antes de programar: el plazo, la métrica de retención y un documento desactualizado. Además quedan nueve puntos abiertos que se pueden cerrar ahora con las propuestas de abajo.

---

## 1. Lo que hay que atender

### 1.1 El plazo no tiene margen
| Origen | Efecto en el plan |
|---|---|
| Recorte de la CEO review | −6,75 semanas (justo lo que faltaba) |
| Design review (sin conexión, estados, accesibilidad) | +7 días |
| Eng review (borrar cuenta, Maestro) | +4 días |
| Supabase en lugar de FastAPI | −2 a −3 semanas |

El saldo da entre **0 y +1 semana de margen**, y solo si la estimación de Supabase se cumple. Antes de escribir código conviene dejar fijo **qué se corta primero si en la semana 4 vamos atrasados**. El plan B de la CEO review (D3) cubre la carga por texto y el reclamo, pero no lo que sumó el diseño.

**Propuesta, en este orden:**
1. La accesibilidad se limita al tamaño de toque y a las etiquetas de montos; el texto agrandado pasa a la fase 2.
2. Los estados de "contenido largo" pasan a la fase 2. Carga, vacío y error se quedan.
3. La carga por texto acepta una sola línea (ya está en el plan B).

### 1.2 La métrica de retención choca con lo que aprendió office hours
- `producto-y-lanzamiento.md` usa como métrica central **3 movimientos por semana**.
- Office hours encontró que la gente **se olvida y se pone al día de golpe**, y eligió el cierre de tarjeta como ritual.

Con ese hábito, alguien que carga 15 gastos juntos el día del cierre es un usuario sano, pero la métrica semanal lo cuenta como inactivo 3 de cada 4 semanas. Esto es justamente el **R3-10** que quedó abierto. Propuesta en §2.

### 1.3 `producto-y-lanzamiento.md` quedó desactualizado
Sigue mostrando cosas que ya se decidieron distinto:

| Dice | Ahora es |
|---|---|
| Presupuestos con avisos al 80% y 100% | Fuera de la v1; queda el gasto por categoría |
| Decisiones abiertas: invitados, backend, miembros sin cuenta | Resueltas: web de solo lectura con reclamo, Supabase, integrantes provisorios |
| Plan gratis: hasta 2 tarjetas | Propuesta de office hours: sacar el tope (se decide antes de la fase 2) |
| Fase 3: carga por foto | La lectura de comprobantes pasa a la fase 2, con cupo |
| Fase 0 sin Mercado Pago | Se investiga la API de Mercado Pago en la fase 0 (2 horas como máximo) |
| Diferencial 4: "alertas de mercado" | La alerta del dólar salió de la v1; el diferencial de la v1 es el **aviso de cierre** |
| Métrica central: 3 movimientos por semana | Ver §2, R3-10 |
| Finy: "Hay que probarlo a fondo" | Agregar lo aprendido: no maneja cuotas; foto, voz y PDF; plan gratis de 100 movimientos |

---

## 2. Propuestas para los puntos abiertos

Son propuestas para que Fran las apruebe o las cambie. Cada una tiene una regla concreta, para que se pueda programar y testear.

### R3-1 · Carga por texto: línea sin medio de pago o sin descripción
- **Sin medio de pago:** la línea queda **incompleta** en la vista previa, con las mismas fichas de medio de pago (3A) y ninguna marcada. No se guarda hasta elegir uno. Así se respeta la regla de no preseleccionar.
- **Sin descripción:** también queda incompleta, porque la descripción es obligatoria (13B). Si la línea tiene una palabra de categoría ("súper"), esa palabra pasa a ser la descripción propuesta y se puede editar.
- **Botón "Guardar N gastos":** muestra cuántos faltan completar ("Guardar 6 · faltan 2"). Las incompletas se pueden descartar.

### R3-2 · Cuotas sin tarjeta de crédito
Si la línea dice "3 cuotas" y el medio no es de crédito:
- se guarda en **1 pago**;
- la vista previa avisa: "Las cuotas son solo para tarjetas de crédito".

Si todavía no tiene medio de pago, las cuotas quedan guardadas y se aplican si después se elige una tarjeta de crédito.

### R3-3 · Gasto cargado tarde en un resumen con varios pagos
- El gasto **no modifica ningún pago**: sube el total del resumen. Si estaba "Pagado", pasa a "Pago parcial" con la diferencia pendiente.
- Se pregunta "¿Ya lo pagaste?". Si la respuesta es sí, se registra **un pago nuevo** por ese monto desde la cuenta del **último pago** del resumen, con la misma fecha que ese pago, y se puede editar.
- Así ningún pago existente cambia, deshacer sigue funcionando pago por pago y el saldo de las cuentas cierra.

### R3-4 · Gasto tarde en dólares
- Se suma a la parte en dólares del resumen.
- Si se contesta "Ya lo pagué", el pago nuevo se propone en la moneda en que se pagó la parte en dólares la última vez:
  - **en dólares,** desde la misma cuenta en dólares;
  - **en pesos,** con el **dólar tarjeta de la fecha de ese último pago** (es la que tiene guardada el sistema).

  Se puede editar.

### R3-5 · Aprendizaje de categorías con palabras genéricas
- **Lista de palabras que no enseñan:** "compra", "pago", "gasto", "cosas", "varios", "de", "el", "la", "en", "con", "para", "por", "y", números, nombres de medios de pago ("visa", "master", "mp") y la palabra "cuotas".
- **Qué palabra se asocia:** la primera palabra que **no** esté en esa lista. Si no queda ninguna, no se aprende nada.
- **Cambio de idea:** si la misma palabra se corrige a otra categoría, gana la última corrección.

### R3-6 · La favorita no coincide con el texto
El texto manda. "súper master" usa la Master aunque la favorita sea Visa. Si el texto coincide con varias tarjetas ("visa" con dos Visa):
1. la favorita, si es una de ellas;
2. si no, la más usada en 30 días;
3. si empatan, la línea queda incompleta con las fichas de esas tarjetas.

### R3-8 y R3-9 · Deshacer un reclamo equivocado
"Deshacer" (7 días, desde el ⋯ de la fila del integrante) **solo corta el vínculo** entre ese lugar del grupo y la cuenta:
- el lugar vuelve a ser un **integrante provisorio** con el mismo nombre;
- los gastos y pagos del grupo **no cambian**, así que los saldos de todos siguen iguales;
- la **cuenta** de la persona sigue existiendo, con todos sus datos personales;
- los **gastos personales** que esa persona creó desde el grupo (con `group_expense_id`) **pierden el vínculo** y pasan a contar completos en su presupuesto, igual que cuando se elimina un grupo.

Se avisa a la persona desvinculada y queda el registro de quién deshizo y cuándo.

### R3-10 · Cómo medir la retención
| Métrica | Definición | Meta de la beta |
|---|---|---|
| **Principal: activo en el ciclo** | El usuario carga al menos un gasto de tarjeta **entre el aviso de cierre y el vencimiento** de ese resumen | 40% en el 2.º ciclo de cada usuario (≈ semana 4 a 6) |
| Secundaria: semana activa | Al menos 1 movimiento cargado en la semana (no 3) | Para ver el hábito diario, sin bloquear |
| Grupos | % de invitados que reclaman su lugar | Sin meta en la beta; se mide |

Esto reemplaza "3 movimientos por semana" como métrica central, porque mide justamente el ritual que eligió office hours.

### Rango de cuotas
Campo numérico de **1 a 24**, con fichas rápidas **1, 3, 6, 12**. Igual en el gasto personal y en el gasto de grupo.

### T9 · Edge Functions importando `packages/core`
Hacer la prueba primero (es media hora). Si Deno no resuelve el paquete del workspace, la salida más simple es un **import map** (`deno.json`) que apunte a `../../packages/core/src/index.ts`, siempre que el paquete no use APIs de Node. Copiarlo al hacer deploy queda como última opción.

---

## 3. Lo que está bien resuelto y conviene no tocar

- **Medio de pago con fichas sin preselección (3A):** respeta la regla original y es más rápido que el desplegable.
- **Toast con el impacto del gasto y "Deshacer" (9A):** muestra el valor de Mangos en cada carga ("entra en el resumen del 24/10").
- **Cotización completada por un trigger con la fecha del gasto (D7):** evita que la app mande cotizaciones viejas cuando estuvo sin conexión.
- **Borrar la cuenta y exportar los datos en la v1 (D17):** la Ley 25.326 da derecho de acceso y de supresión de los datos. Llevarlo igual a la consulta con el abogado (R-LEGAL).
- **Web de invitados de solo lectura con `get_guest_group` y token con hash (D5).**

## 4. Siguiente paso

1. Fran aprueba o cambia las propuestas de §2.
2. Con Claude Code:
   - se aplican las propuestas a `02-reglas-de-negocio.md`;
   - se actualiza `producto-y-lanzamiento.md` (§1.3);
   - se suma a `01-alcance-v1.md` el orden de recorte de §1.1.
3. Se actualiza el prototipo a la v1: tarea T12 de `diseno-pantallas-v1.md`, más la tabla "Lo que el prototipo contradice" del README de decisiones.
4. Paso 5: `/spec` para `packages/core` (tareas T2 a T4 del informe de eng review).
