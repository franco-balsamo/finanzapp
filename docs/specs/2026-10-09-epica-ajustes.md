---
spec_kind: epic
status: approved
date: 2026-10-09
---

# Épica: Ajustes (T10)

## Contexto

Hoy la app no tiene pantalla de Ajustes. El tema y el dólar de referencia se eligen una sola vez, en la bienvenida, y después no se pueden cambiar. Los avisos de cierre y de vencimiento salen siempre, con los valores por defecto. Tampoco hay forma de borrar la cuenta ni de exportar los datos, y las dos cosas las piden las tiendas (App Store y Google Play) y la Ley 25.326 (02 §10).

La base ya tiene casi todo hecho: `delete_account()`, `export_account()`, la tabla `alerts` (que el cron ya lee) y el no molestar en `private.deliver_after`. Esta épica es, sobre todo, la pantalla.

## Estado actual (verificado el 9/10/2026)

| Pieza | Qué hay | Dónde |
|---|---|---|
| Ajustes del usuario | `user_settings` con `name`, `fx_reference`, `theme`, `notify_push`, `quiet_from`, `quiet_to`. La app lee y guarda `name`, `display_currency`, `fx_reference`, `theme` y `onboarded_at` | `apps/mobile/src/lib/session.tsx:14` (`SETTINGS_COLUMNS`, `updateSettings`) |
| Permisos de `user_settings` | `update` de `name, display_currency, fx_reference, theme, notify_push, quiet_from, quiet_to, goal` | `supabase/migrations/20261002120000_schema_v1.sql:572` |
| Tema | `useTheme` ya combina `useColorScheme()` con `settings.theme` | `apps/mobile/src/theme/useTheme.ts:7` |
| Avisos por tarjeta | Tabla `alerts` (`card_closing`/`card_due`, `enabled`, `params.card_id`, `params.days_before` de 1 a 5). Índice único sobre una expresión: `(user_id, type, (params ->> 'card_id'))`. Sin fila: prendido y 2 días | `schema_v1.sql:277`; el cron la lee en `20261004140000_card_notices.sql:105` |
| No molestar | `private.deliver_after(quiet_from, quiet_to, at)`: con null o iguales, no hay horario; puede pasar la medianoche | `20261004140000_card_notices.sql:35` |
| Borrar la cuenta | `delete_account()`: si el login por código tiene más de 10 minutos, `42501` "reauthentication required" | `20261004130000_purge_and_account.sql:89`; 03 "Funciones de la base" |
| Exportar | `export_account()` devuelve el JSON | `20261004130000_purge_and_account.sql:200` |
| Tarjetas archivadas | La Billetera ya las lista con "Recuperar" (`unarchiveCard`) | `apps/mobile/src/app/(app)/(tabs)/billetera.tsx:134` |
| Cerrar sesión | Menú ⋯ de la Billetera, con el mail y "Cerrar sesión" | `billetera.tsx:71` |
| Pedir y verificar código | `signInWithOtp` y `verifyOtp` | `apps/mobile/src/app/(auth)/codigo.tsx:32`, `components/ClaimPanel.tsx:58` |
| Guardar archivos | No hay `expo-file-system` ni `expo-sharing` | `apps/mobile/package.json` |
| Interruptor | `DESIGN.md` define `Switch` (40 × 22), pero el componente no existe | `DESIGN.md:465` |
| Push | No se manda: la app no registra tokens | `estado-y-proximos-pasos.md`, "Antes de la beta" |

## Decisiones tomadas en esta spec (9/10, aprobadas por Fran)

