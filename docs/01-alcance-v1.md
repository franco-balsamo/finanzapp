# Alcance de la versión 1

**Estado:** revisado con `/office-hours`, `/plan-ceo-review`, `/plan-design-review` y `/plan-eng-review` (1/10) y revisión de Claude (2/10).
**Base:** fase 1 de [producto-y-lanzamiento.md](producto-y-lanzamiento.md) más lo que se decidió después, mientras se armaba el prototipo.

## La idea en una línea

La v1 tiene que resolver bien dos dolores: **"cuánto me viene de tarjeta"** y **"quién le debe a quién"**. Todo lo demás espera.

## La regla que manda

Cargar un gasto tiene que llevar **menos de 10 segundos**. El mayor riesgo de Mangos no es técnico: es que la gente deje de cargar gastos a las dos semanas. Si una función agrega pasos a la carga, no entra en la v1.

## Entra en la v1

Recortada el 1 de octubre para que la beta entre en 3 meses con una sola persona. Ver [decisiones/2026-10-01-office-hours.md](decisiones/2026-10-01-office-hours.md) y [decisiones/2026-10-01-ceo-review.md](decisiones/2026-10-01-ceo-review.md).

### 1. Cuenta de usuario y bienvenida
- Registro e inicio de sesión con mail y código.
- Bienvenida corta: dólar de referencia. La moneda del patrimonio se cambia en la Billetera. La primera tarjeta se suma después, desde la Billetera, que es lo primero que se ve al entrar (7/10).
- **Borrar mi cuenta** y **Exportar mis datos** en Ajustes (revisión técnica, 1/10; ver 02 §10).
- El permiso de notificaciones se pide al cargar la primera tarjeta de crédito ("¿Te avisamos cuando cierre?"), no en la bienvenida.

### 2. Billetera: cuentas y tarjetas
- **Cuentas:** banco, billetera virtual y efectivo, cada una en pesos o en dólares, con su saldo. Los gastos con débito o con una billetera descuentan de la cuenta. El saldo se puede ajustar a mano, y el ajuste queda guardado como un movimiento.
- **Tarjetas de crédito:** banco, red, últimos 4 números, vencimiento del plástico, día de cierre, día de vencimiento y límite.
- **Lista de tarjetas**, con una favorita que aparece primera.
- **Detalle de una tarjeta de crédito:** resumen por mes, consumos, cuotas futuras, límite usado, pagos totales o parciales y corrección de la fecha real de cierre.

### 3. Carga de gastos
- **Formulario:** monto, moneda, descripción, medio de pago (vacío hasta que el usuario lo elija), cuotas si es una tarjeta de crédito, fecha y categoría.
- Asignar el gasto a un grupo desde el mismo formulario.
- **Carga rápida por texto:** una línea opcional arriba del formulario. Escribís "12000 súper visa 3 cuotas" y se completa el gasto con reglas, sin IA. Acepta **varias líneas** para ponerse al día de una vez y muestra lo que entendió para confirmarlo. El foco sigue en el monto del formulario, así que no agrega pasos.
- Las 6 categorías fijas del prototipo.

### 4. Aviso de cierre de tarjeta
- El día de cierre de cada tarjeta, a las 20:00, llega una notificación: "Cerró tu Visa: te vienen $187.000. ¿Te falta cargar algo?".
- La notificación abre el detalle de la tarjeta con el campo de texto para cargar lo que falta. En Inicio queda una tarjeta con el aviso hasta el vencimiento.
- Un gasto cargado tarde entra en el resumen que le corresponde por su fecha. Si ese resumen ya estaba pagado, se pregunta "¿Ya lo pagaste?" para no mostrar una deuda que en el banco no existe.

### 5. Inicio
- Patrimonio en pesos o en dólares con el dólar elegido: cuentas, más lo que te deben, menos lo que debés de tarjetas.
- Próximos vencimientos de tarjetas.
- Gastos del mes por categoría.
- Saldo de grupos y avisos recientes.

### 6. Grupos compartidos (básicos)
- Crear un grupo con nombre, moneda e integrantes. Los integrantes pueden ser **provisorios**: tienen solo un nombre y no tienen cuenta.
- **Cargar un gasto del grupo:** quién pagó y cómo se divide, en partes iguales o en montos exactos, pudiendo excluir a alguien.
- Saldo de cada persona y **simplificación de deudas** (como máximo N−1 transferencias).
- Registrar que alguien saldó una deuda. Mangos registra el pago, no mueve la plata.
- Permisos: el dueño puede eliminar el grupo; los demás pueden editarlo y abandonarlo si están al día.
- Si pagaste vos, el gasto impacta en tu tarjeta o cuenta por el total y en el gasto por categoría solo por tu parte.
- **Invitación por link a una web de solo lectura:** el invitado ve los gastos y saldos del grupo sin instalar nada y elige "soy Juan". El link se puede revocar.
- **Reclamar el lugar:** cuando el invitado instala la app desde el link, toma el lugar de su integrante provisorio. El dueño o quien reclamó pueden deshacerlo dentro de los 7 días.

