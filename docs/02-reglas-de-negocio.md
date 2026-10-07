# Reglas de negocio

Lógica que la app tiene que respetar, sacada del prototipo (`prototipo/mangos.html`) y del documento de producto. Cada regla tiene un ejemplo con números para usarlo como caso de prueba.

**Fuente de verdad** desde el 1 de octubre de 2026, junto con [03-modelo-de-datos.md](03-modelo-de-datos.md). Si el código, el prototipo u otro documento dice otra cosa, manda este archivo. Para cambiar una regla, primero se cambia acá.

Las notas **✅ Decidido** son los lugares donde la app real se aparta del prototipo. Salen de estas decisiones:
- [Reglas de negocio](decisiones/2026-10-01-reglas-de-negocio.md)
- [Office hours](decisiones/2026-10-01-office-hours.md)
- [Revisión de alcance (recorte de la v1)](decisiones/2026-10-01-ceo-review.md)
- [Revisión de diseño](decisiones/2026-10-01-design-review.md)
- [Revisión técnica](decisiones/2026-10-01-eng-review.md)
- [Revisión de Claude (2/10)](decisiones/2026-10-02-revision-claude.md)

Las secciones marcadas "Fuera de la v1" quedan para después y no se programan en la beta.

---

## 1. Monedas y tipo de cambio

- Cada movimiento se guarda **en su moneda original** (ARS o USD) junto con la fecha.
- El usuario elige un **dólar de referencia**: MEP (por defecto), oficial o blue. Lo usan los totales del inicio y el patrimonio.
- Hay dos cotizaciones más para casos puntuales:
  - **Tarjeta:** consumos en dólares de la tarjeta pagados en pesos. Incluye percepciones.
  - **CCL y cripto:** informativas.
- Comprar dólares no es un gasto: es una **transferencia** entre una cuenta en pesos y una en dólares, con el tipo de cambio que pagó el usuario.
- Las cotizaciones las consulta el backend cada 10 minutos (DolarApi; ArgentinaDatos para históricos; revisión técnica, 1/10) y las guarda. La app nunca llama a esas APIs directo. Si la API falla, se muestra la última cotización guardada con su hora.

> **✅ Decidido:** el prototipo solo guarda la cotización del día en los gastos de grupo. La app real guarda la cotización **en cada movimiento** (MEP, oficial y blue del día) para que los reportes históricos no cambien con cada devaluación.
>
> **Cómo se completa** (eng review, 1/10): la completa la base al guardar, nunca la app.
> - Se usa la cotización de **venta** de la **fecha del gasto**, en hora de Argentina: la última guardada ese día.
> - Si ese día no hubo cotización (fin de semana o feriado), se usa la del último día hábil anterior, mirando hasta 4 días hacia atrás (T6, 2/10).
> - Si falta el historial de esa fecha, el gasto se guarda igual, marcado como pendiente, y una tarea completa la cotización después. Nunca se bloquea la carga.
> - Si la fecha del gasto tiene más de 2 días y sigue pendiente, la tarea diaria usa la última cotización anterior a esa fecha, sin límite de días. Si la fecha es anterior a todo el historial, usa la primera disponible. En los dos casos el gasto queda marcado como **estimado**, para revisarlo (ajuste de T6, 4/10).
> - Si se cambia la fecha del gasto, la cotización se vuelve a calcular. Si se edita otra cosa, queda la que estaba.
>
> *Ejemplo: un gasto del sábado 3/10/2026 cargado el lunes 5/10 guarda la cotización del viernes 2/10, no la del lunes.*
>
> *Ejemplo: un gasto del 1/2/2020, cuando el último historial anterior es del 10/1/2020, queda pendiente al cargarlo. A la madrugada siguiente toma la cotización del 10/1 y queda estimado.*

## 2. Cuentas

- **Tipos:** banco, billetera virtual, efectivo. Cada cuenta tiene **una sola moneda**.
- **Saldo** = saldo inicial + ingresos − gastos con débito o billetera − pagos de tarjeta ± transferencias.
- Si el gasto está en otra moneda que la cuenta, se descuenta convertido. **Decidido** (eng review, 1/10): se guarda lo descontado en la moneda de la cuenta (`debited_amount`). La app lo propone con el **dólar tarjeta de la fecha del gasto** (`fx_rate_on('tarjeta', fecha)`, con la misma ventana de 4 días que §1) y la persona lo puede corregir si el banco cobró otra cosa. El saldo suma ese monto y nunca se recalcula con otra cotización. *Ejemplo: US$ 12 desde una caja en pesos con dólar tarjeta a $2.028 → se proponen $24.336, editables.*
- El usuario tiene que poder **ajustar el saldo a mano**, y el ajuste queda guardado como un movimiento, para no perder el historial.

> **✅ Decidido:** el prototipo no tiene ajuste manual y guarda el saldo pisando el valor anterior. La app real suma el ajuste manual y **calcula el saldo a partir de los movimientos**, así se puede reconstruir y auditar.

## 3. Tarjetas de crédito

### Datos de una tarjeta
Banco, nombre, red (Visa, Mastercard, Amex, Cabal), últimos 4 números, vencimiento del plástico (MM/AA), día de cierre y día de vencimiento (1 a 31; en meses cortos, el último día del mes), límite en pesos (mayor a cero). El color se asigna solo y la favorita se marca con la estrella de la tarjeta.

