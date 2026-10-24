import { q, maybe, tx } from "@/lib/db";
import { grantCredits } from "@/lib/credits/ledger";
import { logger } from "@/lib/logger";
import { enqueue } from "@/lib/queue/jobs";

export interface AuthUser {
  id: string;
  email: string;
  isNew: boolean;
}

/**
 * Find a user by Google subject or email, or create one. Every new account receives the free
 * diagram (8 credits) exactly once; the ledger key makes a retry harmless.
 */
export async function findOrCreateUser(input: { email: string; name?: string | null; googleSub?: string | null; avatarUrl?: string | null }): Promise<AuthUser> {
  const email = input.email.trim().toLowerCase();
  const result = await tx(async (client) => {
    const bySub = input.googleSub ? await maybe<{ id: string; email: string }>(`select id, email from users where google_sub = $1`, [input.googleSub], client) : null;
    const existing = bySub ?? (await maybe<{ id: string; email: string }>(`select id, email from users where lower(email) = $1`, [email], client));
    if (existing) {
      await q(
        `update users set last_login_at = now(),
                          google_sub = coalesce(google_sub, $2),
                          full_name = coalesce($3, full_name),
                          avatar_url = coalesce($4, avatar_url)
          where id = $1`,
        [existing.id, input.googleSub ?? null, input.name ?? null, input.avatarUrl ?? null],
        client,
      );
      return { id: existing.id, email: existing.email, isNew: false };
    }
    const created = await maybe<{ id: string; email: string }>(
      `insert into users(email, full_name, google_sub, avatar_url, last_login_at) values ($1, $2, $3, $4, now()) returning id, email`,
      [email, input.name ?? null, input.googleSub ?? null, input.avatarUrl ?? null],
      client,
    );
    if (!created) throw new Error("user insert returned nothing");
    await q(`insert into account_settings(account_id) values ($1) on conflict do nothing`, [created.id], client);
    return { id: created.id, email: created.email, isNew: true };
  });
  if (result.isNew) {
    await grantCredits({ accountId: result.id, amount: 8, bucket: "free", refType: "signup", refId: result.id, key: `free-signup:${result.id}`, note: "one free diagram" }).catch((err) =>
      logger.error({ err, userId: result.id }, "free grant failed"),
    );
    // Welcome email, a minute after sign-up so the first screen is never slowed by mail.
    enqueue({ kind: "email.send", payload: { kind: "welcome", userId: result.id }, key: `email:welcome:${result.id}`, runAfter: new Date(Date.now() + 60_000), maxAttempts: 5 }).then(
      async (jobId) => {
        if ((process.env.RUN_PIPELINE_INLINE ?? (process.env.NODE_ENV === "production" ? "false" : "true")) === "true") {
          const { runJobInline } = await import("@/lib/queue/handlers");
          setTimeout(() => void runJobInline(jobId).catch((err) => logger.error({ err }, "welcome email failed")), 61_000).unref?.();
        }
      },
      (err) => logger.error({ err, userId: result.id }, "welcome enqueue failed"),
    );
  }
  return result;
}
