# Guía: cómo usar gstack en Mangos

Qué skill usar en cada etapa, qué archivos pasarle y qué texto pegarle. Los textos están listos para copiar en Claude Code, dentro de este repositorio.

> **Importante:** Claude Code no puede abrir los links privados de Claude (el prototipo publicado ni el documento de producto). Por eso todo lo necesario está **dentro del repo**: `docs/` y `prototipo/mangos.html`. Si cambia algo en el prototipo o en el documento, actualizá la copia acá antes de correr una skill.

## Mapa rápido

| Etapa | Skill | Entrada principal | Sale |
|---|---|---|---|
| 1. Repensar el producto | `/office-hours` | `producto-y-lanzamiento.md`, `01-alcance-v1.md` | Documento de diseño |
| 2. Recortar el alcance | `/plan-ceo-review` | El documento de diseño | Plan con el alcance ajustado |
| 3. Revisar el diseño | `/plan-design-review` y `/design-consultation` | El plan, `prototipo/mangos.html` | Notas por pantalla y `DESIGN.md` |
| 4. Cerrar la arquitectura | `/plan-eng-review` | `02-reglas-de-negocio.md`, `03-modelo-de-datos.md` | Diagramas, casos borde, matriz de tests |
| 5. Construir por partes | `/spec` | Una función a la vez | Especificación ejecutable |
| 6. Revisar cada cambio | `/review`, `/investigate` | La rama con cambios | Bugs encontrados o arreglados |
| 7. Seguridad antes de la beta | `/cso` | Todo el repo | Hallazgos con escenario de ataque |
| 8. Probar | `/qa` (backend y web) | URL de staging o de la API | Bugs y tests de regresión |
| 9. Publicar cambios | `/ship` | La rama lista | PR con los tests corridos |

Atajo: `/autoplan` corre las revisiones 2 a 4 de una vez y solo te consulta las decisiones de gusto. La primera vez conviene hacerlas **por separado**, para entender qué te pregunta cada una.

---

## 0. Preparación (una sola vez)