### En qué resumen entra un gasto
- Un resumen se identifica por **año y mes de cierre**.
- Si la compra es **el día de cierre o antes**, entra en el resumen que cierra ese mes. Si es después, entra en el del mes siguiente.
- **Vencimiento del resumen:** si el día de vencimiento es mayor que el de cierre, vence ese mismo mes; si no, vence el mes siguiente.

**Ejemplo** (tarjeta con cierre el 24 y vencimiento el 6):

| Compra | Resumen | Cierra | Vence |
|---|---|---|---|
| 20 sep | septiembre | 24 sep | 6 oct |
| 24 sep | septiembre | 24 sep | 6 oct |
| 25 sep | octubre | 24 oct | 6 nov |
| 28 dic | enero del año siguiente | 24 ene | 6 feb |

### Cuotas
- Una compra en **N cuotas** suma **monto ÷ N** en el resumen donde entra la compra y en los N−1 siguientes.
- Las cuotas en pesos y los consumos en dólares se suman por separado.

**Ejemplo:** $30.000 en 3 cuotas el 25 sep (cierre 24, vencimiento 6) suma $10.000 en los resúmenes de octubre, noviembre y diciembre, que vencen el 6 nov, el 6 dic y el 6 ene.

> **✅ Decidido** (eng review, 1/10): si la división no da exacta al centavo, **la primera cuota lleva el resto**. *Ejemplo: $100.000 en 3 cuotas son $33.333,34 + $33.333,33 + $33.333,33 = $100.000,00.*

### Gastos que se cargan tarde

> **✅ Decidido** (office hours, 1/10): ponerse al día cargando gastos viejos es el caso central de la app.

- Un gasto con fecha anterior al **último cierre que ya pasó** entra en el resumen que le corresponde por su fecha, porque así lo cobra el banco.
- El gasto **no modifica ningún pago**: sube el total del resumen. Si estaba "Pagado", pasa a "Pago parcial" (o a "Vencido", si ya pasó el vencimiento) con la diferencia pendiente (revisión del 2/10, R3-3).
- Si ese resumen ya estaba **pagado**, Mangos pregunta una vez: "¿Ya lo pagaste con el resumen de septiembre?".
  - **Sí** (opción por defecto): se registra **un pago nuevo** por ese monto, desde la cuenta del **último pago** del resumen y con la misma fecha que ese pago. Se puede editar. Ningún pago existente cambia, deshacer sigue funcionando pago por pago y el saldo de las cuentas cierra.
  - **No:** el resumen queda en "Pago parcial" (o "Vencido", si ya pasó el vencimiento) con la diferencia pendiente.
- **Gasto tarde en dólares** (revisión del 2/10, R3-4): se suma a la parte en dólares del resumen. Si se contesta "Sí", el pago nuevo se propone en la moneda en que se pagó la parte en dólares la última vez:
  - **en dólares:** desde la misma cuenta en dólares;
  - **en pesos:** con el **dólar tarjeta de la fecha de ese último pago**, que es el que tiene guardado el sistema.

  Se puede editar.

  Si la parte en dólares de ese resumen **nunca se pagó** (por ejemplo, el resumen solo tenía pesos), el pago nuevo sale de la cuenta del último pago del resumen, con su fecha y con el **dólar tarjeta de hoy** (spec de core, 2/10).
- **Cuotas cargadas tarde:** cada cuota va al resumen que le toca por su fecha. Si varias caen en resúmenes ya pagados, la pregunta se hace una sola vez para todas. Con **Sí**, se registra un pago nuevo por cada resumen, con la cuenta y la fecha del último pago de ese resumen.

En los ejemplos que siguen, la Visa cierra el 30 y vence el 10, salvo el de cuotas, donde cierra el 25 y vence el 8.

**Ejemplo:** el resumen de septiembre de la Visa cerró en $100.000 y se pagó completo. El 5/10 cargás "28/09 12000 farmacia visa". Ese resumen pasa a $112.000. Con **Sí**, queda pagado; con **No**, quedan $100.000 pagados y $12.000 pendientes.

**Ejemplo con varios pagos (R3-3):** el resumen de septiembre ($100.000) se pagó con $60.000 desde la caja de Galicia el 3/10 y $40.000 desde Mercado Pago el 6/10. El 8/10 cargás "28/09 12000 farmacia visa":
- el resumen pasa a $112.000 en "Pago parcial", con $12.000 pendientes;
- con **Sí**, se registra un pago nuevo de $12.000 desde **Mercado Pago** (la cuenta del último pago), con fecha 6/10. El resumen vuelve a "Pagado" y Mercado Pago baja $12.000;
- los pagos de $60.000 y $40.000 no cambian. Si después se deshace el de $12.000, el resumen vuelve a "Pago parcial" con $12.000 pendientes y Mercado Pago recupera los $12.000.

**Ejemplo en dólares (R3-4):** la parte en dólares del resumen de septiembre (US$ 50) se pagó en pesos el 6/10 desde la caja de Galicia, con dólar tarjeta a $2.028. El 8/10 cargás "29/09 usd 12 netflix visa":
- la parte en dólares pasa a US$ 62, con US$ 12 pendientes;
- con **Sí**, se propone un pago nuevo de **$24.336** (12 × $2.028) desde la caja de Galicia, con fecha 6/10, editable;
- si la última vez se hubiera pagado en dólares desde la caja en dólares, se propondría **US$ 12** desde esa misma cuenta.

