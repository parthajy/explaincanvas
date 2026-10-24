import { NextResponse, after } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { handle, requireUser, parseBody, HttpError, enforceRateLimit } from "@/lib/chat/api";
import { tx } from "@/lib/db";
import { chats, explanations, messages, students } from "@/lib/repo";
import { enqueue } from "@/lib/queue/jobs";
import { runJobInline } from "@/lib/queue/handlers";
import { screenText, recordSafetyEvent, isPaused, SAFE_REPLY } from "@/lib/safety";
import { getPlanForAccount } from "@/lib/billing/subscription";
import { logger } from "@/lib/logger";

const Body = z.object({
  chatId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(4000),
  attachments: z
    .array(z.object({ type: z.literal("image"), path: z.string().min(1), mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]) }))
    .max(1)
    .default([]),
  /** Client-generated idempotency key so a retried request never creates two explanations. */
  requestId: z.string().min(8).max(64).optional(),
  /** Set when the student pressed "I didn't get it" on a previous explanation. */
  reexplain: z.object({ explanationId: z.string().uuid(), reason: z.string().max(200) }).optional(),
  language: z.enum(["english", "hinglish"]).optional(),
});

const MAX_IN_FLIGHT = 3;
const RUN_INLINE = (process.env.RUN_PIPELINE_INLINE ?? (process.env.NODE_ENV === "production" ? "false" : "true")) === "true";

/**
 * POST /api/chat
 * Creates the user turn, an empty assistant turn and an explanation row in one transaction, then
 * enqueues the job. Returns immediately; the client follows the rows over SSE.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  enforceRateLimit("chat", user.id, 20, 60_000);
  const body = await parseBody(req, Body);
  const requestId = body.requestId ?? nanoid(21);

  const existing = await explanations.byRequestId(requestId);
  if (existing) {
    return NextResponse.json({ chatId: existing.chat_id, explanationId: existing.id, userMessageId: existing.user_message_id, assistantMessageId: existing.assistant_message_id, replay: true });
  }

  if ((await explanations.inFlightCount(user.id)) >= MAX_IN_FLIGHT) {
    throw new HttpError(429, "too_many_in_flight", "Wait for the current explanations to finish.");
  }

  if (body.chatId && !(await chats.get(body.chatId, user.id))) throw new HttpError(404, "chat_not_found");
  if (body.studentId && !(await students.get(body.studentId, user.id))) throw new HttpError(404, "student_not_found");
  for (const a of body.attachments) {
    if (!a.path.startsWith(`${user.id}/`)) throw new HttpError(403, "attachment_forbidden");
  }

  // Safety: a fast local screen before any model runs, and a day's pause after repeated abuse.
  const screen = screenText(body.text);
  if (!screen.ok) {
    await recordSafetyEvent({ accountId: user.id, kind: "profanity", source: "chat", sample: body.text });
    throw new HttpError(400, "keep_it_school", SAFE_REPLY);
  }
  if (await isPaused(user.id)) {
    await recordSafetyEvent({ accountId: user.id, kind: "blocked", source: "chat" });
    throw new HttpError(429, "paused", "Questions are paused on this account for a day after repeated inappropriate messages. A parent can write to hello@explaincanvas.com.");
  }

  let hints: Record<string, unknown> = {};
  if (body.language === "hinglish") hints.language = "hinglish";
  if (body.reexplain) {
    const prev = await explanations.getOwned(body.reexplain.explanationId, user.id);
    if (!prev) throw new HttpError(404, "explanation_not_found");
    hints = { ...hints, reexplain: { previousFormat: prev.format, reason: body.reexplain.reason } };
  }

  const created = await tx(async (client) => {
    const chatId = body.chatId ?? (await chats.create(user.id, body.studentId ?? null, client)).id;
    const userMsg = await messages.create({ chatId, accountId: user.id, role: "user", content: body.text, attachments: body.attachments }, client);
    const asstMsg = await messages.create({ chatId, accountId: user.id, role: "assistant", content: "" }, client);
    const ex = await explanations.create(
      { requestId, chatId, accountId: user.id, studentId: body.studentId ?? null, userMessageId: userMsg.id, assistantMessageId: asstMsg.id, hints },
      client,
    );
    await messages.linkExplanation(asstMsg.id, ex.id, client);
    await chats.touch(chatId, client);
    return { chatId, userMessageId: userMsg.id, assistantMessageId: asstMsg.id, explanationId: ex.id };
  });

  const { plan } = await getPlanForAccount(user.id);
  const jobId = await enqueue({ kind: "explanation.generate", payload: { explanationId: created.explanationId }, key: `explanation:${created.explanationId}`, priority: plan.priorityRendering ? 10 : 0 });

  if (RUN_INLINE) {
    after(async () => {
      try {
        await runJobInline(jobId);
      } catch (err) {
        logger.error({ err, jobId }, "inline runner failed");
      }
    });
  }

  return NextResponse.json(created);
});
