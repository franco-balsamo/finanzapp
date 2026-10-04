// Cotizaciones del momento desde DolarApi. La llama pg_cron cada 10 minutos.
import { fetchJson, fxHandler } from "../_shared/fx.ts";

Deno.serve(fxHandler("dolarapi", () => fetchJson("https://dolarapi.com/v1/dolares")));
