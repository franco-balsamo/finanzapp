# Mangos

App de finanzas personales para Argentina (pesos y dólares, tarjetas en cuotas, gastos compartidos). Desarrollador único: Fran.

## Idioma
- Respondé siempre en castellano rioplatense.
- Todos los textos de la interfaz van en castellano rioplatense, con voseo ("Cargá", "Elegí", "Te deben").
- El código (nombres de variables, funciones y tablas) va en inglés.

## Fuente de verdad
Antes de proponer o cambiar lógica, consultá la parte relevante de estos archivos. No los leas enteros: listá los títulos con `grep -n '^## '` y leé solo las secciones que toca la tarea.
- `docs/01-alcance-v1.md`: qué entra en la v1. No sumes funciones de "Queda para después" sin preguntar.
- `docs/02-reglas-de-negocio.md`: reglas con ejemplos numéricos. Si el código contradice este archivo, el archivo manda (o se actualiza primero).
- `docs/03-modelo-de-datos.md`: tablas, funciones de la base y cálculos. Junto con `02`, es la fuente de verdad desde el 1/10/2026: si el código o cualquier otro documento los contradice, mandan estos dos (o se actualizan primero).
- `prototipo/mangos.html`: referencia visual y de comportamiento. Pesa más de 200 KB: nunca lo leas entero. Buscá con grep la pantalla o el componente puntual y leé solo ese tramo.

Si la tarea toca reglas de plata (montos, monedas, cuotas, cotizaciones o gastos compartidos), leé completa la sección correspondiente de `02` y `03`, sin resumir.

## Reglas que no se rompen
- Montos con decimales exactos (`numeric` en la base, nunca `float`). Cada monto va con su moneda.
- Cada movimiento guarda la cotización del día.
- Nunca guardar el número completo de una tarjeta: solo los últimos 4 y el vencimiento.
- Mangos registra pagos entre personas pero no mueve plata.
- Las alertas informan hechos; nunca recomiendan comprar o vender.
- Las APIs de cotizaciones se llaman solo desde el backend.
- Cargar un gasto tiene que llevar menos de 10 segundos: no sumar pasos obligatorios a ese flujo.
- Las reglas de este archivo y de `docs/02` y `docs/03` tienen prioridad sobre ponytail. Simplificar nunca justifica tocar montos, monedas o cotizaciones.

## Decisiones
Al terminar una skill de planificación, guardá un resumen en `docs/decisiones/AAAA-MM-DD-tema.md`.

## Contexto y tokens
- Las skills de gstack cargan entre 12k y 21k tokens de instrucciones cada una, y quedan en el contexto toda la sesión.
- Al terminar una skill de gstack (`/spec`, `/review`, `/plan-*`, `/autoplan`, `/qa`, `/ship`, `/investigate`, `/office-hours`), guardá lo decidido en `docs/decisiones/` y recordale a Fran que corra `/clear` antes de la tarea siguiente.
- En `execute_sql` contra `mangos`, filtrá siempre por fecha, tipo o fuente y poné `limit`. Nunca `select *` sobre tablas grandes.
- Al retomar, leé `estado-y-proximos-pasos.md`. El historial viejo está en `docs/decisiones/2026-10-07-historial-estado.md`: leelo solo si la tarea lo necesita.

## Qué skill usar
Invocá la skill vos mismo con la herramienta Skill, sin esperar a que Fran la nombre:
- Lógica nueva o cambio en `packages/core` o en funciones de la base: `tdd`. El test sale de los ejemplos numéricos de `docs/02`.
- Bug, error o algo que anda mal (en código o en datos de `mangos`): `diagnosing-bugs`, no `/investigate`.
- Una decisión chica que conviene cuestionar antes de escribir código: `grilling`.
- Revisar un cambio chico antes del commit: `ponytail:ponytail-review`, no `/review`.
- Épica nueva o tanda de pantallas: `/spec` de gstack. Las demás skills de gstack (`/plan-*`, `/qa`, `/cso`, `/ship`), solo si Fran las pide o si la tarea es un hito (beta, deploy, revisión de seguridad).
- No uses `code-review`, `to-spec` ni `ask-matt`: necesitan `/setup-matt-pocock-skills`, que no está corrido en este repo.

## Sistema de diseño
- Antes de tomar cualquier decisión visual o de interfaz, consultá `DESIGN.md`. No lo leas entero: listá los títulos con `grep -n '^##' DESIGN.md` y leé solo las secciones que toca la tarea.
- Para un componente, leé su sección `###` dentro de "Components" y además "Do's and Don'ts". Para colores, fuentes o espaciados, leé "Tokens para React Native"; el frontmatter YAML (líneas 1 a 124) tiene los mismos valores en crudo.
- En QA o en una revisión de diseño completa sí podés leer `DESIGN.md` entero.
- Ahí están las fuentes, los colores, los espaciados y la dirección visual. No te apartes sin que Fran lo apruebe.
- En QA, marcá todo el código que no coincida con `DESIGN.md`.

## gstack
Skills de gstack disponibles en `~/.claude/skills/gstack`. Las que usamos en este proyecto: `/office-hours`, `/plan-ceo-review`, `/plan-design-review`, `/design-consultation`, `/plan-eng-review`, `/autoplan`, `/spec`, `/review`, `/investigate`, `/cso`, `/qa`, `/ship`, `/careful`, `/guard`. La guía de uso está en `docs/04-guia-gstack.md`.
