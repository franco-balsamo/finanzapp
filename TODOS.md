# Pendientes

## Después de la beta (recortados de la v1 el 1/10/2026)

Salieron para que la beta entre en 3 meses con una sola persona. Ninguno ayuda a responder las dos preguntas de la beta: si la gente sigue cargando y si los grupos traen gente nueva. Detalle en `docs/decisiones/2026-10-01-ceo-review.md`.

- [ ] **Datos de ejemplo ("Ver como usuario nuevo").** Los de la beta cargan sus propias tarjetas desde el día 1. Retomar para el lanzamiento público.
- [ ] **Login con Google y Apple.** En la beta queda solo mail con código. Si se suma Google, en iOS hay que sumar también Apple (regla 4.8 de la App Store).
- [ ] **Tarjetas de débito y prepagas como tipo propio, con su pantalla de detalle.** En la beta, pagar con débito es pagar desde la cuenta.
- [ ] **Carrusel de tarjetas.** En la beta, lista simple. La favorita se mantiene.
- [ ] **Adjuntar comprobante como imagen.** Necesita guardar archivos y revisar la privacidad. Va junto con la lectura automática (fase 2).
- [ ] **Categorías editables (nombre e ícono).** En la beta, 6 categorías fijas. El parser aprende de las correcciones.
- [ ] **"Dato del ciclo" en el aviso de cierre.** Las reglas ya están definidas en el documento de diseño de office hours.
- [ ] **Código de reclamo de 6 caracteres** para cuando se pierde el link al instalar. En la beta, el lugar se reclama solo desde el link.
- [ ] **Pantalla propia "Cerró tu tarjeta".** En la beta, la notificación abre el detalle de la tarjeta de crédito con el campo de texto.
- [ ] **Carga de gastos desde la web de invitados.** En la beta, la web es de solo lectura y los gastos los cargan los integrantes con la app.

## Después de la beta (eng review del 1/10/2026)

- [ ] **Ocultar montos en las notificaciones.**
  - **Qué:** sumar en Ajustes el interruptor "Ocultar montos en las notificaciones". Con la opción activa, el aviso dice "Cerró tu Visa. Tocá para ver cuánto te viene".
  - **Por qué:** con el teléfono bloqueado, el aviso de cierre y el de vencimiento muestran cuánto debe la persona a cualquiera que esté cerca.
  - **Contexto:** el texto con monto se aprobó en office hours porque es el motivo para volver. Conviene sumarlo si alguien de la beta lo pide. Lleva ~medio día.
