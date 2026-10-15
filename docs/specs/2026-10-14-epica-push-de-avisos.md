# Épica: Push de los avisos

Estado: aprobada por Fran el 14/10/2026. P-1 a P-4 implementados y en `mangos`; P-5 (código) y P-6 implementados el 15/10. Faltan los pasos de Fran de P-5 y P-7.

## Contexto

Los avisos de cierre y de vencimiento son la razón por la que alguien vuelve a abrir Mangos ("Cerró tu Visa: te vienen $187.000. ¿Te falta cargar algo?", `docs/01` §4 y §8). Hoy se calculan y se guardan, pero nunca llegan al teléfono: solo se ven si el usuario abre Inicio. Sin el push, el aviso de cierre no cumple su función de recordarle a la gente que cargue lo que le falta, que es el mayor riesgo del producto (`docs/01`, "La regla que manda"). Es el último hueco funcional de la v1 antes de la beta.

## Estado actual (verificado el 14/10/2026)

| Pieza | Estado |
|---|---|
| `card-closing-notices` (cron `0 23 * * *` UTC, 20:00 de Argentina) | Inserta en `notifications` con `kind`, `data.card_ids` y `deliver_after` (`supabase/migrations/20261004140000_card_notices.sql:182`) |
| `card-due-notices` (cron `0 13 * * *` UTC, 10:00 de Argentina) | Igual |
| `private.notify` (avisos de grupo: se sumó, te quitaron, se eliminó, nuevo dueño) | Inserta en `notifications` solo con título y cuerpo, sin `kind` ni `data` (`supabase/migrations/20261002130000_group_functions.sql:140`) |
| `private.deliver_after(quiet_from, quiet_to, at)` | Corre la salida hasta el final del no molestar |
| `notifications.sent_at` | Existe y nadie lo escribe. En `mangos` hay 3 filas, todas sin enviar, de grupo, del 7/10 |
| `user_settings.notify_push` | Existe (default `true`) y nadie lo lee; Ajustes no lo muestra (`docs/02` §9) |
| Inicio, tocar un aviso | `markNoticeRead` y, si tiene tarjeta, `/tarjeta/[id]` (`apps/mobile/src/app/(app)/(tabs)/index.tsx:129`). La tarjeta sale de `data.card_ids` (`packages/core/src/wallet/home.ts:139`) |
| App | Sin `expo-notifications`, sin `eas.json`, sin `android.package` en `app.json`. Se prueba en Expo Go, que desde el SDK 53 no recibe push remoto en Android |
| Tokens de dispositivo | No existen |

## Decisiones tomadas en esta spec (14/10, aprobadas por Fran)

- **D1. Solo Android** en la beta: FCM por un proyecto de Firebase. iOS queda afuera. El package es `com.francobalsamo.mangos`.
- **D2. Development build de EAS** en lugar de Expo Go. Es la única forma de probar un push real.
- **D3. No se mandan los avisos viejos:** solo se mandan los que tienen `deliver_after` dentro de las últimas 24 horas. Los más viejos quedan sin push, pero siguen en Inicio. Así no llega un aluvión de avisos el día que se prende el envío, ni después de un corte largo.
- **D4. Se mandan todas las filas de `notifications`**, incluidas las de grupo. Tocar una de grupo abre Inicio. "Saldo de grupo" sigue en la fase 2.
- **D5. El permiso se pide al entrar a Inicio**, una sola vez, después de la bienvenida. Si el usuario lo niega, la app no lo vuelve a pedir por su cuenta.
- **D6. Cada aviso se manda a lo sumo una vez:** `sent_at` se marca antes de llamar a Expo. Si Expo falla, ese aviso no llega por push, pero sigue en Inicio. Nunca llega duplicado.
- **D7. Interruptor "Notificaciones" en Ajustes**, sobre `notify_push`.

## Comportamiento

### Registro del teléfono
- La primera vez que se abre Inicio con sesión (en Android, no en la web), la app pide el permiso de notificaciones. Si el usuario acepta, obtiene el token de Expo y lo guarda con `register_push_token`.
- Cada vez que la app arranca con sesión y con el permiso concedido, vuelve a registrar el token. Así el token se mantiene al día si cambió o si el teléfono pasó a otra cuenta.
- Al cerrar sesión, la app borra el token del teléfono (`unregister_push_token`) antes de `supabase.auth.signOut()`. Si no hay señal, la sesión se cierra igual: el token queda asociado hasta que otra cuenta lo registre en ese teléfono.
- Al borrar la cuenta, los tokens se borran en cascada.

