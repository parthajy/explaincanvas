import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireUser, parseBody, HttpError } from "@/lib/chat/api";
import { SceneDoc } from "@/lib/scene/schema";
import { grantCredits } from "@/lib/credits/ledger";
import { FREE_TIER } from "@/lib/billing/plans";
import { checks, explanations, streaks } from "@/lib/repo";

const Body = z.object({ answerIndex: z.number().int().min(0).max(3) });

function istDate(d = new Date()): string {
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/** POST /api/explanations/:id/check — grade the check question, update streak, grant the daily streak credit. */
export const POST = handle(async (req, ctx) => {
  const user = await requireUser();
  const { explanationId } = await ctx.params;
  const { answerIndex } = await parseBody(req, Body);

  const ex = await explanations.getOwned(explanationId, user.id);
  if (!ex) throw new HttpError(404, "explanation_not_found");
  const doc = SceneDoc.safeParse(ex.scene);
  if (!doc.success) throw new HttpError(409, "no_check_question");

  const passed = answerIndex === doc.data.check.answerIndex;
  await checks.insert({ explanationId, accountId: user.id, studentId: ex.student_id, answer: String(answerIndex), passed });

  let streak: { current_days: number; longest_days: number } | null = null;
  if (passed && ex.student_id) {
    const today = istDate();
    const yesterday = istDate(new Date(Date.now() - 86_400_000));
    const s = await streaks.get(ex.student_id);
    let current = 1;
    if (s?.last_passed_on === today) current = s.current_days;
    else if (s?.last_passed_on === yesterday) current = s.current_days + 1;
    const longest = Math.max(current, s?.longest_days ?? 0);
    await streaks.upsert(ex.student_id, current, longest, today);
    streak = { current_days: current, longest_days: longest };

    const expires = new Date();
    expires.setUTCDate(expires.getUTCDate() + 7);
    await grantCredits({
      accountId: user.id,
      amount: FREE_TIER.streakCreditPerDay,
      bucket: "streak",
      refType: "streak",
      refId: ex.student_id,
      key: `streak:${ex.student_id}:${today}`,
      expiresAt: expires,
      note: "daily streak credit",
    });
  }

  return NextResponse.json({ passed, correctIndex: doc.data.check.answerIndex, explanation: doc.data.check.explanation, streak });
});
