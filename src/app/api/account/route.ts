import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handle, requireUser } from "@/lib/chat/api";
import { q } from "@/lib/db";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

/**
 * DELETE /api/account — the privacy policy promises deletion on request; this does it immediately.
 * Chats, photos, explanations, reports and sessions go with the user row (cascade). Payment rows
 * are detached from the user and kept for accounting.
 */
export const DELETE = handle(async () => {
  const user = await requireUser();
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;

  await q(`delete from users where id = $1`, [user.id]);
  if (sid) await destroySession(sid).catch(() => undefined);
  logger.info({ userId: user.id }, "account deleted");

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
});
