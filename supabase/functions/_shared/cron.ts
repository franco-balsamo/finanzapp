// Lo que comparten las Edge Functions que llama pg_cron: el chequeo del
// secreto y las llamadas a la base con service_role.

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * El secreto vive solo en Vault (fx_cron_secret): la base dice si el que llegó
 * en `Authorization: Bearer …` es el correcto.
 */
export async function authorized(req: Request): Promise<boolean> {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  return await rpc<boolean>("cron_secret_matches", { token: header.slice("Bearer ".length) });
}

/** Llama a una función de la base (public.<name>) con service_role. */
export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name} respondió ${res.status}: ${await res.text()}`);
  return await res.json();
}

/** Arma el handler de un cron: 401 sin el secreto, 502 si algo falla. */
export function cronHandler(label: string, run: (req: Request) => Promise<Record<string, unknown>>) {
  return async (req: Request): Promise<Response> => {
    try {
      if (!(await authorized(req))) return json(401, { error: "unauthorized" });
      return json(200, await run(req));
    } catch (err) {
      console.error(`${label}:`, err);
      return json(502, { error: String(err) });
    }
  };
}