### Envío
- El cron `send-push` corre cada 5 minutos. Un aviso de cierre de las 20:00 llega antes de las 20:05, y uno demorado por el no molestar hasta las 8:00 llega antes de las 8:05.
- Se manda cada fila que cumpla todo esto: `sent_at` nulo, `deliver_after <= now()`, `deliver_after > now() - 24 horas`, `notify_push` del usuario en `true` y al menos un token registrado. Va un mensaje por cada token del usuario.
- Las filas que no cumplen quedan con `sent_at` nulo. Las que se quedan sin push vencen solas cuando pasan las 24 horas.
- Si Expo responde `DeviceNotRegistered` para un token, el token se borra.
- Mensaje: `title`, `body`, `channelId: "avisos"`, `sound: "default"` y `data: { notification_id, card_ids? }`.

### Tocar el push
- La app marca el aviso como leído, igual que el tap en Inicio.
- Si `data.card_ids` trae alguna tarjeta, abre `/tarjeta/[id]` con la primera, que es el detalle con la carga por texto. Si no trae, abre Inicio.
- Funciona con la app cerrada (arranque en frío) y con la app abierta o en segundo plano.
- Con la app abierta, el push se muestra igual, como banner.

### Ajustes
- Hay una fila nueva, "Notificaciones", con un `Switch` sobre `notify_push`, en la sección de avisos y arriba de los avisos por tarjeta. Usa el mismo guardado que el resto de Ajustes, y vuelve atrás si falla.
- Si el permiso del sistema está negado, la fila muestra "Desactivadas en el teléfono" y, al tocarla, abre los ajustes del sistema (`Linking.openSettings()`).
- La fila no se muestra en la web.

## Hijas

```
P-1 Docs ──> P-2 Base ──> P-4 Edge Function + cron ──┐
        └──> P-3 Core ──┘                            ├──> P-7 Prueba en el teléfono
P-5 Build (EAS + Firebase, pasos de Fran) ──> P-6 App ┘
```

P-5 se puede hacer en paralelo desde el principio: tiene pasos manuales de Fran (cuentas) que no dependen del código.

### P-1. Docs
- `docs/02` §9: la sección "Canales" describe el push (permiso, ventana de 24 h, a lo sumo una vez, también los de grupo) y el interruptor general deja de estar "pendiente".
- `docs/03`: tabla `push_tokens`, las funciones nuevas y la frase de `notifications` sobre el envío, reemplazada por la regla real.

### P-2. Base: `supabase/migrations/20261014130000_push.sql`
```sql
create table public.push_tokens (
  token text primary key check (token ~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$' and length(token) <= 200),
  user_id uuid not null references auth.users on delete cascade,
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security; -- sin políticas: solo por las funciones
```
- `register_push_token(token text) returns void`, `security definer`, solo `authenticated`. Exige `auth.uid()`. Hace un upsert por `token`: `user_id = auth.uid()` y `updated_at = now()`. Si el token es de otra cuenta, pasa a la nueva, porque es el mismo teléfono.
- `unregister_push_token(token text) returns void`, solo `authenticated`. Borra el token si es de `auth.uid()`; si no es suyo, no hace nada.
- `claim_push_batch(max_rows int default 500)`, solo `service_role`, con `for update skip locked` para que dos corridas no tomen la misma fila. En una sola sentencia marca `sent_at = now()` en las filas que cumplen la regla de "Envío" y devuelve `(notification_id, token, title, body, data)`, con una fila por cada token.
- `drop_push_tokens(tokens text[]) returns void`, solo `service_role`.
- Cron: `select cron.schedule('send-push', '*/5 * * * *', $$select private.call_edge('send-push')$$);`.
- pgTAP `supabase/tests/24_push.test.sql`: el upsert y el cambio de dueño del token; `unregister` con el token de otro; los tokens con formato inválido; `claim` respeta `deliver_after` futuro, la ventana de 24 h, `notify_push = false`, el usuario sin token y las filas ya enviadas; un segundo `claim` no devuelve nada; dos tokens dan dos filas; `anon` y `authenticated` no pueden llamar a `claim` ni a `drop`. El test 23 ya exige el índice de `user_id`.

