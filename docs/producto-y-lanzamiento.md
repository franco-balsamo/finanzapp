# Mangos: producto y lanzamiento

Copia en Markdown del documento de producto (27 de septiembre de 2026), para que esté dentro del repositorio. El original vive como documento en Claude; si cambia allá, actualizar esta copia.

## Resumen

Mangos es una app para que cualquier persona en Argentina vea toda su plata en un solo lugar: cuentas en pesos y en dólares, tarjetas con sus cuotas, inversiones, gastos compartidos con otras personas y el dólar del día.

**Propuesta de valor:** saber cuánto tenés, cuánto vas a pagar y cuánto te deben, en pesos o en dólares, sin planillas.

El prototipo visual cubre Inicio, Billetera (tarjetas y cuentas), Grupos, Inversiones, Mercado, Alertas, Ajustes y la bienvenida. El nombre es provisorio.

## Usuarios y problemas

El usuario principal es una persona de 22 a 40 años con sueldo en pesos, que ahorra en dólares y usa tarjetas en cuotas. Los grupos compartidos suman un segundo motivo de uso y son la puerta de entrada para nuevos usuarios.

| Perfil | Situación | Qué le duele | Qué resuelve Mangos |
|---|---|---|---|
| Profesional joven | Sueldo en pesos, 2 o 3 tarjetas, Mercado Pago, algo de dólares | No sabe cuánto le viene de tarjeta ni cuántas cuotas arrastra | Resumen por tarjeta con cuotas futuras y vencimientos |
| Ahorrista en dólares | Pesos para gastos, dólares para ahorro, en varios lugares | No tiene una cifra única de patrimonio con el dólar que usa | Patrimonio en pesos o dólares con MEP, oficial o blue |
| Pareja o convivientes | Comparten alquiler, súper y servicios | Discusiones y cuentas a mano sobre quién pagó qué | Grupo compartido con saldos claros |
| Grupo de amigos o viaje | Asado, vacaciones, regalos | Planillas, gastos en dos monedas, deudas que nadie salda | Grupo con monedas mezcladas y liquidación en pocas transferencias |
| Inversor principiante | CEDEARs, fondos, algo de cripto | Cada cosa en una app distinta, sin resultado en dólares | Cartera unificada con resultado en USD y alertas |

## Lógica de producto

El detalle con ejemplos está en [02-reglas-de-negocio.md](02-reglas-de-negocio.md). En resumen:

- **Multimoneda:** cada movimiento se guarda en su moneda original junto con la cotización del día. Los totales de hoy usan la cotización actual; los reportes históricos, la del día de cada movimiento. Comprar dólares es una transferencia, no un gasto.
- **Cuentas:** banco, billetera virtual o efectivo, con una sola moneda cada una. Los ajustes manuales del saldo quedan registrados.
- **Tarjetas:** cierre, vencimiento y límite; cada resumen permite corregir la fecha real de cierre. Las cuotas se reparten entre resúmenes. Los dólares van aparte y se pagan con el dólar tarjeta si se pagan en pesos. Estados del resumen: en curso, a pagar, pagado, vencido. El límite usado incluye las cuotas futuras.
- **Presupuestos** *(fuera de la v1; queda el gasto por categoría)*: monto mensual opcional por categoría; una compra en cuotas cuenta una cuota por mes; avisos al 80% y al 100%.
- **Inversiones:** cantidad, costo en USD y ratio de los CEDEARs. Con precio de API se calcula solo; fondos y plazos fijos se cargan a mano. El resultado se muestra en dólares.
- **Mercado:** dólar con DolarApi; históricos, riesgo país e inflación con ArgentinaDatos; acciones de EE.UU. y noticias con Finnhub. El backend consulta cada 5 a 15 minutos y las apps leen del backend.
- **Alertas:** precio, vencimiento de tarjeta, presupuesto, saldo de grupo y resumen semanal. Canales: notificación, mail y WhatsApp. Con "no molestar", los avisos salen a la mañana. Informan hechos, nunca recomiendan.

## Grupos compartidos

Los grupos dividen gastos entre personas, como Sesterce o Splitwise, con una diferencia: **cada gasto de grupo también impacta en tus finanzas personales, sin cargarlo dos veces**. La tarjeta refleja lo que pagaste, el presupuesto solo tu parte y el resto queda como plata que te deben.