**Ejemplo con cuotas:** la Visa cierra el 25. El 5/10 cargás "15/07 60000 x6 visa", que son 6 cuotas de $10.000. Julio, agosto y septiembre ya estaban pagados: se pregunta una vez. Octubre entra en el resumen en curso, y noviembre y diciembre quedan como cuotas futuras.

La pregunta aparece solo para gastos con fecha anterior al último cierre, así que no suma pasos a la carga común.

### Estados de un resumen

| Estado | Condición |
|---|---|
| En curso | Es el resumen que cierra en el ciclo actual |
| Cuotas futuras | Cierra después del resumen en curso |
| A pagar | Ya cerró, no tiene pagos y no venció |
| Pago parcial | Ya cerró y los pagos registrados no cubren el total |
| Pagado | Los pagos registrados cubren el total |
| Vencido | Ya cerró, pasó la fecha de vencimiento y queda saldo pendiente (sin pagos o con pago parcial) |

### Lo que se muestra
- **A pagar:** todos los resúmenes cerrados con **saldo pendiente** (total − pagos registrados), vencidos o no. El más próximo a vencer va primero; los vencidos se marcan en rojo.
- **Pago mínimo aproximado:** 15% de la parte en pesos (los dólares no entran). Es una aproximación; el real lo define el banco.
- **Límite usado:** todo lo que falta pagar: el saldo pendiente de los resúmenes cerrados (**incluidos los vencidos**), más el resumen en curso, más todas las cuotas futuras. Los dólares se convierten con el **dólar tarjeta**.
- **Disponible:** límite − límite usado (nunca negativo).

### Registrar el pago
- El usuario **paga lo que quiera**: el total, el mínimo o cualquier monto. Se puede registrar más de un pago para el mismo resumen.
- Se elige de qué cuenta sale cada parte. La parte en dólares puede salir de una cuenta en dólares o pagarse en pesos con el **dólar tarjeta** de la fecha del pago, que la app pide con `fx_rate_on('tarjeta', fecha)`.
- Cada pago se descuenta de la cuenta de la que salió y queda guardado con esa cuenta.
- **Saldo pendiente** = total del resumen − pagos registrados. Si queda saldo, el resumen sigue figurando como deuda (en "A pagar", en el límite usado y en el patrimonio) hasta cubrirlo.
- **Deshacer un pago:** el resumen vuelve a tener ese saldo pendiente y la plata **vuelve a la cuenta de la que salió**.

**Ejemplo:** resumen de $200.000. El usuario paga $120.000 desde la caja de ahorro: el resumen queda en "Pago parcial" con $80.000 pendientes y la caja baja $120.000. Si pasa el vencimiento sin otro pago, queda "Vencido" con $80.000. Si deshace el pago, el resumen vuelve a $200.000 pendientes y la caja recupera los $120.000.

> En la v1 Mangos **no calcula intereses** por el saldo que se arrastra; el saldo pendiente es el que registró el usuario.

### Archivar y eliminar
- Eliminar una tarjeta de crédito la **archiva por 7 días**: deja de verse en la Billetera y en los medios de pago, pero su deuda pendiente sigue contando.
- Durante esos 7 días se puede **desarchivar** desde Ajustes y vuelve todo como estaba.
- Pasados los 7 días se **elimina definitivamente**, con todos sus consumos y pagos. **Antes de borrar** (eng review, 1/10), cada pago no revertido pasa a ser un movimiento de la cuenta de la que salió ("Pago de tarjeta Visa ··2337 (eliminada)"), con el mismo monto y fecha, para que el saldo de las cuentas no cambie. La purga corre todos los días a las 3:30; si una tarjeta no se puede borrar, queda registrada para revisarla y se reintenta al día siguiente (T7, 4/10).
- Al archivar se avisa cuántos consumos tiene y cuándo se borra.

> **✅ Decidido** (cambios respecto del prototipo):
> - **Cierre real:** cada resumen permite corregir su fecha real de cierre y de vencimiento. El día fijo de la tarjeta se usa solo como estimación.
> - **Días 29 a 31:** se permiten. En los meses más cortos se usa el último día del mes. *Ejemplo: cierre el 31 → en febrero cierra el 28 (o el 29 si es bisiesto); en abril, el 30.* Para saber en qué mes vence se comparan los días **configurados** (vencimiento contra cierre), y después cada fecha se ajusta al último día del mes si hace falta (eng review, 1/10). *Ejemplo: cierre 31 y vencimiento 30 → el resumen de febrero cierra el 28/2 (29 si es bisiesto) y vence el 30/3.*
> - **Distancia entre cierre y vencimiento** (decisión del 2/10, después del /review):
>   - El formulario de la tarjeta exige que el vencimiento quede **al menos 5 días después del cierre en todos los meses**, contando el cambio de mes y febrero. *Ejemplo: cierre 24 y vencimiento 6 → el caso más corto es febrero (24/2 → 6/3, 10 días): se acepta. Cierre 28 y vencimiento 2 → en febrero de 2027 queda 28/2 → 2/3, 2 días: se rechaza.*
>   - Como red de seguridad, si después del ajuste a fin de mes el vencimiento queda el mismo día del cierre o antes, core lo pasa **al día siguiente del cierre**. *Ejemplo: cierre 28 y vencimiento 29 (un dato que el formulario ya no deja guardar) → febrero de 2027 cierra el 28/2 y vence el 1/3; en 2028, que es bisiesto, vence el 29/2.*
> - **Conversión de dólares:** todo lo que es de tarjeta (pagar dólares en pesos, límite usado) usa el **dólar tarjeta**. El dólar de referencia queda para cuentas y patrimonio.
> - **Pago parcial, vencidos y deshacer:** como se describe arriba. En el prototipo solo había pago total, los vencidos dejaban de contar y deshacer no devolvía la plata.
> - **Eliminar:** se archiva 7 días y después se borra. En el prototipo se borraba en el momento.

