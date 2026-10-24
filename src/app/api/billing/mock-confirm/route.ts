import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireUser, parseBody, HttpError } from "@/lib/chat/api";
import { fulfilPayment } from "@/lib/billing/fulfil";
import { payments } from "@/lib/repo";
import { paymentsConfigured } from "@/lib/env";

const Body = z.object({ paymentId: z.string().uuid() });

/** Development only: marks a mock payment as paid and fulfils it. Disabled in production or when Razorpay is configured. */
export const POST = handle(async (req) => {
  if (process.env.NODE_ENV === "production" || paymentsConfigured()) throw new HttpError(404, "not_found");
  const user = await requireUser();
  const { paymentId } = await parseBody(req, Body);
  const pay = await payments.getOwned(paymentId, user.id);
  if (!pay || pay.provider !== "mock") throw new HttpError(404, "payment_not_found");
  await payments.markPaid(paymentId, `mock_${paymentId.slice(0, 8)}`);
  await fulfilPayment(paymentId);
  return NextResponse.json({ ok: true });
});
