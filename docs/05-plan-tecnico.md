# Plan técnico de la v1

Salió de `/plan-eng-review` (1 de octubre de 2026), sobre [02-reglas-de-negocio.md](02-reglas-de-negocio.md), [03-modelo-de-datos.md](03-modelo-de-datos.md) y el recorte de la v1. Cada decisión lleva su número de pregunta (D1 a D18) y el informe completo está en `~/.gstack/projects/finanzas/nogit-eng-review-20261001-180706.md`.

## Arquitectura

| Pieza | Decisión |
|---|---|
| Repo | `apps/mobile` (Expo Router: la app y las rutas web `/g/[token]` para invitados) y `packages/core` (cálculos) (D1) |
| Backend | **Supabase**: autenticación por mail con código, Postgres, políticas por fila, pg_cron y Edge Functions en TypeScript. Plan pago para la beta (D3) |
| Cálculos | `packages/core` en TypeScript puro, sin dependencias. Lo usan la app (también sin conexión) y las Edge Functions (D4) |
| Dinero | `Money = { minor: entero, currency }` en el código y `numeric(14,2)` en la base. Una sola función `convert()`, que redondea al centavo con half-up (D8) |

```
 ┌──────────────── apps/mobile (Expo) ────────────────┐
 │ pantallas ── packages/core ── cola sin conexión     │──┐  upsert por UUID (D6)
 │ /g/[token] (web de invitados, solo lectura)         │  │  rpc get_guest_group (D5)
 └─────────────────────────────────────────────────────┘  │
                                                          ▼
 ┌──────────────────────── Supabase ──────────────────────────────┐
 │ Auth (mail + código) │ Postgres + RLS (is_group_member, D16)    │
 │ trigger fx por fecha del gasto (D7)                             │
 │ pg_cron ─┬─ cada 10 min: Edge Fn cotizaciones ─▶ DolarApi       │
 │          ├─ diario: historial ─▶ ArgentinaDatos                 │
 │          ├─ 20:00 ART: aviso de cierre (usa packages/core)      │
 │          ├─ diario: vencimientos                                │
 │          └─ diario: purga de tarjetas archivadas (D13)          │
 │ Notificaciones (Expo push)                                      │
 └─────────────────────────────────────────────────────────────────┘
```

## Cómo se implementa cada "✅ Decidido" de 02

| Decisión | Implementación | ¿Trae problemas? |
|---|---|---|
| §1 Cotización en cada movimiento | Trigger `before insert` en `movements`: busca la cotización de venta de la fecha del gasto, en hora de Argentina (la última del día o del último día hábil anterior). Si no hay, queda `fx_pending` (D7) | Sí: no decía quién la completaba ni cuál era "la del día". Resuelto |
| §2 Saldo calculado y ajuste manual | Saldo = `opening_balance` + Σ movimientos. El ajuste es un movimiento de tipo `adjustment`. Si la moneda del gasto difiere de la cuenta, se guarda `debited_amount` (D12) | Sí: no decía con qué dólar se descontaba. Resuelto |
| §3 Cierre real | `statementFor(card, date, overrides)`. La corrección se valida a ±10 días y entre los cierres vecinos (D10) | Sí: la función no recibía las correcciones. Resuelto |
| §3 Días 29 a 31 | Se comparan los días configurados y después se ajusta al último día del mes (D11) | Sí: el resultado cambiaba en febrero. Resuelto |
| §3 Dólar tarjeta | `cardState` convierte la parte en dólares con la cotización de tipo tarjeta, tanto para el límite usado como para pagar dólares en pesos | No |
| §3 Pago parcial, vencidos y deshacer | `statement_payments` con varios pagos por resumen y `reverted_at`. Pendiente = total − Σ pagos no revertidos, por moneda | No |
| §3 Archivar y borrar a los 7 días | `archived_at` y una purga diaria en transacción, que antes convierte los pagos en movimientos de la cuenta (D13) | **Sí, grave:** borrar los pagos subía el saldo de las cuentas. Resuelto |
| §6 Una cuota en el mes de cierre de cada resumen | `categorySpend` usa `statementFor` para cada cuota. Sin presupuestos en la v1, se usa para el gasto por categoría | No, y el resto de la división va a la primera cuota (D9) |
| §7 La simplificación se queda | `simplifyDebts` con cruce de mayor a menor, como máximo N−1 transferencias. Umbral de cero por moneda (D14) | Menor: el umbral en dólares. Resuelto |
| §7 El dueño pasa al azar | Función en la base que elige al azar un integrante con `user_id` y avisa a todos. El test comprueba que el nuevo dueño tenga cuenta, no a quién elige | No |

## Diagramas

### Cargar un gasto personal