## 4. Tarjetas de débito y prepagas

> **Fuera de la v1** (recorte C3, 1/10): en la beta, pagar con débito es pagar desde la cuenta. Esta sección queda para después.

- Están siempre **asociadas a una cuenta** (banco o billetera; nunca efectivo). Un gasto con ellas se registra con la cuenta como medio de pago y descuenta al momento.
- El detalle muestra los gastos del mes de esa cuenta, el saldo disponible, el promedio por gasto y las categorías donde más se gastó.
- Si el mes en curso no tiene movimientos, el detalle abre en el último mes que sí tenga.
- **Eliminar** la tarjeta no borra movimientos: quedan en la cuenta.

## 5. Medio de pago, favorita y carga de gastos

- Al cargar un gasto, el medio de pago **empieza vacío** y es **obligatorio**. Excepción: las líneas de la carga por texto que se escriben en el detalle de una tarjeta de crédito usan esa tarjeta, salvo que el texto nombre otro medio de pago.
- Orden de la lista: primero la **favorita** (con ★), después las demás tarjetas de crédito y al final las cuentas (bancos, billeteras y efectivo).
- Hay **una sola favorita** entre todas las tarjetas, de crédito, débito o prepagas. Marcar una le saca la marca a la anterior.
- **Cuotas:** el campo aparece solo si el medio es una tarjeta de crédito. Es un campo numérico de **1 a 24**, con fichas rápidas **1, 3, 6 y 12**, igual en el gasto personal y en el de grupo (revisión del 2/10). En el prototipo eran 1, 3, 6, 9, 12 o 18 al cargar un gasto y 1, 3, 6 o 12 en un gasto de grupo.
- **Comprobante** *(fuera de la v1: recorte C5, 1/10; vuelve en la fase 2)*: imagen opcional. En la v1 se guarda sin leerla. Más adelante la IA va a leer monto, comercio, fecha y medio de pago para completar el formulario, y el usuario siempre confirma.
- **Validaciones:**
  - monto mayor a cero;
  - descripción obligatoria;
  - medio de pago elegido;
  - si hay grupo, que la división cierre: los montos exactos suman el total (los porcentajes son de la fase 2).

  Excepción del sistema: los gastos que entran al reclamar un lugar en un grupo quedan "Sin medio de pago" (§7).
- **Categoría** (diseño, 1/10): ninguna viene preseleccionada. Se deduce de la descripción con las palabras clave de la carga por texto; si no hay coincidencia, queda "Otros". Si la persona la corrige, se aprende como dice "Aprendizaje de categorías" en la carga por texto.
- **Medio de pago en la hoja de carga** (diseño, 1/10): se muestran la favorita, los dos medios más usados en 30 días y "Otro…". Ninguno viene marcado.
- **Sin conexión** (diseño y eng review, 1/10): el gasto se guarda en el teléfono y se envía cuando vuelve la señal. Cada gasto tiene un identificador que genera el teléfono, así que reintentar **nunca lo duplica**. Si el envío falla por otra causa, el gasto queda como "No se pudo guardar", con Reintentar o Editar.

### Carga por texto

> **✅ Decidido** (office hours, 1/10): es un campo opcional arriba del formulario, funciona con reglas y sin IA, y no agrega pasos a la carga común.

- **Cada línea es un gasto.** Los números se leen en este orden y cada uno se usa una sola vez:
  1. **Fecha:** `dd/mm`, `dd/mm/aa`, `ayer` o `anteayer`. Si no hay, es hoy. `dd/mm` toma la fecha más reciente que no sea futura. Una fecha futura marca la línea para revisar.
  2. **Cuotas:** `N cuotas`, `N c` o `xN`, de 1 a 24 (como en el formulario).
  3. **Tarjeta:** 4 dígitos que coinciden con los últimos 4 de una tarjeta del usuario. Se toman como tarjeta solo si queda otro número para el monto; si no, son el monto. *Ejemplo: "4532 súper visa" con una Visa ··4532 da $4.532 con la Visa.*
  4. **Monto:** el primer número que queda. Si queda más de uno que podría ser el monto, la línea se marca para revisar.
- **Formato del monto:** el punto separa miles y la coma, decimales (`12.000`, `12.000,50`). Sufijos: `k`, `mil` y `M`. Lo ambiguo (`12.5`) se marca para revisar y nunca se adivina. Para dólares: `u$s`, `usd`, `us$` o `dólares`; si no hay, la moneda es ARS.
- **Descripción:** lo que queda de la línea después de sacar la fecha, las cuotas, el monto, la moneda y lo que se usó para elegir el medio de pago. *Ejemplo: en "28/09 4532 12000 súper x3", la descripción es "súper".*
- **Medio de pago:** se busca por los últimos 4, por el banco o por la red. **El texto manda** (revisión del 2/10, R3-6): "súper master" usa la Master aunque la favorita sea Visa. Si el texto coincide con varias tarjetas ("visa" con dos Visa), se elige en este orden:
  1. la favorita, si es una de ellas;
  2. si no, la más usada en 30 días;
  3. si empatan, la línea queda **incompleta**, con las fichas de esas tarjetas.
