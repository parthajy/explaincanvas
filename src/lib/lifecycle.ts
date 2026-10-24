import { nanoid } from "nanoid";
import { z } from "zod";
import { env } from "@/lib/env";
import { q, maybe, one } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/auth/mail";
import { grantCredits } from "@/lib/credits/ledger";
import { enqueue } from "@/lib/queue/jobs";
import * as T from "@/lib/email/templates";
import { findChapter, chapterSlug, chaptersFor } from "@/lib/ncert";
import { landerFor, chapterQuestions } from "@/lib/marketing";

/**
 * Lifecycle emails that bring people back:
 *   welcome      right after sign-up
 *   nurture 0..2 on days 3, 6 and 9 after sign-up (tips, one per email)
 *   winback      after 10 quiet days: a claim link worth WINBACK_CREDITS, at most once per 30 days, twice ever
 *   streak       the evening a student's streak of 2+ days is about to lapse
 *   weekly       Sunday evening recap per account with activity that week
 *
 * Every send is keyed in email_log, so a re-run never double-sends. Tips and offers respect
 * account_settings.marketing_email; streak and weekly follow parent_report_email.
 */

export const WINBACK_CREDITS = 50;
const WINBACK_CLAIM_DAYS = 14;
const WINBACK_GRANT_DAYS = 30;

export const EmailJob = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("welcome"), userId: z.string().uuid() }),
  z.object({ kind: z.literal("nurture"), userId: z.string().uuid(), step: z.number().int().min(0).max(2) }),
  z.object({ kind: z.literal("winback"), userId: z.string().uuid() }),
  z.object({ kind: z.literal("streak"), studentId: z.string().uuid(), date: z.string() }),
  z.object({ kind: z.literal("weekly"), userId: z.string().uuid(), week: z.string() }),
  z.object({ kind: z.literal("nudge"), studentId: z.string().uuid(), date: z.string() }),
]);
export type EmailJob = z.infer<typeof EmailJob>;

export function emailKey(job: EmailJob): string {
  switch (job.kind) {
    case "welcome":
      return `welcome:${job.userId}`;
    case "nurture":
      return `nurture:${job.step}:${job.userId}`;
    case "winback":
      return `winback:${job.userId}:${new Date().toISOString().slice(0, 10)}`;
    case "streak":
      return `streak:${job.studentId}:${job.date}`;
    case "weekly":
      return `weekly:${job.userId}:${job.week}`;
    case "nudge":
      return `nudge:${job.studentId}:${job.date}`;
  }
}

interface Account {
  id: string;
  email: string;
  full_name: string | null;
  marketing_email: boolean;
  parent_report_email: boolean;
  unsub_token: string;
}

async function account(userId: string): Promise<Account | null> {
  return maybe<Account>(
    `select u.id, u.email, u.full_name, coalesce(s.marketing_email, true) marketing_email, coalesce(s.parent_report_email, true) parent_report_email, s.unsub_token
       from users u left join account_settings s on s.account_id = u.id where u.id = $1`,
    [userId],
  );
}

async function ensureSettings(userId: string): Promise<void> {
  await q(`insert into account_settings(account_id) values ($1) on conflict do nothing`, [userId]);
}

const unsubUrl = (token: string) => `${env().APP_URL}/api/email/unsubscribe?t=${token}`;

/** Claims a slot in email_log. False means this key was already sent (or attempted) before. */
async function claimLog(accountId: string, kind: string, key: string): Promise<boolean> {
  const row = await maybe<{ id: string }>(`insert into email_log(account_id, kind, key) values ($1,$2,$3) on conflict (key) do nothing returning id`, [accountId, kind, key]);
  return Boolean(row);
}

async function deliver(accountId: string, key: string, to: string, mail: T.Mail): Promise<{ sent: boolean }> {
  try {
    const { sent } = await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
    await q(`update email_log set sent = $2 where key = $1`, [key, sent]);
    return { sent };
  } catch (err) {
    // Free the slot so the job's retry can try again.
    await q(`delete from email_log where key = $1`, [key]);
    throw err;
  }
}