### 7. Dólar del día
- MEP, oficial, blue y tarjeta, desde el backend: el backend consulta DolarApi cada 10 minutos y la app lee del backend, nunca de la API directo.
- Cada gasto guarda la cotización de su fecha. Para los gastos cargados tarde, el backend la saca del historial (ArgentinaDatos).

### 8. Alertas por notificación
- Cierre de tarjeta (sección 4).
- Vencimiento de tarjeta.

## Qué se corta primero si vamos atrasados en la semana 4

El plan no tiene margen: con todo lo que sumaron las revisiones queda entre 0 y +1 semana, y solo si la estimación de Supabase se cumple (revisión del 2/10, §1.1). Si en la semana 4 de desarrollo hay atraso, sale lo siguiente, en este orden:

1. **Accesibilidad:** queda solo el tamaño de toque y las etiquetas de montos. El texto agrandado pasa a la fase 2.
2. **Estados de "contenido largo":** pasan a la fase 2. Carga, vacío y error se quedan.
3. **Carga por texto:** acepta una sola línea en vez de varias.

Si con eso no alcanza, siguen los otros dos recortes del plan B de la revisión de alcance (1/10):

4. Deshacer un reclamo lo hace Fran a mano.
5. Solo pagos totales. Mientras dure la beta, se suspende la regla de pago parcial.

## Queda para después

| Función | Cuándo | Por qué no en la v1 |
|---|---|---|
| Lectura automática de comprobantes con IA | Fase 2, con cupo | Costo por uso y errores de lectura. Se adelantó de la fase 3 en office hours (1/10). |
| Presupuestos y sus avisos al 80% y al 100% | Después de la beta | No ayudan a responder las preguntas de la beta. Queda el gasto por categoría. Decisión abierta 3, resuelta el 1/10. |
| Alerta de precio del dólar | Después de la beta | No ayuda a responder las preguntas de la beta. El dólar del día queda. |
| Datos de ejemplo ("Ver como usuario nuevo") | Lanzamiento público | Los de la beta cargan sus propias tarjetas desde el día 1. |
| Login con Google y Apple | Después de la beta | En la beta, solo mail con código. Si se suma Google, en iOS hay que sumar Apple (App Store, regla 4.8). |
| Tarjetas de débito y prepagas como tipo propio | Después de la beta | En la beta, pagar con débito es pagar desde la cuenta. |
| Carrusel de tarjetas | Después de la beta | En la beta, lista simple; la favorita se mantiene. |
| Adjuntar comprobante como imagen | Fase 2 | Necesita guardar archivos y revisar la privacidad; va junto con la lectura automática. |
| Categorías editables (nombre e ícono) | Después de la beta | En la beta, 6 categorías fijas. |
| Cargar gastos desde la web de invitados | Después de la beta | En la beta, la web es de solo lectura: el invitado ve el grupo y reclama su lugar al instalar la app. Decisión abierta 1, resuelta el 1/10. |
| "Dato del ciclo", código de reclamo y pantalla propia de cierre | Después de la beta | Recortes del diseño de office hours. El aviso de cierre abre el detalle de la tarjeta. |
| Grupos con porcentajes y con partes (2 a 1) | Fase 2 | Iguales y exactos cubren la mayoría de los casos. La lógica ya está en el prototipo, así que es barato sumarlo. |
| Grupos en dos monedas y sin conexión | Fase 2 | Sincronizar sin conexión es lo más difícil técnicamente. |
| Inversiones (manuales y con precio automático) | Fase 2 | No es el dolor principal de la v1 y suma APIs. |
| Mercado con noticias y acciones | Fase 2 | Ídem. |
| Alertas por mail y WhatsApp | Fase 2 | WhatsApp cuesta por conversación; va en Pro. |
| Importar resúmenes en PDF | Fase 2 (Pro) | Cada banco tiene un formato distinto. |
| Plan Pro y cobros | Fase 2 | Primero retención, después monetización. |
| Sincronización con Mercado Pago y carga por voz | Fase 3 | Integraciones complejas. |
| App completa en la web | Después de la beta | Fran quiere Mangos en la web y en el teléfono (7/10). En la beta, la web es solo la de invitados. Hace falta: diseño de escritorio como el del prototipo (menú lateral, más columnas), probar las hojas y la carga rápida con teclado y mouse, avisos de cierre y vencimiento sin notificaciones del teléfono (mail o avisos del navegador) y revisar la sesión guardada en el navegador. Ver [decisiones/2026-10-07-web-completa.md](decisiones/2026-10-07-web-completa.md). |
| App para otros países | Sin fecha | La v1 es solo para Argentina: la base acepta ARS y USD, las cotizaciones salen de DolarApi y ArgentinaDatos, los textos usan voseo y las tarjetas siguen el modelo argentino. Para abrirla hace falta: país del usuario (de la configuración del teléfono, sin preguntar), monedas abiertas en la base, cotizaciones por país, textos traducibles y tarjetas por país. Con eso, "¿Con qué dólar querés ver tus números?" se pregunta solo a quien está en Argentina (7/10). |
| Reportes históricos y exportar | Fase 3 | |
| Logos oficiales de bancos y redes | Antes de publicar | Se usan los archivos oficiales de cada marca, respetando sus reglas. En el prototipo hay iniciales y texto. |

