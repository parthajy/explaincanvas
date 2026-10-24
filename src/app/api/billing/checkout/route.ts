import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireUser, parseBody, HttpError } from "@/lib/chat/api";
import { priceItem } from "@/lib/billing/fulfil";
import { createCheckoutSession, productIdFor, type DodoItem } from "@/lib/billing/dodo";
import { getPlanForAccount } from "@/lib/billing/subscription";
import { payments, users } from "@/lib/repo";
import { env, paymentsConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

const Body = z.object({ item: z.string().min(2).max(40) });

/**
 * POST /api/billing/checkout
 * Records a pending payment row and returns a hosted Dodo checkout URL. Dodo is merchant of record,
 * so GST is handled there and the price we quote is what the customer pays.
 * Without Dodo keys (local dev) it returns a mock order the dev-only confirm route can settle.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const { item } = await parseBody(req, Body);
  const priced = priceItem(item);

  const { plan, subscription } = await getPlanForAccount(user.id);
  if (priced.kind === "topup" && !plan.topupsAllowed) throw new HttpError(403, "topups_require_subscription", "Top-ups are for subscribers. Pick a plan first.");
  if (priced.kind === "subscription" && subscription && subscription.provider === "dodo" && subscription.status === "active" && subscription.plan_code === priced.code) {
    throw new HttpError(409, "already_subscribed", `You are already on ${priced.name}. Manage it from your account.`);
  }

  if (!paymentsConfigured()) {
    if (process.env.NODE_ENV === "production") throw new HttpError(503, "payments_not_open", "Payments open shortly. Your free credits and library access keep working until then.");
    const payment = await payments.create({ accountId: user.id, kind: priced.kind, itemCode: priced.code, amountPaise: priced.amountPaise, gstPaise: 0, totalPaise: priced.amountPaise, provider: "mock" });
    return NextResponse.json({ provider: "mock", paymentId: payment.id, amount: priced.amountPaise, name: priced.name });
  }
  if (!productIdFor(priced.code)) throw new HttpError(503, "product_not_configured", "This item is not available yet.");

  const payment = await payments.create({ accountId: user.id, kind: priced.kind, itemCode: priced.code, amountPaise: priced.amountPaise, gstPaise: 0, totalPaise: priced.amountPaise, provider: "dodo" });
  const profile = await users.get(user.id);
  let session;
  try {
    session = await createCheckoutSession({
    item: priced.code as DodoItem,
    paymentId: payment.id,
    accountId: user.id,
    email: user.email,
    name: profile?.full_name ?? null,
    dodoCustomerId: profile?.dodo_customer_id ?? null,
      returnUrl: `${env().APP_URL}/account?checkout=${priced.kind}`,
    });
  } catch (err) {
    logger.error({ err, item: priced.code }, "dodo checkout session failed");
    throw new HttpError(502, "checkout_unavailable", "Could not open checkout right now. Please try again in a minute.");
  }
  await payments.setOrder(payment.id, session.session_id);
  if (!session.checkout_url) throw new HttpError(502, "checkout_unavailable", "Could not open checkout. Please try again.");
  return NextResponse.json({ provider: "dodo", paymentId: payment.id, url: session.checkout_url, name: priced.name });
});
