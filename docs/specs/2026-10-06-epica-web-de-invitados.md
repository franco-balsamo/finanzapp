---
spec_kind: epic
status: approved
date: 2026-10-06
---

# Épica: web de invitados, link del grupo y reclamo del lugar

## Contexto

Los grupos ya andan en la app, pero solo entre personas que tienen Mangos. Para sumar a un amigo hoy hay que crearlo como provisorio y no hay forma de que él vea el grupo ni tome su lugar. La web de invitados es la puerta de entrada (02 §7 y 01-alcance §6): el amigo abre el link por WhatsApp, ve los gastos y los saldos sin instalar nada, elige "soy Juan" y queda vinculado. También es la métrica del grupo: % de invitados que reclaman su lugar.

Esta épica agrega:
- guardar el link para que cualquier integrante lo vuelva a compartir (D2);
- publicar la web en Vercel (D1);
- la web de solo lectura en `/g/[token]`;
- "Compartir link" en el detalle y regenerar o revocar desde "Editar grupo";
- reclamar el lugar en la web, con el código por mail (D3);
- deshacer un reclamo desde la app, dentro de los 7 días.

## Estado actual (verificado el 6/10/2026)

| Pieza | Estado | Dónde |
|---|---|---|
| Página `/g/[token]` | Placeholder de 14 líneas: muestra el token y las monedas | `apps/mobile/src/app/g/[token].tsx` |
| Acceso sin sesión | `g/[token]` está fuera de los `Stack.Protected` | `apps/mobile/src/app/_layout.tsx:56-66` |
| Datos para la web | `get_guest_group(token)` (anon y authenticated): nombre, moneda, integrantes con `has_account` y `active`, gastos no borrados con partes y pagos no anulados. Nunca el alias ni `user_id` | `group_functions.sql:395`, grant en `schema_v1.sql:555` |
| Link | `rotate_invite_token(gid)` devuelve el token **una sola vez** y guarda solo su SHA-256; `revoke_invite_token(gid)` lo borra. Cualquier integrante | `group_functions.sql:364-391` |
| Reclamo | `claim_member(token, member_id)`: lugar provisorio y activo, quien reclama no es integrante activo; crea los "Sin medio de pago" (`origin = claim`) y avisa | `group_functions.sql:184` |
| Deshacer | `undo_claim(member_id)`: dueño o quien reclamó, 7 días | `group_functions.sql:245` |
| Login | Código por mail: `signInWithOtp` y `verifyOtp({ type: 'email' })` | `apps/mobile/src/app/(auth)/ingresar.tsx`, `codigo.tsx` |
| Web | `"output": "static"` y `scheme: "mangos"`; `npx expo export --platform web` exporta `/g/[token]`. No está publicada | `apps/mobile/app.json` |
| Mail con código en `mangos` | **Pendiente de Fran**: sin la plantilla `supabase/templates/codigo.html`, `mangos` manda un link y no un código | `estado-y-proximos-pasos.md` |

## Decisiones tomadas en esta spec

| # | Decisión | Elección |
|---|---|---|
| D1 | Hosting | **Vercel** (plan Hobby, gratis), export estático de `apps/mobile`. Los links se arman con `EXPO_PUBLIC_WEB_URL`; el dominio se suma después cambiando esa variable |
| D2 | Volver a mostrar el link | La base **guarda el token** (`groups.invite_token`) y los integrantes lo leen como el resto del grupo (RLS). La búsqueda sigue por la huella |
| D3 | Dónde se reclama | **En la web**, con el mismo login por código. Después, "Instalá Mangos y entrá con este mail" |
| D4 | Completar los "Sin medio de pago" | **Después**, con la lista de movimientos. En esta tanda cuentan en la categoría sin medio |
| — | Compartir | La hoja de compartir del sistema (`Share` de react-native) con "Mirá los gastos de Cabaña en Mangos: <link>". En la web, `navigator.share` o copiar |
| — | Regenerar y revocar | En "Editar grupo", con confirmación: "El link anterior deja de andar." |
| — | Link inválido o revocado | "Este link ya no funciona. Pedile uno nuevo a alguien del grupo." |

## Hijas

