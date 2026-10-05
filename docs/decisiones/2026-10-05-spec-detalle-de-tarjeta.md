# /spec del detalle de tarjeta · 5 de octubre de 2026

- **Spec:** `docs/specs/2026-10-05-epica-detalle-de-tarjeta.md`. Es una épica con 6 hijas:
  - D-1: base y core;
  - D-2: detalle;
  - D-3: pagos;
  - D-4: corregir cierre, editar, favorita y archivar;
  - D-5: carga por texto de varias líneas;
  - D-6: "¿Ya lo pagaste?".
- **Gate:** revisión semántica y escaneo de datos sensibles limpios.
- **Revisión externa:** no corrió, porque `codex` no está instalado. Sin `gh`, no se abrió issue.

## Pedido

El detalle de tarjeta de 6A con todo lo que cuelga de él:
- pagos totales y parciales, con deshacer;
- corrección del cierre real;
- editar, archivar y marcar favorita;
- la carga por texto del detalle;
- la pregunta "¿Ya lo pagaste?" de los gastos cargados tarde (02 §3, R3-3 y R3-4).

## Decisiones aprobadas (todas las recomendadas)

1. **La carga por texto del detalle es de varias líneas (D1),** con vista previa por línea, fichas para completar y "Guardar N gastos". Es el ritual del cierre. El componente queda listo para sumarlo después a la hoja de carga.
2. **"¿Ya lo pagaste?" → Sí se guarda con una función de la base (D2):** `save_expense_with_payments` guarda el gasto y sus pagos en una transacción, sin duplicar si se reintenta con el mismo id. Es `security invoker`, así que las políticas por fila siguen valiendo.
3. **El límite es obligatorio, como dice 02 §3 (D3):**
   - lo exigen el formulario y un check `NOT VALID` en la base;
   - las tarjetas viejas no se revisan, pero cualquier edición obliga a cargarlo.

   Corrige lo que E3 había dejado opcional.
4. **Recuperar una tarjeta archivada (D4):**
   - toast con "Deshacer";
   - sección "Archivadas" al final de la pestaña Tarjetas, con "Se borra en N días" y "Recuperar".

   No depende de Ajustes.

## Decisiones técnicas sin pregunta

- **Favorita:** `set_favorite_card(card_id)` saca la marca anterior y pone la nueva en una transacción. Con dos updates chocaría contra el índice único parcial.
- **Pagos:** `insert` directo en `statement_payments`, una fila por moneda en un mismo `insert`.
- **Deshacer un pago:** `reverted_at = now()`. No se borra la fila.
- **Resumen que se abre:** el más urgente de "A pagar"; si no hay, el resumen en curso.
- **Gasto tarde en una tanda de varias líneas:** una sola pregunta para todas las líneas tarde. Cada línea se evalúa contra las anteriores de la misma tanda.

## Bug encontrado

`loadWalletInput` (E4) trae solo las tarjetas no archivadas, así que la deuda de una archivada dejaba de contar en el patrimonio, contra 02 §3. Se corrige en D-1: `wallet()` recibe también las archivadas y las devuelve aparte, en `archivedCards`.
