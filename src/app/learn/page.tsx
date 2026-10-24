import Link from "next/link";
import type { Metadata } from "next";
import { LANDERS } from "@/lib/marketing";
import { pageMetadata, breadcrumbLd } from "@/lib/seo";
import { SiteHeader, SiteFooter } from "@/components/SiteShell";
import { Hero, CtaBand, JsonLdScript, Steps, SectionTitle } from "@/components/Marketing";

export const metadata: Metadata = pageMetadata({
  title: "Chapter guides: school Science and Maths, explained visually",
  description: "Chapter-by-chapter guides for school Science and Maths with the questions students really ask. Beyond these, ask anything from any subject at any level.",
  path: "/learn",
});

export default function LearnHub() {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <JsonLdScript data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Learn", path: "/learn" }])} />
      <SiteHeader />
      <Hero eyebrow="Guides" title="Chapter guides for school Science and Maths." lede="Every page below lists the questions students in that class really ask, chapter by chapter. These are starting points: the product answers any academic question at any level, from a Class 6 doubt to a research paper." cta={null} />
      <section className="mx-auto mt-14 max-w-6xl px-6">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {LANDERS.map((l) => (
            <Link key={l.slug} href={`/learn/${l.slug}`} className="group bg-panel p-7 transition hover:bg-panel-2">
              <div className="text-[12px] text-muted">
                Class {l.classLevel} · {l.subject}
              </div>
              <div className="mt-2 text-[22px] font-semibold tracking-tight">{l.title}</div>
              <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-muted">{l.description}</p>
              <div className="mt-4 text-[14px] font-medium underline underline-offset-4">See the questions</div>
            </Link>
          ))}
        </div>
      </section>
      <section className="mx-auto mt-20 max-w-6xl px-6">
        <SectionTitle title="Three steps, every time." />
        <div className="mt-8">
          <Steps />
        </div>
      </section>
      <section className="mx-auto mt-20 max-w-6xl px-6">
        <CtaBand />
      </section>
      <SiteFooter />
    </div>
  );
}
