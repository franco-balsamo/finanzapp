# /spec de la web de invitados · 6 de octubre de 2026

- **Spec:** `docs/specs/2026-10-06-epica-web-de-invitados.md`. Es una épica con 6 hijas:
  - W-1: base y core (`invite_token` guardado y `guestGroupDetail`);
  - W-2: publicar la web en Vercel;
  - W-3: web de invitados de solo lectura;
  - W-4: compartir, regenerar y revocar el link;
  - W-5: reclamar el lugar en la web;
  - W-6: deshacer un reclamo en la app.
- **Gate:** revisión semántica y escaneo de datos sensibles limpios.
- **Revisión externa:** no corrió, porque `codex` no está instalado. Sin `gh`, no se abrió issue.

## Pedido

La web de solo lectura en `/g/[token]`, "Compartir link", regenerar y revocar, reclamar el lugar ("soy Juan") y deshacer un reclamo dentro de los 7 días. Las funciones de la base ya existían desde el 2/10.

## Decisiones de Fran (todas las recomendadas)

1. **Hosting (D1):** Vercel, plan Hobby (gratis), con el export estático de `apps/mobile`. Los links se arman con `EXPO_PUBLIC_WEB_URL`, así el dominio propio se suma después sin tocar código. Crear el proyecto en Vercel lo confirma Fran antes.
2. **Volver a mostrar el link (D2):** la base guarda el token en `groups.invite_token` y lo leen solo los integrantes. Antes guardaba solo la huella, y entonces cada "Compartir" desde otro teléfono rompía los links que ya habían mandado los demás. El link solo deja ver el grupo, que los integrantes ya ven.
3. **Dónde se reclama (D3):** en la web, con el mismo login por código por mail. Un deep link diferido a la app recién instalada no anda con Expo Go ni sin publicar en las tiendas.
4. **Completar los "Sin medio de pago" (D4):** después, con la lista de movimientos. En esta tanda cuentan en la categoría sin medio.

## Decisiones técnicas sin pregunta

- La búsqueda del link sigue por la huella (`get_guest_group`, `claim_member`); `invite_token` solo sirve para volver a compartirlo.
- La web usa `guestGroupDetail` de core: mismos saldos y "Cómo saldar" que la app, sin lugar propio.
- Compartir con `Share` de react-native en la app y `navigator.share` (o copiar) en la web.
- Regenerar y revocar desde "Editar grupo", con la confirmación "El link anterior deja de andar."
- Link inválido, revocado o de un grupo eliminado: "Este link ya no funciona. Pedile uno nuevo a alguien del grupo."
- Prerrequisito para probar en `mangos`: la plantilla del mail con el código.