- **Línea sin medio de pago** (R3-1): queda **incompleta** en la vista previa, con las mismas fichas de medio de pago de la hoja de carga y ninguna marcada. No se guarda hasta elegir uno.
- **Línea sin descripción** (R3-1): si no queda nada para la descripción, la línea también queda incompleta, porque la descripción es obligatoria. *Ejemplo: "12000 visa".*
- **Cuotas sin tarjeta de crédito** (R3-2): si la línea dice "3 cuotas" y el medio no es de crédito, se guarda en **1 pago** y la vista previa avisa: "Las cuotas son solo para tarjetas de crédito". Si todavía no tiene medio de pago, las cuotas quedan guardadas y se aplican si después se elige una tarjeta de crédito.
- **Categoría:** por palabra completa, sin importar acentos ni mayúsculas. Gana la primera palabra que coincide. Lista inicial:
  - Supermercado: super, coto, carrefour, jumbo, disco, chino, verdulería.
  - Salidas: delivery, rappi, pedidosya, resto, bar, birra, café.
  - Transporte: nafta, ypf, shell, uber, cabify, sube, peaje.
  - Servicios: luz, gas, agua, internet, celu, edenor, edesur, metrogas.
  - Suscripciones: netflix, spotify, disney.
  - Lo que no coincide va a Otros.
- **Aprendizaje de categorías** (revisión del 2/10, R3-5): cuando la persona corrige una categoría, se asocia a la nueva la **primera palabra de la descripción que no esté en esta lista**: "compra", "pago", "gasto", "cosas", "varios", "de", "el", "la", "en", "con", "para", "por", "y", los números, los bancos y las redes de los medios de pago del usuario (por ejemplo "visa", "master", "galicia") y "cuotas". Si no queda ninguna palabra, no se aprende nada. Si la misma palabra se corrige a otra categoría, gana la última corrección.
- **Estados de cada línea:**
  - **Lista:** se guarda.
  - **Para revisar:** hay que confirmarla.
  - **Incompleta:** falta el medio de pago o la descripción; se completa ahí mismo o se descarta.
  - **Sin monto:** queda en el campo.

  "Guardar N gastos" guarda las listas y las confirmadas en una sola tanda, y muestra cuántas faltan completar ("Guardar 6 · faltan 2"). Las incompletas se pueden descartar. Lo que no se guardó queda en el campo.

*Ejemplo: "28/09 4532 12000 súper x3" con una Visa ··4532 da: 28/9, Visa ··4532, $12.000 en 3 cuotas, descripción "súper", Supermercado.*

## 6. Categorías y presupuestos

- Cada categoría tiene nombre, ícono y un color interno, que se usa en el gráfico de reparto y como fondo suave del ícono.
- *(Fuera de la v1: recorte C6, 1/10. En la beta hay 6 categorías fijas.)* Las categorías se pueden crear, renombrar y eliminar. "Otros" no se puede eliminar. Al eliminar una, sus gastos pasan a "Otros" y se borran su presupuesto y sus alertas.
- **Presupuesto** *(fuera de la v1, 1/10; en la beta queda solo el gasto por categoría)*: un tope mensual en pesos, opcional por categoría. Se edita desde "Editar presupuestos" en el inicio. Sin tope, la categoría muestra "sin tope".
- **Qué cuenta en el gasto del mes:**
  - con tarjeta de crédito, cada cuota en el mes de cierre de su resumen; con cuenta o efectivo, en el mes de la fecha del gasto;
  - si el gasto es de un grupo, **solo tu parte**;
  - si es en cuotas, **una cuota**;
  - los gastos en dólares se convierten a pesos.
- **Avisos** *(fuera de la v1, junto con los presupuestos)*: el inicio avisa al 80% y al 100% de cada categoría con tope. Además, el usuario puede crear alertas de presupuesto al 50%, 80% o 100%.

> **✅ Decidido:** una compra en N cuotas cuenta **una cuota en el mes de cierre de cada uno de los N resúmenes** en los que cae. El prototipo la contaba solo en el mes de la compra.
>
> **Ejemplo:** $30.000 en 3 cuotas el 25 sep, con cierre el 24. Los resúmenes cierran el 24 oct, el 24 nov y el 24 dic, así que el gasto por categoría cuenta $10.000 en octubre, $10.000 en noviembre y $10.000 en diciembre, y nada en septiembre.
>
> Los gastos con débito, billetera o efectivo cuentan en el mes de la fecha del gasto.

## 7. Grupos compartidos

### Datos de un grupo
Nombre, moneda base (ARS o USD), integrantes (vos más otros, con o sin cuenta en Mangos), dueño, gastos y pagos entre integrantes.

### Cómo se divide un gasto
Cada gasto guarda monto, moneda, **cotización del día**, quién pagó, modo de división y las partes de cada integrante. El monto se pasa a la moneda del grupo con la cotización guardada, para que **la deuda no cambie con el dólar**.

