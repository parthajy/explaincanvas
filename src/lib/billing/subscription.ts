import { PLANS, PlanCode, type Plan } from "@/lib/billing/plans";
import { subscriptions, type SubscriptionRow } from "@/lib/repo";

export type { SubscriptionRow };

/** The plan an account is on right now. Falls back to free. */
export async function getPlanForAccount(accountId: string): Promise<{ plan: Plan; subscription: SubscriptionRow | null }> {
  const sub = await subscriptions.active(accountId);
  if (!sub) return { plan: PLANS.free, subscription: null };
  const parsed = PlanCode.safeParse(sub.plan_code);
  const plan = parsed.success ? PLANS[parsed.data] : PLANS.free;
  if (new Date(sub.period_end).getTime() < Date.now()) return { plan: PLANS.free, subscription: sub };
  return { plan, subscription: sub };
}
