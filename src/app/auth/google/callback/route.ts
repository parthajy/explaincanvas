import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, GOOGLE_STATE_COOKIE, GoogleAuthError } from "@/lib/auth/google";
import { findOrCreateUser } from "@/lib/auth/users";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Google redirects here with ?code&state. Verifies state, exchanges the code, starts a session. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const base = env().APP_URL; // never the request origin: behind the proxy that reads as localhost
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const stored = store.get(GOOGLE_STATE_COOKIE)?.value ?? "";
  const [expectedState, nextRaw] = stored.split("|");
  const next = nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  const fail = (reason: string) => {
    logger.warn({ reason }, "google sign-in failed");
    const res = NextResponse.redirect(new URL("/login?error=google", base));
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  if (!code || !state || !expectedState || state !== expectedState) return fail("state mismatch");
  try {
    const identity = await exchangeCode(code);
    const user = await findOrCreateUser({ email: identity.email, name: identity.name, googleSub: identity.sub, avatarUrl: identity.picture });
    const session = await createSession(user.id, request.headers.get("user-agent"));
    const res = NextResponse.redirect(new URL(user.isNew ? "/account?welcome=1" : next, base));
    res.cookies.set(SESSION_COOKIE, session.id, sessionCookieOptions(session.expiresAt));
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    return fail(err instanceof GoogleAuthError ? err.message : "unexpected error");
  }
}