| Modo | Parte de cada uno | Validación |
|---|---|---|
| Iguales | total ÷ cantidad de incluidos | al menos una persona |
| Exactos | el monto que se carga | la suma = total (tolerancia $0,50) |
| Porcentaje *(fase 2)* | total × % ÷ 100 | la suma = 100% |
| Partes *(fase 2)* | total × partes ÷ suma de partes | al menos una parte |

Se puede **excluir** a alguien de un gasto: no se le asigna parte.

> **✅ Decidido** (eng review, 1/10): las partes siempre suman el total exacto.
> - **Iguales:** si la división no da exacta al centavo, el resto va al que pagó, o al primer incluido si el que pagó quedó excluido. *Ejemplo: $100 entre 3, pagó Ana: Ana $33,34, Juan $33,33, Vos $33,33.*
> - **Exactos:** si la suma difiere del total en $0,50 o menos, la diferencia se suma a la parte del que pagó (o del primer incluido). Reemplaza el reescalado del prototipo. *Ejemplo: total $1.000, partes $600 + $399,60; la parte del que pagó pasa a $600,40.*

### Integrantes sin cuenta, invitación y reclamo

> **✅ Decidido** (office hours, recorte y eng review, 1/10).

- **Integrante provisorio:** tiene nombre y no tiene cuenta. Los gastos y pagos del grupo funcionan igual con él.
- **Link de invitación:**
  - Abre una web de **solo lectura**, sin instalar nada, con los gastos, los saldos y los nombres del grupo.
  - **Nunca** muestra el alias o CBU ni datos personales de nadie.
  - El invitado no puede cargar gastos (eso queda para después de la beta).
  - El link es un token aleatorio de 128 bits. Cualquier integrante con cuenta lo puede regenerar o revocar, y el link viejo deja de funcionar.
- **Reclamar el lugar:** el invitado elige "soy Juan" y, al registrarse desde el link (o abrirlo con su cuenta), toma el lugar de ese integrante provisorio. Al reclamar:
  - Los gastos de grupo que **pagó él** entran a sus finanzas con "Sin medio de pago", para que los complete cuando quiera. Mientras no lo haga, no cuentan para ninguna tarjeta ni cuenta. Su parte de esos gastos sí cuenta en el gasto por categoría, aunque no afecte tarjetas ni cuentas.
  - Los que **pagaron otros** solo cambian su saldo en el grupo.
- **Deshacer un reclamo** (revisión del 2/10, R3-8 y R3-9): lo pueden hacer el dueño o quien reclamó, dentro de los 7 días, desde el ⋯ de la fila del integrante. **Solo corta el vínculo** entre ese lugar del grupo y la cuenta:
  - el lugar vuelve a ser un **integrante provisorio** con el mismo nombre;
  - los gastos y pagos del grupo **no cambian**, así que los saldos de todos siguen iguales;
  - la **cuenta** de la persona sigue existiendo, con todos sus datos personales;
  - los gastos que entraron a sus finanzas **al reclamar** (los "Sin medio de pago", con `origin = claim`) **se borran**, aunque ya les haya completado el medio de pago, porque eran del integrante provisorio y no suyos;
  - los **gastos personales** que esa persona cargó ella misma desde el grupo después de reclamar (los que tienen `group_expense_id`) **pierden el vínculo** y pasan a contar completos en su gasto por categoría, igual que cuando se elimina un grupo.

  Se avisa a la persona desvinculada y queda registrado quién lo deshizo y cuándo.

### Saldo de cada integrante
- Saldo = lo que pagó − lo que le toca, sumado en todos los gastos del grupo, más los pagos que hizo y menos los que recibió.
- Positivo significa que le deben; negativo, que debe.
- Los saldos de todos suman cero. Al mostrar y al simplificar, los saldos menores a $1 se toman como cero en los grupos en pesos; en los grupos en dólares, solo los menores a US$ 0,01 (eng review, 1/10).
- **"Al día"** (decisión del 2/10, después del /review): un integrante está al día si su saldo es menor a $1 en un grupo en pesos o menor a US$ 0,01 en uno en dólares. Ese mismo umbral vale para **todo**: mostrar el saldo, simplificar, abandonar el grupo, quitar a un integrante y eliminar el grupo sin aviso de saldos pendientes. El resto de centavos **queda guardado**; no se borra ni se redondea en la base.
- Al simplificar, solo pagan los que **no** están al día, y les pagan a todos los que tienen saldo a favor, aunque ese saldo esté debajo del umbral. Así una deuda visible nunca se queda sin transferencias.

  *Ejemplo: grupo en pesos con Ana −$2,97 y Beto, Caro y Dani +$0,99 cada uno. Beto, Caro y Dani están al día (pueden abandonar el grupo) y se muestran en $0. Ana no está al día: "Cómo saldar" le muestra $0,99 a Beto, $0,99 a Caro y $0,99 a Dani. Si en cambio Ana tuviera −$0,80 y Beto +$0,80, los dos estarían al día y no habría transferencias.*

### Simplificar deudas
Se ordenan los que deben y los que cobran de mayor a menor y se van cruzando: el que más debe le paga al que más cobra, hasta que todos quedan en cero. Resultado: **como máximo N−1 transferencias**.

