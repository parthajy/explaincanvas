import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyWebhook, type DodoPayment, type DodoSubscription } from "@/lib/billing/dodo";
import { handleDodoPayment, handleDodoSubscription } from "@/lib/billing/fulfil";
import { webhooks } from "@/lib/repo";
import { logger } from "@/lib/logger";

const Envelope = z.object({
  business_id: z.string().optional(),
  type: z.string(),
  timestamp: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

/**
 * POST /api/billing/webhook — Dodo Payments.
 * Signature verified on the raw body (Standard Webhooks); idempotent per webhook-id; fulfilment runs inside
 * the request so a retry from Dodo can never double-grant. Unknown event types are acknowledged and ignored.
 */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  const id = req.headers.get("webhook-id");
  const verdict = verifyWebhook(raw, { id, timestamp: req.headers.get("webhook-timestamp"), signature: req.headers.get("webhook-signature") });
  if (!verdict.ok) {
    logger.warn({ reason: verdict.reason }, "dodo webhook rejected");
    return NextResponse.json({ error: "bad_signature", reason: verdict.reason }, { status: 401 });
  }

  let json: unknown;
  let ev: z.infer<typeof Envelope>;
  try {
    json = JSON.parse(raw);
    ev = Envelope.parse(json);
  } catch {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }

  const rowId = await webhooks.insert("dodo", id!, ev.type, json);
  if (!rowId) return NextResponse.json({ ok: true, duplicate: true });

  try {
    let result: unknown = { ignored: ev.type };
    if (ev.type.startsWith("payment.")) result = await handleDodoPayment(ev.type, ev.data as unknown as DodoPayment);
    else if (ev.type.startsWith("subscription.")) result = await handleDodoSubscription(ev.type, ev.data as unknown as DodoSubscription);
    await webhooks.processed(rowId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    logger.error({ err, eventId: id, type: ev.type }, "dodo webhook processing failed");
    // Drop the row so Dodo's retry is processed again instead of being deduplicated away.
    await webhooks.remove(rowId);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
