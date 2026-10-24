import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteShell";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 pt-8">
        <nav className="flex gap-5 text-[13px] text-muted">
          <Link href="/legal/privacy" className="hover:text-text">
            Privacy
          </Link>
          <Link href="/legal/terms" className="hover:text-text">
            Terms
          </Link>
          <Link href="/legal/refunds" className="hover:text-text">
            Refunds
          </Link>
        </nav>
        <article className="mt-8 max-w-none text-[15px] leading-relaxed [&_h1]:text-[34px] [&_h1]:font-semibold [&_h1]:tracking-[-0.03em] [&_h2]:mt-9 [&_h2]:text-[18px] [&_h2]:font-semibold [&_p]:mt-3 [&_p]:text-muted [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted [&_li]:mt-1">{children}</article>
        <p className="mt-12 text-[12px] text-faint">Questions: hello@explaincanvas.com</p>
      </div>
      <SiteFooter />
    </div>
  );
}
