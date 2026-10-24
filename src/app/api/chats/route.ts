import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/chat/api";
import { chats } from "@/lib/repo";

/** GET /api/chats — the history rail. */
export const GET = handle(async (req) => {
  const user = await requireUser();
  const q = new URL(req.url).searchParams.get("q")?.trim().replace(/[%_]/g, "") || undefined;
  const rows = await chats.list(user.id, q);
  return NextResponse.json({ chats: rows.map(({ id, title, starred, last_message_at, created_at }) => ({ id, title, starred, last_message_at, created_at })) });
});