Reglas, permisos y ejemplos en [02-reglas-de-negocio.md](02-reglas-de-negocio.md) §7.

**Por qué suma al producto:** cada grupo invita a personas que todavía no usan la app. Es el canal de crecimiento más barato: quien entra por un grupo ya conoce la app cuando quiere ordenar sus propias finanzas.

## Competencia y diferencial

| App | Qué hace bien | Qué le falta frente a Mangos |
|---|---|---|
| Sesterce | Gastos compartidos gratis, sin cuenta, sin conexión, conversión de monedas | No conecta con tus finanzas personales ni tarjetas |
| Splitwise | El estándar mundial de gastos compartidos | Límite diario en el plan gratis, publicidad, monedas solo en Pro (USD 4,99/mes) |
| Finy | Más de 40 monedas, carga por voz, foto e IA, importa PDF, espacios compartidos, sincroniza con Mercado Pago | Sin inversiones; plan gratis de 100 movimientos por mes |
| Ábaco | Pesos, dólares y blue, tarjetas, gratis | No menciona inversiones ni gastos compartidos |
| Mercado Pago, Ualá, Brubank | Ven sus propias cuentas e inversiones | Solo muestran lo suyo |
| Excel o Google Sheets | Flexible y gratis | Todo manual, sin avisos ni cotizaciones |

**Dónde se diferencia Mangos:**
1. **Tarjetas exactas:** resumen por fecha de cierre real, cuotas futuras, dólar tarjeta y límite usado.
2. **Grupos integrados:** un gasto de grupo actualiza tu tarjeta, tu presupuesto y tu saldo a la vez.
3. **Patrimonio en dólares con inversiones**, con el dólar que elijas.
4. **Aviso de cierre de cada tarjeta**, con lo que te viene y lo que falta cargar. La alerta del dólar salió de la v1.

Finy es el competidor más cercano. Lo que se aprendió (office hours, 1/10): no maneja cuotas; carga por foto, voz y PDF; plan gratis de 100 movimientos por mes. Hay que probarlo a fondo antes de cerrar el alcance, sobre todo su importación de PDF y la sincronización con Mercado Pago.

## Modelo de negocio

Freemium. Los grupos compartidos **nunca se limitan**, porque son el canal de crecimiento.

| | Gratis | Pro |
|---|---|---|
| Cuentas y efectivo | Ilimitadas | Ilimitadas |
| Tarjetas | Hasta 2 *(propuesta de office hours: sacar el tope; se decide antes de la fase 2)* | Ilimitadas |
| Grupos compartidos | Ilimitados, sin tope de gastos | Ilimitados |
| Cotizaciones y noticias | Sí | Sí |
| Alertas | 3, por notificación | Ilimitadas, con mail y WhatsApp |
| Inversiones | Carga manual | Precios automáticos y resultado en USD |
| Importar resúmenes en PDF | No | Sí |
| Reportes históricos y exportar | No | Sí |

- **Precio a validar:** alrededor de USD 3 por mes cobrado en pesos, con 14 días de prueba. Mercado Pago en la web, Apple y Google en el celular.
- **Costos principales:** servidor y base de datos, WhatsApp (solo Pro), APIs de mercado, comisiones de las tiendas y marketing.
- **Más adelante:** referidos con brokers o bancos, con aviso claro y revisión legal (CNV).

## Fases de producto

Cada fase empieza solo si la anterior cumple su meta.

| Fase | Duración estimada | Qué incluye | Pasa a la siguiente si |
|---|---|---|---|
| 0 · Validación | 4 a 6 semanas, sin código de producto | Landing con lista de espera y prototipo navegable; 20 entrevistas; probar Finy, Ábaco y Sesterce; investigar la API de Mercado Pago (2 horas como máximo) | 300 personas en la lista y 7 de cada 10 entrevistados usan cuotas o comparten gastos |
| 1 · MVP en beta cerrada | unos 3 meses | Ver [01-alcance-v1.md](01-alcance-v1.md) | De 100 usuarios, 40% activos en el ciclo en su 2.º ciclo de tarjeta (≈ semana 4 a 6) |
| 2 · Lanzamiento y plan Pro | unos 3 meses | Inversiones con precio automático, PDF, lectura de comprobantes con cupo, grupos sin conexión y en dos monedas, mail y WhatsApp, suscripción | 3 de cada 100 activos pagan Pro |
| 3 · Crecimiento | desde el mes 9 | Mercado Pago, carga por voz, referidos, reportes, acuerdos con brokers | — |

