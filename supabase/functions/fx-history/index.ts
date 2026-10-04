// Historial diario desde ArgentinaDatos (un valor por día, con fines de
// semana y feriados). La llama pg_cron a las 3:00 de Argentina con los
// últimos 30 días; la carga inicial se hace una vez con {"full": true}.
import { fetchJson, fxHandler } from "../_shared/fx.ts";

const RECENT_DAYS = 30;

Deno.serve(
  fxHandler("argentinadatos", async (req) => {
    const body = await req.json().catch(() => ({}));
    const rows = await fetchJson("https://api.argentinadatos.com/v1/cotizaciones/dolares");
    if (body?.full === true) return rows;

    const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);
    return rows.filter((r) => typeof (r as { fecha?: unknown }).fecha === "string" && (r as { fecha: string }).fecha >= since);
  }),
);