### P-3. Core: `packages/core/src/notices/push.ts`
- `pushMessages(rows: PushRow[]): ExpoMessage[][]`: arma los mensajes de la regla de "Envío" en tandas de 100, el máximo de Expo por pedido.
- `deadTokens(messages: ExpoMessage[], tickets: ExpoTicket[]): string[]`: devuelve los tokens con `details.error === "DeviceNotRegistered"`.
- `pushRoute(data: { card_ids?: string[] } | null)`: devuelve `{ pathname: '/tarjeta/[id]', params: { id } }` o `'/'`.
- Tests de Vitest: 0, 1, 100 y 101 filas; un ticket con error y otro `ok`; `data` nulo, vacío o con dos tarjetas.

### P-4. Edge Function `supabase/functions/send-push/index.ts`
- Usa `cronHandler` de `_shared/cron.ts`, con el secreto en Vault como las otras.
- Pasos: `claim_push_batch`, `pushMessages`, un `POST https://exp.host/--/api/v2/push/send` por tanda, `deadTokens` y `drop_push_tokens`.
- Devuelve `{ claimed, sent, failed, dropped }`. Si una tanda falla por red o por un 5xx, cuenta esos mensajes como `failed` y sigue con la próxima. No reintenta (D6).
- No consulta los recibos de Expo (`getReceipts`).
- Deploy: `npx supabase functions deploy send-push --project-ref pkhjsrknnijjygzwvtkn`.

### P-5. Build (EAS + Firebase)
Pasos de Fran:
1. Crear una cuenta de Expo y correr `npx eas login`.
2. Crear el proyecto de Firebase "Mangos" y agregarle una app Android con el package de `app.json`. Bajar `google-services.json` a `apps/mobile/`; se commitea, porque Firebase no lo considera secreto.
3. Generar en Firebase la clave de cuenta de servicio (FCM V1) y subirla con `npx eas credentials` (Android, FCM V1). Esa clave **no** va al repo.

Pasos de código:
- Agregar `expo-notifications` con `npx expo install` y sumarlo a los plugins de `app.json`, con el color del ícono de `DESIGN.md`.
- En `app.json`: `android.package`, `android.googleServicesFile` y `extra.eas.projectId` (lo escribe `eas init`).
- `eas.json` con el perfil `development` (`developmentClient: true`, `distribution: internal`, APK).
- `npx eas build --profile development --platform android`. Fran instala el APK y desde ahí `npx expo start` sirve igual que antes, pero con `--dev-client`.

### P-6. App
- `apps/mobile/src/lib/push.ts`:
  - `setupPush()`: canal `avisos` (importancia alta) y `setNotificationHandler` (banner con la app abierta).
  - `registerPush({ ask })`: pide el permiso solo si `ask` y si nunca se pidió (la marca queda en el almacenamiento local que ya usa la app), saca el token con `projectId` y llama a `register_push_token`.
  - `unregisterPush()`.
  - En la web, todas son no-op.
- Inicio: `registerPush({ ask: true })` al montar.
- `(app)/_layout.tsx`:
  - `registerPush({ ask: false })` al arrancar.
  - El listener de respuesta y `getLastNotificationResponseAsync` (arranque en frío): `markNoticeRead(notification_id)` y `router.push(pushRoute(data))`.
- `apps/mobile/src/lib/session.tsx:119`: `signOut` llama primero a `unregisterPush()` (con `catch`, no bloquea).
- `apps/mobile/src/app/(app)/ajustes.tsx`: la fila "Notificaciones" (ver "Ajustes" arriba).

### P-7. Prueba en el teléfono contra `mangos`
Insertar a mano una fila en `notifications` para la cuenta de Fran (cierre de la Bna Visa con `card_ids`) y esperar al cron. Chequear: llega, abre la tarjeta y queda leída; con el interruptor apagado no llega; después de cerrar sesión no llega; el no molestar la demora.

## Estados

| Situación | Qué pasa |
|---|---|
| Permiso negado | Sin token, sin push. Ajustes dice "Desactivadas en el teléfono" |
| `notify_push = false` | La fila no se toma; sigue en Inicio |
| Sin token (nunca abrió la app nueva) | Sin push; la fila vence a las 24 h |
| Expo caído | Esa tanda no llega (D6); el próximo cron sigue con filas nuevas |
| Token muerto (desinstaló) | Expo responde `DeviceNotRegistered` y el token se borra |
| Dos teléfonos con la misma cuenta | Llega a los dos |
| Mismo teléfono, otra cuenta | El token pasa a la cuenta nueva y la anterior deja de recibir |
| Cron corre dos veces a la vez | `skip locked` y `sent_at` evitan el duplicado |

