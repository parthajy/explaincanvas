import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { handle, requireUser, parseBody, HttpError } from "@/lib/chat/api";
import { explanations } from "@/lib/repo";
import { env } from "@/lib/env";

const Body = z.object({ explanationId: z.string().uuid() });

/** POST /api/share — mint (or return) a public read-only link for one of your explanations. */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const { explanationId } = await parseBody(req, Body);
  const ex = await explanations.getOwned(explanationId, user.id);
  if (!ex || ex.status !== "ready" || !ex.scene) throw new HttpError(404, "explanation_not_found");
  let token = (ex as { share_token?: string | null }).share_token ?? null;
  if (!token) {
    token = nanoid(12);
    await explanations.setShareToken(explanationId, token);
    const again = await explanations.getOwned(explanationId, user.id);
    token = (again as { share_token?: string | null } | null)?.share_token ?? token;
  }
  return NextResponse.json({ url: `${env().APP_URL}/s/${token}` });
});
