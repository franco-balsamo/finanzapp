# /office-hours · 1 de octubre de 2026

Sesión sobre qué tomar de Finy para la v1. El documento de diseño completo (aprobado, con 3 rondas de revisión independiente) está en `~/.gstack/projects/finanzas/fbalsamo-nogit-design-20261001-170507.md`.

## Contexto

- **Lo que se aprendió:** la gente no deja de cargar solo porque le cueste. **Se olvida y después se pone al día de golpe.**
- **Usuaria de referencia:** la pareja de Fran (33 años, varias tarjetas y billeteras, planilla de Excel que no actualiza todos los días).
- **Competencia en gastos compartidos:** Sesterce, gratis y sin cuenta.
- **Evidencia:** todavía viene del entorno cercano.

## Qué se decidió

| Tema | Decisión |
|---|---|
| Enfoque de la v1 | **B: el cierre de tarjeta como ritual, más invitados reclamables** |
| Carga rápida por texto | Entra en la v1: un campo opcional, con reglas y sin IA, que acepta **varias líneas** y muestra lo que interpretó para confirmar. El formulario de siempre no cambia |
| Motivo para volver | **El aviso de cierre de cada tarjeta**, no un resumen del día 1 |
| Invitados a grupos | Ven el grupo sin cuenta (integrante provisorio) y reclaman su lugar cuando se registran |
| Lo que sale de la v1 | Presupuestos (queda el gasto por categoría) y la alerta de precio del dólar |
| Gastos cargados tarde | Entran en el resumen de su fecha; si estaba pagado, se pregunta "¿Ya lo pagaste?" |
| Plan gratis (para la fase 2) | La propuesta es sacar el tope de 2 tarjetas |
| Fases | La lectura de comprobantes pasa de la fase 3 a la 2, con cupo. La API de Mercado Pago se investiga en la fase 0, con un límite de 2 horas |

## Qué se descartó

- **Resumen del mes el día 1:** el primero llega tarde para medir la retención a las 2 a 4 semanas.
- **Enfoque A (versión mínima):** no permite vincular a un invitado que después se registra con lo que hizo en el grupo.
- **Enfoque C (beta de parejas):** no prueba que los grupos traigan gente nueva.

## Qué quedó abierto

- **¿El aviso de cierre alcanza o hace falta también el resumen mensual?** Se decide con los datos de la beta.
- **Plan gratis:** sacar el tope de tarjetas o subirlo, antes de la fase 2.
- **11 observaciones de la revisión independiente** (R3-1 a R3-11 del documento de diseño). Algunas quedaron sin efecto con decisiones posteriores (R3-11, por el recorte C7). Siguen abiertas:
  - **R3-1 y R3-2:** cómo queda en la carga por texto una línea sin medio de pago o sin descripción, y una línea con cuotas pero sin tarjeta de crédito.
  - **R3-3 y R3-4:** en los gastos cargados tarde, qué pago se ajusta si hay varios y qué pasa con los gastos en dólares.
  - **R3-5 y R3-6:** palabras genéricas en el aprendizaje de categorías, y qué pasa si la favorita no está entre las tarjetas que coinciden.
  - **R3-8 y R3-9:** qué pasa con la cuenta y con sus gastos cuando se deshace un reclamo equivocado.
  - **R3-10:** en qué ventana se mide la retención por ciclo.
- **Tareas de validación:**
  - Observar a la usuaria de referencia ponerse al día con su planilla.
  - Hablar con 5 personas que no sean conocidas cercanas.
  - Investigar la API de Mercado Pago.