- **D1. Tarjetas archivadas, solo en la Billetera.** Ajustes no las lista. Se corrigen `docs/01` (tabla de pantallas) y `docs/02` §3 ("se puede desarchivar desde la Billetera").
- **D2. Avisos:** por tarjeta (cierre sí/no, vencimiento sí/no y días antes, de 1 a 5) y el no molestar. **Sin el interruptor global `notify_push`** hasta que se mande el push. Los avisos de Inicio respetan esta configuración desde ya, porque el cron no crea el aviso apagado.
- **D3. Exportar** a un archivo `mangos-AAAA-MM-DD.json` con `expo-file-system` y `expo-sharing`, que abre la hoja de compartir del sistema.
- **D4. Perfil:** el nombre se edita y vale para los grupos nuevos. No renombra el lugar en los grupos existentes (ahí cada uno edita su nombre). El mail se muestra pero no se cambia.
- **D5. Entrada:** un botón con engranaje a la derecha de "Hola, Fran" en Inicio abre `/ajustes`. "Cerrar sesión" pasa al final de Ajustes y se borra el menú ⋯ de la Billetera.
- **D6. Borrar la cuenta:** se pide el código del mail solo si la base responde `42501`.
- **D7. No molestar:** al prenderlo, de 22:00 a 8:00. Apagado = `quiet_from` y `quiet_to` en null.
- **D8. Avisos por tarjeta, en Ajustes:** una fila por tarjeta de crédito activa.
- **D9 (técnica). Guardar un aviso con una función de la base** (`set_card_alert`). PostgREST no puede hacer `upsert` contra un índice único sobre una expresión, y la función además valida que la tarjeta sea del usuario.

## Orden de lectura de la pantalla `/ajustes`

Una sola pantalla con scroll, con secciones como Inicio (`Section`, título en `type.label`). Los cambios se guardan solos, sin botón "Guardar": cada cambio guarda y muestra el toast "Guardado".

1. **Encabezado:** "Ajustes", con el botón de volver.
2. **Perfil:**
   - "Tu nombre" (`TextField`). Se guarda al salir del campo. Ayuda debajo: "Así te ven en los grupos nuevos.". Vacío: no se guarda y dice "Poné un nombre.".
   - "Mail": el mail de la sesión, en texto (no se edita).
3. **Preferencias:**
   - "Dólar de referencia": `Segmented` MEP / Oficial / Blue. Ayuda: "Para pasar a pesos tus cuentas y el patrimonio.".
   - "Tema": `Segmented` Sistema / Claro / Oscuro.
4. **Avisos:**
   - Una tarjeta de crédito activa por bloque, con su nombre y ··últimos 4:
     - "Cuando cierra" + `Switch`.
     - "Antes del vencimiento" + `Switch`.
     - Si el de vencimiento está prendido: "Días antes", `Segmented` 1 / 2 / 3 / 4 / 5.
   - Sin tarjetas de crédito activas: "Cuando sumes una tarjeta, vas a poder elegir sus avisos acá." y no hay bloques.
   - "No molestar" + `Switch`. Prendido: "De 22:00 a 08:00", donde cada hora es un botón que abre una `Sheet` con las 24 horas (`Option`). Ayuda: "Los avisos de ese horario te llegan al terminar.". Si se eligen dos horas iguales, se apaga.
5. **Tus datos:**
   - "Exportar mis datos" (`Button`, variante secundaria). Ayuda: "Un archivo con todo lo que cargaste.".
6. **Cuenta:**
   - "Cerrar sesión" (`Button`).
   - "Borrar mi cuenta" (`Button` destructivo, en `bad`). Abre la hoja de borrar.

### Hoja "Borrar mi cuenta"

1. Título: "¿Borrar tu cuenta?".
2. Texto: "Se borran tus cuentas, tarjetas, movimientos y ajustes. No se puede deshacer." Si está en algún grupo activo: "En tus grupos vas a seguir apareciendo como "Fran", sin cuenta, para que los saldos de los demás no cambien.".
3. Recomendación antes de borrar: "Antes, podés exportar tus datos." con un link que dispara el export.
4. Botones: "Borrar mi cuenta" (destructivo) y "Cancelar".
5. Al tocar "Borrar mi cuenta": se llama a `delete_account()`.
   - **Funciona:** se cierra la sesión (`signOut`) y la app vuelve al login con el toast "Borramos tu cuenta.".
   - **`42501`:** se manda el código (`signInWithOtp` con `shouldCreateUser: false`) y la hoja cambia a "Te mandamos un código a fran@… para confirmar." con el campo del código y "Confirmar y borrar". Al verificar (`verifyOtp`), se vuelve a llamar a `delete_account()`. Código mal: "Ese código no es válido o ya venció.", con "Mandar otro código".
   - **Otro error:** "No se pudo borrar la cuenta. Probá de nuevo." y la hoja queda abierta.