```
FAB ─▶ hoja ─▶ monto/medio/desc ─▶ [Guardar]
                                     │ uuid = randomUUID() en el teléfono (D6)
                                     ▼
                          ¿hay conexión?
                    no ┌──────┴──────┐ sí
                       ▼             ▼
            cola local (Pendiente)   upsert movements on conflict(id) do nothing
                       │ al volver    │
                       └────▶─────────┤
                                      ▼
                    RLS: user_id = auth.uid()  ── falla ─▶ "No se pudo guardar" [Reintentar/Editar]
                                      ▼
                    trigger fx (fecha del gasto, hora AR) ── sin historial ─▶ fx_pending = true
                                      ▼
                    app recalcula con packages/core ─▶ toast "entra en el resumen del 24/10" [Deshacer]
```

### Cargar un gasto de grupo

```
hoja (grupo elegido) ─▶ quién pagó · cómo se divide (Iguales | Montos)
        │
        ├─ validar: Montos suma = total ± $0,50 → diferencia al que pagó (D9)
        ▼
 group_expenses + group_expense_parts (fx_rate fija del día)
        │
        ├─ ¿pagué yo y elegí medio? ── sí ─▶ movements (total en tarjeta/cuenta,
        │                                     my_share = mi parte, group_expense_id)
        │                     └─ "No sumarlo a mis finanzas" ─▶ nada personal
        └─ ¿pagó otro? ─────────────────────▶ solo cambia mi saldo en el grupo
        ▼
 groupBalances ─▶ simplifyDebts ─▶ toast "tu parte $X; te deben $Y"
```

### Estado de un resumen de tarjeta

```
                 hoy < cierre del resumen en curso
   [Cuotas futuras] ───────────────▶ [En curso]
                                       │ llega el cierre (real o estimado)
                                       ▼
                                   [A pagar] ──── pagos ≥ total ────▶ [Pagado]
                                     │   │                              ▲   │
                         pago < total│   │ pasa el vencimiento          │   │ deshacer pago
                                     ▼   ▼                              │   ▼
                            [Pago parcial] ──── pagos ≥ total ──────────┘ (vuelve a A pagar
                                     │                                      o Pago parcial)
                                     │ pasa el vencimiento con saldo
                                     ▼
                                 [Vencido] ──── pagos ≥ total ────▶ [Pagado]

 Siempre cuentan en "A pagar", en el límite usado y en el patrimonio:
 A pagar, Pago parcial y Vencido (saldo pendiente) + En curso + Cuotas futuras.
 Imposible: Pagado → Vencido (si después se deshace un pago, se recalcula desde los pagos).
```

### Saldos y simplificación de un grupo

```
por cada gasto:  saldo[pagador] += total_en_moneda_grupo
                 por cada parte: saldo[integrante] -= parte      (suma de partes = total, D9)
por cada pago:   saldo[from] += monto ; saldo[to] -= monto
invariante:      Σ saldos = 0 exacto (centavos enteros, D8)
mostrar:         |saldo| < umbral(moneda) → 0   (ARS $1, USD US$ 0,01, D14)

simplifyDebts:
  deudores  = saldos < 0, de mayor a menor deuda
  acreedores = saldos > 0, de mayor a menor
  mientras haya ambos:
     m = min(|deudor|, acreedor) → transferencia deudor→acreedor por m
     descontar m a los dos; sacar el que quedó en 0
  resultado: ≤ N−1 transferencias
```

## Matriz de tests

Los primeros casos son los ejemplos de 02. Los cálculos se testean con Vitest (`packages/core`), la base con `supabase test db` (pgTAP) y los flujos de punta a punta con Maestro (D15).

