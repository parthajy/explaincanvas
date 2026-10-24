import { PLANS, PlanCode, TOPUPS, TopupCode, type Plan } from "@/lib/billing/plans";
import { grantCredits } from "@/lib/credits/ledger";
import { payments, subscriptions, users, type SubscriptionRow } from "@/lib/repo";
import { itemForProductId, type DodoPayment, type DodoSubscription } from "@/lib/billing/dodo";
import { logger } from "@/lib/logger";

/** Dodo is merchant of record: the listed price is GST-inclusive and is what the customer pays. */
export function priceItem(item: string): { kind: "subscription" | "topup"; code: string; name: string; amountPaise: number; gstPaise: number; totalPaise: number } {
  const plan = PlanCode.safeParse(item);
  if (plan.success && plan.data !== "free") {
    const p = PLANS[plan.data];
    return { kind: "subscription", code: p.code, name: p.name, amountPaise: p.pricePaise, gstPaise: 0, totalPaise: p.pricePaise };
  }
  const topup = TopupCode.safeParse(item);
  if (topup.success) {
    const t = TOPUPS[topup.data];
    return { kind: "topup", code: t.code, name: `${t.name} top-up`, amountPaise: t.pricePaise, gstPaise: 0, totalPaise: t.pricePaise };
  }
  throw new Error(`unknown item ${item}`);
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

/** Grant one month of plan credits for a subscription cycle. Idempotent per (subscription, cycle number). */
export async function grantCycle(sub: Pick<SubscriptionRow, "id" | "account_id" | "grants_made">, plan: Plan, cycleStart: Date, key?: string): Promise<void> {
  const expiresAt = addMonths(cycleStart, 1);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + plan.rolloverDays);
  await grantCredits({
    accountId: sub.account_id,
    amount: plan.creditsPerMonth,
    bucket: "plan",
    refType: "subscription",
    refId: sub.id,
    key: key ?? `plan-grant:${sub.id}:${sub.grants_made + 1}`,
    expiresAt,
    note: `${plan.name} monthly credits`,
  });
  await subscriptions.recordGrant(sub.id, sub.grants_made + 1, addMonths(cycleStart, 1));
}

/**
 * Apply a paid payment: activate or extend the subscription, or add top-up credits.
 * Safe to call more than once for the same payment.
 */
export async function fulfilPayment(paymentId: string): Promise<void> {
  const payment = await payments.get(paymentId);
  if (!payment) throw new Error(`payment ${paymentId} not found`);
  if (payment.status !== "paid") throw new Error(`payment ${paymentId} is ${payment.status}, not paid`);
  const log = logger.child({ paymentId, account: payment.account_id, item: payment.item_code });

  if (payment.kind === "topup") {
    const pack = TOPUPS[TopupCode.parse(payment.item_code)];
    await grantCredits({ accountId: payment.account_id, amount: pack.credits, bucket: "topup", refType: "payment", refId: payment.id, key: `topup:${payment.id}`, type: "topup", note: `${pack.name} top-up` });
    log.info({ credits: pack.credits }, "top-up fulfilled");
    return;
  }

  const planCode = PlanCode.parse(payment.item_code);
  const plan = PLANS[planCode];
  const providerRef = `payment:${payment.id}`;
  if (await subscriptions.byProviderRef(providerRef)) {
    log.info("subscription already fulfilled");
    return;
  }
  const now = new Date();
  const existing = await subscriptions.active(payment.account_id);
  const periodStart = existing && new Date(existing.period_end) > now && existing.plan_code === planCode ? new Date(existing.period_end) : now;
  const periodEnd = plan.interval === "year" ? addMonths(periodStart, 12) : addMonths(periodStart, 1);
  if (existing) await subscriptions.expire(existing.id);
  const created = await subscriptions.create({ accountId: payment.account_id, planCode, periodStart, periodEnd, provider: payment.provider, providerRef });
  await grantCycle(created, plan, periodStart);
  log.info({ plan: planCode, periodEnd }, "subscription fulfilled");
}

/** Hourly: grant the next monthly cycle for subscriptions whose cycle is due, expire ended ones. */
export async function runBillingCycle(): Promise<number> {
  let n = 0;
  for (const sub of await subscriptions.dueForGrant()) {
    const parsed = PlanCode.safeParse(sub.plan_code);
    if (!parsed.success || !sub.next_credit_grant_at) continue;
    // Monthly Dodo plans are granted by subscription.renewed; the cycle job only serves annual plans (monthly credits on a yearly charge) and mock/manual ones.
    if (sub.provider === "dodo" && PLANS[parsed.data].interval === "month") continue;
    await grantCycle(sub, PLANS[parsed.data], new Date(sub.next_credit_grant_at));
    n++;
  }
  await subscriptions.expirePastDue();
  return n;
}

// ---------- Dodo Payments webhooks ----------

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** Our payment row for a Dodo object: by the payment_id we put in checkout metadata, else by checkout session id. */
async function paymentFor(meta: Record<string, unknown> | null | undefined, sessionId?: string | null) {
  const pid = str(meta?.payment_id);
  if (pid) {
    const p = await payments.get(pid);
    if (p) return p;
  }
  return sessionId ? payments.byOrder(sessionId) : null;
}

async function rememberCustomer(accountId: string | null | undefined, customer: { customer_id?: string } | undefined) {
  if (accountId && customer?.customer_id) await users.setDodoCustomer(accountId, customer.customer_id);
}

/**
 * payment.* events. One-time packs are fulfilled here. For subscription charges we only record the money;
 * activation and renewals come through subscription.* events, which carry the billing dates.
 */
