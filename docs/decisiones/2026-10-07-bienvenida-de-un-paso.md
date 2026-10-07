# Bienvenida de un paso (7/10/2026)

**Decisión:** la bienvenida pasa de 3 pasos a 1: el dólar de referencia. Se sacan "¿Para qué la vas a usar más?" y "¿Usás tarjeta de crédito?".

**Por qué se saca el objetivo:**
- `user_settings.goal` se guardaba pero ningún código lo leía: la respuesta no cambiaba nada.
- Era de una sola opción y en la prueba en el teléfono Fran quiso elegir varias.
- "Invertir" prometía cartera y alertas, que son de la fase 2.

**Por qué se saca la tarjeta:**
- Ahí se cargaba una sola; quien usa varias igual tenía que ir a la Billetera.
- El formulario es largo y saltearlo no era obvio ("Dejá todo vacío y tocá Listo").
- Al terminar la bienvenida se entra a la Billetera, que abre en Tarjetas y, sin tarjetas, ya muestra "Sumá tu primera tarjeta de crédito para saber cuánto te viene" con "Sumar tarjeta". Ese es el empujón.
- El permiso de notificaciones se sigue pidiendo al cargar la primera tarjeta, en el alta.

**Moneda del patrimonio (mismo día):** sale de la bienvenida y pasa a la Billetera, como en Cocos. Un chip al lado de "Patrimonio" muestra 🇦🇷 AR$ o 🇺🇸 US$ y al tocarlo pasa todo el total a la otra moneda. El cambio es instantáneo: se recalcula con las filas ya cargadas y `display_currency` se guarda de fondo (si falla, vuelve atrás con un toast). Arranca en pesos.

**Qué cambia:**
- `apps/mobile/src/app/bienvenida.tsx`: una sola pantalla con el dólar, sin barra de pasos, con "Listo".
- `apps/mobile/src/app/(app)/(tabs)/index.tsx`: el chip de moneda; `lib/wallet.ts` pierde `loadWallet`, que quedó sin uso.
- `apps/mobile/src/lib/session.tsx`: `goal` sale de `UserSettings` y del select.
- La columna `goal` queda en la base (sin migración). Si vuelve en la fase 2, se decide si es una lista.
- Se pierde el texto de intro "Toda tu plata en un solo lugar".
- `01-alcance-v1.md`, `02-reglas-de-negocio.md` §8, `03-modelo-de-datos.md` y `DESIGN.md` actualizados.

Deja sin efecto D6 de `specs/2026-10-05-epica-primeras-pantallas.md`.
