// Push de los avisos (02 §9). La llama pg_cron cada 5 minutos. Los avisos
// tomados ya quedan como enviados: si Expo falla, no se reintenta (D6).
import { deadTokens, type ExpoTicket, pushMessages, type PushRow } from "../../../packages/core/src/index.ts";
import { cronHandler, rpc } from "../_shared/cron.ts";

const EXPO_URL = "https://exp.host/--/api/v2/push/send";
const FETCH_TIMEOUT_MS = 10_000;

Deno.serve(cronHandler("send-push", async () => {
  const rows = await rpc<PushRow[]>("claim_push_batch");
  let sent = 0, failed = 0;
  const dead: string[] = [];

  for (const batch of pushMessages(rows)) {
    try {
      const res = await fetch(EXPO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Expo respondió ${res.status}: ${await res.text()}`);
      const tickets: ExpoTicket[] = (await res.json()).data ?? [];
      const ok = tickets.filter((t) => t.status === "ok").length;
      sent += ok;
      failed += batch.length - ok;
      dead.push(...deadTokens(batch, tickets));
    } catch (err) {
      console.error("send-push:", err);
      failed += batch.length;
    }
  }

  if (dead.length) await rpc("drop_push_tokens", { tokens: dead });
  return { claimed: rows.length, sent, failed, dropped: dead.length };
}));