## Fases de marketing

| Fase | Objetivo | Canales | Acciones | Meta |
|---|---|---|---|---|
| 0 · Validación | Probar que el dolor existe | TikTok, Instagram, X, landing | Videos cortos sobre dolores reales; calculadora web gratis de cuotas y dólar tarjeta que capte mails; contar el desarrollo en X | 300 en la lista de espera |
| 1 · Beta cerrada | Retención y aprendizaje | Lista de espera, grupos | Invitar en tandas de 25; quien arma un grupo pasa primero; charla semanal con usuarios | 40% activo en la semana 4 |
| 2 · Lanzamiento | Usuarios y primeros pagos | Tiendas, prensa, creadores, buscadores | Ficha de tienda con "controlar gastos", "dividir gastos", "cuotas"; notas en medios; creadores chicos; guías web | 3% paga Pro |
| 3 · Crecimiento | Crecer con costo bajo | Referidos, contenido recurrente | Un mes de Pro por amigo; posteo semanal del dólar; creadores de viajes | Crecimiento sin pauta |

**Momentos del año:** enero y febrero (viajes en grupo), Hot Sale y Cyber Monday (cuotas), junio y diciembre (aguinaldo), cada salto del dólar.

**Mensaje:** hablar del dolor concreto: "Sabé cuánto te viene de tarjeta antes de que llegue el resumen", "Dividan el asado sin planillas". Nunca prometer rendimientos ni decir qué comprar.

## Métricas

| Métrica | Definición | Meta de la beta |
|---|---|---|
| **Principal: activo en el ciclo** | El usuario carga al menos un gasto de tarjeta **entre el aviso de cierre y el vencimiento** de ese resumen | 40% en el 2.º ciclo de cada usuario (≈ semana 4 a 6) |
| Secundaria: semana activa | Al menos 1 movimiento cargado en la semana | Para ver el hábito diario, sin bloquear |
| Grupos | % de invitados que reclaman su lugar | Sin meta en la beta; se mide |

Reemplaza a "3 movimientos por semana" como métrica central, porque mide el ritual del cierre que eligió office hours (revisión del 2/10, R3-10).
- **El dato más importante de los grupos:** cuántos invitados terminan usando la app para sus propias finanzas.

## Riesgos

| Riesgo | Qué hacer |
|---|---|
| Abandono por carga manual | Carga en tres toques, recordatorio diario opcional, PDF en Pro, voz y foto en la fase 3 |
| Competencia de Finy y otras apps locales | Probarlas en la fase 0 y concentrar el mensaje en tarjetas exactas y grupos integrados |
| Datos financieros sensibles | Cifrado, login seguro y cumplir la Ley 25.326 de protección de datos personales (registro de la base). Consultar con un abogado antes de la beta |
| Recomendar inversiones | Las alertas informan hechos y nunca dicen qué comprar (CNV) |
| Mover plata entre usuarios | En el MVP solo se registran pagos; procesarlos exige registrarse ante el BCRA |
| APIs gratuitas sin garantía | Guardar cotizaciones en el backend y tener una fuente de respaldo |
| Tiempo del proyecto | Cumplir las metas de cada fase antes de sumar alcance |

## Decisiones abiertas

- [ ] Nombre definitivo y dominio
- [ ] Precio final del plan Pro
- [x] Invitados de grupos: web de solo lectura con reclamo del lugar al instalar (1/10)
- [x] Backend: Supabase (1/10)
- [x] Miembros sin cuenta: integrantes provisorios (1/10)

## Fuentes

- [Sesterce en Google Play](https://play.google.com/store/apps/details?id=io.sesterce.androidapp)
- [Límites del plan gratis de Splitwise – Dolio](https://dolio.org/compare/splitwise-free-plan-limits)
- [Guía de apps de gastos en Argentina – Finy](https://www.finyapp.io/guias/mejor-app-de-gastos-argentina) (escrita por Finy)
- [Mejores apps de finanzas personales en Argentina – Focus·Folio](https://focusfolio.com.ar/mejores-apps-finanzas-personales-argentina)
- [DolarApi](https://dolarapi.com/docs/) y [ArgentinaDatos](https://argentinadatos.com/docs/operations/get-cotizaciones-dolares)
