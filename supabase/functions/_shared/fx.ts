// Lo que comparten fx-rates y fx-history: el chequeo del secreto del cron,
// traer el JSON de la API y pasárselo a public.ingest_fx_rates, que mapea,
// no duplica y completa los movimientos pendientes (T6).

const FETCH_TIMEOUT_MS = 10_000;

export type FxSource = "dolarapi" | "argentinadatos";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Compara en tiempo constante para no filtrar el secreto por la demora.
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function authorized(req: Request): boolean {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return false;
  return sameSecret(req.headers.get("Authorization") ?? "", `Bearer ${secret}`);
}

export async function fetchJson(url: string): Promise<unknown[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body)) throw new Error(`${url} no devolvió una lista`);
  return body;
}

export async function ingest(source: FxSource, payload: unknown[]): Promise<number> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

  const res = await fetch(`${url}/rest/v1/rpc/ingest_fx_rates`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ source, payload }),
  });
  if (!res.ok) throw new Error(`ingest_fx_rates respondió ${res.status}: ${await res.text()}`);
  return await res.json();
}

// Arma el handler: 401 sin el secreto, 502 si falla la API o la base.
export function fxHandler(source: FxSource, load: (req: Request) => Promise<unknown[]>) {
  return async (req: Request): Promise<Response> => {
    if (!authorized(req)) return json(401, { error: "unauthorized" });
    try {
      const rows = await load(req);
      const inserted = await ingest(source, rows);
      return json(200, { source, received: rows.length, inserted });
    } catch (err) {
      console.error(`${source}:`, err);
      return json(502, { error: String(err) });
    }
  };
}
