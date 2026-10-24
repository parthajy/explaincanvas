import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody, HttpError, enforceRateLimit, clientIp } from "@/lib/chat/api";
import { issueMagicLink, TooManyLinksError } from "@/lib/auth/magic";

const Body = z.object({ email: z.string().email().max(200), next: z.string().max(200).optional() });

/** POST /api/auth/magic — email a single-use sign-in link. Always answers ok to avoid account enumeration. */
export const POST = handle(async (req) => {
  enforceRateLimit("magic", clientIp(req), 10, 60 * 60_000);
  const { email, next } = await parseBody(req, Body);
  try {
    await issueMagicLink(email, next ?? "/");
  } catch (err) {
    if (err instanceof TooManyLinksError) throw new HttpError(429, "too_many_links", "Too many links requested. Check your inbox or try again in an hour.");
    throw err;
  }
  return NextResponse.json({ ok: true });
});
