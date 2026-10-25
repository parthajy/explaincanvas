import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { SiteHeader, SiteFooter, PageTitle } from "@/components/SiteShell";
import { DangerZone } from "@/components/DangerZone";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Delete your account",
  description: "Delete your ExplainCanvas account and all associated data: learners, chats, explanations, photos, credits and payment records. Immediate and permanent.",
  path: "/delete-account",
});

/** Public page linked from the Play Store listing: how to delete an account and everything tied to it. */
export default async function DeleteAccountPage() {
  const user = await getSessionUser().catch(() => null);
  return (
    <div className="min-h-dvh bg-bg text-text">
      <SiteHeader />
      <PageTitle eyebrow="Your data" title="Delete your account." lede="Deleting your account removes everything tied to it, immediately and permanently. This page works for the website and the Android app alike." />
      <main className="mx-auto max-w-3xl px-6 pt-10">
        <section className="rounded-3xl border border-border bg-panel p-7 text-[15px] leading-relaxed">
          <h2 className="text-[18px] font-semibold tracking-tight">What gets deleted</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
            <li>Your account and sign-in</li>
            <li>Every learner profile, streak and progress record</li>
            <li>All chats, questions, explanations and check answers</li>
            <li>Every photo you uploaded</li>
            <li>Remaining credits and email preferences</li>
            <li>Notification subscriptions on your devices</li>
          </ul>
          <p className="mt-4 text-muted">
            Payment records are kept for the period Indian tax law requires, with your personal details removed from them. Explanations that were published to the shared library stay in the library without any link to you.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-border bg-panel p-7 text-[15px] leading-relaxed">
          <h2 className="text-[18px] font-semibold tracking-tight">How to delete</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted">
            <li>Sign in with the Google account you use for ExplainCanvas.</li>
            <li>Type your email address below to confirm, then press Delete my account.</li>
            <li>You are signed out at once and the data is gone. There is no waiting period and no way to undo it.</li>
          </ol>
          <div className="mt-6">
            {user ? (
              <DangerZone email={user.email} />
            ) : (
              <Link href="/login?next=/delete-account" className="inline-block rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-on-primary">
                Sign in to delete your account
              </Link>
            )}
          </div>
        </section>

        <section className="mt-6 text-[14px] text-muted">
          Cannot sign in, or want us to do it for you? Email <a href="mailto:hello@explaincanvas.com?subject=Delete%20my%20account" className="underline underline-offset-4">hello@explaincanvas.com</a> from the address on the account. We delete within 7 days and confirm by reply. See the <Link href="/legal/privacy" className="underline underline-offset-4">privacy policy</Link> for the full details.
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
