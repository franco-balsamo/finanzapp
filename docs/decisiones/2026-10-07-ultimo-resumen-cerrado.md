# El último resumen cerrado aparece aunque esté vacío (7/10/2026)

**Qué pasaba:** el detalle de tarjeta armaba la lista de resúmenes solo con los que tenían consumos o pagos, más el en curso. En la prueba en el teléfono, con todo cargado en octubre, no se podía entrar a septiembre.

Eso dejaba un caso sin arreglo, aunque `02` dice que cada resumen permite corregir su cierre real: una compra del 25/9 con cierre estimado el 24/9 cae en octubre. Si el banco cerró el 26/9, hay que corregir el cierre de septiembre, que no aparecía porque estaba vacío. Desde octubre no se puede: su cierre tiene que quedar después del 24/9.

**Decisión:**
- `cardState` (core) suma siempre el período anterior al en curso, que es el último cerrado.
- Si no tiene gastos ni pagos (tampoco revertidos), su estado es `empty`: pastilla "Sin consumos" `neutral`. Un resumen en $0 con solo un pago revertido sigue siendo "Pagado", como se decidió en la spec.
- Los vacíos más viejos no se muestran.
- No cambia "A pagar", el límite ni el patrimonio: un resumen vacío no tiene saldo.

**Archivos:** `packages/core/src/cards/types.ts` y `state.ts`, la pastilla en `apps/mobile/src/app/(app)/tarjeta/[id].tsx`, 4 tests nuevos en `state.test.ts` (core: 325, todos pasan; sin el cambio falla el de septiembre vacío). `02` §3 y la spec del detalle de tarjeta actualizados.
