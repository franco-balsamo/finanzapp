// Lo que comparten fx-rates y fx-history: traer el JSON de la API y pasárselo
// a public.ingest_fx_rates, que mapea, no duplica y completa los movimientos
// pendientes (T6).
import { cronHandler, rpc } from "./cron.ts";

const FETCH_TIMEOUT_MS = 10_000;

export type FxSource = "dolarapi" | "argentinadatos";

export async function fetchJson(url: string): Promise<unknown[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body)) throw new Error(`${url} no devolvió una lista`);
  return body;
}

export function fxHandler(source: FxSource, load: (req: Request) => Promise<unknown[]>) {
  return cronHandler(source, async (req) => {
    const rows = await load(req);
    const inserted = await rpc<number>("ingest_fx_rates", { source, payload: rows });
    return { source, received: rows.length, inserted };
  });
}
