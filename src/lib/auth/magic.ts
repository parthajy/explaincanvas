import { createHash, randomBytes } from "node:crypto";
import { q, maybe } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMagicLink } from "@/lib/auth/mail";
import { findOrCreateUser } from "@/lib/auth/users";

const TOKEN_TTL_MS = 15 * 60_000;
const MAX_LINKS_PER_HOUR = 5;

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export class TooManyLinksError extends Error {
  constructor() {
    super("too many sign-in links requested");
    this.name = "TooManyLinksError";
  }
}

/** Create a single-use sign-in link and email it. */
export async function issueMagicLink(emailRaw: string, next = "/"): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  const recent = await maybe<{ n: string }>(`select count(*)::text as n from auth_tokens where lower(email) = $1 and created_at > now() - interval '1 hour'`, [email]);
  if (Number(recent?.n ?? 0) >= MAX_LINKS_PER_HOUR) throw new TooManyLinksError();

  const token = randomBytes(32).toString("base64url");
  await q(`insert into auth_tokens(token_hash, email, expires_at) values ($1, $2, $3)`, [hash(token), email, new Date(Date.now() + TOKEN_TTL_MS)]);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const link = `${env().APP_URL}/auth/callback?token=${encodeURIComponent(token)}&next=${encodeURIComponent(safeNext)}`;
  await sendMagicLink(email, link);
}

export interface VerifiedUser {
  id: string;
  email: string;
  isNew: boolean;
}

/** Consume a link token. Creates the user on first sign-in and grants the free diagram. */
export async function verifyMagicToken(token: string): Promise<VerifiedUser | null> {
  if (!token || token.length > 128) return null;
  const row = await maybe<{ email: string }>(`update auth_tokens set consumed_at = now() where token_hash = $1 and consumed_at is null and expires_at > now() returning email`, [hash(token)]);
  if (!row) return null;
  return findOrCreateUser({ email: row.email });
}
