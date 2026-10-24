import fs from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Transactional email through Resend's REST API. Without a key (local dev) the link is logged
 * and written to .data/last-magic-link.txt so you can sign in without a mailbox.
 */
export async function sendMagicLink(to: string, link: string): Promise<void> {
  const e = env();
  if (!e.RESEND_API_KEY) {
    logger.info({ to, link }, "magic link (dev: email not configured)");
    const dir = path.resolve(process.cwd(), ".data");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "last-magic-link.txt"), `${to}\n${link}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: e.MAIL_FROM,
      to: [to],
      subject: "Your ExplainCanvas sign-in link",
      html: `<p>Tap to sign in. The link works once and expires in 15 minutes.</p><p><a href="${link}">Sign in to ExplainCanvas</a></p><p style="color:#6b7280;font-size:12px">If you did not ask for this, ignore it.</p>`,
      text: `Sign in to ExplainCanvas: ${link}\nThe link works once and expires in 15 minutes.`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`resend failed: ${res.status} ${body.slice(0, 200)}`);
  }
}

/** Generic transactional send. Logged to .data/last-email.txt when Resend is not configured. */
export async function sendEmail(input: { to: string; subject: string; html: string; text: string }): Promise<{ sent: boolean }> {
  const e = env();
  if (!e.RESEND_API_KEY) {
    logger.info({ to: input.to, subject: input.subject }, "email (dev: not configured)");
    const dir = path.resolve(process.cwd(), ".data");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "last-email.txt"), `${input.to}\n${input.subject}\n\n${input.text}\n`);
    return { sent: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: e.MAIL_FROM, to: [input.to], reply_to: e.SUPPORT_EMAIL, subject: input.subject, html: input.html, text: input.text }),
  });
  if (!res.ok) throw new Error(`resend failed: ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return { sent: true };
}