| # | Título | Prioridad | Esfuerzo (vos solo / CC) | Depende de |
|---|---|---|---|---|
| W-1 | Base y core: `invite_token` guardado y la vista del invitado | Crítica | ~0,5 día / ~1 h | — |
| W-2 | Publicar la web en Vercel | Crítica | ~0,5 día / ~30 min | — |
| W-3 | Web de invitados (lectura) | Crítica | ~1 día / ~2 h | W-1 |
| W-4 | Compartir, regenerar y revocar el link | Alta | ~0,5 día / ~1 h | W-1, W-2 |
| W-5 | Reclamar el lugar en la web | Alta | ~1 día / ~1,5 h | W-3 |
| W-6 | Deshacer un reclamo en la app | Media | ~0,5 día / ~45 min | W-5 |

```
W-1 Base y core ──┬──> W-3 Web (lectura) ──> W-5 Reclamo ──> W-6 Deshacer
                  └──> W-4 Compartir ◄── W-2 Vercel
```

**Por qué este orden:** W-1 va primero porque la migración se aplica aparte en `mangos` y la web usa la vista de core. W-2 es independiente, pero W-4 necesita la URL pública para armar el link. El reclamo (W-5) vive en la página de W-3, y deshacer (W-6) solo se puede probar con un lugar reclamado.

---

### W-1. Base y core

**Migración `supabase/migrations/20261007120000_invite_token.sql`:**

```sql
-- D2: el link se guarda para que cualquier integrante lo vuelva a compartir. Lo leen solo los
-- integrantes (RLS de groups); get_guest_group y claim_member siguen buscando por la huella.
alter table public.groups add column invite_token text;

create or replace function public.rotate_invite_token(gid uuid) returns text …
  -- igual que hoy, más: set invite_token = token
create or replace function public.revoke_invite_token(gid uuid) returns void …
  -- igual que hoy, más: set invite_token = null
```

- `delete_group` ya pone `invite_token_hash` en nulo: suma `invite_token = null`.
- `group_snapshot` (exportar y web) no incluye la columna: verificarlo con un test.
- Los grupos que ya tenían link (sin `invite_token`) muestran "Crear link" en vez de "Compartir link".

**Tests pgTAP** en `supabase/tests/16_invite_token.test.sql` (+6):
- `rotate_invite_token` deja `invite_token` igual al token devuelto, y la huella coincide;
- un integrante lee `invite_token`; alguien de afuera no ve la fila;
- `revoke_invite_token` y `delete_group` lo ponen en nulo;
- `get_guest_group` y `export_account` no lo devuelven.

**Core** (`packages/core/src/wallet/groups.ts`): `guestGroupDetail(json)` pasa la respuesta de `get_guest_group` a `GroupDetail`, sin lugar propio (`isMe` siempre false, `myBalance` en cero, `isOwner` false). `isProvisional` sale de `!has_account`. Así la web usa los mismos saldos y "Cómo saldar" que la app.

**Implementado el 7/10.**
- Migración `20261007120000_invite_token.sql`, aplicada en `mangos`. Solo se redefine `rotate_invite_token`: un trigger (`groups_clear_invite_token`) borra el token cuando la huella queda en nulo, así `revoke_invite_token` y `delete_group` no cambian.
- `guestGroupDetail` y `GuestGroupJson` en `packages/core/src/wallet/groups.ts`. La web no recibe cuándo se fue alguien: `GroupMemberView` suma `left` (se fue) y en la web `leftOn` queda en nulo. La app pasó a usar `left`.
- 8 tests pgTAP en `supabase/tests/16_invite_token.test.sql` y 4 de Vitest.

**Criterios de aceptación de W-1:**
1. Pasan `npx supabase test db` y `db lint`, y la migración queda en `mangos` con la versión del archivo.
2. `guestGroupDetail` con el ejemplo de 02 §7 da los saldos +60.000, −10.000 y −50.000 y las 2 transferencias, igual que `groupDetail`.

---

### W-2. Publicar la web en Vercel

- `vercel.json` en la raíz:
  - build: `pnpm install` y `cd apps/mobile && npx expo export --platform web`;
  - salida: `apps/mobile/dist`;
  - reescritura de `/g/:token` a `/g/[token].html` (el export estático genera una página por ruta dinámica).
- Variables en Vercel: `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` de `mangos` (la clave es publicable), y `EXPO_PUBLIC_WEB_URL` con la URL del proyecto.
- `apps/mobile/.env.example` suma `EXPO_PUBLIC_WEB_URL`.
- **Crear el proyecto en Vercel y conectarlo al repo lo confirma Fran antes** (es un servicio nuevo, aunque sea gratis).

**Criterios de aceptación de W-2:**
1. Un push a `main` publica la web, y `<URL>/g/<token válido>` abre la página del grupo desde un teléfono con datos móviles.
2. `<URL>/g/cualquiercosa` muestra "Este link ya no funciona…", no un 404 de Vercel.