/** Builds and sends one lifecycle email. Called by the "email.send" job handler. */
export async function sendLifecycleEmail(job: EmailJob): Promise<unknown> {
  const appUrl = env().APP_URL;
  const key = emailKey(job);

  if (job.kind === "nudge") {
    const s = await maybe<{ account_id: string; name: string; class_level: number; quiet_days: number | null; weak_chapter: number | null; weak_subject: string | null }>(
      `select st.account_id, st.name, st.class_level,
              extract(day from now() - (select max(e.created_at) from explanations e where e.student_id = st.id))::int quiet_days,
              (select e.ncert_chapter from check_results c join explanations e on e.id = c.explanation_id where c.student_id = st.id and not c.passed and e.ncert_chapter is not null order by c.created_at desc limit 1) weak_chapter,
              (select e.subject from check_results c join explanations e on e.id = c.explanation_id where c.student_id = st.id and not c.passed and e.ncert_chapter is not null order by c.created_at desc limit 1) weak_subject
         from students st where st.id = $1`,
      [job.studentId],
    );
    if (!s) return { skipped: "student missing" };
    const a = await account(s.account_id);
    if (!a || !a.parent_report_email) return { skipped: "reports off" };
    if (!(await claimLog(a.id, "nudge", key))) return { skipped: "already sent" };
    const ch = s.weak_subject ? findChapter(s.class_level, s.weak_subject, s.weak_chapter) : null;
    const lander = landerFor(s.class_level, s.weak_subject === "maths" ? "Maths" : "Science");
    const pool = ch && lander ? chapterQuestions(lander, ch) : lander ? chaptersFor(s.class_level, lander.subject.toLowerCase()).flatMap((c) => chapterQuestions(lander, c).slice(0, 1)) : [];
    const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    const suggestion = pick ? { title: pick, url: `${appUrl}/login?next=${encodeURIComponent(`/?q=${encodeURIComponent(pick)}`)}` } : null;
    return deliver(a.id, key, a.email, T.nudge({ appUrl, studentName: s.name, quietDays: Math.max(2, s.quiet_days ?? 2), suggestion, weakChapter: ch ? `Chapter ${ch.n}, ${ch.name}` : null }));
  }

  if (job.kind === "streak") {
    const s = await maybe<{ account_id: string; name: string; current_days: number }>(
      `select st.account_id, st.name, k.current_days from students st join streaks k on k.student_id = st.id where st.id = $1`,
      [job.studentId],
    );
    if (!s) return { skipped: "student missing" };
    const a = await account(s.account_id);
    if (!a || !a.parent_report_email) return { skipped: "reports off" };
    if (!(await claimLog(a.id, "streak", key))) return { skipped: "already sent" };
    return deliver(a.id, key, a.email, T.streakAtRisk({ appUrl, studentName: s.name, days: s.current_days }));
  }

  await ensureSettings(job.userId);
  const a = await account(job.userId);
  if (!a) return { skipped: "user missing" };

  if (job.kind === "weekly") {
    if (!a.parent_report_email) return { skipped: "reports off" };
    const rows = await q<{ id: string; name: string; class_level: number; asked: string; asked_last: string; streak: number | null }>(
      `select st.id, st.name, st.class_level,
              (select count(*) from explanations e where e.student_id = st.id and e.created_at > now() - interval '7 days')::text asked,
              (select count(*) from explanations e where e.student_id = st.id and e.created_at > now() - interval '14 days' and e.created_at <= now() - interval '7 days')::text asked_last,
              (select current_days from streaks k where k.student_id = st.id) streak
         from students st where st.account_id = $1 order by st.created_at`,
      [a.id],
    );
    const students: T.WeeklyStudent[] = [];
    const weakForSuggestions: { classLevel: number; subject: string; chapter: number }[] = [];
    for (const r of rows) {
      const checks = await q<{ passed: boolean; concept_title: string | null; ncert_chapter: number | null; class_level: number | null; subject: string | null }>(
        `select c.passed, e.concept_title, e.ncert_chapter, e.class_level, e.subject from check_results c join explanations e on e.id = c.explanation_id
          where c.student_id = $1 and c.created_at > now() - interval '7 days' order by c.created_at`,
        [r.id],
      );
      const passed = new Set(checks.filter((c) => c.passed).map((c) => c.concept_title));
      const understood = [...new Set(checks.filter((c) => c.passed && c.concept_title).map((c) => c.concept_title!))];
      const struggled = [...new Set(checks.filter((c) => !c.passed && c.concept_title && !passed.has(c.concept_title)).map((c) => c.concept_title!))];
      const byChapter = new Map<string, { label: string; fails: number; classLevel: number; subject: string; chapter: number }>();
      for (const c of checks) {
        if (c.passed || !c.ncert_chapter || !c.class_level || !c.subject) continue;
        const ch = findChapter(c.class_level, c.subject, c.ncert_chapter);
        if (!ch) continue;
        const k = `${c.class_level}-${c.subject}-${ch.n}`;
        const cur = byChapter.get(k) ?? { label: `Ch ${ch.n} ${ch.name}`, fails: 0, classLevel: c.class_level, subject: c.subject, chapter: ch.n };
        cur.fails += 1;
        byChapter.set(k, cur);
      }
      const weakChapters = [...byChapter.values()].sort((x, y) => y.fails - x.fails).slice(0, 3);
      weakForSuggestions.push(...weakChapters.map((w) => ({ classLevel: w.classLevel, subject: w.subject, chapter: w.chapter })));
      students.push({ name: r.name, asked: Number(r.asked), askedLastWeek: Number(r.asked_last), understood, struggled, weakChapters: weakChapters.map(({ label, fails }) => ({ label, fails })), streak: r.streak ?? 0 });
    }
    if (students.every((s) => s.asked === 0 && s.understood.length === 0)) return { skipped: "no activity" };
    // Suggestions: questions from the weak chapters first, then published lessons for the class.
    const suggestions: { title: string; url: string }[] = [];
    for (const w of weakForSuggestions.slice(0, 3)) {
      const lander = landerFor(w.classLevel, w.subject === "maths" ? "Maths" : "Science");
      const ch = findChapter(w.classLevel, w.subject, w.chapter);
      if (!lander || !ch) continue;
      const qText = chapterQuestions(lander, ch)[0];
      if (qText) suggestions.push({ title: qText, url: `${appUrl}/learn/${lander.slug}/${chapterSlug(ch)}` });
    }
    if (suggestions.length < 3) {
      const classLevel = rows[0]?.class_level ?? null;
      const sugg = await q<{ id: string; title: string }>(`select id, title from library_lessons where status = 'published' and ($1::int is null or class_level = $1) order by random() limit $2`, [classLevel, 3 - suggestions.length]);
      suggestions.push(...sugg.map((s) => ({ title: s.title, url: `${appUrl}/library/${s.id}` })));
    }
    if (!(await claimLog(a.id, "weekly", key))) return { skipped: "already sent" };
    return deliver(a.id, key, a.email, T.weeklyRecap({ appUrl, name: a.full_name, students, suggestions }));
  }

  if (!a.marketing_email) return { skipped: "marketing off" };
  const unsubscribeUrl = unsubUrl(a.unsub_token);

  if (job.kind === "welcome") {
    if (!(await claimLog(a.id, "welcome", key))) return { skipped: "already sent" };
    return deliver(a.id, key, a.email, T.welcome({ appUrl, name: a.full_name, unsubscribeUrl }));
  }
  if (job.kind === "nurture") {
    if (!(await claimLog(a.id, "nurture", key))) return { skipped: "already sent" };
    return deliver(a.id, key, a.email, T.nurture(job.step, { appUrl, name: a.full_name, unsubscribeUrl }));
  }
  // winback
  if (!(await claimLog(a.id, "winback", key))) return { skipped: "already sent" };
  const token = nanoid(16);
  const claim = await one<{ token: string }>(
    `insert into credit_claims(account_id, token, credits, kind, expires_at) values ($1,$2,$3,'winback', now() + ($4 || ' days')::interval) returning token`,
    [a.id, token, WINBACK_CREDITS, String(WINBACK_CLAIM_DAYS)],
  );
  return deliver(a.id, key, a.email, T.winback({ appUrl, name: a.full_name, credits: WINBACK_CREDITS, claimUrl: `${appUrl}/claim/${claim.token}`, expiresInDays: WINBACK_CLAIM_DAYS, unsubscribeUrl }));
}

