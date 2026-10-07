# Mangos completo en la web, después de la beta (7/10/2026)

**Contexto:** probando el reclamo en la web se vio que la web publicada (mangos-kohl.vercel.app) contiene la app entera: con sesión, desde `/` se usa la Billetera en el navegador. `01-alcance-v1.md` definía la web como solo para invitados.

**Decisión de Fran:**
- Mangos tiene que ser web y también móvil.
- La app completa en la web va **después de la beta**. La beta sale en el teléfono, con la web de invitados.
- En una compu, **diseño de escritorio**, como la versión de escritorio del prototipo (menú lateral de 232, ancho máximo de 1040), no la pantalla del teléfono centrada.

**Qué hace falta para la web completa:**
- Diseño de escritorio en `DESIGN.md` y en las pantallas (dos disposiciones para mantener).
- Las hojas (`formSheet`) y la carga en menos de 10 segundos con teclado y mouse.
- Los avisos de cierre y vencimiento: en la web no hay notificaciones del teléfono (mail o avisos del navegador).
- La sesión guardada en el navegador: duración y cierre.

**Pendiente para la beta:** qué hacer mientras tanto con la parte de la app que ya se ve en la web (limitar la web publicada a `/g/…` o dejarla).