## Criterios de aceptación

1. Una fila con `deliver_after` vencido y dentro de las 24 h llega al teléfono Android de Fran en menos de 5 minutos, con el título y el cuerpo de la fila.
2. Ninguna fila se manda dos veces, aunque el cron corra dos veces seguidas (pgTAP).
3. Las filas con `deliver_after` de más de 24 h, con `notify_push = false` o de un usuario sin token no se mandan (pgTAP).
4. Tocar el push de un cierre abre `/tarjeta/[id]` de esa tarjeta, con la app cerrada y con la app en segundo plano, y el aviso queda leído en Inicio.
5. Tocar un push de grupo abre Inicio.
6. Después de cerrar sesión, ese teléfono no recibe los avisos de esa cuenta.
7. Un token con `DeviceNotRegistered` desaparece de `push_tokens`.
8. `anon` y `authenticated` no pueden llamar a `claim_push_batch` ni a `drop_push_tokens`, ni leer `push_tokens` directamente.
9. El interruptor de Ajustes guarda `notify_push`, y con el permiso negado abre los ajustes del sistema.
10. La carga de un gasto no suma ningún paso: el permiso se pide en Inicio, no en la hoja.
11. Pasan pgTAP, Vitest y el typecheck. El advisor de seguridad no marca nada nuevo, salvo las advertencias intencionales de `security definer`.

## Testing

| Capa | Qué | Cantidad |
|---|---|---|
| pgTAP | `24_push.test.sql`: registro, ventana, notify_push, sin token, doble claim, permisos | +14 aprox. |
| Vitest | `pushMessages`, `deadTokens`, `pushRoute` | +9 aprox. |
| Teléfono | P-7 contra `mangos` | 6 chequeos |

La Edge Function no tiene test propio: es pegamento entre `claim`, core y `fetch`, y se prueba en P-7.

## Plan de vuelta atrás
- Cortar el envío: `select cron.unschedule('send-push');`. Los avisos siguen en Inicio.
- Revertir la migración: `drop table push_tokens` y las 4 funciones. `notifications` no cambia de forma.
- App: volver a Expo Go con el commit anterior. El código de push no hace nada sin un build que lo soporte.

## Esfuerzo
P-1 15 min · P-2 45 min · P-3 20 min · P-4 20 min · P-5 de código 20 min, más lo que tarden Fran y el build (unos 15 min) · P-6 45 min · P-7 30 min con Fran.

## Archivos

| Archivo | Cambio |
|---|---|
| `docs/02-reglas-de-negocio.md` §9 | Canales y push |
| `docs/03-modelo-de-datos.md` | `push_tokens`, funciones, regla de envío |
| `supabase/migrations/20261014130000_push.sql` | Tabla, 4 funciones, cron |
| `supabase/tests/24_push.test.sql` | Nuevo |
| `packages/core/src/notices/push.ts` (+ test, + export en `index.ts`) | Nuevo |
| `supabase/functions/send-push/index.ts` | Nuevo |
| `apps/mobile/app.json`, `apps/mobile/eas.json`, `apps/mobile/google-services.json`, `apps/mobile/package.json` | Build |
| `apps/mobile/src/lib/push.ts` | Nuevo |
| `apps/mobile/src/app/(app)/_layout.tsx` | Registro al arrancar y tap |
| `apps/mobile/src/app/(app)/(tabs)/index.tsx` | Pedir el permiso |
| `apps/mobile/src/lib/session.tsx:119` | Borrar el token al cerrar sesión |
| `apps/mobile/src/app/(app)/ajustes.tsx` | Fila "Notificaciones" |

## Fuera de alcance
- iOS y APNs.
- Los recibos de Expo (`getReceipts`) y los reintentos.
- Push de saldo de grupo, de precio, de presupuesto y el resumen semanal (fase 2 o después de la beta).
- Mail y WhatsApp (plan Pro).
- Publicar en Google Play: la beta se instala con el APK de EAS.
- El token de acceso de Expo ("enhanced security" del envío).
- Volver a pedir el permiso por cuenta propia si se negó.
