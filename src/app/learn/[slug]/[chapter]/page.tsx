import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LANDERS, landerBySlug, chapterQuestions, landerChapters } from "@/lib/marketing";
import { chapterFromSlug, chapterSlug } from "@/lib/ncert";
import { library } from "@/lib/repo";
import { pageMetadata, faqLd, breadcrumbLd, SITE } from "@/lib/seo";
import { SiteHeader, SiteFooter } from "@/components/SiteShell";
import { Hero, SectionTitle, AskLink, FaqList, CtaBand, Breadcrumbs, JsonLdScript, Steps } from "@/components/Marketing";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return LANDERS.flatMap((l) => landerChapters(l).map((c) => ({ slug: l.slug, chapter: chapterSlug(c) })));
}

function resolve(slug: string, chapter: string) {
  const l = landerBySlug(slug);
  if (!l) return null;
  const c = chapterFromSlug(l.classLevel, l.subject.toLowerCase(), chapter);
  return c ? { l, c } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; chapter: string }> }): Promise<Metadata> {
  const { slug, chapter } = await params;
  const r = resolve(slug, chapter);
  if (!r) return { title: "Not found" };
  const { l, c } = r;
  return pageMetadata({
    title: `Class ${l.classLevel} ${l.subject} Chapter ${c.n}: ${c.name}, explained visually`,
    description: `Class ${l.classLevel} ${l.subject} Chapter ${c.n} (${c.name}): the questions students ask, each answered as a diagram, steps, animation or 3D model with a check question. Free library lessons included.`,
    path: `/learn/${l.slug}/${chapter}`,
    keywords: [`Class ${l.classLevel} ${l.subject} Chapter ${c.n}`, c.name, `Class ${l.classLevel} ${c.name}`, `${c.name} explained`, `${c.name} notes`],
  });
}

/** One page per textbook chapter: "Class 9, Chapter 4" is how students and parents actually think. */
export default async function ChapterPage({ params }: { params: Promise<{ slug: string; chapter: string }> }) {
  const { slug, chapter } = await params;
  const r = resolve(slug, chapter);
  if (!r) notFound();
  const { l, c } = r;
  const subjectKey = l.subject.toLowerCase();
  const lessons = await library.listPublished({ classLevel: l.classLevel, chapter: c.n, subjectGroup: subjectKey as "science" | "maths" }).catch(() => []);
  const qs = chapterQuestions(l, c);
  const chapters = landerChapters(l);
  const prev = chapters.find((x) => x.n === c.n - 1);
  const next = chapters.find((x) => x.n === c.n + 1);
  const faq = [
    { q: `What is Chapter ${c.n} of Class ${l.classLevel} ${l.subject} about?`, a: `Chapter ${c.n}, ${c.name}, is part of the Class ${l.classLevel} ${l.subject} textbook. Ask any question from it on ExplainCanvas and the answer comes back as a picture built for that question, pitched at Class ${l.classLevel}, with one check question at the end.` },
    { q: `Can I ask about a specific exercise, like "Ex ${c.n}.2 Q3"?`, a: `Yes. Type the chapter, exercise and question number the way it appears in the book, or photograph the page and tap the question. The explanation is mapped to Chapter ${c.n} so it shows up in your parent's report under the right chapter.` },
    ...l.faq.slice(0, 2),
  ];
  const ld = [
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Learn", path: "/learn" },
      { name: `Class ${l.classLevel} ${l.subject}`, path: `/learn/${l.slug}` },
      { name: `Chapter ${c.n}: ${c.name}`, path: `/learn/${l.slug}/${chapter}` },
    ]),
    faqLd(faq),
    {
      "@context": "https://schema.org",
      "@type": "LearningResource",
      name: `Class ${l.classLevel} ${l.subject} Chapter ${c.n}: ${c.name}`,
      description: `Visual explanations for Class ${l.classLevel} ${l.subject} Chapter ${c.n}, ${c.name}.`,
      url: `${SITE.url}/learn/${l.slug}/${chapter}`,
      educationalLevel: `Class ${l.classLevel}`,
      learningResourceType: "visual explanation",
      inLanguage: "en-IN",
      isAccessibleForFree: true,
      educationalAlignment: { "@type": "AlignmentObject", alignmentType: "educationalSubject", targetName: `Class ${l.classLevel} ${l.subject} Chapter ${c.n}` },
      provider: { "@type": "Organization", name: SITE.name, url: SITE.url },
    },
  ];

  return (
    <div className="min-h-dvh bg-bg text-text">
      <JsonLdScript data={ld} />
      <SiteHeader />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Learn", href: "/learn" },
          { name: `Class ${l.classLevel} ${l.subject}`, href: `/learn/${l.slug}` },
          { name: `Chapter ${c.n}`, href: `/learn/${l.slug}/${chapter}` },
        ]}
      />
      <Hero eyebrow={`Class ${l.classLevel} ${l.subject} · Chapter ${c.n}`} title={c.name} lede={`Everything in Chapter ${c.n} of the Class ${l.classLevel} ${l.subject} textbook, answered the way your child asks it. Type the doubt, or the exercise number, or photograph the page.`} secondary={{ label: "All chapters", href: `/learn/${l.slug}` }} />

      <section className="mx-auto mt-16 max-w-6xl px-6">
        <SectionTitle title="Ask one of these." lede="Tap a question. It opens in the chat, ready to send." />
        <div className="mt-6 flex flex-wrap gap-2">
          {qs.map((q) => (
            <AskLink key={q} q={q} />
          ))}
        </div>
      </section>

      {lessons.length > 0 && (
        <section className="mx-auto mt-16 max-w-6xl px-6">
          <SectionTitle title="Free lessons from this chapter." lede="Made for a student, checked for accuracy, kept because it worked." />
          <div className="mt-6 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((x) => (
              <Link key={x.id} href={`/library/${x.id}`} className="bg-panel p-6 transition hover:bg-panel-2">
                <div className="text-[12px] capitalize text-muted">{x.format.replace("_", " ")}</div>
                <div className="mt-1 text-[17px] font-semibold tracking-tight">{x.title}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto mt-16 max-w-6xl px-6">
        <SectionTitle title="Three steps, every time." />
        <div className="mt-6">
          <Steps />
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-6">
        <SectionTitle title={`Chapter ${c.n}, answered.`} />
        <div className="mt-6">
          <FaqList items={faq} />
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-6">
        <CtaBand title={`Ask your first question from Chapter ${c.n}.`} />
      </section>

      <section className="mx-auto mt-12 flex max-w-6xl flex-wrap justify-between gap-3 px-6 text-[14px]">
        {prev ? (
          <Link href={`/learn/${l.slug}/${chapterSlug(prev)}`} className="text-muted hover:text-text">
            ← Chapter {prev.n}: {prev.name}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/learn/${l.slug}/${chapterSlug(next)}`} className="text-muted hover:text-text">
            Chapter {next.n}: {next.name} →
          </Link>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