> **Ejemplo:** grupo de 3 (Vos, Ana, Juan), en pesos.
> 1. Vos pagás $90.000 en partes iguales: le toca $30.000 a cada uno.
> 2. Ana paga $30.000 en montos exactos: Ana $10.000, Juan $20.000.
>
> Saldos:
> - Vos: +90.000 − 30.000 = **+60.000**
> - Ana: +30.000 − 30.000 − 10.000 = **−10.000**
> - Juan: −30.000 − 20.000 = **−50.000**
>
> Suman 0. Al simplificar quedan 2 transferencias: Juan → Vos $50.000 y Ana → Vos $10.000.

> **✅ Decidido:** este método no siempre da el mínimo absoluto de transferencias, aunque nunca pasa de N−1. Se queda así.

### Impacto en tus finanzas personales
Si pagaste vos y elegiste con qué, el gasto se registra **una sola vez** y afecta tres cosas de forma distinta:

| Dónde | Cuánto cuenta |
|---|---|
| Tarjeta o cuenta | El total que pagaste (en cuotas si corresponde) |
| Gasto por categoría | Solo tu parte |
| Grupo | El resto queda como plata que te deben |

- Si pagó otro integrante, en tus finanzas no se registra nada: solo cambia tu saldo en el grupo.
- También se puede cargar un gasto de grupo eligiendo **"No sumarlo a mis finanzas"**.
- Al **registrar un pago** entre integrantes baja el saldo. Opcionalmente puede mover el saldo de una de tus cuentas (por defecto, "No mover saldos"). En la v1 Mangos solo **registra** pagos; no mueve plata (procesar pagos exige registrarse ante el BCRA).
- Un pago **nunca se edita**. Si estaba mal, cualquier integrante lo **anula** y se registra de nuevo. Los saldos no cuentan los pagos anulados (decisión del 2/10).

> **✅ Decidido** (spec de grupos en la app, 6/10):
> - **Editar un gasto de grupo:** cualquier integrante cambia la descripción, la fecha, la categoría y la división, y tu parte se recalcula sola. El **monto, la moneda y quién pagó** los cambia solo quien pagó, si tiene el gasto en sus finanzas: así nadie cambia lo que figura en tu tarjeta. Si quien pagó pasa a ser otro, el gasto sale de las finanzas de quien pagaba.
> - **Borrar un gasto de grupo:** cualquier integrante. El gasto personal de quien pagó **queda** y vuelve a contar completo en la categoría, como al eliminar el grupo. Solo el "Deshacer", justo después de cargarlo, borra los dos.
> - **Mover el saldo al registrar un pago:** solo si sos el que paga o el que cobra, con una cuenta tuya en la moneda del grupo. Si cobrás, entra como ingreso; si pagás, como un ajuste negativo. Ninguno cuenta en el gasto por categoría. Anular el pago revierte el movimiento.
> - **Gasto en otra moneda que el grupo:** se propone tu dólar de referencia (MEP por defecto) de la fecha del gasto, y se puede corregir. *Ejemplo: US$ 120 en un grupo en pesos con MEP a $1.500 → $180.000 de deuda en pesos, que no cambia si después sube el dólar.*

### Permisos

| Acción | Integrante | Dueño |
|---|---|---|
| Cargar y editar gastos, registrar pagos | Sí | Sí |
| Cambiar el nombre y sumar personas | Sí | Sí |
| Quitar a alguien | No (solo a quien sumó en la misma edición, antes de guardar) | Solo si esa persona nunca participó en un gasto ni en un pago y tiene saldo cero |
| Abandonar el grupo | Sí, si está al día | Sí, si está al día; el rol pasa al azar a otro integrante con cuenta |
| Eliminar el grupo | No | Sí, para todos, con aviso si hay saldos pendientes |

- **Salir no borra nada:** el grupo sigue para los demás con su historial. Para volver hace falta otra invitación. Tus gastos personales que vinieron del grupo siguen contando solo tu parte.
- **Eliminar un grupo:** los gastos personales que venían de ese grupo vuelven a contar completos en tu gasto por categoría.

> **✅ Decidido:** cuando el dueño abandona (estando al día), el rol de dueño pasa **al azar a otro integrante que tenga cuenta en Mangos**. Se les avisa a todos quién es el nuevo dueño. Si no queda nadie con cuenta, el grupo sigue sin dueño y nadie lo puede eliminar. En el prototipo el rol no se pasaba.

## 8. Patrimonio (inicio)

```
patrimonio = Σ saldos de cuentas (convertidos)
           + Σ inversiones (el prototipo ya las suma; en la v1 no hay inversiones)
           − Σ lo que falta pagar de cada tarjeta (saldo pendiente de resúmenes cerrados,
               incluidos vencidos, + en curso + cuotas futuras), en pesos y en dólares
           + Σ tu saldo en cada grupo (positivo o negativo)
```

Se muestra en pesos o en dólares. En la Billetera, al lado de "Patrimonio", un chip muestra la moneda actual (🇦🇷 AR$ o 🇺🇸 US$); tocarlo pasa todo el total a la otra moneda y la elección queda guardada (`display_currency`). Arranca en pesos (7/10).

