# /spec de las primeras pantallas de la app · 5 de octubre de 2026

- **Spec:** `docs/specs/2026-10-05-epica-primeras-pantallas.md`. Es una épica con 5 hijas:
  - E1: base de la app;
  - E2: lógica de la hoja en core;
  - E3: bienvenida y altas de tarjeta y de cuenta;
  - E4: Billetera;
  - E5: hoja de carga.
- **Gate:** revisión semántica y escaneo de datos sensibles limpios, sin hallazgos.
- **Revisión externa:** no corrió, porque `codex` no está instalado. Sin `gh`, no se abrió issue.

## Pedido

La primera tanda de pantallas de `apps/mobile`:
- login por mail con código y bienvenida;
- hoja de carga de gasto (fichas de medio de pago, carga por texto, toast con "Deshacer", menos de 10 segundos);
- Billetera mínima (`CardRow`, cuentas y patrimonio).

Quedan fuera:
- detalle de tarjeta y de grupo;
- cola sin conexión (T8);
- Ajustes (T10).

## Decisiones aprobadas (todas las recomendadas)

1. **Carga por texto (D2):**
   - el parser completo de 02 §5 va en `packages/core` (`parseQuickEntry`), con tests;
   - en la hoja hay **una sola línea**, que completa el formulario y guarda con `origin = 'text'`;
   - la vista previa de varias líneas y "Guardar N gastos" quedan para la tanda siguiente.
2. **Altas (D3):**
   - alta de tarjeta de crédito y de cuenta;
   - editar, archivar y cambiar la favorita van con el detalle de tarjeta.
3. **Sin grupo en la hoja (D4).** La línea plegada muestra solo fecha y cuotas.
4. **`user_settings.onboarded_at` (D5):**
   - es una migración nueva, con su grant de update y un test pgTAP;
   - se eligió en vez de deducir la bienvenida de los datos, porque quien no tiene tarjeta la vería en cada login.
5. **Bienvenida en 3 pasos según 01 (D6):**
   - intro y objetivo;
   - dólar de referencia y moneda;
   - primera tarjeta, que es opcional.

   Las cuentas se suman desde la Billetera.
6. **Hoja de carga (D7):** `presentation: 'formSheet'` de Expo Router, con `react-native-keyboard-controller` (`KeyboardStickyView`) para dejar Guardar arriba del teclado.

## Decisiones técnicas sin pregunta (Fran no objetó)

- **Sesión:** `@supabase/supabase-js` con AsyncStorage, como en la guía de Supabase para Expo.
- **Lógica pura en core, con Vitest:**
  - `formatAmountInput` y `parseAmount`;
  - `paymentChips`;
  - `deduceCategory` y `learnableWord`;
  - `savedToastText`.

  Las pantallas se verifican a mano contra los criterios. Maestro sigue en T11.
- **Sin conexión:** Guardar falla con "Sin conexión. Probá de nuevo." y la hoja queda abierta. El UUID se genera una sola vez, al abrir la hoja, para que T8 lo reuse y para no duplicar al reintentar.
- **Mail con el código:** la plantilla por defecto de Supabase manda un link. Se cambia por una con `{{ .Token }}`, en local (`supabase/templates/`) y en `mangos`.
- **Patrimonio en la Billetera:** incluye tu saldo en grupos con `groupBalances`, aunque las pantallas de grupos no entran en esta tanda.

## Lo que se dejó afuera a sabiendas

- **"¿Ya lo pagaste?" de un gasto cargado tarde** (R3-3 y R3-4, `lateExpenseImpact`). Va con el detalle de tarjeta, que es donde están los pagos. Hasta entonces, un gasto con fecha en un resumen cerrado se guarda sin preguntar.
- La lista de movimientos con filtros en la Billetera, y editar o borrar un gasto después del toast.
