import { describe, it, expect } from "vitest";
import { verifyWebhook, signWebhook } from "@/lib/billing/dodo";

const secret = "whsec_" + Buffer.from("a-test-signing-key-of-decent-length").toString("base64");
const body = JSON.stringify({ type: "payment.succeeded", data: { payment_id: "pay_1", total_amount: 59900 } });

describe("Dodo webhook signature (Standard Webhooks)", () => {
  const now = 1_760_000_000_000;
  const ts = Math.floor(now / 1000);

  it("accepts a correctly signed body", () => {
    const sig = signWebhook(body, "msg_1", ts, secret);
    expect(verifyWebhook(body, { id: "msg_1", timestamp: String(ts), signature: sig }, secret, now)).toEqual({ ok: true });
  });

  it("accepts when one of several signatures matches (key rotation)", () => {
    const sig = signWebhook(body, "msg_1", ts, secret);
    expect(verifyWebhook(body, { id: "msg_1", timestamp: String(ts), signature: `v1,AAAA ${sig}` }, secret, now).ok).toBe(true);
  });

  it("rejects a tampered body, wrong id, wrong secret, stale timestamp and missing headers", () => {
    const sig = signWebhook(body, "msg_1", ts, secret);
    expect(verifyWebhook(body + " ", { id: "msg_1", timestamp: String(ts), signature: sig }, secret, now).ok).toBe(false);
    expect(verifyWebhook(body, { id: "msg_2", timestamp: String(ts), signature: sig }, secret, now).ok).toBe(false);
    expect(verifyWebhook(body, { id: "msg_1", timestamp: String(ts), signature: sig }, "whsec_" + Buffer.from("other").toString("base64"), now).ok).toBe(false);
    expect(verifyWebhook(body, { id: "msg_1", timestamp: String(ts - 600), signature: signWebhook(body, "msg_1", ts - 600, secret) }, secret, now)).toEqual({ ok: false, reason: "stale_timestamp" });
    expect(verifyWebhook(body, { id: null, timestamp: String(ts), signature: sig }, secret, now)).toEqual({ ok: false, reason: "missing_headers" });
    expect(verifyWebhook(body, { id: "msg_1", timestamp: String(ts), signature: sig }, "", now)).toEqual({ ok: false, reason: "no_secret" });
  });
});
