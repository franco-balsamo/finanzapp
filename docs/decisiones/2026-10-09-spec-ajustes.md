# Spec de Ajustes (9/10/2026)

Spec: `docs/specs/2026-10-09-epica-ajustes.md` (hijas A-1 a A-6).

**Decisiones:**
- Las tarjetas archivadas se recuperan solo desde la Billetera, que ya las lista. Ajustes no las muestra; se corrigen `docs/01` y `docs/02` §3.
- Avisos: por tarjeta de crédito activa (cierre, vencimiento y días antes, de 1 a 5) y el no molestar, todo en Ajustes. No hay interruptor global (`notify_push`) hasta que se mande el push.
- No molestar: al prenderlo, de 22:00 a 8:00. Apagado = `quiet_from` y `quiet_to` en null. Si se elige la misma hora de inicio y de fin, se apaga.
- Exportar: archivo `mangos-AAAA-MM-DD.json` con `expo-file-system` y `expo-sharing`, abierto en la hoja de compartir. No hay export en la web.
- Perfil: el nombre se edita y vale para los grupos nuevos (no renombra el lugar en los grupos existentes). El mail solo se muestra.
- Entrada: engranaje en el encabezado de Inicio. "Cerrar sesión" pasa a Ajustes y se borra el menú ⋯ de la Billetera.
- Borrar la cuenta: se llama a `delete_account()` y se pide el código del mail solo si responde `42501`. La hoja ofrece exportar antes.
- Base: una función nueva, `set_card_alert`, porque PostgREST no puede hacer `upsert` contra el índice único sobre `params ->> 'card_id'`.
- Borrar la cuenta se prueba solo con una cuenta creada para eso.

**Revisión externa:** no corrió, porque `codex` no está instalado. Tampoco se subió el issue, porque falta `gh`.

**A confirmar al implementar A-6:** que, después de `verifyOtp` con la sesión abierta, el JWT nuevo traiga `amr` con `otp` y la hora del momento.
