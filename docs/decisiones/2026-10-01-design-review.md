# /plan-design-review · 1 de octubre de 2026

Revisión de las pantallas de la v1, a fondo sobre la carga de gastos, la Billetera con el detalle de tarjeta y el detalle de grupo. Nota: de 2/10 a 8/10. La especificación está en [../diseno-pantallas-v1.md](../diseno-pantallas-v1.md).

Antes, `/design-consultation` creó `DESIGN.md` en la raíz del repo. Extrajo los tokens y componentes del prototipo sin cambiar la dirección visual y marcó 14 inconsistencias (I-1 a I-14).

## Qué se decidió

| # | Decisión |
|---|---|
| 1A | **Detalle de grupo:** tu saldo con +Gasto y Compartir link; después cómo saldar, los integrantes (con la marca de los que no tienen cuenta), los gastos y los pagos plegados |
| 2A | **Hoja de carga:** carga por texto plegada, monto con $/US$, medio, descripción y categoría. Fecha, grupo y cuotas van en una línea plegable, y Guardar queda fijo arriba del teclado |
| 3A | **Medio de pago con fichas:** la favorita, los 2 más usados y "Otro…", ninguna preseleccionada |
| 4A | **Categoría deducida de la descripción**, o "Otros". Las correcciones del formulario sí enseñan al parser (cambia lo que decía office hours) |
| 5A | **Billetera:** filas con miniatura del plástico. El plástico completo va en el detalle |
| 6A | **Detalle de tarjeta:** plástico, mes, "¿Te falta cargar algo?", Pagar, cuotas, consumos, límite y configuración |
| 7A | **Sin conexión:** el gasto se guarda en el teléfono y se envía después |
| 8A | **Tabla de estados** (cargando, vacío, error y contenido largo) para las tres zonas |
| 9A | **Después de guardar:** toast con el impacto del gasto y "Deshacer" durante 5 segundos |
| 10A | **Componentes nuevos en DESIGN.md:** QuickEntry, PaymentMethodChips, CardRow y Toast con acción |
| 11A | **Monto:** teclado decimal del sistema con formato en vivo y como máximo 2 decimales |
| 12A | **Accesibilidad:** toque mínimo de 44, montos en palabras para el lector de pantalla y texto agrandado con tope de 1.3 |
| 13B | **La descripción sigue siendo obligatoria** |

## Qué se descartó

- El orden del prototipo y las pestañas Gastos/Saldos en el detalle de grupo.
- El desplegable de medio de pago.
- "Supermercado" preseleccionado y la categoría vacía obligatoria.
- Los plásticos apilados o superpuestos en la Billetera.
- Bloquear el guardado sin conexión.
- Los estados genéricos.
- El toast simple.
- El teclado propio y el campo numérico sin formato.
- La descripción opcional.

## Qué quedó abierto

- **Web de invitados y pantalla de reclamo:** no tienen referencia visual. No se pudieron generar mockups (falta la clave de OpenAI y el navegador headless no arranca).
- **Inicio:** solo tuvo una pasada rápida.
- **I-1 a I-14 de DESIGN.md:** peso 600 sin cargar, escala de tamaños, radios fuera de escala, filas de lista distintas, contraste (I-6), estados que faltan, etc.
- **Plazo:** 7A, 8A y 12A suman unos 7 días al plan.
