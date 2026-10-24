import { createHmac, timingSafeEqual } from "node:crypto";
import { env, paymentsConfigured } from "@/lib/env";
import { PLANS, TOPUPS, type PlanCode, type TopupCode } from "@/lib/billing/plans";

/**
 * Dodo Payments (merchant of record) through its REST API. No SDK: three calls matter and they are small.
 *   - hosted checkout sessions (plans are subscription products, packs are one-time products)
 *   - customer portal links (cancel, change card, invoices)
 *   - Standard Webhooks signature verification
 * Dodo collects GST and remits it, so the prices we send are what the customer pays.
 */

export type DodoItem = PlanCode | TopupCode;

/** Our item codes to Dodo product ids. Env overrides let test and live mode use different catalogues. */
export function productIdFor(item: string): string | null {
  const e = env();
  const map: Record<string, string | undefined> = {
    student: e.DODO_PRODUCT_STUDENT,
    pro: e.DODO_PRODUCT_PRO,
    max: e.DODO_PRODUCT_MAX,
    max_annual: e.DODO_PRODUCT_MAX_ANNUAL,
    topup_small: e.DODO_PRODUCT_TOPUP_SMALL,
    topup_medium: e.DODO_PRODUCT_TOPUP_MEDIUM,
    topup_large: e.DODO_PRODUCT_TOPUP_LARGE,
  };
  return map[item] ?? null;
}

/** Reverse lookup used by webhooks that only carry a product id. */
export function itemForProductId(productId: string): { kind: "subscription"; code: PlanCode } | { kind: "topup"; code: TopupCode } | null {
  for (const code of Object.keys(PLANS) as PlanCode[]) if (code !== "free" && productIdFor(code) === productId) return { kind: "subscription", code };
  for (const code of Object.keys(TOPUPS) as TopupCode[]) if (productIdFor(code) === productId) return { kind: "topup", code };
  return null;
}

export function dodoBaseUrl(): string {
  return env().DODO_MODE === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
}

async function dodo<T>(path: string, init: { method: "GET" | "POST" | "PATCH"; body?: unknown }): Promise<T> {
  const e = env();
  if (!paymentsConfigured()) throw new Error("payments not configured");
  const res = await fetch(`${dodoBaseUrl()}${path}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${e.DODO_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`dodo ${init.method} ${path} failed: ${res.status} ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export interface CheckoutSession {
  session_id: string;
  checkout_url: string | null;
}

/**
 * Hosted checkout. Metadata rides along to the resulting payment and subscription objects,
 * which is how the webhook finds our payment row without trusting the browser.
 */
export async function createCheckoutSession(input: {
  item: DodoItem;
  paymentId: string;
  accountId: string;
  email: string;
  name?: string | null;
  dodoCustomerId?: string | null;
  returnUrl: string;
}): Promise<CheckoutSession> {
  const productId = productIdFor(input.item);
  if (!productId) throw new Error(`no Dodo product configured for ${input.item}`);
  return dodo<CheckoutSession>("/checkouts", {
    method: "POST",
    body: {
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: input.dodoCustomerId ? { customer_id: input.dodoCustomerId } : { email: input.email, name: input.name ?? undefined },
      billing_address: { country: "IN" },
      billing_currency: "INR",
      return_url: input.returnUrl,
      metadata: { payment_id: input.paymentId, account_id: input.accountId, item: input.item },
      allowed_payment_method_types: ["upi_collect", "upi_intent", "credit", "debit"],
      customization: { theme: "system", show_order_details: true },
      feature_flags: { allow_discount_code: true, allow_currency_selection: false },
    },
  });
}

/** Self-serve billing: cancel, change card, download invoices. Returns a short-lived link. */
export async function createPortalLink(dodoCustomerId: string, returnUrl: string): Promise<string> {
  const qs = new URLSearchParams({ return_url: returnUrl }).toString();
  const r = await dodo<{ link: string }>(`/customers/${encodeURIComponent(dodoCustomerId)}/customer-portal/session?${qs}`, { method: "POST" });
  return r.link;
}

/** Fetch a subscription (used to reconcile when a webhook arrives out of order). */
export async function getSubscription(subscriptionId: string): Promise<DodoSubscription> {
  return dodo<DodoSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "GET" });
}

export interface DodoCustomer {
  customer_id: string;
  email: string;
  name?: string | null;
}

export interface DodoPayment {
  payload_type?: "Payment";
  payment_id: string;
  status?: string | null;
  total_amount: number;
  currency: string;
  tax?: number | null;
  metadata?: Record<string, string | number | boolean> | null;
  subscription_id?: string | null;
  product_cart?: { product_id: string; quantity: number }[] | null;
  customer: DodoCustomer;
  created_at: string;
  error_code?: string | null;
  error_message?: string | null;
}

export interface DodoSubscription {
  payload_type?: "Subscription";
  subscription_id: string;
  product_id: string;
  status: "pending" | "active" | "on_hold" | "paused" | "cancelled" | "failed" | "expired" | "past_due";
  metadata?: Record<string, string | number | boolean> | null;
  customer: DodoCustomer;
  next_billing_date: string;
  previous_billing_date: string;
  created_at: string;
  cancel_at_next_billing_date?: boolean;
  cancelled_at?: string | null;
  recurring_pre_tax_amount?: number;
  currency?: string;
  /** Set on subscription.renewed: the renewal payment. */
  payment_id?: string | null;
  past_due_ends_at?: string | null;
}

/**
 * Standard Webhooks verification (what Dodo uses): HMAC-SHA256 over "{id}.{timestamp}.{body}" with the
 * base64 secret after the "whsec_" prefix, compared against each "v1,<base64>" entry in webhook-signature.
 */
export function verifyWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string | undefined = env().DODO_WEBHOOK_SECRET,
  now: number = Date.now(),
  toleranceSeconds = 300,
): { ok: true } | { ok: false; reason: string } {
  if (!secret) return { ok: false, reason: "no_secret" };
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing_headers" };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp" };
  if (Math.abs(now / 1000 - ts) > toleranceSeconds) return { ok: false, reason: "stale_timestamp" };
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  if (key.length === 0) return { ok: false, reason: "bad_secret" };
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
  for (const part of signature.split(/\s+/)) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const given = Buffer.from(sig, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, reason: "no_match" };
}

/** Test helper and local simulator: sign a body the way Dodo would. */
export function signWebhook(rawBody: string, id: string, timestampSeconds: number, secret: string): string {
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${timestampSeconds}.${rawBody}`).digest("base64")}`;
}
