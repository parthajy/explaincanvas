import { NextResponse } from "next/server";
import { handle, requireUser, HttpError } from "@/lib/chat/api";
import { createPortalLink } from "@/lib/billing/dodo";
import { users } from "@/lib/repo";
import { env, paymentsConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

/** POST /api/billing/portal — a short-lived link to Dodo's customer portal (cancel, card, invoices). */
export const POST = handle(async () => {
  const user = await requireUser();
  if (!paymentsConfigured()) throw new HttpError(503, "payments_not_open");
  const profile = await users.get(user.id);
  if (!profile?.dodo_customer_id) throw new HttpError(404, "no_billing_account", "No payments on this account yet.");
  try {
    const url = await createPortalLink(profile.dodo_customer_id, `${env().APP_URL}/account`);
    return NextResponse.json({ url });
  } catch (err) {
    logger.error({ err }, "dodo portal link failed");
    throw new HttpError(502, "portal_unavailable", "Billing portal is not reachable right now. Please try again in a minute.");
  }
});
