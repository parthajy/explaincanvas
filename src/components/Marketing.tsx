import Link from "next/link";
import { ldJson, type JsonLd } from "@/lib/seo";

/** Shared blocks for the marketing pages, so every lander reads and looks like the same product. */

export function JsonLdScript({ data }: { data: JsonLd | JsonLd[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(...(Array.isArray(data) ? data : [data])) }} />;
}

export function Hero({ eyebrow, title, lede, cta = { label: "Start free", href: "/login" }, secondary }: { eyebrow?: string; title: string; lede: string; cta?: { label: string; href: string } | null; secondary?: { label: string; href: string } }) {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-12 md:pt-20">
      {eyebrow && <span className="inline-block rounded-full border border-border px-3 py-1 text-[12px] text-muted">{eyebrow}</span>}
      <h1 className="mt-5 max-w-4xl text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] md:text-[68px]">{title}</h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted md:text-[19px]">{lede}</p>
      {(cta || secondary) && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {cta && (
            <Link href={cta.href} className="rounded-full bg-primary px-6 py-3 text-[15px] font-medium text-on-primary hover:bg-primary-2">
              {cta.label}
            </Link>
          )}
          {secondary && (
            <Link href={secondary.href} className="rounded-full border border-border px-6 py-3 text-[15px] hover:border-border-2">
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

export function SectionTitle({ title, lede, id }: { title: string; lede?: string; id?: string }) {
  return (
    <div id={id} className="scroll-mt-24">
      <h2 className="text-[30px] font-semibold tracking-[-0.03em] md:text-[44px]">{title}</h2>
      {lede && <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted">{lede}</p>}
    </div>
  );
}

export const STEPS = [
  { n: "01", title: "Ask", body: "Type the doubt in your own words, dictate it, or photograph the page. “Why don't action and reaction cancel?” is a perfect question." },
  { n: "02", title: "See", body: "The explanation arrives in the format that fits the idea: a diagram, steps, slides, an animation or a 3D model, with narration." },
  { n: "03", title: "Check", body: "One question at the end confirms it landed. Correct answers extend the streak and go into the parent's daily report." },
];

export function Steps() {
  return (
    <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3">
      {STEPS.map((s) => (
        <div key={s.n} className="bg-panel p-7">
          <div className="text-[12px] tabular text-faint">{s.n}</div>
          <div className="mt-3 text-[22px] font-semibold tracking-tight">{s.title}</div>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
        </div>
      ))}
    </div>
  );
}

/** A question a student could ask right now. Signed-out visitors go through login and land with it pre-filled. */
export function AskLink({ q, className }: { q: string; className?: string }) {
  const next = `/?q=${encodeURIComponent(q)}`;
  return (
    <Link href={`/login?next=${encodeURIComponent(next)}`} className={className ?? "rounded-full border border-border px-3.5 py-1.5 text-[14px] hover:border-border-2 hover:bg-panel"}>
      {q}
    </Link>
  );
}

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-border rounded-3xl border border-border bg-panel">
      {items.map((f) => (
        <details key={f.q} className="group p-6">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[17px] font-medium tracking-tight">
            <h3 className="text-[17px] font-medium tracking-tight">{f.q}</h3>
            <span className="mt-1 shrink-0 text-faint transition group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function CtaBand({ title = "Stuck on a chapter? Ask it now.", body = "Five explanations a week are free. The library is free forever.", label = "Start free", href = "/login" }: { title?: string; body?: string; label?: string; href?: string }) {
  return (
    <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-primary p-8 text-on-primary md:flex-row md:items-center md:p-12">
      <div>
        <h2 className="text-[28px] font-semibold tracking-[-0.03em] md:text-[36px]">{title}</h2>
        <p className="mt-2 text-[15px] opacity-70">{body}</p>
      </div>
      <Link href={href} className="rounded-full bg-bg px-6 py-3 text-[15px] font-medium text-text">
        {label}
      </Link>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-6 pt-6 text-[13px] text-muted">
      {items.map((it, i) => (
        <span key={it.href}>
          {i > 0 && <span className="mx-2 text-faint">/</span>}
          {i === items.length - 1 ? <span className="text-text">{it.name}</span> : <Link href={it.href} className="hover:text-text">{it.name}</Link>}
        </span>
      ))}
    </nav>
  );
}
