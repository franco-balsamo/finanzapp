# Spec de la lista de movimientos (8/10/2026)

Spec: `docs/specs/2026-10-08-epica-lista-de-movimientos.md` (hijas L-1 a L-5).

**Decisiones:**
- La lista es una pantalla `/movimientos`, no una pestaña. Se abre con "Ver movimientos" desde la Billetera y desde "Gastos del mes" de Inicio (con el mes en curso).
- Tocar un gasto personal abre la hoja de carga en modo editar, con "Eliminar gasto". Un gasto de grupo abre la edición de grupo que ya existe. Los ingresos, los ajustes, los pagos de grupo y los pagos de tarjetas purgadas no se editan.
- Filtros: mes (por la fecha del gasto), búsqueda y la ficha "Sin medio de pago". El total suma solo los gastos, con el monto completo y por moneda. Quedan para después los filtros por medio y por categoría y la barra de reparto.
- Completar un "Sin medio de pago": la misma hoja, con el medio vacío y obligatorio. Monto, moneda y fecha quedan bloqueados porque copian el gasto del grupo. Sigue con `origin = claim`.
- Editar un gasto de tarjeta calcula "¿Ya lo pagaste?" sin el propio gasto: solo se pregunta por la diferencia.
- Borrar un gasto no toca ningún pago y pide confirmación, sin "Deshacer".
- Función nueva en la base, `update_expense_with_payments`, porque `save_expense_with_payments` no edita.
- Antes de implementar, se escriben en `docs/02` §5 las reglas de editar y borrar (L-1).

**Revisión externa:** no corrió, porque `codex` no está instalado. Tampoco se subió el issue, porque falta `gh`.
