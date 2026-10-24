import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/admin";
import { admin } from "@/lib/repo";
import { budgetState } from "@/lib/budget";
import { formatInr } from "@/lib/billing/plans";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ReportActions, RetryJob } from "@/components/AdminActions";

export const dynamic = "force-dynamic";

const n = (v: string | number | null | undefined) => Number(v ?? 0);
const inr = (paise: string | number | null | undefined) => formatInr(n(paise));
const pct = (a: number, b: number) => (b === 0 ? "0%" : `${Math.round((a / b) * 100)}%`);

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-panel p-5">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 text-[26px] font-semibold tracking-tight tabular">{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-faint">{sub}</div>}
    </div>
  );
}

function Bars({ rows, pick, label }: { rows: { day: string; [k: string]: string }[]; pick: string; label: string }) {
  const vals = rows.map((r) => n(r[pick]));
  const max = Math.max(1, ...vals);
  return (
    <div className="bg-panel p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-[12px] text-muted">{label}, last 14 days</div>
        <div className="text-[12px] tabular text-faint">today {vals.at(-1)}</div>
      </div>
      <div className="mt-3 flex h-24 items-end gap-1">
        {rows.map((r, i) => (
          <div key={r.day} className="group relative flex-1">
            <div className="w-full rounded-sm bg-text transition-all" style={{ height: `${Math.max(2, (vals[i] / max) * 96)}px`, opacity: i === rows.length - 1 ? 1 : 0.35 }} title={`${r.day}: ${vals[i]}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdminEmail(user.email)) notFound();

  const [o, daily, recent, failures, openReports, dead, userRows, emails, [claims], safety, [safetyCounts], budget] = await Promise.all([admin.overview(), admin.daily(), admin.recentExplanations(), admin.failures(), admin.openReports(), admin.deadJobs(), admin.users(), admin.emails(), admin.claims(), admin.safety(), admin.safetyCounts(), budgetState(true)]);
  const ready30 = n(o.cache.generated) + n(o.cache.library);
  const grid = "grid gap-px overflow-hidden rounded-3xl border border-border bg-border";

  return (
    <div className="min-h-dvh bg-bg text-text">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:flex" />
          <Link href="/" className="rounded-full border border-border px-4 py-2 text-[13px] hover:border-border-2">
            Back to chat
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 pb-24">
        <section className={`${grid} sm:grid-cols-3`}>
          <Stat label="Spend this month" value={inr(budget.spentPaise)} sub={budget.budgetPaise ? `${Math.round(budget.fraction * 100)}% of the ${inr(budget.budgetPaise)} ceiling · model calls, narration, images, video` : "no ceiling set"} />
          <Stat label="Projected month end" value={inr(budget.projectedPaise)} sub={budget.projectedPaise > budget.budgetPaise && budget.budgetPaise ? "on course to hit the ceiling" : "within budget at this pace"} />
          <Stat label="Generation status" value={budget.allPaused ? "Paused for all" : budget.freePaused ? "Paused for free" : "Open"} sub={budget.allPaused ? "resumes on the 1st" : budget.freePaused ? "paid plans continue · free accounts get the library" : `free pauses at ${Math.round((budget.budgetPaise * 0.7) / 100).toLocaleString("en-IN")} INR, all at 105%`} />
        </section>

        <section className={`${grid} sm:grid-cols-2 lg:grid-cols-4`}>
          <Stat label="Users" value={o.users.total} sub={`+${o.users.d1} today · +${o.users.d7} this week`} />
          <Stat label="Explanations, 30 days" value={o.explanations.d30} sub={`${o.explanations.d1} today · ${o.explanations.inflight} in flight now`} />
          <Stat label="Library hit rate, 30 days" value={pct(n(o.cache.library), ready30)} sub={`${o.cache.library} served from library of ${ready30} · ${o.cache.followup} follow-ups`} />
          <Stat label="Active subscriptions" value={o.money.active_subs} sub={`${inr(o.money.paid30)} collected in 30 days`} />
          <Stat label="Provider cost, 30 days" value={inr(o.cost.cost30)} sub={`${inr(o.cost.cost7)} this week · ${o.cost.calls7} model calls`} />
          <Stat label="Credits used, 30 days" value={o.money.credits_used30} sub={`≈ ${inr(n(o.money.credits_used30) * 240)} at ₹2.40 a credit`} />
          <Stat label="Generation time" value={o.speed.p50 ? `${Math.round(n(o.speed.p50))}s` : "–"} sub={o.speed.p90 ? `p90 ${Math.round(n(o.speed.p90))}s · fresh generations, 7 days` : "no fresh generations in 7 days"} />
          <Stat label="Failed, 7 days" value={o.explanations.failed7} sub={failures.map((f) => `${f.code} ${f.n}`).join(" · ") || "none"} />
        </section>

        <section className={`${grid} lg:grid-cols-3`}>
          <Bars rows={daily} pick="explanations" label="Explanations" />
          <Bars rows={daily} pick="signups" label="Sign-ups" />
          <Bars rows={daily} pick="cost_paise" label="Provider cost, paise" />
        </section>

        <section className={`${grid} sm:grid-cols-2 lg:grid-cols-4`}>
          <Stat label="Queue" value={`${o.queue.queued} queued`} sub={`${o.queue.running} running · ${o.queue.succeeded24} done in 24h`} />
          <Stat label="Dead jobs" value={o.queue.dead} sub={n(o.queue.dead) > 0 ? "retry below" : "all clear"} />
          <Stat label="Library" value={o.library.published} sub={`${o.library.validated} validated · ${o.library.candidate} candidates · ${o.library.retired} retired`} />
          <Stat label="Open reports" value={o.reports.open} sub={n(o.reports.open) > 0 ? "review below" : "none open"} />
        </section>

        <section className={`${grid} sm:grid-cols-3`}>
          <Stat label="Safety events, 24h" value={safetyCounts?.d1 ?? "0"} sub={`${safetyCounts?.d7 ?? 0} this week`} />
          <Stat label="Accounts paused" value={safetyCounts?.paused ?? "0"} sub="5+ events in 24h pauses questions for a day" />
          <Stat label="Latest" value={safety[0] ? safety[0].kind.replace("_", " ") : "–"} sub={safety[0] ? `${safety[0].source} · ${safety[0].email ?? "unknown"}` : "nothing flagged"} />
        </section>

        {safety.length > 0 && (
          <section>
            <h2 className="text-[18px] font-semibold tracking-tight">Safety log</h2>
            <div className="mt-3 divide-y divide-border rounded-3xl border border-border bg-panel text-[13px]">
              {safety.map((s) => (
                <div key={s.id} className="flex flex-col gap-1 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <span className="font-medium">{s.kind.replace("_", " ")}</span> <span className="text-muted">· {s.source} · {s.email ?? "unknown"}</span>
                    {s.sample && <div className="truncate text-[12px] text-faint">{s.sample}</div>}
                  </div>
                  <div className="whitespace-nowrap text-[12px] text-faint">{new Date(s.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {openReports.length > 0 && (
          <section>
            <h2 className="text-[18px] font-semibold tracking-tight">Mistake reports</h2>
            <div className="mt-3 divide-y divide-border rounded-3xl border border-border bg-panel">
              {openReports.map((r) => (
                <div key={r.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="text-[14px]">
                      <span className="font-medium">{r.concept_title ?? "Untitled"}</span> <span className="text-muted">· {r.format} · {r.reason.replace("_", " ")}</span>
                    </div>
                    {r.detail && <div className="mt-1 text-[13px] text-muted">{r.detail}</div>}
                    <div className="mt-1 text-[12px] text-faint">
                      {new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · {r.email ?? "unknown"} · lesson {r.lesson_status ?? "not in library"} ·{" "}
                      <Link href={`/s/${r.explanation_id}`} className="underline underline-offset-2">
                        open
                      </Link>
                    </div>
                  </div>
                  <ReportActions reportId={r.id} lessonId={r.lesson_id} />
                </div>
              ))}
            </div>
          </section>
        )}

        {dead.length > 0 && (
          <section>
            <h2 className="text-[18px] font-semibold tracking-tight">Dead jobs</h2>
            <div className="mt-3 divide-y divide-border rounded-3xl border border-border bg-panel text-[13px]">
              {dead.map((j) => (
                <div key={j.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <span className="font-medium">{j.kind}</span> <span className="text-muted">· {j.attempts} attempts · {new Date(j.updated_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                    <div className="truncate text-[12px] text-faint">{j.last_error}</div>
                  </div>
                  <RetryJob jobId={j.id} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-semibold tracking-tight">Users</h2>
            <div className="text-[12px] text-muted">
              Emails sent: {emails.map((e) => `${e.kind} ${e.sent} (${e.d7} this week)`).join(" · ") || "none yet"} · Win-back claims {claims.claimed}/{claims.issued}
            </div>
          </div>
          <div className="mt-3 overflow-x-auto rounded-3xl border border-border bg-panel">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[12px] text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Students</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 text-right font-medium">Credits</th>
                  <th className="px-4 py-3 text-right font-medium">Asked</th>
                  <th className="px-4 py-3 text-right font-medium">Emails</th>
                  <th className="px-4 py-3 text-right font-medium">Flags</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {userRows.map((u) => (
                  <tr key={u.id}>
                    <td className="max-w-[260px] truncate px-4 py-2.5">
                      <a href={`mailto:${u.email}`} className="hover:underline">{u.email}</a>
                      {!u.marketing_email && <span className="ml-1 text-[11px] text-faint">(no tips)</span>}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-2.5 text-muted">{u.full_name ?? "–"}</td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 text-muted">{u.students ?? "–"}</td>
                    <td className="px-4 py-2.5">{u.plan}</td>
                    <td className="px-4 py-2.5 text-right tabular">{u.balance}</td>
                    <td className="px-4 py-2.5 text-right tabular">{u.explanations}</td>
                    <td className="px-4 py-2.5 text-right tabular">{u.emails}</td>
                    <td className={`px-4 py-2.5 text-right tabular ${n(u.flags) > 0 ? "text-danger" : ""}`}>{u.flags}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular text-muted">{new Date(u.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" })}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular text-muted">{u.days_inactive === null ? "–" : `${u.days_inactive}d ago`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold tracking-tight">Recent explanations</h2>
          <div className="mt-3 overflow-x-auto rounded-3xl border border-border bg-panel">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[12px] text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Concept</th>
                  <th className="px-4 py-3 font-medium">Format</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Credits</th>
                  <th className="px-4 py-3 text-right font-medium">Cost</th>
                  <th className="px-4 py-3 text-right font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Who</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.map((e) => (
                  <tr key={e.id} className={e.status === "failed" ? "text-danger" : ""}>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular text-muted">{new Date(e.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="max-w-[260px] truncate px-4 py-2.5">{e.concept_title ?? "–"}{e.class_level ? <span className="text-faint"> · C{e.class_level}</span> : null}</td>
                    <td className="px-4 py-2.5">{e.format ?? "–"}</td>
                    <td className="px-4 py-2.5">{e.source ?? "–"}</td>
                    <td className="px-4 py-2.5">{e.status}{e.error?.code ? <span className="text-faint"> · {e.error.code}</span> : null}</td>
                    <td className="px-4 py-2.5 text-right tabular">{e.credits_charged ?? "–"}</td>
                    <td className="px-4 py-2.5 text-right tabular">{e.cost_paise ? inr(e.cost_paise) : "–"}</td>
                    <td className="px-4 py-2.5 text-right tabular">{e.seconds ? `${e.seconds}s` : "–"}</td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 text-muted">{e.email ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