| Id | Función | Caso | Esperado | Fuente |
|---|---|---|---|---|
| T-01 | statementFor | Cierre 24, vencimiento 6; compras del 20/9, 24/9, 25/9 y 28/12 | sep (24/9, 6/10); sep; oct (24/10, 6/11); ene del año siguiente (24/1, 6/2) | 02 §3 |
| T-02 | cuotas | $30.000 en 3, el 25/9 | $10.000 en oct, nov y dic; vencen 6/11, 6/12 y 6/1 | 02 §3 |
| T-03 | cuotas | $100.000 en 3 | $33.333,34 + $33.333,33 + $33.333,33 | D9 |
| T-04 | cardState | Resumen de $200.000, pago de $120.000 | Pago parcial, $80.000 pendientes, caja −$120.000. Pasado el vencimiento: Vencido $80.000. Al deshacer: $200.000 pendientes y caja +$120.000 | 02 §3 |
| T-05 | cardState | Un resumen por cada estado | En curso, Cuotas futuras, A pagar, Pagado | 02 §3 |
| T-06 | cardState | Límite usado con un vencido, el en curso, cuotas futuras y US$ | Suma todo; los dólares con dólar tarjeta; disponible ≥ 0 | 02 §3 |
| T-07 | statementFor | Cierre 31 (febrero, bisiesto, abril). Cierre 31 y vencimiento 30 | 28/2 o 29/2, 30/4. Febrero cierra 28/2 y vence 30/3 | 02 §3, D11 |
| T-08 | statementFor | Cierre real corregido al 27/10 con compra del 26/10. Corrección a +15 días | Entra en octubre. La corrección se rechaza | D10 |
| T-09 | categorySpend | $30.000 en 3, el 25/9, con cierre el 24 | sep $0; oct, nov y dic $10.000. Débito: en el mes de la fecha | 02 §6 |
| T-10 | groupBalances | Vos pagás $90.000 iguales; Ana paga $30.000 exactos (Ana 10.000, Juan 20.000) | Vos +60.000, Ana −10.000, Juan −50.000; suma 0 | 02 §7 |
| T-11 | simplifyDebts | Los saldos de T-10 | Juan→Vos $50.000 y Ana→Vos $10.000 (2 transferencias, como máximo N−1) | 02 §7 |
| T-12 | groupBalances | $100 entre 3, pagó Ana | Ana $33,34, Juan $33,33, Vos $33,33 | D9 |
| T-13 | groupBalances | Total $1.000 con partes $600 (pagador) + $399,60. Diferencia de $0,60 | Pagador $600,40. Con $0,60 se rechaza | D9 |
| T-14 | simplifyDebts | ARS con saldo $0,80. USD con saldo US$ 0,80 | ARS se muestra como 0; USD aparece | D14 |
| T-15 | impacto personal | Pagaste $90.000 con tarjeta, 3 iguales. Pagó otro. "No sumarlo" | Tarjeta $90.000, categoría $30.000, te deben $60.000. Nada personal. Nada personal | 02 §7 |
| T-16 | netWorth | Cuentas ARS/USD, un grupo +, una tarjeta con US$ | Cuentas convertidas con el dólar de referencia + grupos − tarjetas (dólar tarjeta) | 02 §8 |
| T-17 | trigger fx | Gasto de un sábado. Gasto de una fecha sin historial | Cotización del viernes. `fx_pending = true` | D7 |
| T-18 | saldo de cuenta | US$ 12 desde una caja en pesos, dólar tarjeta $2.028 | Se proponen $24.336; el saldo resta `debited_amount` | D12 |
| T-19 | purga | Tarjeta archivada hace 8 días, con pagos | Saldos de las cuentas iguales antes y después; tarjeta, consumos y pagos borrados | D13 |
| T-20 | upsert / RLS | Mismo UUID dos veces. UUID de otro usuario | 1 fila. Rechazado | D6 |
| T-21 | get_guest_group | Token válido, token regenerado y select anónimo sobre las tablas | Sin `payment_alias` ni `user_id`; el token viejo no devuelve nada; el select se rechaza | D5 |
| T-22 | dueño abandona | Grupo con integrantes con y sin cuenta. Grupo sin nadie con cuenta | El nuevo dueño tiene `user_id`. El dueño queda nulo y nadie puede eliminar el grupo | 02 §7 |
| T-23 | convert | Montos que terminan en ,005 | Redondeo half-up al centavo | D8 |
| T-24 | borde de la base | `'86500.00'` ↔ 8650000 | Ida y vuelta exactas | D8 |
| T-25 | is_group_member | Integrante, ex integrante (`left_at`) y ajeno | true, false, false | D16 |
| T-26 | borrar cuenta | Usuario con cuentas, tarjetas y grupos | No queda nada personal; en los grupos queda un integrante sin cuenta con el mismo nombre y los saldos no cambian | D17 |
| E-1 | Maestro | Cargar un gasto con tarjeta | Menos de 10 s | D15 |
| E-2 | Maestro | Modo avión, guardar, reconectar | Un solo gasto, con su cotización | D15 |
| E-3 | Maestro | Carga por texto de 8 líneas, doble toque | 8 gastos, sin duplicados | D15 |
| E-4 | Maestro | `/g/[token]` → "soy Juan" → instalar → reclamar | El lugar pasa a la cuenta | D15 |

## Riesgos de seguridad del modelo

| Riesgo | Probabilidad / impacto | Mitigación |
|---|---|---|
| El link de invitado expone CBU o alias y permite adivinar otros grupos | Alta / Alto | `get_guest_group(token)` con campos limitados y token de 128 bits guardado con hash (D5) |
| Un usuario lee datos de otro cambiando ids | Media / Alto | RLS por `user_id = auth.uid()` en todas las tablas personales, más un test con dos usuarios (D6) |
| Recursión o lentitud en las políticas de grupo | Media / Medio | `is_group_member` security definer con `search_path` fijo e índices (D16) |
| Alguien reclama el lugar de otro integrante sin cuenta | Media / Medio | El dueño o quien reclamó puede deshacer durante 7 días, y se avisa al grupo (diseño de office hours) |
| Cotización falsa o ausente enviada desde la app | Baja / Medio | La completa la base con un trigger, no la app (D7) |
| La clave `service_role` llega a la app | Baja / Muy alto | Solo en las Edge Functions; la app usa la clave anónima |
| Pedido de borrado de datos (Ley 25.326) | Media / Alto | "Borrar mi cuenta" y "Exportar mis datos" (D17). La consulta con un abogado y la inscripción de la base siguen pendientes (R-LEGAL) |
| Montos visibles en la pantalla bloqueada | Alta / Bajo | Pendiente para después de la beta (TODOS.md, D18) |
| Número completo de tarjeta | — | El modelo solo guarda `last4` y `expiry` (regla del proyecto) |
