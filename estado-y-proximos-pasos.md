# Mangos: estado y próximos pasos (2 de octubre de 2026)

Nota para retomar en una sesión nueva. Mangos es la app de finanzas personales de Fran para Argentina; el nombre es provisorio.

## Dónde está cada cosa
- **Repo de Fran (fuente de verdad):** `CLAUDE.md`, `DESIGN.md`, `docs/01-alcance-v1.md`, `docs/02-reglas-de-negocio.md`, `docs/03-modelo-de-datos.md`, `docs/04-guia-gstack.md`, `docs/05-plan-tecnico.md`, `docs/producto-y-lanzamiento.md`, `docs/diseno-pantallas-v1.md`, `docs/decisiones/` y `prototipo/mangos.html`. Para revisar algo, Fran pasa los archivos como adjuntos.
- **Prototipo publicado:** https://claude.ai/artifact/VcdZaUcopPPczEKi8vjSh4. Se lee con Artifact (action read) y conserva la capacidad `sample`.
- **Documento de producto (Claude Docs):** https://claude.ai/code/artifact/bdee199b-bc4c-4257-a296-be764d705be4. Está desactualizado; la copia del repo es la que vale.
- **En este proyecto:** `mangos/01-alcance-v1.md`, que es la versión del 1/10, anterior a las revisiones de gstack.

## Qué está hecho
- Prototipo HTML completo:
  - Billetera con carrusel, tarjetas de crédito, débito y prepagas con detalle, editar y eliminar en la tarjeta, banco, vencimiento MM/AA y red.
  - Grupos estilo Sesterce, categorías con íconos y medio de pago vacío por defecto.
- gstack corrido hasta el paso 4: `/office-hours`, `/plan-ceo-review`, `/plan-design-review` con `/design-consultation`, y `/plan-eng-review`. Lo decidido está en `docs/decisiones/`.
- Decisiones principales:
  - **Supabase:** autenticación por mail con código, políticas por fila, pg_cron y Edge Functions.
  - **Repo:** monorepo con `apps/mobile` (Expo Router, con la web de invitados en `/g/[token]`) y `packages/core` (cálculos en TypeScript con Vitest).
  - **Producto:** el cierre de tarjeta como ritual de vuelta, carga rápida por texto con reglas, sin IA; invitados con web de solo lectura que reclaman su lugar.
  - **Fuera de la v1:** presupuestos, alerta del dólar, débito como tipo propio, carrusel, comprobantes y categorías editables.
- Revisión de Claude: `docs/decisiones/2026-10-02-revision-claude.md`, con propuestas para R3-1 a R3-10, el rango de cuotas, T9, el plazo sin margen, la métrica "activo en el ciclo" y la lista de lo que hay que actualizar en `producto-y-lanzamiento.md`.

- Propuestas de la revisión aplicadas en 02, `producto-y-lanzamiento` y 01. Revisión posterior de 02 y 01 hecha y corregida (también 03); el detalle está en `docs/decisiones/README.md`, "Correcciones de la revisión de Claude (2/10)".
- **Paso 5 de gstack (`/spec`) hecho e implementado** (T1 a T4 del informe de eng review):
  - Spec en `docs/specs/2026-10-02-epica-core.md`; decisiones en `docs/decisiones/2026-10-02-spec-core.md`.
  - El repo ya es git (rama `main`). Monorepo con pnpm: `packages/core` (`@mangos/core`) y `apps/mobile` (Expo SDK 57, rutas en `src/app/`, export web con `/g/[token]`).
  - Core tiene `Money`/`convert`, tarjetas (`statementFor`, `cardState`, `lateExpenseImpact`…), grupos (`shares`, `groupBalances`, `simplifyDebts`), `accountBalance`, `categorySpend` y `netWorth`. 96 tests en verde.
  - Comandos: `pnpm test`, `pnpm typecheck`, y `npx expo export --platform web` dentro de `apps/mobile`.

## Próximos pasos
1. **Claude:** actualizar el prototipo a la v1:
   - lista de tarjetas con `CardRow` en vez del carrusel;
   - fichas de medio de pago (favorita, 2 más usados y "Otro…", sin preselección);
   - hoja de carga en el orden nuevo, con carga por texto;
   - toast con "Deshacer";
   - detalle de tarjeta y de grupo en el orden nuevo;
   - sin débito como tipo propio, sin comprobante, sin presupuestos, sin alertas de precio, solo Iguales y Montos.
2. **T5 del informe:** migraciones de 03 en Supabase, políticas por fila con `is_group_member` e índices (T-20, T-21 y T-25 con pgTAP). Después, la prueba T9: que las Edge Functions importen `packages/core`.
3. **Pendiente de herramientas:** instalar `codex` si se quiere la revisión externa en `/spec` y `/review` (esta vez no corrió) y `gh` si se suben los specs como issues.

## Commits
Sin la línea "Co-Authored-By" de Claude. Se usa la identidad global de git.

## Cómo trabajar con Fran
Castellano rioplatense, ritmo rápido y pocas preguntas. Aprueba con "Dale".
