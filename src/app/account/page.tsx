import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getPlanForAccount } from "@/lib/billing/subscription";
import { creditBalance, recentLedger } from "@/lib/credits/ledger";
import { settings, students } from "@/lib/repo";
import { AddStudentForm } from "@/components/AddStudentForm";
import { ReportToggle } from "@/components/ReportToggle";
import { levelLabel } from "@/lib/levels";
import { isAppMode } from "@/lib/appmode";
import { ManageBillingButton } from "@/components/CheckoutButton";
import { PushToggle } from "@/components/PushToggle";
import { DangerZone } from "@/components/DangerZone";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string; checkout?: string; status?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  const { welcome, checkout, status } = await searchParams;
  const app = await isAppMode();
  const paidJustNow = checkout && status !== "failed" && status !== "cancelled";
  const [{ plan, subscription }, balance, kids, ledger, prefs] = await Promise.all([getPlanForAccount(user.id), creditBalance(user.id), students.listWithStreaks(user.id), recentLedger(user.id), settings.get(user.id)]);

  return (
    <div className="min-h-dvh bg-bg text-text">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:flex" />
          <Link href="/" className="rounded-full bg-primary px-4 py-2 text-[14px] font-medium text-on-primary">
            Back to chat
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">
        <h1 className="text-[34px] font-semibold tracking-[-0.03em]">{welcome ? "Welcome. One quick thing." : "Account"}</h1>
        <p className="mt-1 text-[15px] text-muted">{welcome ? "Add a learner, yourself or your child, so every explanation is pitched at the right level." : user.email}</p>

        {checkout && (
          <div className="mt-6 rounded-2xl border border-border bg-panel px-5 py-4 text-[14px]">
            {paidJustNow ? (
              <>
                <span className="font-medium">Payment received.</span> {checkout === "topup" ? "Credits" : "Your plan and credits"} appear here within a minute, as soon as the payment provider confirms. Refresh if you do not see them yet.
              </>
            ) : (
              <>
                <span className="font-medium">Payment did not go through.</span> Nothing was charged. You can try again from <Link href="/pricing" className="underline underline-offset-4">pricing</Link>.
              </>
            )}
          </div>
        )}

        <section className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2">
          <div className="bg-panel p-6">
            <div className="text-[13px] text-muted">Plan</div>
            <div className="mt-1 text-[24px] font-semibold tracking-tight">{plan.name}</div>
            {subscription && (
              <div className="mt-1 text-[12px] text-faint">
                {subscription.cancel_at_period_end ? "Ends" : subscription.status === "past_due" ? "Payment due, access until" : "Renews"} {new Date(subscription.period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              {app ? (
                <span className="text-[13px] text-muted">Plans and credits are managed at explaincanvas.com in a browser.</span>
              ) : (
                <>
                  <Link href="/pricing" className="text-[14px] font-medium underline underline-offset-4">
                    {plan.code === "free" ? "Choose a plan" : "Change plan or top up"}
                  </Link>
                  {subscription?.provider === "dodo" && <ManageBillingButton />}
                </>
              )}
            </div>
          </div>
          <div className="bg-panel p-6">
            <div className="text-[13px] text-muted">Credits</div>
            <div className="mt-1 text-[24px] font-semibold tracking-tight tabular">{balance}</div>
            <div className="mt-1 text-[12px] text-faint">A diagram is 8, a library lesson 1.</div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-[18px] font-semibold tracking-tight">Learners</h2>
          <p className="mt-1 text-[14px] text-muted">
            Your plan allows {plan.studentProfiles}. Each learner&apos;s level tunes every explanation, from Class 6 to PhD.
          </p>
          <div className="mt-4 space-y-3">
            {kids.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-3xl border border-border bg-panel p-5">
                <div>
                  <div className="text-[16px] font-medium">{s.name}</div>
                  <div className="text-[13px] text-muted">{levelLabel(s.class_level)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-medium tabular">{s.current_days ?? 0} day streak</div>
                  <div className="text-[12px] text-faint">best {s.longest_days ?? 0}</div>
                </div>
              </div>
            ))}
            {kids.length < plan.studentProfiles && <AddStudentForm />}
            {welcome && kids.length > 0 && (
              <Link href="/" className="inline-block rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-on-primary">
                Start the first question
              </Link>
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-[18px] font-semibold tracking-tight">Email and notifications</h2>
          <div className="mt-3 space-y-3">
            <PushToggle />
            <ReportToggle on={prefs?.parent_report_email !== false} email={user.email} />
            <ReportToggle on={prefs?.marketing_email !== false} email={user.email} field="marketingEmail" title="Tips and offers" description="Occasional emails on getting more from ExplainCanvas, and free credits when we have them. Never more than one a few days." />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-[18px] font-semibold tracking-tight">Recent credit activity</h2>
          <div className="mt-3 divide-y divide-border rounded-3xl border border-border bg-panel text-[14px]">
            {ledger.length === 0 && <div className="p-5 text-muted">Nothing yet.</div>}
            {ledger.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="capitalize">{l.entry_type}</span>
                  {l.note && <span className="text-muted"> · {l.note}</span>}
                </div>
                <div className={`tabular font-medium ${l.amount >= 0 ? "text-success" : "text-text"}`}>
                  {l.amount >= 0 ? "+" : ""}
                  {l.amount}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <DangerZone email={user.email} />
        </section>
      </main>
    </div>
  );
}
