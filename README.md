# Mangos

App de finanzas personales para Argentina: cuentas en pesos y en dólares, tarjetas con sus cuotas, gastos compartidos y el dólar del día, en un solo lugar. El nombre es provisorio.

**Estado:** prototipo visual terminado y alcance de la v1 revisado. Ya está el monorepo con `packages/core` (los cálculos, con tests) y `apps/mobile` (Expo, todavía sin pantallas). Comandos: `pnpm install`, `pnpm test` y `pnpm typecheck`.

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
- Backend: a decidir en `/plan-eng-review` (FastAPI + Postgres o Supabase).
- Cotizaciones: DolarApi y ArgentinaDatos, consultadas desde el backend.