/** Redeems a claim link for the signed-in owner. Idempotent: a second visit reports already claimed. */
export async function redeemClaim(token: string, accountId: string): Promise<{ status: "claimed" | "already" | "expired" | "not_yours" | "missing"; credits: number }> {
  const c = await maybe<{ id: string; account_id: string; credits: number; expires_at: string; claimed_at: string | null }>(`select id, account_id, credits, expires_at, claimed_at from credit_claims where token = $1`, [token]);
  if (!c) return { status: "missing", credits: 0 };
  if (c.account_id !== accountId) return { status: "not_yours", credits: c.credits };
  if (c.claimed_at) return { status: "already", credits: c.credits };
  if (new Date(c.expires_at) < new Date()) return { status: "expired", credits: c.credits };
  await grantCredits({
    accountId,
    amount: c.credits,
    bucket: "promo",
    refType: "claim",
    refId: c.id,
    key: `claim:${c.id}`,
    expiresAt: new Date(Date.now() + WINBACK_GRANT_DAYS * 86_400_000),
    note: "Welcome back gift",
  });
  await q(`update credit_claims set claimed_at = now() where id = $1 and claimed_at is null`, [c.id]);
  return { status: "claimed", credits: c.credits };
}

/**
 * Hourly sweep: decides who is due which email and enqueues "email.send" jobs with stable keys.
 * Windows are deliberately narrow so the first run on an existing user base does not send everything at once.
 */