1. Instalá gstack. Requisitos: Claude Code, Git y [Bun](https://bun.sh). En Claude Code pegá:
   ```bash
   git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
   ```
2. Creá el repo con esta estructura y hacé el primer commit:
   ```
   mangos/
   ├── CLAUDE.md            ← contexto para Claude Code (ya viene armado)
   ├── README.md
   ├── docs/                ← esta carpeta
   └── prototipo/
       └── mangos.html      ← el prototipo; se abre con doble clic
   ```
3. Abrí `prototipo/mangos.html` en el navegador para tenerlo a mano. La lectura automática de comprobantes no anda fuera de Claude; el resto sí.
4. **Guardá lo que produce cada skill en `docs/decisiones/`.** gstack guarda sus planes en su propia carpeta (`.gstack/` o `~/.gstack/`). Al terminar cada skill, pedile: *"Guardá un resumen de lo que decidimos en docs/decisiones/AAAA-MM-DD-nombre.md"*. Así queda todo en el repo y te lo puedo leer yo también.

---

## 1. `/office-hours`: repensar el producto

**Para qué:** te hace seis preguntas incómodas sobre el problema, para quién es y qué alternativas hay, antes de escribir código. Escribe un documento de diseño que leen las skills siguientes.

**Cuándo:** ahora, en paralelo a la fase 0 (validación). Sirve más si ya hiciste algunas de las 20 entrevistas.

**Qué tener a mano:**
- Lo que te dijeron en las entrevistas (aunque sean notas sueltas).
- Qué te pareció Finy después de probarlo.
- Cuánto tiempo por semana le vas a dedicar.

**Qué pegarle:**
```
/office-hours

Estoy armando Mangos, una app de finanzas personales para Argentina.
Leé primero docs/producto-y-lanzamiento.md y docs/01-alcance-v1.md.
El prototipo navegable está en prototipo/mangos.html.

Contexto mío: soy desarrollador React Native/TypeScript, trabajo solo y
en paralelo con otros proyectos. Quiero llegar a una beta cerrada de
100 usuarios.

Lo que más me importa validar: que la gente siga cargando gastos
después de dos semanas, y que los grupos compartidos traigan usuarios nuevos.

[Pegá acá lo que aprendiste en las entrevistas y de probar Finy]

Respondé en castellano.
```

**Qué hacer con el resultado:** guardá el documento de diseño en `docs/decisiones/`. Si te convence de cambiar algo del alcance, actualizá `01-alcance-v1.md`.

---

## 2. `/plan-ceo-review`: recortar el alcance

**Para qué:** revisa el plan con cuatro modos: expandir, expandir selectivamente, mantener o **reducir**.

**Modo recomendado:** **Reduction** (reducir). El alcance de la v1 ya es grande para una persona en unos 3 meses.

**Qué pegarle:**
```
/plan-ceo-review

Usá el documento de diseño de /office-hours y docs/01-alcance-v1.md.
Modo: Reduction. Soy una sola persona con unos 3 meses para la beta.

Restricciones que no se negocian:
- Cargar un gasto tiene que llevar menos de 10 segundos.
- Los grupos compartidos entran en la v1 (son el canal de crecimiento).
- Mangos no mueve plata entre usuarios ni recomienda inversiones.

Quiero que me digas qué sacarías de la sección "Entra en la v1"
y que resuelvas las "Decisiones abiertas" 1 y 3.
Respondé en castellano.
```

**Qué hacer con el resultado:** actualizá la tabla "Queda para después" de `01-alcance-v1.md`.

---

## 3. Diseño: `/plan-design-review` y `/design-consultation`

### `/design-consultation`: sistema de diseño
**Para qué:** arma un `DESIGN.md` con colores, tipografía, espaciado y componentes. Conviene que parta del prototipo, que ya tiene decisiones tomadas, en vez de inventar uno nuevo.

```
/design-consultation

Ya tengo un prototipo con un lenguaje visual definido en prototipo/mangos.html.
Extraé de ahí los tokens (colores en modo claro y oscuro, tipografías
Schibsted Grotesk e IBM Plex Mono, radios, espaciados) y los componentes
(tarjeta del carrusel, filas de movimientos, hojas inferiores, chips,
botones, íconos de categoría).

Armá DESIGN.md pensado para React Native: tokens como constantes de
TypeScript y componentes con sus estados.
No cambies la dirección visual; marcá solo inconsistencias.
Respondé en castellano.
```

### `/plan-design-review`: auditoría por pantalla
**Para qué:** puntúa cada aspecto del diseño de 0 a 10 y propone qué cambiar. Te va a preguntar decisión por decisión.

```
/plan-design-review

Revisá las pantallas de la v1 (lista en docs/01-alcance-v1.md, sección
"Pantallas de la v1") usando prototipo/mangos.html como referencia.
Foco en: el flujo de cargar un gasto (meta: menos de 10 segundos),
la Billetera con el carrusel y el detalle de tarjeta, y el detalle de grupo.
Es una app móvil, en castellano rioplatense.
Respondé en castellano.
```

---

## 4. `/plan-eng-review`: cerrar la arquitectura

**Para qué:** antes de programar, deja escrito el flujo de datos, los estados, los caminos de error, los casos borde y qué tests escribir. Es la skill **más importante** para Mangos, porque la lógica de cuotas, monedas y grupos es donde aparecen los bugs.

**Qué tener decidido o pensado:**
- Backend: FastAPI (lo conocés) o Supabase (autenticación, Postgres, seguridad por fila y almacenamiento ya resueltos).
- App: React Native con Expo y TypeScript.
- Dónde viven los cálculos (ver `03-modelo-de-datos.md`, al final).

**Qué pegarle:**
```
/plan-eng-review

Leé docs/02-reglas-de-negocio.md, docs/03-modelo-de-datos.md y el plan
recortado de /plan-ceo-review.

Stack: app en React Native con Expo y TypeScript. Backend a decidir entre
FastAPI + Postgres y Supabase; quiero tu recomendación para una persona
sola, con autenticación, seguridad por fila para los grupos,
almacenamiento de comprobantes y un proceso que consulte cotizaciones
cada 10 minutos.

Necesito:
1. Implementar cada nota "✅ Decidido" de 02-reglas-de-negocio.md
   (cambios respecto del prototipo) y marcar si alguna trae problemas.
2. Diagramas de: cargar un gasto (personal y de grupo), estado de un
   resumen de tarjeta, y saldos y simplificación de un grupo.
3. Matriz de tests usando los ejemplos con números de 02-reglas-de-negocio.md
   como primeros casos.
4. Cómo compartir los cálculos (statementFor, cardState, groupBalances,
   simplifyDebts, categorySpend, netWorth) entre la app y el backend.
5. Riesgos de seguridad del modelo de datos (datos financieros, grupos
   con integrantes sin cuenta, links de invitación).

Respondé en castellano.
```

**Qué hacer con el resultado:** guardalo en `docs/decisiones/` y actualizá `02` y `03` con lo que se resolvió. Desde acá, esos dos archivos pasan a ser la fuente de verdad.

---

## 5. Construir: `/spec` por funcionalidad

**Para qué:** convierte una idea suelta en una especificación precisa (por qué, alcance, parte técnica leyendo el código, borrador, archivo) y la puede ejecutar.

**Orden de construcción sugerido:**
1. **Paquete de cálculos con tests** (sin interfaz): `statementFor`, `cardState`, `groupBalances`, `simplifyDebts`, `categorySpend`. Es lo más delicado y lo más fácil de probar.
2. Autenticación y bienvenida.
3. Cuentas y carga de gastos.
4. Tarjetas de crédito con resúmenes y pago.
5. Débito y prepagas.
6. Grupos.
7. Cotizaciones del dólar en el backend.
8. Alertas y notificaciones.

**Ejemplo:**
```
/spec

Paquete packages/calc con las funciones de cálculo de tarjetas de crédito
descritas en docs/02-reglas-de-negocio.md §3. TypeScript puro, sin
dependencias, con tests que incluyan todos los ejemplos con números de
esa sección. Respondé en castellano.
```

---

## 6. Día a día: `/review`, `/investigate`, `/careful`

- **`/review`** en cada rama antes de mergear. Agregale: *"Verificá especialmente redondeos de montos, conversiones de moneda y fechas de cierre a fin de mes."*
- **`/investigate`** cuando aparezca un bug. Pasale qué esperabas, qué pasó y un caso con números. Por ejemplo: *"Compra de $30.000 en 3 cuotas el 25/09 con cierre el 24 debería ir a oct/nov/dic y aparece en sep."*
- **`/careful`** o **`/guard`** cuando toques migraciones de base o algo en producción.

---

## 7. `/cso`: seguridad antes de la beta

**Para qué:** auditoría con OWASP Top 10 y STRIDE. En una app de finanzas es obligatoria antes de que entren usuarios reales.

```
/cso

App de finanzas personales con datos sensibles: saldos, últimos 4 números
y vencimiento de tarjetas, fotos de comprobantes, grupos compartidos con
personas que pueden no tener cuenta, y links de invitación a grupos.

Revisá especialmente:
- que un usuario no pueda leer datos de otro (seguridad por fila,
  endpoints de grupos);
- links de invitación (que no se puedan adivinar, que vencen);
- almacenamiento de comprobantes (URLs firmadas, nada público);
- que nunca se guarde el número completo de una tarjeta;
- autenticación y manejo de sesión en la app móvil;
- claves de APIs de cotizaciones solo en el backend.

Contexto legal: Argentina, Ley 25.326 de datos personales.
Respondé en castellano.
```

---

## 8. Probar: `/qa` y móvil

- **`/qa`** prueba con navegador real y también **APIs**. Usala para el backend y para la web de invitados si la hacés: *"/qa https://api-staging.mangos.app — probá los endpoints de grupos con dos usuarios distintos."*
- **App móvil:** gstack solo tiene skills para iOS (`/ios-qa`, `/ios-fix`, `/ios-design-review`), y necesitan Mac, Xcode y un iPhone conectado. **No cubre Android**, que va a ser la mayoría de tus usuarios. Para eso usá [Maestro](https://maestro.mobile.dev) (flujos en YAML, simple) o Detox.

## 9. `/ship`: publicar cambios

Sincroniza con `main`, corre los tests, revisa la cobertura y abre el PR. Usala cuando la rama esté lista; si todavía no tenés tests configurados, los arma.

---

## Skills que podés ignorar por ahora

| Skill | Por qué |
|---|---|
| `/retro` | Pensada para equipos |
| `/land-and-deploy`, `/canary`, `/benchmark` | Para productos web desplegados; la app sale por las tiendas |
| `/browse`, `/scrape`, `/setup-browser-cookies` | Automatización de navegador; no la necesitás para construir la app |
| `/plan-devex-review`, `/devex-review` | Experiencia de otros desarrolladores; Mangos no es una herramienta para devs |
| `/setup-gbrain`, `/pair-agent`, `/connect-chrome` | Infraestructura avanzada de agentes |

## Cuándo volver a hablar conmigo

Después de cada skill de planificación (1 a 4), traé lo que guardaste en `docs/decisiones/`. Lo reviso, actualizo el prototipo si cambió algo de pantallas o flujos, y te preparo el texto para la skill siguiente.
