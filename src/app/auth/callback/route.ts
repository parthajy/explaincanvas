import { NextResponse } from "next/server";
import { verifyMagicToken } from "@/lib/auth/magic";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { env } from "@/lib/env";

/** Sign-in link landing: consumes the token, starts a session, goes to the requested page. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const base = env().APP_URL;
  const token = url.searchParams.get("token") ?? "";
  const next = url.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const user = await verifyMagicToken(token);
  if (!user) return NextResponse.redirect(new URL("/login?error=link", base));

  const session = await createSession(user.id, request.headers.get("user-agent"));
  const res = NextResponse.redirect(new URL(user.isNew ? "/account?welcome=1" : safeNext, base));
  res.cookies.set(SESSION_COOKIE, session.id, sessionCookieOptions(session.expiresAt));
  return res;
}
