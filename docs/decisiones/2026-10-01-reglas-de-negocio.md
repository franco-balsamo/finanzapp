# Decisiones sobre reglas de negocio · 1 de octubre de 2026

Respuestas de Fran a los pendientes de `02-reglas-de-negocio.md`. Ya están aplicadas en `02-reglas-de-negocio.md` y `03-modelo-de-datos.md`.

| Tema | Decisión |
|---|---|
| Cotización por movimiento | Cada movimiento guarda MEP, oficial y blue del día. |
| Saldo de cuentas | Se calcula a partir de los movimientos; se suma el ajuste manual como movimiento. |
| Cierre real del resumen | Cada resumen permite corregir su fecha real de cierre y vencimiento. |
| Días 29 a 31 | Se permiten; en meses cortos, último día del mes. |
| Conversión de dólares de tarjeta | Todo lo de tarjeta usa el dólar tarjeta. |
| Pago parcial | El usuario paga lo que quiera; lo que no pagó sigue figurando como deuda. |
| Resúmenes vencidos | Siguen contando como deuda hasta que se paguen. |
| Deshacer un pago | La plata vuelve a la cuenta de la que salió. |
| Eliminar tarjeta de crédito | Se archiva 7 días; si no se desarchiva, se borra definitivamente. |
| Cuotas en el presupuesto | Una cuota en el mes de cierre de cada resumen. |
| Simplificar deudas | Se queda el método actual (máximo N−1 transferencias). |
| Dueño que abandona un grupo | El rol pasa al azar a otro integrante con cuenta. |

## Consecuencias a tener en cuenta

- **Intereses:** con pagos parciales, el banco cobra intereses sobre el saldo que se arrastra. En la v1 Mangos no los calcula: muestra el saldo pendiente registrado. El usuario puede sumar los intereses como un consumo más cuando le llega el resumen.
- **Borrado a los 7 días:** al borrarse la tarjeta se borran sus consumos, así que los presupuestos de meses pasados cambian. Se avisa al archivar.
- **Grupos sin integrantes con cuenta:** si el dueño se va y nadie más tiene cuenta, el grupo queda sin dueño y nadie lo puede eliminar.
- **Prototipo:** estas reglas todavía no están en `prototipo/mangos.html`.
