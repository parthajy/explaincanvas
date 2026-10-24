import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireUser, parseBody, HttpError, enforceRateLimit } from "@/lib/chat/api";
import { explanations, reports, users } from "@/lib/repo";
import { sendEmail } from "@/lib/auth/mail";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const Body = z.object({
  reason: z.enum(["wrong_fact", "wrong_diagram", "wrong_answer", "unclear", "other"]),
  detail: z.string().trim().max(1000).optional(),
});

/**
 * POST /api/explanations/:id/report — "Report a mistake". Records it, pulls the lesson from the
 * shared library until reviewed, and emails the founder.
 */
export const POST = handle(async (req, ctx) => {
  const user = await requireUser();
  enforceRateLimit("report", user.id, 10, 60 * 60_000);
  const { explanationId } = await ctx.params;
  const body = await parseBody(req, Body);
  const ex = await explanations.getOwned(explanationId, user.id);
  if (!ex) throw new HttpError(404, "explanation_not_found");

  await reports.insert({ explanationId, accountId: user.id, reason: body.reason, detail: body.detail ?? null });
  await reports.quarantineLesson(explanationId);

  const owner = await users.get(user.id);
  const e = env();
  const text = `Report on explanation ${explanationId}\nConcept: ${ex.concept_title ?? "?"} (${ex.format ?? "?"}, class ${ex.class_level ?? "?"})\nReason: ${body.reason}\nDetail: ${body.detail ?? "-"}\nFrom: ${owner?.email ?? user.id}\n\n${e.APP_URL}/c/${ex.chat_id}`;
  sendEmail({ to: e.SUPPORT_EMAIL, subject: `[ExplainCanvas] Mistake reported: ${ex.concept_title ?? explanationId}`, html: `<pre style="font-family:system-ui">${text.replace(/</g, "&lt;")}</pre>`, text }).catch((err) =>
    logger.error({ err }, "report email failed"),
  );
  return NextResponse.json({ ok: true });
});