---

### W-3. Web de invitados (lectura)

**Ruta:** `apps/mobile/src/app/g/[token].tsx`, la misma de hoy. Funciona con y sin sesión.

**Contenido** (como el detalle 1A, sin acciones):
1. "Mangos" y el nombre del grupo, "4 personas · pesos".
2. **Integrantes**, con su saldo y "· sin cuenta" en los provisorios. Cada provisorio activo lleva **"Soy Juan"** con su nombre (W-5).
3. **Cómo saldar**, con las transferencias.
4. **Gastos**: fecha, descripción, quién pagó y monto. Muestra 30 y "Ver todos (N)".
5. **Pagos**, plegados.
6. Al final: "Mangos registra los gastos del grupo. Instalá la app para llevar los tuyos." con los botones de las tiendas (por ahora, texto sin link hasta la beta).

**Nunca** muestra el alias, el mail ni otros datos personales de nadie (02 §7).

**Estados:**
- cargando: esqueleto;
- link inválido, revocado o grupo eliminado (`get_guest_group` devuelve null): "Este link ya no funciona. Pedile uno nuevo a alguien del grupo.";
- error de red: "No pudimos traer el grupo." con "Reintentar".

**Diseño:** los tokens de `DESIGN.md` en la web, con ancho máximo de 560 y margen de 16.

**Implementado el 7/10.**
- Las secciones del detalle (Cómo saldar, Integrantes, Gastos y Pagos) pasaron a `apps/mobile/src/components/GroupSections.tsx`, con las acciones como parámetros opcionales. Las usan el detalle de la app y la web, así se ven igual.
- `loadGuestGroup` en `apps/mobile/src/lib/guest.ts`: `get_guest_group` con la clave anónima; null es link inválido, error es "No pudimos traer el grupo.".
- En la web, los gastos no muestran "tu parte" (el invitado no tiene lugar propio).
- El export genera `g/[token].html`, que W-2 sirve para cualquier `/g/:token`.
- "Soy Juan" llega con W-5.
- Sin ver en pantalla (la extensión de Chrome no conecta): el diseño se revisa en el teléfono cuando esté publicada.

**Criterios de aceptación de W-3:**
1. Con el ejemplo de 02 §7, la web muestra los mismos saldos y transferencias que el detalle en la app.
2. El HTML y la respuesta de la red de la página no contienen `payment_alias`, mails ni `user_id` (verificado con la respuesta de `get_guest_group`).
3. Un link revocado muestra el mensaje de link inválido.

---

### W-4. Compartir, regenerar y revocar el link

- **Detalle de grupo:** botón "Compartir link" al lado de "+ Gasto".
  - Si el grupo ya tiene `invite_token`: abre la hoja de compartir con "Mirá los gastos de Cabaña en Mangos: <EXPO_PUBLIC_WEB_URL>/g/<token>".
  - Si no tiene: llama a `rotate_invite_token`, guarda el resultado y abre la hoja de compartir.
- **Editar grupo**, sección "Link para invitar":
  - con link: el link en `caption`, "Regenerar link" y "Revocar link", los dos con la confirmación "El link anterior deja de andar.";
  - sin link: "Crear link".
- Toast: "Link nuevo listo" o "Revocaste el link".

**Criterios de aceptación de W-4:**
1. Vos creás el link desde tu teléfono; Ana, desde el suyo, toca "Compartir link" y comparte el mismo link sin regenerarlo.
2. Regenerar deja el link anterior mostrando "Este link ya no funciona…" y el nuevo abriendo el grupo.
3. Revocar deja los dos sin funcionar, y "Compartir link" vuelve a crear uno.

---

### W-5. Reclamar el lugar en la web

**Flujo** (D3), en la misma página:
1. "Soy Juan" en la fila de Juan abre un panel: "¿Sos Juan? Entrá con tu mail para tomar su lugar."
2. Si no hay sesión: el mail y "Mandame el código"; después, el código de 6 dígitos (los mismos `signInWithOtp` y `verifyOtp` de la app, con los mismos errores de `authErrors.ts`).
3. Con sesión: `claim_member(token, member_id)`.
4. Listo: "Ya sos Juan en Cabaña. Instalá Mangos y entrá con <mail> para ver el grupo y cargar gastos." La lista se actualiza y Juan pierde "· sin cuenta".

**Errores** (por código de la base):
- `55000 already a member`: "Ya sos parte de este grupo con esta cuenta.";
- `55000 not a provisional place`: "Ese lugar ya lo tomó otra persona." y se recarga la lista;
- `P0002 invalid invite`: el mensaje de link inválido.

