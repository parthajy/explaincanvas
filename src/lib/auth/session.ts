import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { q, maybe } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Database-backed sessions. The cookie carries an opaque random id; nothing about the user is
 * stored client-side, and a session can be revoked by deleting its row.
 */
export const SESSION_COOKIE = "vz_session";

export interface SessionUser {
  id: string;
  email: string;
  full_name: string | null;
}

export async function createSession(userId: string, userAgent?: string | null): Promise<{ id: string; expiresAt: Date }> {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + env().SESSION_TTL_DAYS * 86_400_000);
  await q(`insert into sessions(id, user_id, expires_at, user_agent) values ($1, $2, $3, $4)`, [id, userId, expiresAt, userAgent ?? null]);
  return { id, expiresAt };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function getSessionUserById(sessionId: string): Promise<SessionUser | null> {
  const row = await maybe<SessionUser & { session_id: string }>(
    `select u.id, u.email, u.full_name, s.id as session_id
       from sessions s join users u on u.id = s.user_id
      where s.id = $1 and s.expires_at > now()`,
    [sessionId],
  );
  if (!row) return null;
  // Sliding window: bump last_seen at most once a minute.
  void q(`update sessions set last_seen_at = now(), expires_at = greatest(expires_at, now() + ($2 || ' days')::interval) where id = $1 and last_seen_at < now() - interval '1 minute'`, [
    sessionId,
    String(env().SESSION_TTL_DAYS),
  ]).catch(() => undefined);
  return { id: row.id, email: row.email, full_name: row.full_name };
}

/** The signed-in user for the current request, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return null;
  return getSessionUserById(id);
}

export async function destroySession(sessionId: string): Promise<void> {
  await q(`delete from sessions where id = $1`, [sessionId]);
}

export async function purgeExpiredSessions(): Promise<number> {
  const rows = await q<{ n: string }>(`with d as (delete from sessions where expires_at < now() returning 1) select count(*)::text as n from d`);
  return Number(rows[0]?.n ?? 0);
}
