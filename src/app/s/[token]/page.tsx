import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { explanations } from "@/lib/repo";
import { SceneDoc } from "@/lib/scene/schema";
import { LessonView } from "@/components/LessonView";
import { SiteHeader, SiteFooter } from "@/components/SiteShell";
import { WhatsAppShare } from "@/components/WhatsAppShare";
import { ncertLabel } from "@/lib/ncert";

export const dynamic = "force-dynamic";

async function load(token: string) {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(token)) return null;
  const ex = await explanations.getByShareToken(token);
  if (!ex) return null;
  const doc = SceneDoc.safeParse(ex.scene);
  return doc.success ? { ex, doc: doc.data } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await load(token);
  if (!data) return { title: "Not found" };
  return { title: data.doc.title, description: data.doc.summary, robots: { index: false } };
}

/** A shared explanation: read-only, no account needed, with a path into the product. */
export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await load(token);
  if (!data) notFound();
  const { doc } = data;
  return (
    <div className="min-h-dvh bg-bg text-text">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 pt-8">
        <div className="text-[12px] text-muted">
          Shared explanation · {ncertLabel(doc.concept.classLevel, doc.concept.subject, doc.concept.ncert?.chapter, doc.concept.ncert?.ref) ?? <>Class {doc.concept.classLevel} · <span className="capitalize">{doc.concept.subject}</span></>}
        </div>
        <h1 className="mt-2 text-[34px] font-semibold leading-tight tracking-[-0.03em] md:text-[44px]">{doc.title}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">{doc.summary}</p>
        <div className="mt-5">
          <WhatsAppShare title={doc.title} />
        </div>
        <div className="mt-10">
          <LessonView doc={doc} />
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-5 rounded-3xl border border-border p-7 md:flex-row md:items-center">
          <div>
            <div className="text-[18px] font-semibold tracking-tight">Want one for your own question?</div>
            <p className="mt-1 text-[14px] text-muted">Type it or photograph the page. Five explanations a week are free.</p>
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
