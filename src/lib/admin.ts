import { env } from "@/lib/env";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { HttpError } from "@/lib/chat/api";

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && env().ADMIN_EMAILS.includes(email!.toLowerCase());
}

/** For route handlers: 401 if signed out, 403 if not an admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "unauthenticated");
  if (!isAdminEmail(user.email)) throw new HttpError(403, "forbidden");
  return user;
}
