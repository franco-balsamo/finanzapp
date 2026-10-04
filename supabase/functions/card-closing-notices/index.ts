// Aviso de cierre (02 §9). La llama pg_cron a las 20:00 de Argentina.
import { closingNotices } from "../../../packages/core/src/index.ts";
import { noticesHandler } from "../_shared/card-notices.ts";

Deno.serve(noticesHandler("card-closing-notices", closingNotices));
