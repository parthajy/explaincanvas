import { z } from "zod";
import { type JobHandler, type JobKind, NonRetryableError, claimOne, complete, fail, getJob } from "@/lib/queue/jobs";
import { EmailJob, lifecycleSweep, sendLifecycleEmail } from "@/lib/lifecycle";
import { findChapter } from "@/lib/ncert";
import { runExplanation } from "@/lib/pipeline/run";
import { expireDueCredits } from "@/lib/credits/ledger";
import { runBillingCycle } from "@/lib/billing/fulfil";
import { purgeExpiredSessions } from "@/lib/auth/session";
import { checks, library, parentReports, retention, settings, students, users } from "@/lib/repo";
import { storage } from "@/lib/storage";
import { sendEmail } from "@/lib/auth/mail";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const GeneratePayload = z.object({ explanationId: z.string().uuid() });

/**
 * One handler map shared by the standalone worker and the in-process runner, so a job
 * behaves identically wherever it runs.
 */
export const handlers: Partial<Record<JobKind, JobHandler>> = {
  "explanation.generate": async (job, ctx) => {
    const { explanationId } = GeneratePayload.parse(job.payload);
    await runExplanation(explanationId, { isLastAttempt: job.attempts >= job.max_attempts, signal: ctx.signal });
    return { explanationId };
  },
  "credits.expire": async () => ({ expired: await expireDueCredits() }),
  "billing.cycle": async () => ({ granted: await runBillingCycle() }),
  "sessions.purge": async () => ({ purged: await purgeExpiredSessions() }),
  // Privacy policy: uploaded photos are kept for 90 days.
  "uploads.purge": async () => {
    let n = 0;
    for (const m of await retention.staleUploads(90)) {
      for (const a of m.attachments) await storage().delete(a.path).catch((err) => logger.warn({ err, path: a.path }, "upload delete failed"));
      await retention.clearAttachments(m.id);
      n++;
    }
    return { purged: n };
  },
  "lesson.promote": async (job) => {
    const { lessonId } = z.object({ lessonId: z.string().uuid() }).parse(job.payload);
    await library.publish(lessonId);
    return { lessonId };
  },
  "email.send": async (job) => {
    const parsed = EmailJob.safeParse(job.payload);
    if (!parsed.success) throw new NonRetryableError("bad email job payload");
    return sendLifecycleEmail(parsed.data);
  },
  "lifecycle.sweep": async () => lifecycleSweep(),
  "parent.report": async (job) => {
    // Builds the day's report and emails it to the parent through Resend.
    const { studentId, date } = z.object({ studentId: z.string().uuid(), date: z.string() }).parse(job.payload);
    const student = await students.getAny(studentId);
    if (!student) throw new NonRetryableError("student missing");
    const start = new Date(`${date}T00:00:00+05:30`);
    const end = new Date(start.getTime() + 86_400_000);
    const rows = await checks.forStudentOnDate(studentId, start, end);
    if (rows.length === 0) return { skipped: true };
    const label = (r: { concept_title: string | null; ncert_chapter: number | null; class_level: number | null; subject: string | null }) => {
      const ch = r.class_level && r.subject ? findChapter(r.class_level, r.subject, r.ncert_chapter) : null;
      return r.concept_title ? `${r.concept_title}${ch ? ` (Ch ${ch.n}, ${ch.name})` : ""}` : null;
    };
    const passedTitles = new Set(rows.filter((r) => r.passed).map((r) => r.concept_title));
    const understood = [...new Set(rows.filter((r) => r.passed).map(label).filter(Boolean))] as string[];
    const struggled = [...new Set(rows.filter((r) => !r.passed && !passedTitles.has(r.concept_title)).map(label).filter(Boolean))] as string[];
    const text =
      `${student.name} studied today.\n` +
      (understood.length ? `Understood: ${understood.join(", ")}.\n` : "") +
      (struggled.length ? `Still working on: ${struggled.join(", ")}.\n` : "") +
      `Keep it up tomorrow.`;
    await parentReports.upsert({ accountId: student.account_id, studentId, date, body: text });

    const [prefs, owner] = await Promise.all([settings.get(student.account_id), users.get(student.account_id)]);
    if (!owner || prefs?.parent_report_email === false) return { studentId, date, sent: false, reason: "email report off" };
    const appUrl = env().APP_URL;
    const li = (items: string[]) => items.map((i) => `<li>${i}</li>`).join("");
    const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#111827">
<p style="font-size:13px;color:#6b7280;margin:0 0 12px">ExplainCanvas · daily report · ${date}</p>
<h2 style="margin:0 0 12px;font-size:20px">${student.name} studied today</h2>
${understood.length ? `<p style="margin:0 0 4px"><strong>Understood</strong></p><ul style="margin:0 0 12px 18px;padding:0">${li(understood)}</ul>` : ""}
${struggled.length ? `<p style="margin:0 0 4px"><strong>Still working on</strong></p><ul style="margin:0 0 12px 18px;padding:0">${li(struggled)}</ul>` : ""}
<p style="margin:16px 0 0;font-size:14px">Understood means ${student.name} answered the check question correctly after the explanation.</p>
<p style="margin:16px 0 0;font-size:13px;color:#6b7280">Turn this report off any time from <a href="${appUrl}/account" style="color:#4f6bff">your account</a>.</p>
</div>`;
    try {
      const { sent } = await sendEmail({ to: owner.email, subject: `${student.name} studied today: ${understood.length} understood${struggled.length ? `, ${struggled.length} to revisit` : ""}`, html, text });
      if (sent) await parentReports.markSent(studentId, date);
      return { studentId, date, sent };
    } catch (err) {
      await parentReports.markFailed(studentId, date);
      throw err; // retry with backoff
    }
  },
};

/**
 * Run a specific job in the current process. Used right after enqueue in development so the
 * product works without a separate worker; the claim keeps it safe if a worker is also running.
 * Honours the queue's retry schedule: after a retryable failure it waits for run_after and claims
 * again, until the job succeeds, dead-letters, or another worker takes it. Capped at 5 minutes.
 */
export async function runJobInline(jobId: string): Promise<void> {
  const workerId = `inline-${process.pid}`;
  const deadline = Date.now() + 5 * 60_000;
  const controller = new AbortController();
  while (Date.now() < deadline) {
    const job = await claimOne(jobId, workerId);
    if (!job) {
      // Not claimable right now: either finished, taken by a worker, or backing off.
      const row = await getJob(jobId);
      if (!row || row.status !== "queued") return;
      const wait = Math.max(500, new Date(row.run_after).getTime() - Date.now());
      await new Promise((r) => setTimeout(r, Math.min(wait, 60_000)));
      continue;
    }
    const handler = handlers[job.kind];
    try {
      if (!handler) throw new NonRetryableError(`no handler for ${job.kind}`);
      const result = await handler(job, { heartbeat: async () => undefined, signal: controller.signal });
      await complete(job.id, workerId, result);
      return;
    } catch (err) {
      const retryable = !(err instanceof NonRetryableError);
      logger.error({ err, jobId, attempt: job.attempts, retryable }, "inline job failed");
      await fail(job.id, workerId, err, retryable);
      if (!retryable) return;
    }
  }
  logger.warn({ jobId }, "inline runner gave up; a worker will pick the job up");
}
