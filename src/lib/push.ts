import webpush from "web-push";
import { q } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Web push to phones and browsers (VAPID). The Android app, as a Trusted Web Activity, receives these as
 * normal Android notifications. Dead subscriptions (410/404) are removed on the first failure.
 */

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configured: boolean | null = null;
function ready(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@explaincanvas.com", pub, priv);
  return (configured = true);
}

export function pushConfigured(): boolean {
  return ready();
}

export async function saveSubscription(accountId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string | null): Promise<void> {
  await q(
    `insert into push_subscriptions(account_id, endpoint, p256dh, auth, user_agent) values ($1,$2,$3,$4,$5)
     on conflict (endpoint) do update set account_id = excluded.account_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, failures = 0`,
    [accountId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent ?? null],
  );
}

export async function removeSubscription(accountId: string, endpoint: string): Promise<void> {
  await q(`delete from push_subscriptions where account_id = $1 and endpoint = $2`, [accountId, endpoint]);
}

export async function hasSubscriptions(accountId: string): Promise<boolean> {
  const r = await q<{ n: string }>(`select count(*)::text n from push_subscriptions where account_id = $1`, [accountId]);
  return Number(r[0]?.n ?? 0) > 0;
}

/** Sends to every device of an account. Never throws: a notification is a nicety, not a dependency. */
export async function pushToAccount(accountId: string, payload: PushPayload): Promise<{ sent: number; removed: number }> {
  if (!ready()) return { sent: 0, removed: 0 };
  const subs = await q<{ id: string; endpoint: string; p256dh: string; auth: string }>(`select id, endpoint, p256dh, auth from push_subscriptions where account_id = $1`, [accountId]);
  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 6, urgency: "normal" });
        sent++;
        await q(`update push_subscriptions set last_used_at = now(), failures = 0 where id = $1`, [s.id]);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await q(`delete from push_subscriptions where id = $1`, [s.id]);
          removed++;
        } else {
          await q(`update push_subscriptions set failures = failures + 1 where id = $1`, [s.id]);
          logger.warn({ err, status }, "push send failed");
        }
      }
    }),
  );
  return { sent, removed };
}
