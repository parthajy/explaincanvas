import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { redeemClaim } from "@/lib/lifecycle";
import { SiteHeader, SiteFooter } from "@/components/SiteShell";

export const dynamic = "force-dynamic";

const COPY: Record<string, { title: string; body: string }> = {
  claimed: { title: "credits added", body: "They are in your account now and good for 30 days. Ask anything your child is stuck on." },
  already: { title: "already claimed", body: "These credits were added earlier. They are waiting in your account." },
  expired: { title: "this link has expired", body: "The offer was open for two weeks. Your free diagram and the library are still there." },
  not_yours: { title: "this link belongs to another account", body: "Sign in with the email the offer was sent to, then open the link again." },
  missing: { title: "link not found", body: "Check the link in your email, or just head to the chat." },
};

/** /claim/<token>: redeems a win-back gift for the signed-in owner and sends them into the chat. */
export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) redirect("/");
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/claim/${token}`)}`);
  const result = await redeemClaim(token, user.id);
  const copy = COPY[result.status];
  const good = result.status === "claimed" || result.status === "already";
  return (
    <div className="min-h-dvh bg-bg text-text">
      {good && <meta httpEquiv="refresh" content="4;url=/" />}
      <SiteHeader />
      <main className="mx-auto flex max-w-xl flex-col items-center px-6 pt-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-[22px] font-semibold tabular">{good ? `+${result.credits}` : "·"}</div>
        <h1 className="mt-6 text-[32px] font-semibold leading-tight tracking-[-0.03em] md:text-[40px]">
          {good ? `${result.credits} ` : ""}
          {copy.title}
        </h1>
        <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted">{copy.body}</p>
        <Link href="/" className="mt-8 rounded-full bg-primary px-6 py-3 text-[14px] font-medium text-on-primary">
          {good ? "Start asking" : "Go to chat"}
        </Link>
        {good && <p className="mt-3 text-[12px] text-faint">Taking you there in a moment.</p>}
      </main>
      <SiteFooter />
    </div>
  );
}