## Estados

| Estado | Qué se ve |
|---|---|
| Guardando un cambio | El control ya muestra el valor nuevo; si la base falla, vuelve al anterior y el toast dice "No se pudo guardar. Probá de nuevo." |
| Cargando los avisos | Las secciones de perfil y preferencias se ven al instante (vienen de `useSession`); la de avisos muestra "Cargando…" |
| Error al cargar los avisos | "No se pudieron cargar los avisos." + "Reintentar" (como Inicio) |
| Exportando | El botón dice "Exportando…" y está deshabilitado |
| Error al exportar | Toast "No se pudo exportar. Probá de nuevo." |
| Nombre largo | El campo corta con el ancho; no hay límite nuevo (la base no lo tiene) |
| Muchas tarjetas | La lista crece; la pantalla ya scrollea |

## Hijas

```
A-1 Docs ──────────────┐
A-2 Base set_card_alert ┼─> A-4 Pantalla /ajustes ─┬─> A-5 Exportar
A-3 Core cardAlerts ────┘                          └─> A-6 Borrar la cuenta
```

A-1 a A-3 no dependen entre sí. La pantalla necesita la función y el cálculo. Exportar y borrar son las dos piezas con más riesgo: van aparte para probarlas solas.

| # | Título | Esfuerzo (vos / CC) | Depende de |
|---|---|---|---|
| A-1 | Docs: 01, 02 §3 y §10 | 20 min / 5 min | — |
| A-2 | Base: `set_card_alert` | 2 h / 20 min | — |
| A-3 | Core: `cardAlerts` | 1 h / 10 min | — |
| A-4 | Pantalla `/ajustes`, `Switch` y entrada | 1 día / 1,5 h | A-2, A-3 |
| A-5 | Exportar mis datos | 2 h / 20 min | A-4 |
| A-6 | Borrar mi cuenta | 3 h / 40 min | A-4 |

### A-1. Docs

- `docs/01-alcance-v1.md`, tabla de pantallas, fila Ajustes: "Perfil, dólar de referencia, tema, avisos por tarjeta (cierre y vencimiento) y no molestar, exportar mis datos, cerrar sesión y borrar mi cuenta". Sin "tarjetas archivadas". Fila Billetera, pestaña Tarjetas: suma "las archivadas, para recuperarlas".
- `docs/02-reglas-de-negocio.md` §3 "Archivar y eliminar": "se puede **desarchivar** desde la Billetera".
- `docs/02` §10: el flujo de la hoja (código solo si la base lo pide) y el nombre del archivo exportado.
- `docs/02` §9: "Sin el interruptor general de notificaciones hasta que se mande el push".

### A-2. Base: `set_card_alert(card_id uuid, alert_type text, enabled boolean, days_before integer)`

Migración `supabase/migrations/20261009160000_set_card_alert.sql`:

```sql
-- Guarda un aviso de tarjeta (02 §9). Una fila por tarjeta y tipo: el índice único es
-- sobre una expresión y PostgREST no puede hacer upsert contra él.
create function public.set_card_alert(card_id uuid, alert_type text, enabled boolean, days_before integer default null)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if alert_type not in ('card_closing', 'card_due') then
    raise exception 'invalid alert type' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.cards c
    where c.id = set_card_alert.card_id and c.user_id = (select auth.uid())
  ) then
    raise exception 'card not found' using errcode = '42501';
  end if;

  insert into public.alerts (type, enabled, params)
  values (
    alert_type, set_card_alert.enabled,
    case when alert_type = 'card_due'
      then jsonb_build_object('card_id', card_id, 'days_before', coalesce(days_before, 2))
      else jsonb_build_object('card_id', card_id) end
  )
  on conflict (user_id, type, (params ->> 'card_id')) do update
    set enabled = excluded.enabled, params = excluded.params;
end;
$$;

grant execute on function public.set_card_alert(uuid, text, boolean, integer) to authenticated;
```

