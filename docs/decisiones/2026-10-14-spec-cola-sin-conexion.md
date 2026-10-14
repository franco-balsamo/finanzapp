# Spec de la cola sin conexión (14/10/2026)

Spec: `docs/specs/2026-10-14-epica-cola-sin-conexion.md` (hijas C-1 a C-5). Es T5 de `docs/diseno-pantallas-v1.md` y la decisión 7A.

**Decisiones:**
- La hoja abre sin señal: `loadEntryContext` guarda en el teléfono lo último que trajo y lo usa si la red falla. La fecha de hoy se recalcula al abrir.
- Los gastos sin enviar se ven en una sección "Sin enviar" arriba de `/movimientos` y en una fila "N gastos sin enviar" de Inicio, aunque esas pantallas estén en error. No suman a saldos, resúmenes ni patrimonio hasta llegar a la base.
- Solo entran en la cola los gastos personales nuevos, desde la hoja y desde la carga por texto. Editar, borrar, los grupos, los pagos y los ajustes siguen pidiendo señal.
- Reintento sin dependencias nuevas: al abrir la app, al iniciar sesión, al volver al primer plano, cada 30 s mientras haya pendientes y después de cada guardado que salió bien.
- "¿Ya lo pagaste?" no se pregunta sin señal: el gasto llega como si se hubiera contestado "No" y el resumen queda en "Pago parcial" o "Vencido". Va a 02 §3.
- Sin señal no se propone lo descontado de una cuenta en otra moneda. En la hoja, se escribe; en la carga por texto, la línea queda en el campo, como hoy.
- Quedan pendientes los errores de red, los 5xx y los 401. Los demás 4xx pasan a "No se pudo guardar", con Reintentar y Editar. `23505` cuenta como enviado.
- Hay una cola por usuario en AsyncStorage (`mangos.pending.<userId>`). Cerrar sesión no la borra; borrar la cuenta, sí.
- El "Deshacer" del toast saca el gasto de la cola, o lo borra de la base si ya llegó.
- La categoría aprendida no se encola.
- No hay cambios en la base.

**Revisión externa:** no corrió, porque `codex` no está instalado. Tampoco se subió el issue, porque falta `gh`. El escáner de redacción de gstack no está instalado; la revisión de contenido a mano dio limpia.
