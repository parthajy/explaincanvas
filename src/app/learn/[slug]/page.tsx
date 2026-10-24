import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LANDERS, landerBySlug, landerChapters, chapterQuestions } from "@/lib/marketing";
import { chapterSlug } from "@/lib/ncert";
import { pageMetadata, faqLd, breadcrumbLd, SITE } from "@/lib/seo";
import { SiteHeader, SiteFooter } from "@/components/SiteShell";
import { Hero, SectionTitle, Steps, AskLink, FaqList, CtaBand, Breadcrumbs, JsonLdScript } from "@/components/Marketing";

export function generateStaticParams() {
  return LANDERS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const l = landerBySlug(slug);
  if (!l) return { title: "Not found" };
  return pageMetadata({ title: l.metaTitle, description: l.description, path: `/learn/${l.slug}`, keywords: [`Class ${l.classLevel} ${l.subject}`, `Class ${l.classLevel} ${l.subject} explained`, "chapter guide", "visual learning", "AI tutor India"] });
}

/** One lander per class and subject: what a student will type, what comes back, what it costs. */
export default async function LanderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = landerBySlug(slug);
  if (!l) notFound();
  const others = LANDERS.filter((x) => x.slug !== l.slug);
  const ld = [
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Learn", path: "/learn" },
      { name: l.title, path: `/learn/${l.slug}` },
    ]),
    faqLd(l.faq),
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: `Class ${l.classLevel} ${l.subject} with ExplainCanvas`,
      description: l.description,
      provider: { "@type": "Organization", name: SITE.name, url: SITE.url },
      educationalLevel: `Class ${l.classLevel}`,
      inLanguage: "en-IN",
      isAccessibleForFree: true,
      hasCourseInstance: [{ "@type": "CourseInstance", courseMode: "online", courseWorkload: "PT10M" }],
      offers: [{ "@type": "Offer", price: "0", priceCurrency: "INR", category: "free" }],
      syllabusSections: landerChapters(l).map((c) => ({ "@type": "Syllabus", name: `Chapter ${c.n}: ${c.name}`, url: `${SITE.url}/learn/${l.slug}/${chapterSlug(c)}` })),
    },
  ];

  return (
    <div className="min-h-dvh bg-bg text-text">
      <JsonLdScript data={ld} />
      <SiteHeader />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Learn", href: "/learn" }, { name: `Class ${l.classLevel} ${l.subject}`, href: `/learn/${l.slug}` }]} />
      <Hero eyebrow={`Chapter guide · Class ${l.classLevel} · ${l.subject}`} title={l.title} lede={l.intro} secondary={{ label: "Browse free lessons", href: `/library?class=${l.classLevel}` }} />

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <SectionTitle title="Every chapter, the way students ask it." lede="Tap a question to ask it, or open the chapter for more. Each answer is a picture built for that question, mapped to its textbook chapter." />
        <div className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-2">
          {landerChapters(l).map((c) => (
            <div key={c.n} className="bg-panel p-6">
              <Link href={`/learn/${l.slug}/${chapterSlug(c)}`} className="group block">
                <div className="text-[12px] tabular text-faint">Chapter {c.n}</div>
                <h3 className="mt-0.5 text-[16px] font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4">{c.name}</h3>
              </Link>
              <div className="mt-3 flex flex-wrap gap-2">
                {chapterQuestions(l, c)
                  .slice(0, 2)
                  .map((q) => (
                    <AskLink key={q} q={q} />
                  ))}
              </div>
            </div>
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
        <SectionTitle title={`Class ${l.classLevel} ${l.subject}, answered.`} />
        <div className="mt-8">
          <FaqList items={l.faq} />
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <CtaBand title={`Ask your first Class ${l.classLevel} ${l.subject} question.`} />
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-6">
        <div className="text-[13px] text-muted">Other classes</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {others.map((o) => (
            <Link key={o.slug} href={`/learn/${o.slug}`} className="rounded-full border border-border px-3.5 py-1.5 text-[13px] text-muted hover:border-border-2 hover:text-text">
              Class {o.classLevel} {o.subject}
            </Link>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
