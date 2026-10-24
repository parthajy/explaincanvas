import Link from "next/link";
import { Logo, LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Header and footer for public pages (pricing, library, legal). Theme-aware, monochrome. */
export function SiteHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Logo />
      <nav className="hidden items-center gap-6 text-[14px] text-muted md:flex" aria-label="Main">
        <Link href="/how-it-works" className="hover:text-text">
          How it works
        </Link>
        <Link href="/learn" className="hover:text-text">
          Classes
        </Link>
        <Link href="/library" className="hover:text-text">
          Library
        </Link>
        <Link href="/for-parents" className="hover:text-text">
          For parents
        </Link>
        <Link href="/pricing" className="hover:text-text">
          Pricing
        </Link>
      </nav>
      <div className="flex items-center gap-2">
        <ThemeToggle className="hidden sm:flex" />
        {cta && (
          <Link href="/login" className="rounded-full bg-primary px-4 py-2 text-[14px] font-medium text-on-primary">
            Start free
          </Link>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark size={22} />
          <span className="text-[12px] text-muted">Type anything you are stuck on. Understand it visually.</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-muted" aria-label="Footer">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/learn">Classes</Link>
          <Link href="/library">Library</Link>
          <Link href="/for-parents">For parents</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/refunds">Refunds</Link>
          <a href="mailto:hello@explaincanvas.com">Contact</a>
        </nav>
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-2 px-6 pb-10 text-[12px] text-faint">
        {[6, 7, 8, 9, 10].map((c) => (
          <Link key={c} href={`/learn/cbse-class-${c}-science`} className="hover:text-text">
            Class {c} Science
          </Link>
        ))}
        <Link href="/learn/cbse-class-9-maths" className="hover:text-text">
          Class 9 Maths
        </Link>
        <Link href="/learn/cbse-class-10-maths" className="hover:text-text">
          Class 10 Maths
        </Link>
      </div>
    </footer>
  );
}

export function PageTitle({ eyebrow, title, lede }: { eyebrow?: string; title: string; lede?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-10">
      {eyebrow && <span className="inline-block rounded-full border border-border px-3 py-1 text-[12px] text-muted">{eyebrow}</span>}
      <h1 className="mt-4 text-[36px] font-semibold tracking-[-0.03em] md:text-[52px]">{title}</h1>
      {lede && <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted">{lede}</p>}
    </div>
  );
}
