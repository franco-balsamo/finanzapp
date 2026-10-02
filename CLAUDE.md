# Mangos

App de finanzas personales para Argentina (pesos y dólares, tarjetas en cuotas, gastos compartidos). Desarrollador único: Fran.

## Idioma
- Respondé siempre en castellano rioplatense.
- Todos los textos de la interfaz van en castellano rioplatense, con voseo ("Cargá", "Elegí", "Te deben").
- El código (nombres de variables, funciones y tablas) va en inglés.

## Fuente de verdad
Antes de proponer o cambiar lógica, leé:
- `docs/01-alcance-v1.md`: qué entra en la v1. No sumes funciones de "Queda para después" sin preguntar.
- `docs/02-reglas-de-negocio.md`: reglas con ejemplos numéricos. Si el código contradice este archivo, el archivo manda (o se actualiza primero).
- `docs/03-modelo-de-datos.md`: tablas, funciones de la base y cálculos. Junto con `02`, es la fuente de verdad desde el 1/10/2026: si el código o cualquier otro documento los contradice, mandan estos dos (o se actualizan primero).
- `prototipo/mangos.html`: referencia visual y de comportamiento.

## Reglas que no se rompen
- Montos con decimales exactos (`numeric` en la base, nunca `float`). Cada monto va con su moneda.
- Cada movimiento guarda la cotización del día.
- Nunca guardar el número completo de una tarjeta: solo los últimos 4 y el vencimiento.
- Mangos registra pagos entre personas pero no mueve plata.
- Las alertas informan hechos; nunca recomiendan comprar o vender.
- Las APIs de cotizaciones se llaman solo desde el backend.
- Cargar un gasto tiene que llevar menos de 10 segundos: no sumar pasos obligatorios a ese flujo.

## Decisiones
Al terminar una skill de planificación, guardá un resumen en `docs/decisiones/AAAA-MM-DD-tema.md`.

## Sistema de diseño
- Antes de tomar cualquier decisión visual o de interfaz, leé `DESIGN.md`.
- Ahí están las fuentes, los colores, los espaciados y la dirección visual. No te apartes sin que Fran lo apruebe.
- En QA, marcá todo el código que no coincida con `DESIGN.md`.

## gstack
Skills de gstack disponibles en `~/.claude/skills/gstack`. Las que usamos en este proyecto: `/office-hours`, `/plan-ceo-review`, `/plan-design-review`, `/design-consultation`, `/plan-eng-review`, `/autoplan`, `/spec`, `/review`, `/investigate`, `/cso`, `/qa`, `/ship`, `/careful`, `/guard`. La guía de uso está en `docs/04-guia-gstack.md`.
