# Revisión de diseño contra DESIGN.md (7/10/2026)

**Cómo se hizo:** 12 pantallas con datos realistas en la base local (dos tarjetas, una con banco de nombre largo; cuentas en pesos y dólares; gastos en cuotas y en dólares; un grupo de 12 integrantes con nombres largos), capturadas en la web local con Chrome headless a 390 y 320 de ancho, en claro y oscuro. Además, revisión del código: los tokens de `tokens.ts` son idénticos a los de `DESIGN.md`.

**Arreglado:**
1. `CardRow`: con pesos y dólares, el monto en una línea se comía el nombre y "·· 2337" quedaba en vertical a 320. Ahora pesos y dólares van en dos líneas.
2. "Cómo saldar": "Juan → V…" perdía a quién hay que pagarle. Los nombres usan todo el ancho (hasta dos líneas) y el monto va debajo; fila compacta.
3. "Cuotas que siguen": era texto corrido que partía mes y monto. Ahora un mes por fila y "Y N meses más".
4. Montos en texto corrido en Plex Mono (`components/Mono.tsx`): "Quedan · Pago mínimo", límite usado y disponible, "Total gastado", "tu parte". Los últimos 4 de las fichas de pago también (`Chip` con `mono`).
5. Patrimonio en 30 (`moneyHeroCompact`) en pantallas de menos de 360.
6. La pastilla de estado del resumen, centrada bajo el título.
7. Avatares de integrantes con los colores de categoría (decisión de Fran): inicial en `text` sobre `tint16(cat[i % 6])`, también en el encabezado del grupo.
8. "+ Gasto" del FAB en el tamaño de `button` (14); el campo del código usa `moneyCard`.
9. "Dólar de las 15:00" en vez de "03:00 p. m.".
10. Monograma sin "Banco" ni conectores: "Banco de la Nación Argentina" → "NA".
11. El monto propuesto lleva siempre dos decimales si tiene centavos ("244.116,90"); `amountInputText` en core, con su test.
12. "sin cuenta", "se sumó" y "se fue" van en una segunda línea, debajo del nombre.

**Pendiente:**
- Íconos de categoría en filas y fichas (`CategoryIcon`): hace falta `react-native-svg` y dibujar los 6 glifos.
- Para verificar en el teléfono (pueden ser solo de la web): etiquetas de la barra de pestañas cortadas abajo y el borde de foco del monto (negro en vez de `primary` de 2).