export async function lifecycleSweep(): Promise<Record<string, number>> {
  const counts: Record<string, number> = { nurture: 0, winback: 0, streak: 0, weekly: 0, nudge: 0 };
  const put = async (job: EmailJob) => {
    await enqueue({ kind: "email.send", payload: job, key: `email:${emailKey(job)}`, maxAttempts: 5 });
    counts[job.kind] = (counts[job.kind] ?? 0) + 1;
  };

  // Tips on days 3, 6, 9 (window: that day and the two after, so a down worker still catches up).
  for (const step of [0, 1, 2]) {
    const from = 3 * (step + 1);
    const rows = await q<{ id: string }>(
      `select u.id from users u left join account_settings s on s.account_id = u.id
        where u.created_at between now() - ($2 || ' days')::interval and now() - ($1 || ' days')::interval
          and coalesce(s.marketing_email, true)
          and not exists (select 1 from email_log l where l.account_id = u.id and l.key = $3 || u.id)`,
      [String(from), String(from + 3), `nurture:${step}:`],
    );
    for (const r of rows) await put({ kind: "nurture", userId: r.id, step });
  }

  // Win-back: 10 quiet days, at most one per 30 days, at most two ever.
  const quiet = await q<{ id: string }>(
    `with activity as (
       select u.id, greatest(u.created_at, u.last_login_at,
         (select max(last_seen_at) from sessions x where x.user_id = u.id),
         (select max(created_at) from explanations e where e.account_id = u.id)) last_active
       from users u)
     select a.id from activity a left join account_settings s on s.account_id = a.id
      where a.last_active < now() - interval '10 days'
        and coalesce(s.marketing_email, true)
        and not exists (select 1 from email_log l where l.account_id = a.id and l.kind = 'winback' and l.created_at > now() - interval '30 days')
        and (select count(*) from email_log l where l.account_id = a.id and l.kind = 'winback') < 2`,
  );
  for (const r of quiet) await put({ kind: "winback", userId: r.id });

  // Evening (18:00 to 21:59 IST): streaks of 2+ days that have not been extended today.
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  const hour = ist.getUTCHours();
  const today = ist.toISOString().slice(0, 10);
  if (hour >= 18 && hour < 22) {
    const atRisk = await q<{ student_id: string }>(`select student_id from streaks where current_days >= 2 and last_passed_on = ($1::date - 1)`, [today]);
    for (const r of atRisk) await put({ kind: "streak", studentId: r.student_id, date: today });
  }

  // Fixed evening hour: students with two quiet days get a check-in, at most every second day.
  const reportHour = env().PARENT_REPORT_HOUR_IST;
  if (hour >= reportHour && hour < reportHour + 2) {
    const quietStudents = await q<{ id: string }>(
      `select st.id from students st
        where st.created_at < now() - interval '2 days'
          and not exists (select 1 from explanations e where e.student_id = st.id and e.created_at > now() - interval '2 days')
          and not exists (select 1 from email_log l where l.kind = 'nudge' and l.key like 'nudge:' || st.id || ':%' and l.created_at > now() - interval '2 days')
          and exists (select 1 from explanations e where e.student_id = st.id)`,
    );
    for (const r of quietStudents) await put({ kind: "nudge", studentId: r.id, date: today });
  }

  // Sunday evening weekly recap for accounts with activity in the last 7 days.
  if (ist.getUTCDay() === 0 && hour >= 18) {
    const active = await q<{ account_id: string }>(`select distinct account_id from explanations where created_at > now() - interval '7 days'`);
    for (const r of active) await put({ kind: "weekly", userId: r.account_id, week: today });
  }

  logger.info(counts, "lifecycle sweep");
  return counts;
}
