import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { library } from "@/lib/repo";
import { SceneDoc } from "@/lib/scene/schema";
import { LessonView } from "@/components/LessonView";
import { SiteHeader, SiteFooter } from "@/components/SiteShell";
import { learningResourceLd, breadcrumbLd, SITE } from "@/lib/seo";
import { JsonLdScript } from "@/components/Marketing";
import { WhatsAppShare } from "@/components/WhatsAppShare";
import { ncertLabel } from "@/lib/ncert";

export const dynamic = "force-dynamic";

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const lesson = await library.getPublished(id);
  if (!lesson) return null;
  const doc = SceneDoc.safeParse(lesson.scene);
  return doc.success ? { lesson, doc: doc.data } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }): Promise<Metadata> {
  const { lessonId } = await params;
  const data = await load(lessonId);
  if (!data) return { title: "Lesson not found" };
  const title = `${data.doc.title}: Class ${data.doc.concept.classLevel} ${data.doc.concept.subject}`;
  const url = `${SITE.url}/library/${lessonId}`;
  return { title, description: data.doc.summary, alternates: { canonical: url }, openGraph: { title, description: data.doc.summary, url, type: "article", siteName: SITE.name }, twitter: { card: "summary_large_image", title, description: data.doc.summary } };
}

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const data = await load(lessonId);
  if (!data) notFound();
  const { doc } = data;
  const ld = [
    breadcrumbLd([{ name: "Home", path: "/" }, { name: "Library", path: "/library" }, { name: doc.title, path: `/library/${lessonId}` }]),
    learningResourceLd({ title: doc.title, description: doc.summary, path: `/library/${lessonId}`, classLevel: doc.concept.classLevel, subject: doc.concept.subject }),
  ];

  return (
    <div className="min-h-dvh bg-bg text-text">
      <JsonLdScript data={ld} />
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 pt-8">
        <Link href="/library" className="text-[13px] text-muted hover:text-text">
          ← All lessons
        </Link>
        <div className="mt-6 text-[12px] text-muted">
          Class {doc.concept.classLevel} · <span className="capitalize">{doc.concept.subject}</span>
          {doc.concept.chapter ? ` · ${doc.concept.chapter}` : ""}
        </div>
        <h1 className="mt-2 text-[34px] font-semibold leading-tight tracking-[-0.03em] md:text-[44px]">{doc.title}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">{doc.summary}</p>

        <div className="mt-10">
          <LessonView doc={doc} />
          <div className="mt-6 flex flex-wrap items-center gap-3 text-[13px] text-muted">
            <WhatsAppShare title={doc.title} />
            {ncertLabel(doc.concept.classLevel, doc.concept.subject, doc.concept.ncert?.chapter, doc.concept.ncert?.ref) && <span>{ncertLabel(doc.concept.classLevel, doc.concept.subject, doc.concept.ncert?.chapter, doc.concept.ncert?.ref)}</span>}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-5 rounded-3xl border border-border p-7 md:flex-row md:items-center">
          <div>
            <div className="text-[18px] font-semibold tracking-tight">Stuck on something else?</div>
            <p className="mt-1 text-[14px] text-muted">Type any question or photograph the page. The first diagram is free.</p>
          </div>
          <Link href="/login" className="rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-on-primary">
            Start free
          </Link>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}