- `security invoker`: corre con la RLS de `alerts` (`own_rows`) y de `cards`.
- `days_before` fuera de 1 a 5: lo rechaza el `check` que ya tiene la tabla (`23514`).
- Un `card_due` sin `days_before` guarda 2.

Implementado el 9/10: `cards` no tiene `kind` (todas son de crédito), así que la función no lo filtra. Los tests están en `supabase/tests/22_set_card_alert.test.sql` (8).

Tests pgTAP (`supabase/tests/set_card_alert.test.sql`):
1. Sin fila, apagar el cierre crea una fila con `enabled = false`.
2. Volver a llamarla actualiza la misma fila (sigue habiendo 1).
3. `card_due` con 4 guarda `days_before = 4`; con 6 falla con `23514`.
4. La tarjeta de otro usuario falla con `42501` y no crea filas.
5. Un tipo inválido falla con `22023`.
6. Con la fila `card_closing` apagada, `public.card_notice_input()` devuelve `closing_enabled = false` para esa tarjeta.

### A-3. Core: `cardAlerts(cards, alerts)`

En `packages/core/src/notices/cardAlerts.ts`, exportado desde el índice de `notices`:

```ts
export interface DbAlert { type: 'card_closing' | 'card_due'; enabled: boolean; params: { card_id: string; days_before?: number } }
export interface CardAlertCard { id: string; name: string; last4: string }
export interface CardAlertSettings { card: CardAlertCard; closing: boolean; due: boolean; daysBefore: number }

/** Sin fila, los dos avisos están prendidos y el vencimiento es a 2 días (02 §9). */
export function cardAlerts(cards: CardAlertCard[], alerts: DbAlert[]): CardAlertSettings[]
```

Mantiene el orden de `cards`. Tests Vitest (de los ejemplos de 02 §9):
1. Sin filas: `closing = true`, `due = true`, `daysBefore = 2`.
2. Fila `card_due` apagada con 4: `due = false`, `daysBefore = 4` (al prenderlo de nuevo, vuelve con 4).
3. Una fila de otra tarjeta no cambia nada.

### A-4. Pantalla `/ajustes`, `Switch` y entrada

- `apps/mobile/src/components/Switch.tsx`: el de `DESIGN.md` (40 × 22, pista `line` apagado y `primary` prendido, perilla blanca de 16 que se corre 18 en `motion.micro`). `accessibilityRole="switch"`, `accessibilityState={{ checked }}` y una etiqueta.
- `apps/mobile/src/lib/session.tsx`: `SETTINGS_COLUMNS` y `UserSettings` suman `quiet_from` y `quiet_to` (`number | null`).
- `apps/mobile/src/lib/settings.ts` (nuevo):
  - `loadCardAlerts()`: lee las tarjetas de crédito activas (`id, name, last4`, `archived_at is null`, en el orden de la Billetera: favorita primero y después `created_at`) y `alerts`, y devuelve `cardAlerts(...)`.
  - `setCardAlert(cardId, type, enabled, daysBefore?)`: `supabase.rpc('set_card_alert', …)`.
- `apps/mobile/src/app/(app)/ajustes.tsx` (nueva): la pantalla del orden de lectura. Cada cambio es optimista: actualiza el estado, guarda y, si falla, vuelve atrás con el toast.
- `apps/mobile/src/app/(app)/(tabs)/index.tsx:144`: el encabezado pasa a fila: "Hola, Fran" + la fecha a la izquierda y el botón engranaje (`accessibilityLabel="Ajustes"`, ícono SVG como el del prototipo, área de toque de 44) a la derecha.
- `apps/mobile/src/app/(app)/(tabs)/billetera.tsx:71`: se borran el botón ⋯, `menuOpen` y el menú.
- Correr Expo unos segundos para que regenere las rutas tipadas.

### A-5. Exportar mis datos

- `npx expo install expo-file-system expo-sharing`.
- `exportAccount()` en `lib/settings.ts`: `supabase.rpc('export_account')`, escribe `JSON.stringify(data, null, 2)` en `mangos-AAAA-MM-DD.json` (fecha de Argentina) en el directorio de caché y abre `Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Exportar mis datos' })`.
- Si `Sharing.isAvailableAsync()` da `false`: toast "No se puede compartir desde este dispositivo.".
- En la web no hay botón (la web de producción es solo de invitados).

