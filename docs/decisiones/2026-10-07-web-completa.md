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

**Mientras tanto (decidido el mismo día):** la web publicada es solo la de invitados. En `_layout.tsx`, con `Platform.OS === 'web' && !__DEV__`, las pantallas de la app quedan protegidas y cualquier otra dirección lleva a `instala` ("Mangos está en el teléfono"). `/g/…` y el reclamo siguen igual. En desarrollo (`npx expo start --web`) la app completa sigue andando en el navegador. Cuando se haga la web completa, se saca `GUEST_WEB_ONLY`.

Probado con el export estático contra la base local: `/`, `/ingresar`, `/grupos` y `/bienvenida` llevan a `/instala`; `/g/<token>` muestra el grupo y el reclamo con mail y código sigue en la página. Las direcciones con id (`/grupo/<id>`) o desconocidas dan 404, porque no hay archivo para ellas.
