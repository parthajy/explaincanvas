import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { env } from "@/lib/env";

/** GET /api/email/unsubscribe?t=<token>: one click stops tips and offers. No sign-in needed. */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const base = env().APP_URL;
  if (!/^[a-f0-9]{32}$/.test(t)) return NextResponse.redirect(`${base}/?unsubscribed=0`);
  await q(`update account_settings set marketing_email = false, updated_at = now() where unsub_token = $1`, [t]);
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribed</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;padding:24px">
<div><h1 style="font-size:28px;letter-spacing:-.02em;margin:0 0 10px">Done. No more tips and offers.</h1>
<p style="color:#a1a1aa;margin:0 0 22px">Sign-in links and your daily study reports are not affected. You can turn these back on from your account.</p>
<a href="${base}/" style="display:inline-block;background:#fafafa;color:#09090b;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Back to ExplainCanvas</a></div>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}
