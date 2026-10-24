import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const GOOGLE_READY = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const DEV_BYPASS = !GOOGLE_READY && process.env.NODE_ENV !== "production";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const user = await getSessionUser().catch(() => null);
  if (user) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
  const href = `/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-[#0a0a0a] p-10 text-[#fafafa] md:flex">
        <Link href="/" className="flex items-center gap-2.5" aria-label="ExplainCanvas">
          <svg width="26" height="26" viewBox="0 0 64 64" fill="none" aria-hidden>
            <rect x="6" y="6" width="52" height="52" rx="14" fill="#fafafa" />
            <path d="M19 41 C 25 24, 31 24, 35 33 C 38 40, 42 36, 45 24" stroke="#0a0a0a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="45" cy="42" r="3.6" fill="#0a0a0a" />
          </svg>
          <span className="text-[17px] font-semibold tracking-tight">
            Explain<span className="font-normal text-[#8a8a8a]">Canvas</span>
          </span>
        </Link>
        <div>
          <h1 className="max-w-md text-[44px] font-semibold leading-[1.05] tracking-[-0.03em]">
            Type anything you are stuck on. <span className="text-[#8a8a8a]">Understand it visually.</span>
          </h1>
          <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-[#8a8a8a]">A diagram, steps, an animation or a 3D model, made for the question and checked before you see it.</p>
        </div>
        <p className="text-[12px] text-[#4a4a4a]">Classes 6 to 10 · CBSE · English</p>
      </div>

      <div className="flex items-center justify-center bg-bg p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 md:hidden">
            <LogoMark size={26} />
            <span className="text-[17px] font-semibold tracking-tight">
              Explain<span className="font-normal text-muted">Canvas</span>
            </span>
          </div>
          <h2 className="mt-10 text-[28px] font-semibold tracking-tight md:mt-0">Sign in</h2>
          <p className="mt-1 text-[15px] text-muted">One tap with Google. The parent signs in; the child learns.</p>

          <a href={href} className="mt-8 flex w-full items-center justify-center gap-3 rounded-full border border-border bg-panel px-4 py-3.5 text-[15px] font-medium transition hover:border-border-2">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
              <path fill="#FBBC05" d="M10.5 28.6A14.6 14.6 0 0 1 9.7 24c0-1.6.3-3.1.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z" />
              <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.7-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
            </svg>
            Continue with Google
          </a>

          {DEV_BYPASS && <p className="mt-3 rounded-xl border border-border bg-panel-2 p-3 text-xs text-muted">Google sign-in is not configured yet, so this button signs you in as a local test parent.</p>}
          {error === "google" && <p className="mt-3 text-sm text-danger">Google sign-in did not complete. Please try again.</p>}
          {error === "google_not_configured" && <p className="mt-3 text-sm text-danger">Sign-in is not available right now.</p>}
          {error === "link" && <p className="mt-3 text-sm text-danger">That sign-in link has expired or was already used.</p>}

          <p className="mt-8 text-[12px] leading-relaxed text-faint">
            Your first diagram is free. By continuing you agree to the{" "}
            <Link href="/legal/terms" className="underline underline-offset-2">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline underline-offset-2">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
