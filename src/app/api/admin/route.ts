import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/chat/api";
import { requireAdmin } from "@/lib/admin";
import { admin } from "@/lib/repo";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lesson"), lessonId: z.string().uuid(), status: z.enum(["published", "retired", "validated"]) }),
  z.object({ action: z.literal("resolveReport"), reportId: z.string().uuid(), resolution: z.string().max(200) }),
  z.object({ action: z.literal("retryJob"), jobId: z.string().uuid() }),
]);

/** POST /api/admin — the few actions the dashboard needs. Admins only. */
export const POST = handle(async (req) => {
  await requireAdmin();
  const body = await parseBody(req, Body);
  if (body.action === "lesson") await admin.setLessonStatus(body.lessonId, body.status);
  else if (body.action === "resolveReport") await admin.resolveReport(body.reportId, body.resolution);
  else await admin.retryJob(body.jobId);
  return NextResponse.json({ ok: true });
});