export async function handleDodoPayment(type: string, p: DodoPayment): Promise<unknown> {
  const pay = await paymentFor(p.metadata, null);
  if (type === "payment.succeeded") {
    if (!pay) {
      // A renewal charge or a payment started outside our checkout. Nothing to fulfil here; renewals arrive as subscription.renewed.
      return { noted: "no local payment row", subscription: p.subscription_id ?? null };
    }
    await rememberCustomer(pay.account_id, p.customer);
    await payments.markPaid(pay.id, p.payment_id, p);
    if (typeof p.total_amount === "number" && p.total_amount > 0) await payments.setTotal(pay.id, p.total_amount);
    if (pay.kind === "topup") {
      await fulfilPayment(pay.id);
      return { fulfilled: "topup", paymentId: pay.id };
    }
    return { recorded: "subscription payment", paymentId: pay.id };
  }
  if (type === "payment.failed" || type === "payment.cancelled") {
    if (pay) await payments.markFailed(pay.id, p.payment_id, p);
    return { marked: type, paymentId: pay?.id ?? null };
  }
  return { ignored: type };
}

/** subscription.* events keep our subscriptions table in step with Dodo and grant credits per cycle. */
export async function handleDodoSubscription(type: string, s: DodoSubscription): Promise<unknown> {
  const ref = s.subscription_id;
  const mapped = itemForProductId(s.product_id);
  const planCode = mapped?.kind === "subscription" ? mapped.code : null;
  const log = logger.child({ dodoSubscription: ref, type, plan: planCode });
  let sub = await subscriptions.byProviderRef(ref);
  const periodStart = new Date(s.previous_billing_date ?? s.created_at);
  const periodEnd = new Date(s.next_billing_date);

  if (type === "subscription.active" || (!sub && (type === "subscription.renewed" || type === "subscription.updated") && s.status === "active")) {
    if (!planCode) throw new Error(`unknown Dodo product ${s.product_id}`);
    if (sub) return { already: "active", id: sub.id };
    const pay = await paymentFor(s.metadata, null);
    const accountId = pay?.account_id ?? str(s.metadata?.account_id);
    if (!accountId) throw new Error("subscription without account: no metadata and no payment row");
    await rememberCustomer(accountId, s.customer);
    if (pay && pay.status !== "paid") await payments.markPaid(pay.id, `sub:${ref}`, s);
    const existing = await subscriptions.active(accountId);
    if (existing) await subscriptions.expire(existing.id);
    sub = await subscriptions.create({ accountId, planCode, periodStart, periodEnd, provider: "dodo", providerRef: ref });
    await subscriptions.syncFromProvider(sub.id, { status: "active", providerStatus: s.status });
    await grantCycle(sub, PLANS[planCode], periodStart);
    log.info({ accountId, periodEnd }, "dodo subscription activated");
    return { activated: sub.id };
  }

  if (!sub) return { ignored: type, reason: "unknown subscription" };

  switch (type) {
    case "subscription.renewed": {
      const code = PlanCode.safeParse(sub.plan_code);
      // The same cycle can arrive more than once (provider retries carry fresh webhook ids), so the grant is keyed on the cycle itself.
      const cycleKey = `renewal:${ref}:${s.payment_id ?? s.previous_billing_date}`;
      if (new Date(sub.period_end) >= periodEnd && sub.provider_status === "active") return { already: "renewed", id: sub.id };
      await subscriptions.syncFromProvider(sub.id, { status: "active", providerStatus: s.status, periodEnd, planCode: planCode ?? undefined });
      if (code.success && PLANS[code.data].interval === "month") {
        const fresh = await subscriptions.byProviderRef(ref);
        await grantCycle(fresh!, PLANS[planCode ?? code.data], periodStart, cycleKey);
      }
      log.info({ periodEnd }, "dodo subscription renewed");
      return { renewed: sub.id };
    }
    case "subscription.plan_changed": {
      if (!planCode) throw new Error(`unknown Dodo product ${s.product_id}`);
      await subscriptions.syncFromProvider(sub.id, { status: "active", providerStatus: s.status, periodEnd, planCode });
      return { planChanged: planCode };
    }
    case "subscription.past_due":
      await subscriptions.syncFromProvider(sub.id, { status: "past_due", providerStatus: s.status, periodEnd: s.past_due_ends_at ? new Date(s.past_due_ends_at) : undefined });
      return { pastDue: sub.id };
    case "subscription.on_hold":
    case "subscription.paused":
    case "subscription.expired":
    case "subscription.failed":
      await subscriptions.syncFromProvider(sub.id, { status: "expired", providerStatus: s.status });
      return { ended: type };
    case "subscription.cancelled": {
      // Cancel at period end keeps access until next_billing_date; an immediate cancel ends it now.
      const keepsAccess = s.cancel_at_next_billing_date && periodEnd > new Date();
      await subscriptions.syncFromProvider(sub.id, { status: keepsAccess ? "active" : "cancelled", providerStatus: s.status, cancelAtPeriodEnd: true, cancelledAt: s.cancelled_at ? new Date(s.cancelled_at) : new Date(), periodEnd: keepsAccess ? periodEnd : undefined });
      return { cancelled: sub.id, keepsAccess };
    }
    case "subscription.unpaused":
    case "subscription.updated": {
      const status: SubscriptionRow["status"] = s.status === "active" ? "active" : s.status === "past_due" ? "past_due" : s.status === "cancelled" ? "cancelled" : s.status === "pending" ? sub.status : "expired";
      await subscriptions.syncFromProvider(sub.id, { status, providerStatus: s.status, periodEnd, cancelAtPeriodEnd: s.cancel_at_next_billing_date, planCode: planCode ?? undefined });
      return { synced: status };
    }
    default:
      return { ignored: type };
  }
}
