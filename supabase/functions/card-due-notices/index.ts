// Aviso de vencimiento (02 §9). La llama pg_cron a las 10:00 de Argentina.
import { dueNotices } from "../../../packages/core/src/index.ts";
import { noticesHandler } from "../_shared/card-notices.ts";

Deno.serve(noticesHandler("card-due-notices", dueNotices));
