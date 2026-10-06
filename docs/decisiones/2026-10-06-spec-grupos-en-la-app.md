# /spec de grupos en la app · 6 de octubre de 2026

- **Spec:** `docs/specs/2026-10-06-epica-grupos-en-la-app.md`. Es una épica con 7 hijas:
  - G-1: base (gasto con movimiento, borrar gasto, pagos con cuenta);
  - G-2: core (`groupDetail`, `groupList`);
  - G-3: pestañas, lista y crear grupo;
  - G-4: detalle de grupo;
  - G-5: gasto de grupo en la hoja de carga;
  - G-6: registrar y anular pagos;
  - G-7: editar, abandonar y eliminar.
- **Gate:** revisión semántica y escaneo de datos sensibles limpios.
- **Revisión externa:** no corrió, porque `codex` no está instalado. Sin `gh`, no se abrió issue.

## Pedido

La pantalla del detalle de grupo. Como la app no tenía nada de grupos (ni lista ni forma de crear uno), la tanda suma todo lo necesario para usar un grupo de punta a punta, salvo la web de invitados.

## Decisiones de Fran

1. **Alcance (D1):** la app de grupos completa sin la web. La web de invitados, "Compartir link", el reclamo y deshacer un reclamo van en la tanda siguiente.
2. **Navegación (D2):** `(tabs)` ahora, con Billetera y Grupos, como había quedado dicho en E4.
3. **Gasto que pagaste vos (D3):** función nueva `save_group_expense_with_movement`, que guarda gasto de grupo, partes y tu movimiento en una transacción.
4. **"Grupo" en la hoja de carga (D4):** entra en esta tanda (Fran eligió esto en lugar de la opción recomendada). Va en la línea plegada, sin preselección, así la carga común no suma pasos.
5. **Editar un gasto de grupo (D5):** cualquiera edita descripción, fecha, categoría y división, y tu parte se recalcula. El monto, la moneda y quién pagó los cambia solo quien pagó, si tiene el gasto en sus finanzas.
6. **Borrar un gasto de grupo (D6):** el gasto personal de quien pagó pierde el vínculo y vuelve a contar completo, como al eliminar un grupo. El "Deshacer" del toast borra los dos.
7. **Pago que mueve una cuenta (D7):** entra en esta tanda (Fran eligió esto en lugar de la opción recomendada). Es opcional y "No mover saldos" va por defecto; anular el pago revierte el movimiento.
8. **Cotización de un gasto en otra moneda (D8):** tu dólar de referencia de la fecha del gasto, editable.

## Decisiones técnicas sin pregunta

- **Pagos con cuenta:** si cobrás, el movimiento es `income`; si pagás, `adjustment` negativo. Así no cuentan en el gasto por categoría. Se vinculan con la columna nueva `movements.group_payment_id`. Solo se ofrece si sos el que paga o el que cobra.
- **Escrituras de grupo solo por funciones:** se revocan `update (deleted_at)` en `group_expenses` e `insert` en `group_payments`, porque si no, la regla de D5 y los vínculos se podrían saltear.
- **Cambiar quién pagó:** si pasa a ser otro (solo lo puede hacer quien pagaba), se borra su gasto personal, porque deja de ser una compra suya.
- **Un solo formulario:** el gasto de grupo usa `cargar.tsx`; desde el detalle abre con `groupId`.
- **Fichas de grupo en la hoja:** los 3 grupos con actividad más reciente y "Otro…".
- **Fuera de alcance:** un gasto que pagó otro integrante con cuenta no entra en sus finanzas si lo cargó otra persona.
