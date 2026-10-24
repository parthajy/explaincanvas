import { NextResponse } from "next/server";
import { screenText, recordSafetyEvent } from "@/lib/safety";
import { z } from "zod";
import { handle, requireUser, parseBody, HttpError } from "@/lib/chat/api";
import { chats, explanations, messages } from "@/lib/repo";

/** GET /api/chats/:chatId — messages and their explanations. */
export const GET = handle(async (_req, ctx) => {
  const user = await requireUser();
  const { chatId } = await ctx.params;
  const chat = await chats.get(chatId, user.id);
  if (!chat) throw new HttpError(404, "chat_not_found");
  const [msgs, exs] = await Promise.all([messages.list(chatId), explanations.listPublic(chatId)]);
  return NextResponse.json({
    chat: { id: chat.id, title: chat.title, starred: chat.starred, student_id: chat.student_id },
    messages: msgs.map(({ id, role, content, attachments, explanation_id, seq, created_at, updated_at }) => ({ id, role, content, attachments, explanation_id, seq, created_at, updated_at })),
    explanations: exs,
  });
});

const Patch = z.object({ title: z.string().trim().min(1).max(120).optional(), starred: z.boolean().optional() });

export const PATCH = handle(async (req, ctx) => {
  const user = await requireUser();
  const { chatId } = await ctx.params;
  if (!(await chats.get(chatId, user.id))) throw new HttpError(404, "chat_not_found");
  const body = await parseBody(req, Patch);
  if (body.title && !screenText(body.title).ok) {
    await recordSafetyEvent({ accountId: user.id, kind: "profanity", source: "chat_title", sample: body.title });
    throw new HttpError(400, "title_not_allowed", "Please pick a different title.");
  }
  const row = await chats.update(chatId, body);
  return NextResponse.json({ chat: { id: row.id, title: row.title, starred: row.starred } });
});

export const DELETE = handle(async (_req, ctx) => {
  const user = await requireUser();
  const { chatId } = await ctx.params;
  if (!(await chats.get(chatId, user.id))) throw new HttpError(404, "chat_not_found");
  await chats.remove(chatId);
  return NextResponse.json({ ok: true });
});
