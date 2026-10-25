import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireUser, parseBody } from "@/lib/chat/api";
import { saveSubscription, removeSubscription, pushConfigured } from "@/lib/push";

const Body = z.object({
  subscription: z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(5) }) }),
});

/** POST /api/push/subscribe — register this device for notifications. DELETE — unregister it. */
export const POST = handle(async (req) => {
  const user = await requireUser();
  if (!pushConfigured()) return NextResponse.json({ ok: false, reason: "push_not_configured" }, { status: 503 });
  const { subscription } = await parseBody(req, Body);
  await saveSubscription(user.id, subscription, req.headers.get("user-agent"));
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (req) => {
  const user = await requireUser();
  const { subscription } = await parseBody(req, Body.pick({ subscription: true }));
  await removeSubscription(user.id, subscription.endpoint);
  return NextResponse.json({ ok: true });
});
