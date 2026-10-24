import { NextResponse } from "next/server";
import { env, googleConfigured } from "@/lib/env";
import { buildAuthUrl, newState, GOOGLE_STATE_COOKIE } from "@/lib/auth/google";
import { findOrCreateUser } from "@/lib/auth/users";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const DEV_EMAIL = "dev-parent@explaincanvas.local";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

/**
 * GET /api/auth/google?next=/
 * Starts the Google sign-in. Until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set, and only
 * outside production, this signs the browser in as a local test parent so the product stays usable.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const e = env();
  if (!rateLimit(`google:${clientIp(request)}`, 60, 10 * 60_000).ok) return new Response("Too many sign-in attempts. Try again in a few minutes.", { status: 429 });

  if (!googleConfigured()) {
    if (e.NODE_ENV === "production") {
      return NextResponse.redirect(new URL("/login?error=google_not_configured", e.APP_URL));
    }
    logger.warn("Google sign-in not configured: signing in as the local dev parent");
    const user = await findOrCreateUser({ email: DEV_EMAIL, name: "Dev Parent" });
    const session = await createSession(user.id, request.headers.get("user-agent"));
    const res = NextResponse.redirect(new URL(user.isNew ? "/account?welcome=1" : next, e.APP_URL));
    res.cookies.set(SESSION_COOKIE, session.id, sessionCookieOptions(session.expiresAt));
    return res;
  }

  const state = newState();
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set(GOOGLE_STATE_COOKIE, `${state}|${next}`, { httpOnly: true, sameSite: "lax", secure: e.NODE_ENV === "production", path: "/", maxAge: 600 });
  return res;
}
