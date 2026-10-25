import { q } from "@/lib/db";
import { grantCredits } from "@/lib/credits/ledger";
import { FREE_TIER } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";

/**
 * Weekly refill for free accounts: top the free bucket back up towards FREE_TIER.weeklyRefillTo, never more
 * than weeklyRefillMax in one week, only for accounts that were active in the last 30 days (so dormant
 * sign-ups cost nothing). Keyed by ISO week, so the hourly job can run any number of times.
 * Free diagrams are made on the cheap model, about one rupee each, and the monthly budget guard sits above this.
 */
export async function refillFreeCredits(): Promise<number> {
  const week = isoWeek(new Date());
  const rows = await q<{ account_id: string; free_remaining: string }>(
    `select u.id account_id,
            coalesce((select sum(greatest(remaining, 0)) from credit_grants_v g where g.account_id = u.id and g.bucket = 'free' and (g.expires_at is null or g.expires_at > now())), 0)::text free_remaining
       from users u
      where not exists (select 1 from subscriptions s where s.account_id = u.id and s.status in ('active','past_due') and s.period_end > now())
        and exists (select 1 from explanations e where e.account_id = u.id and e.created_at > now() - interval '30 days')
        and not exists (select 1 from credit_ledger l where l.account_id = u.id and l.idempotency_key = 'free-refill:' || u.id || ':' || $1)`,
    [week],
  );
  let n = 0;
  for (const r of rows) {
    const amount = Math.min(FREE_TIER.weeklyRefillMax, FREE_TIER.weeklyRefillTo - Number(r.free_remaining));
    if (amount <= 0) continue;
    try {
      await grantCredits({
        accountId: r.account_id,
        amount,
        bucket: "free",
        refType: "free_refill",
        refId: week,
        key: `free-refill:${r.account_id}:${week}`,
        expiresAt: new Date(Date.now() + FREE_TIER.creditDays * 86_400_000),
        note: "weekly free credits",
      });
      n++;
    } catch (err) {
      logger.warn({ err, account: r.account_id }, "free refill failed");
    }
  }
  if (n) logger.info({ n, week }, "free credits refilled");
  return n;
}

/** "2026-W43": Monday-based ISO week, in IST. */
export function isoWeek(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  const date = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