> **✅ Decidido** (2/10, después del /review): cada componente se convierte **una sola vez** a la moneda en que se muestra el inicio, nunca de ida y vuelta.
> - **En pesos:** la deuda en dólares de las tarjetas, × **dólar tarjeta**; las cuentas y los saldos de grupo en dólares, × **dólar de referencia**.
> - **En dólares:** la deuda en dólares de las tarjetas va **tal cual**; todo lo que está en pesos (cuentas, grupos y la deuda en pesos de las tarjetas) se divide por el **dólar de referencia**.
>
> *Ejemplo: cuentas por $500.000 y US$ 1.000; un grupo a favor por $60.000; una tarjeta que debe $187.000 + US$ 50. Dólar tarjeta $2.028 y MEP $1.500.*
> - *En pesos: cuentas $500.000 + 1.000 × 1.500 = $2.000.000; grupos $60.000; tarjetas $187.000 + 50 × 2.028 = $288.400. Patrimonio: **$1.771.600**.*
> - *En dólares: cuentas 1.000 + 500.000 ÷ 1.500 = US$ 1.333,33; grupos 60.000 ÷ 1.500 = US$ 40; tarjetas 50 + 187.000 ÷ 1.500 = US$ 174,67. Patrimonio: **US$ 1.198,66**. Antes, la deuda de US$ 50 pasaba a pesos con el dólar tarjeta y volvía con el MEP, y figuraba como US$ 67,60.*

## 9. Alertas

| Tipo | Se dispara cuando | v1 |
|---|---|---|
| Vencimiento de tarjeta | Faltan 2 días para el vencimiento de un resumen a pagar, a las 10:00 (hora de Argentina). Configurable por tarjeta, de 1 a 5 días | Sí |
| Precio | El dólar sube o baja de un valor | Después de la beta (1/10) |
| Presupuesto | Una categoría llega al 50%, 80% o 100% de su tope | Después de la beta (1/10) |
| Cierre de tarjeta | El día de cierre de cada tarjeta, a las 20:00 (hora de Argentina) | Sí (office hours, 1/10) |
| Saldo de grupo | Alguien te carga un gasto o te salda | Fase 2 |
| Resumen semanal | Todos los lunes | Fase 2 |

- **Aviso de cierre** (office hours y recorte, 1/10):
  - Usa el cierre real si se corrigió antes de ese día.
  - Sale **una vez por tarjeta y ciclo**. Si cierran varias el mismo día, va una sola notificación.
  - Abre el detalle de la tarjeta con el campo de carga por texto.
  - Textos: "Cerró tu Visa: te vienen $187.000. ¿Te falta cargar algo?". Con dólares: "$187.000 + US$ 50".
  - Si el total es $0 y el ciclo anterior tuvo consumos: "Cerró tu Visa y no tiene consumos cargados este ciclo. ¿Te falta cargar algo?". Si tampoco tuvo, no se manda nada.
- **Aviso de vencimiento** (spec de avisos, 4/10):
  - Solo si el resumen tiene saldo pendiente. Si el aviso no salió el día que correspondía, sale igual mientras no haya vencido; el día del vencimiento ya no.
  - Texto: "Tu Visa vence el martes 6/10: quedan $80.000 por pagar.". Si vencen varias, una sola notificación: "Vencen tu Visa (martes 6/10, $80.000) y tu Master (miércoles 7/10, US$ 50).".
- **Aviso de cierre, detalles** (spec de avisos, 4/10):
  - Si cierran varias el mismo día: "Cerraron tu Visa ($187.000) y tu Master (sin consumos cargados). ¿Te falta cargar algo?".
  - Si el aviso no salió el día del cierre, sale al día siguiente: "Ayer cerró tu Visa: te vienen $187.000. ¿Te falta cargar algo?". Más tarde, no.
- **Sin configurar:** los dos avisos están prendidos y el de vencimiento sale 2 días antes. Las tarjetas archivadas no reciben avisos.
- **Canales:** notificación en la v1; mail y WhatsApp en el plan Pro.
- **No molestar:** entre la hora de inicio y la de fin, los avisos se guardan y salen al terminar.
- Las alertas **informan hechos, nunca recomiendan** comprar o vender, para no entrar en asesoramiento regulado por la CNV.

## 10. Tu cuenta y tus datos

> **✅ Decidido** (eng review, 1/10). Cumple la Ley 25.326 y lo que piden las tiendas.

- **Borrar mi cuenta** (Ajustes):
  - Borra las cuentas, tarjetas, movimientos y preferencias del usuario.
  - En cada grupo, su lugar pasa a ser un **integrante sin cuenta con el mismo nombre**, así los saldos de los demás no cambian.
  - Si era dueño de un grupo, el rol pasa al azar a otro integrante con cuenta, igual que al abandonar, aunque tenga saldo pendiente. Si no queda nadie con cuenta, el grupo queda sin dueño.
  - Solo se puede borrar habiendo ingresado el código del mail en los últimos 10 minutos; si no, la app lo vuelve a pedir (T10, 4/10).
- **Exportar mis datos:** arma un archivo JSON con todo lo del usuario. De los grupos donde está, trae lo mismo que ve en la app (nombres, gastos, partes y pagos), sin el alias ni la cuenta de los demás; de los grupos que dejó, solo el nombre y su lugar (T10, 4/10).

**Ejemplo:** Ana borra su cuenta. En "Cabaña" sigue apareciendo "Ana" con su saldo de −$10.000, ahora como integrante sin cuenta, y los demás ven las mismas transferencias en "Cómo saldar".
