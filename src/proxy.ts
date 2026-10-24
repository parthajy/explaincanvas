import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "vz_session";

/** Areas that need a signed-in session. Everything else (landing, library, pricing, legal, icons) is public. */
const PRIVATE_PAGE_PREFIXES = ["/c/", "/account", "/admin", "/claim/"];
const PUBLIC_API = ["/api/health", "/api/billing/webhook", "/api/auth/magic", "/api/auth/google", "/api/email/unsubscribe"];

/**
 * Cheap optimistic gate: no session cookie means private pages go to /login and private API calls
 * get a 401. The cookie is only checked for shape here; every route and page verifies the session
 * against the database. /login is never redirected here: a stale cookie must still reach the sign-in page.
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const looksSignedIn = Boolean(cookie && /^[a-f0-9]{64}$/.test(cookie));

  const isPrivateApi = path.startsWith("/api/") && !PUBLIC_API.some((p) => path === p || path.startsWith(p + "/"));
  const isPrivatePage = PRIVATE_PAGE_PREFIXES.some((p) => path === p || path.startsWith(p));

  if (!looksSignedIn && isPrivateApi) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!looksSignedIn && isPrivatePage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
