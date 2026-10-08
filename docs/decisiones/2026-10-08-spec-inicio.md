# Spec de Inicio (8/10/2026)

Spec: `docs/specs/2026-10-08-epica-inicio.md` (hijas I-1 a I-5).

**Decisiones:**
- Inicio es la primera pestaña y la pantalla de entrada. `(tabs)/index.tsx` pasa a ser Inicio y la Billetera se muda a `(tabs)/billetera.tsx`. Orden: Inicio, Billetera, Grupos.
- El patrimonio, con su chip AR$/US$, vive solo en Inicio, con el desglose de cuentas, tarjetas y grupos. La Billetera queda con Tarjetas, Cuentas y las archivadas (02 §8 actualizado).
- Próximos vencimientos como el prototipo: los resúmenes cerrados con saldo y el resumen en curso (solo si tiene algo cargado), por vencimiento y como máximo 4.
- Gastos del mes: solo el mes en curso, con `categorySpend` (02 §6), sin presupuestos.
- Los íconos de categoría (`react-native-svg` + `CategoryIcon`, 6 glifos) entran en esta épica.
- "Cerró tu Visa" se ve desde el aviso `card_closing` hasta el vencimiento, o hasta que el resumen queda pagado. Avisos recientes: los últimos 3; tocar uno lo marca leído.
- Dólar del día: MEP, oficial, blue y tarjeta con su hora, sin variación.
- Grupos: hasta 3 con saldo, ordenados por el valor absoluto del saldo.
- Una sola carga (`loadWalletInput` + `notifications`) y una función nueva en core, `home()`. La base no cambia.

**Revisión externa:** no corrió, porque `codex` no está instalado. Tampoco se subió el issue, porque falta `gh`.
