// Lo que comparten card-closing-notices y card-due-notices: leer los datos
// (card_notice_input), calcular los avisos con packages/core y guardarlos
// (record_card_notices), que no repite lo ya avisado.
import {
  type CardNotice,
  type DbNoticeUser,
  type NoticeInput,
  noticeInputFromDb,
  todayInArgentina,
} from "../../../packages/core/src/index.ts";
import { cronHandler, rpc } from "./cron.ts";

export function noticesHandler(label: string, build: (input: NoticeInput) => CardNotice[]) {
  return cronHandler(label, async () => {
    const today = todayInArgentina();
    const rows = await rpc<DbNoticeUser[]>("card_notice_input");
    const notices = build(noticeInputFromDb(today, rows));
    const payload = notices.map((n) => ({
      user_id: n.userId,
      kind: n.kind,
      title: n.title,
      body: n.body,
      refs: n.refs.map((r) => ({ card_id: r.cardId, period: r.period })),
    }));
    const inserted = payload.length ? await rpc<number>("record_card_notices", { notices: payload }) : 0;
    return { today, users: rows.length, notices: notices.length, inserted };
  });
}
