# /spec del push de los avisos (14/10/2026)

Spec: `docs/specs/2026-10-14-epica-push-de-avisos.md` (hijas P-1 a P-7). Aprobada por Fran.

## Decisiones
- **D1. Solo Android** en la beta, con FCM (proyecto de Firebase). El package es `com.francobalsamo.mangos`, que no se puede cambiar después de publicar. iOS queda afuera.
- **D2. Development build de EAS** en vez de Expo Go: desde el SDK 53, Expo Go no recibe push remoto en Android.
- **D3. Ventana de 24 horas:** solo se mandan las filas con `deliver_after` de menos de 24 horas. Las más viejas siguen en Inicio, sin push. Así no sale un aluvión al prender el envío.
- **D4. Se mandan todas las filas de `notifications`**, también las de grupo (se sumó, te quitaron, se eliminó, nuevo dueño). Tocar una de grupo abre Inicio.
- **D5. El permiso se pide al entrar a Inicio**, una sola vez. No se pide en la hoja de carga, para no sumarle pasos.
- **D6. A lo sumo una vez:** `claim_push_batch` marca `sent_at` antes de llamar a Expo (con `for update skip locked`). Si Expo falla, el push no llega, pero el aviso sigue en Inicio. Nunca llega duplicado.
- **D7. Interruptor "Notificaciones" en Ajustes** sobre `notify_push`. Con el permiso del sistema negado, abre los ajustes del teléfono.
- **Tokens en `push_tokens`**, con el token como clave. Si otra cuenta registra el mismo teléfono, el token pasa a esa cuenta. Al cerrar sesión se borra; al borrar la cuenta, se borra en cascada.
- **Cron `send-push` cada 5 minutos.** Un token que Expo marca `DeviceNotRegistered` se borra.

## Fuera de alcance
iOS, los recibos de Expo y los reintentos, el push de saldo de grupo, de precio, de presupuesto y el semanal, mail y WhatsApp, Google Play y el token de acceso de Expo.

## Gate de calidad
Redacción limpia (`SEMANTIC_REVIEW: clean`, sin hallazgos del regex). Codex no está instalado, así que la puntuación externa no corrió: falta esa revisión.

## Pendientes de Fran (P-5)
Una cuenta de Expo (`npx eas login`). El proyecto de Firebase con una app Android `com.francobalsamo.mangos`, su `google-services.json`, y la clave FCM V1 subida con `npx eas credentials`.
