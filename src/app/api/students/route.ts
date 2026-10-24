import { NextResponse } from "next/server";
import { screenText, recordSafetyEvent } from "@/lib/safety";
import { z } from "zod";
import { handle, requireUser, parseBody, HttpError } from "@/lib/chat/api";
import { getPlanForAccount } from "@/lib/billing/subscription";
import { students } from "@/lib/repo";

const Body = z.object({ name: z.string().trim().min(1).max(60), classLevel: z.number().int().min(1).max(20) });

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, Body);
  const [{ plan }, count] = await Promise.all([getPlanForAccount(user.id), students.count(user.id)]);
  if (count >= plan.studentProfiles) throw new HttpError(403, "student_limit", `Your plan allows ${plan.studentProfiles} student profile${plan.studentProfiles === 1 ? "" : "s"}.`);
  if (!screenText(body.name).ok) {
    await recordSafetyEvent({ accountId: user.id, kind: "profanity", source: "student_name", sample: body.name });
    throw new HttpError(400, "name_not_allowed", "Please use the student's real name.");
  }
  const s = await students.create(user.id, body.name, body.classLevel);
  return NextResponse.json({ student: { id: s.id, name: s.name, class_level: s.class_level } });
});