**Implementado el 7/10.**
- `components/ClaimPanel.tsx` y `claimPlace` en `apps/mobile/src/lib/guest.ts`. El login usa los mismos `signInWithOtp`, `verifyOtp` y `authErrorMessage` que la app, con "Reenviar el código" a los 30 segundos.
- El lugar que se reclama va en la URL (`/g/<token>?claim=<id>`): al iniciar sesión, `RootNavigator` se vuelve a montar mientras trae los ajustes y el estado se perdería.
- Con sesión, el panel confirma con qué mail se toma el lugar y ofrece "Usar otro mail" (cierra la sesión de la web).
- Si el lugar ya lo tomó otra persona, la lista se vuelve a traer.
- Sin ver en pantalla: el recorrido completo (mail real, código, reclamo e instalar) se prueba con la web publicada.

**Criterios de aceptación de W-5:**
1. Un mail nuevo, desde la web, recibe el código, reclama a Juan y queda como integrante: en la app de Vos, Juan aparece "· se sumó 7/10" y deja de decir "sin cuenta".
2. Los gastos que pagó Juan entran a las finanzas del nuevo usuario como "Sin medio de pago" (`origin = claim`), con su parte en `my_share`.
3. Con una cuenta que ya está en el grupo, reclamar otro lugar muestra "Ya sos parte de este grupo…" y no cambia nada.

---

### W-6. Deshacer un reclamo en la app

- **Detalle de grupo**, fila de un integrante reclamado hace 7 días o menos: "Deshacer" si sos el dueño o sos esa persona.
- Confirmación en la misma sección, con el texto de 02 §7: "Juan vuelve a ser un integrante sin cuenta. Los gastos y saldos del grupo no cambian. Los gastos que le entraron al reclamar se borran de sus finanzas."
- `undo_claim(member_id)`. Si lo hizo la propia persona, vuelve a la lista de Grupos (ya no es integrante). Toast: "Deshiciste el reclamo de Juan".
- Errores: `55000 older than 7 days`: "Pasaron más de 7 días: ya no se puede deshacer."

**Criterios de aceptación de W-6:**
1. El dueño deshace el reclamo de Juan: Juan vuelve a "· sin cuenta", los saldos no cambian y los "Sin medio de pago" de la cuenta de Juan se borran.
2. Un integrante que no es el dueño ni Juan no ve "Deshacer".
3. Con un reclamo de hace 8 días, "Deshacer" no aparece y la base lo rechaza.

---

## Testing

| Capa | Qué | Cantidad |
|---|---|---|
| pgTAP | `invite_token` en rotar, revocar, eliminar, permisos y exportación | +6 |
| Unit (Vitest) | `guestGroupDetail` con los ejemplos de 02 §7 y un link sin integrantes activos | +4 |
| Contra la base local (script) | W-4 a W-6 con tres usuarios reales (Vos, Ana y un mail nuevo que reclama) | 1 script |
| Manual | La web publicada desde un teléfono con datos móviles: abrir, reclamar, instalar y entrar con el mismo mail | 1 recorrido |

## Plan de vuelta atrás

- **Web:** se pausa el proyecto en Vercel; los links dejan de abrir.
- **App:** se revierte el merge.
- **Migración:** `alter table groups drop column invite_token` y se restauran las dos funciones. Los links siguen andando por la huella.
- **Reclamos hechos:** se deshacen con `undo_claim` dentro de los 7 días.

## Fuera de alcance

- Completar el medio de pago de los "Sin medio de pago" (D4) y la lista de movimientos.
- Cargar gastos desde la web (después de la beta, 01-alcance).
- Deep links o links universales a la app instalada, EAS y las tiendas.
- El dominio propio (se cambia `EXPO_PUBLIC_WEB_URL` cuando esté).
- El push de "Juan se sumó" y "Te desvincularon" (quedan en `notifications`).

## Definición de terminado

1. Los criterios de W-1 a W-6 se verificaron contra la base local y, con la web publicada, contra `mangos` desde un teléfono.
2. `pnpm test`, `pnpm typecheck`, `npx supabase test db`, `db lint` y `npx expo export --platform web` están en verde.
3. `docs/03-modelo-de-datos.md` tiene `invite_token` y los cambios de las funciones; las decisiones quedan en `docs/decisiones/2026-10-06-spec-web-de-invitados.md`.
4. Prerrequisito de Fran para probar en `mangos`: la plantilla del mail con el código cargada.
