import Link from "next/link";
import type { Metadata } from "next";
import { library } from "@/lib/repo";
import { SiteHeader, SiteFooter, PageTitle } from "@/components/SiteShell";
import { levelShort } from "@/lib/levels";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Free visual lessons",
  description: "Diagrams, steps, slides, animations and 3D explanations made for real questions, checked for accuracy, free to read. School to university.",
  path: "/library",
});

const SUBJECTS = ["maths", "physics", "chemistry", "biology", "science"];

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ class?: string; subject?: string }> }) {
  const sp = await searchParams;
  const classLevel = sp.class ? Number(sp.class) : undefined;
  const subject = sp.subject && SUBJECTS.includes(sp.subject) ? sp.subject : undefined;
  const lessons = await library.listPublished({ classLevel: Number.isFinite(classLevel) ? classLevel : undefined, subject });

  const chip = (active: boolean) => `rounded-full border px-3.5 py-1.5 text-[13px] capitalize transition ${active ? "border-text bg-primary text-on-primary" : "border-border text-muted hover:border-border-2 hover:text-text"}`;

  return (
    <div className="min-h-dvh bg-bg text-text">
      <SiteHeader />
      <PageTitle eyebrow="Library" title="Free visual lessons." lede="Every lesson here was made for a real question, checked for accuracy, and kept because it worked." />

      <div className="mx-auto mt-8 flex max-w-6xl flex-wrap gap-2 px-6">
        {[6, 7, 8, 9, 10, 11, 12, 13].map((c) => (
          <Link key={c} href={`/library?class=${c}${subject ? `&subject=${subject}` : ""}`} className={chip(classLevel === c)}>
            {c >= 13 ? "University and beyond" : `Class ${c}`}
          </Link>
        ))}
        <span className="mx-1 self-center text-faint">·</span>
        {SUBJECTS.map((s) => (
          <Link key={s} href={`/library?subject=${s}${classLevel ? `&class=${classLevel}` : ""}`} className={chip(subject === s)}>
            {s}
          </Link>
        ))}
      </div>

      <section className="mx-auto max-w-6xl px-6">
        {lessons.length === 0 ? (
          <p className="mt-12 text-[14px] text-muted">No published lessons here yet. Lessons appear a day after they are made and reviewed.</p>
        ) : (
          <ul className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((l) => (
              <li key={l.id} className="bg-panel">
                <Link href={`/library/${l.id}`} className="block h-full p-6 transition hover:bg-panel-2">
                  <div className="text-[12px] text-muted">
                    {levelShort(l.class_level)} · <span className="capitalize">{l.subject}</span>{l.ncert_chapter ? ` · Ch ${l.ncert_chapter}` : ""} · {l.format.replace("_", " ")}
                  </div>
                  <div className="mt-2 text-[17px] font-medium leading-snug tracking-tight">{l.title}</div>
                  <div className="mt-1 text-[13px] text-faint">{l.concept_title}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