## Pantallas de la v1

El orden de lectura, los estados y los componentes nuevos de las pantallas principales están en [diseno-pantallas-v1.md](diseno-pantallas-v1.md). Las que dicen "Nueva" no están en el prototipo (link en el [README](../README.md)). Las demás existen, pero varias hay que achicarlas para que coincidan con esta tabla.

| Pantalla | Qué tiene | Cambio respecto del prototipo |
|---|---|---|
| Inicio | Patrimonio, vencimientos, gastos del mes por categoría, grupos, avisos, tarjeta "Cerró tu Visa" hasta el vencimiento | Sin presupuestos; suma el aviso de cierre |
| Billetera, pestaña Tarjetas | Lista de tarjetas de crédito con miniatura (`CardRow`), la favorita primero; al tocar abre el detalle. Las archivadas, para recuperarlas. Movimientos con filtros | Lista en vez de carrusel; sin débito ni prepagas |
| Billetera, pestaña Cuentas | Saldos por cuenta en pesos y en dólares | — |
| Detalle de tarjeta de crédito | Resumen por mes con su estado, consumos, cuotas futuras, pagos (totales o parciales), corregir cierre real, límite, editar y archivar. Es la pantalla que abre el aviso de cierre, con el campo de carga por texto | Suma el campo de texto |
| Grupos | Saldo total en una línea, lista de grupos | — |
| Detalle de grupo | Gastos, saldos, cómo saldar, editar o abandonar, integrantes provisorios, compartir o revocar el link, deshacer un reclamo | Suma provisorios, link y reclamo |
| Cargar gasto (hoja) | Línea de carga por texto arriba (una o varias líneas, con la lista para confirmar) y el formulario con grupo | Suma el texto; sin comprobante |
| Gasto de grupo (hoja) | Quién pagó, cómo se divide, con qué pagaste | — |
| Web de invitados | Gastos y saldos del grupo, "soy Juan" y botón para instalar la app y reclamar el lugar. Solo lectura | Nueva (web, no app) |
| Reclamar lugar | "¿Sos Juan?" al abrir el link con la app instalada | Nueva |
| Ajustes | Perfil, dólar de referencia, tema, avisos por tarjeta (cierre y vencimiento) y no molestar, exportar mis datos, cerrar sesión y borrar mi cuenta. Se abre con el engranaje de Inicio | Sin edición de categorías ni creación de alertas |
| Bienvenida | Dólar de referencia | De 4 pasos a 1 (sin objetivo ni tarjeta, 7/10); sin datos de ejemplo |

## Decisiones abiertas para la revisión

1. **Legal:** consultar con un abogado e inscribir la base de datos (Ley 25.326) antes de la beta.
2. **Nombre definitivo.** "Mangos" es provisorio.

Ya resueltas (1 de octubre):
- **Backend:** Supabase. Ver [05-plan-tecnico.md](05-plan-tecnico.md).
- **¿Los invitados de un grupo necesitan instalar la app?** No para ver el grupo. Hay una web de solo lectura con reclamo del lugar al instalar. Cargar gastos desde la web queda para después. Ver [decisiones/2026-10-01-ceo-review.md](decisiones/2026-10-01-ceo-review.md).
- **¿Presupuestos en la v1?** No. Queda el gasto por categoría. Ver [decisiones/2026-10-01-ceo-review.md](decisiones/2026-10-01-ceo-review.md).
- Reglas de tarjetas: el cierre real de cada resumen entra en la v1, todo lo de tarjeta usa el dólar tarjeta, hay pagos parciales y eliminar una tarjeta la archiva 7 días. Ver [decisiones/2026-10-01-reglas-de-negocio.md](decisiones/2026-10-01-reglas-de-negocio.md).

## Cómo sabemos que la v1 funciona

- **Métrica principal, activo en el ciclo:** el usuario carga al menos un gasto de tarjeta entre el aviso de cierre y el vencimiento de ese resumen. Reemplaza a "3 movimientos por semana", porque mide el ritual del cierre (revisión del 2/10, R3-10).
- **Meta de la beta:** 40% de activos en el ciclo, en el 2.º ciclo de cada usuario (≈ semana 4 a 6).
- **Secundaria, semana activa:** al menos 1 movimiento cargado en la semana. Sirve para ver el hábito diario y no bloquea el paso de fase.
- **Grupos:** % de invitados que reclaman su lugar. No tiene meta en la beta; se mide.
- **También mirar:** tiempo promedio para cargar un gasto, % que agrega al menos una tarjeta, grupos creados por usuario, % de invitados de un grupo que terminan usando la app para sus propias finanzas.
