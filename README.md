# Mangos

App de finanzas personales para Argentina: cuentas en pesos y en dólares, tarjetas con sus cuotas, gastos compartidos y el dólar del día, en un solo lugar. El nombre es provisorio.

**Estado:** prototipo visual terminado y alcance de la v1 revisado. Ya está el monorepo con `packages/core` (los cálculos, con tests) y `apps/mobile` (Expo, todavía sin pantallas), y el esquema de Supabase en `supabase/` con sus políticas por fila y tests pgTAP. Comandos: `pnpm install`, `pnpm test`, `pnpm typecheck` y, con Docker, `npx supabase start` y `npx supabase test db`.

## Ejemplos compartidos entre core y la base

Los saldos de grupo se calculan en core (`shares`, `groupBalances`) y en SQL (`private.member_shares`, `private.group_balances`). Los dos se prueban con los mismos ejemplos de `packages/core/fixtures/group-balances.json`: Vitest los lee directo, y `supabase/tests/05_group_balances.test.sql` se genera desde ese JSON.

Corré `pnpm gen:sql-fixtures` cada vez que cambies el JSON, y commiteá el SQL generado junto con el JSON. `pnpm gen:sql-fixtures --check` falla si el SQL quedó viejo. Si cambia una regla de cálculo, cambiala en core y en SQL, y sumá el ejemplo al JSON.

## Cotizaciones (cron y Edge Functions)

Dos cron de la base llaman a las Edge Functions `fx-rates` (DolarApi, cada 10 minutos) y `fx-history` (ArgentinaDatos, todos los días a las 3:00). Sin configurar, los cron no hacen nada. Para activarlos en un entorno:

1. Elegí un secreto largo al azar y cargalo en las Edge Functions: `npx supabase secrets set CRON_SECRET=...`. En local va en `supabase/functions/.env`, que no se commitea.
2. Cargá en Vault la URL base de las funciones y el mismo secreto (SQL editor):
   `select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'functions_url');`
   `select vault.create_secret('<el secreto>', 'fx_cron_secret');`
   En local, la URL es `http://kong:8000/functions/v1`.
3. Cargá el historial completo una sola vez:
   `curl -X POST <functions_url>/fx-history -H "Authorization: Bearer <el secreto>" -d '{"full": true}'`

## Documentación

| Archivo | Qué tiene | Para qué skill de gstack |
|---|---|---|
| [docs/producto-y-lanzamiento.md](docs/producto-y-lanzamiento.md) | Usuarios, competencia, modelo de negocio, fases, marketing, riesgos | `/office-hours` |
| [docs/01-alcance-v1.md](docs/01-alcance-v1.md) | Qué entra en la primera versión y qué queda para después | `/office-hours`, `/plan-ceo-review` |
| [docs/02-reglas-de-negocio.md](docs/02-reglas-de-negocio.md) | Lógica de tarjetas, cuotas, monedas, grupos y presupuestos, con ejemplos | `/plan-eng-review`, `/spec` |
| [docs/03-modelo-de-datos.md](docs/03-modelo-de-datos.md) | Propuesta de tablas y cálculos | `/plan-eng-review`, `/cso` |
| [docs/04-guia-gstack.md](docs/04-guia-gstack.md) | Qué skill usar en cada etapa y qué pegarle | — |
| [docs/decisiones/](docs/decisiones/) | Lo que se va decidiendo con cada skill | — |
| [prototipo/mangos.html](prototipo/mangos.html) | Prototipo navegable; se abre en el navegador | `/plan-design-review`, `/design-consultation` |

## Links (privados, solo para Fran)

- Prototipo publicado: https://claude.ai/artifact/VcdZaUcopPPczEKi8vjSh4
- Documento de producto: https://claude.ai/code/artifact/bdee199b-bc4c-4257-a296-be764d705be4

Claude Code no puede abrir estos links: por eso las copias están dentro del repo.

## Stack previsto

- App: React Native con Expo y TypeScript.
- Backend: Supabase (Postgres con políticas por fila, autenticación por mail, pg_cron y Edge Functions). Ver `docs/03-modelo-de-datos.md`.
- Cotizaciones: DolarApi y ArgentinaDatos, consultadas desde el backend.
