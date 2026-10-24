import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireUser, parseBody } from "@/lib/chat/api";
import { settings } from "@/lib/repo";

const Body = z.object({ parentReportEmail: z.boolean().optional(), marketingEmail: z.boolean().optional() });

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, Body);
  if (body.parentReportEmail !== undefined) await settings.setReportEmail(user.id, body.parentReportEmail);
  if (body.marketingEmail !== undefined) await settings.setMarketingEmail(user.id, body.marketingEmail);
  return NextResponse.json({ ok: true });
});