### A-6. Borrar mi cuenta

- `deleteAccount()` en `lib/settings.ts`: `supabase.rpc('delete_account')`. Devuelve `'deleted' | 'reauth'`; con `error.code === '42501'` es `'reauth'`; cualquier otro error se lanza.
- La hoja del orden de lectura, en `apps/mobile/src/components/DeleteAccountSheet.tsx`. El campo del código y sus errores salen igual que en `(auth)/codigo.tsx` (mismos textos de `authErrorMessage`).
- Para saber si está en algún grupo activo: el mismo dato que ya usa la lista de grupos (`loadGroupList`); si no se puede leer, se muestra el texto sin la frase de grupos.
- Después de borrar: `signOut()`; el `_layout` ya manda al login sin sesión.

## Testing

| Capa | Qué | Cantidad |
|---|---|---|
| pgTAP | `set_card_alert` (A-2) | +6 |
| Vitest | `cardAlerts` (A-3) | +3 |
| Chrome headless contra la base local (export `--dev`) | Ajustes en 320 y 390, claro y oscuro: cambiar tema y dólar, apagar un aviso y ver la fila en `alerts`, no molestar, cerrar sesión | 1 recorrido |
| Teléfono contra `mangos` | Exportar y compartir el archivo; borrar una cuenta de prueba nueva (no la de Fran) con un login de más de 10 minutos, para que pida el código | 2 recorridos |

Borrar se prueba **solo con una cuenta creada para eso** (un alias `+borrar` del mail de Fran, metido en un grupo de prueba), nunca con la de Fran ni con `+juan`.

## Plan de vuelta atrás

- La app: revertir el commit. Nada de la pantalla cambia datos que no se puedan volver a cambiar desde la misma pantalla.
- `set_card_alert`: `drop function public.set_card_alert(uuid, text, boolean, integer);`. Las filas de `alerts` que haya guardado son válidas igual y el cron las sigue leyendo.
- Borrar la cuenta no tiene vuelta atrás por diseño: por eso se prueba solo con una cuenta de prueba.

## Fuera de alcance

- Interruptor global de notificaciones (`notify_push`) y pedir el permiso de notificaciones: con el push.
- Cambiar el mail.
- Renombrar tu lugar en los grupos existentes desde Ajustes.
- Tarjetas archivadas en Ajustes (D1).
- Moneda del patrimonio: sigue en la Billetera e Inicio.
- Categorías, presupuestos, alertas de precio, mail, WhatsApp y resumen semanal (01 "Queda para después").
- Exportar desde la web.
- Versión de la app, términos y privacidad: con lo legal de antes de la beta.

## Definición de terminado

1. Desde Inicio, el engranaje abre Ajustes; la Billetera ya no tiene el menú ⋯.
2. Cambiar el tema a "Oscuro" cambia toda la app al instante y queda así al volver a abrirla.
3. Cambiar el dólar de referencia a "Blue" cambia el patrimonio de Inicio al volver.
4. Cambiar el nombre a "Franco" hace que el próximo grupo nuevo no pregunte el nombre y use "Franco"; los grupos existentes siguen con el nombre de antes.
5. Apagar "Cuando cierra" de una tarjeta deja una fila en `alerts` con `enabled = false`, y el payload del cron devuelve `closing_enabled = false` para ella.
6. Elegir 4 días antes del vencimiento guarda `days_before = 4`.
7. Prender no molestar guarda `quiet_from = 22` y `quiet_to = 8`; apagarlo los pone en null.
8. Exportar en el teléfono abre la hoja de compartir con `mangos-2026-10-09.json` (o la fecha del día), que se abre como JSON válido con `version`, `user`, `cards` y `groups`.
9. Borrar una cuenta de prueba con un login de más de 10 minutos pide el código; con el código, borra, vuelve al login, y en el grupo de prueba la persona sigue apareciendo como integrante sin cuenta con el mismo saldo.
10. Pasan los tests pgTAP y Vitest nuevos y los existentes, y el typecheck.
