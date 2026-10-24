import type { Metadata } from "next";
import { GENERAL_FAQ } from "@/lib/marketing";
import { pageMetadata, faqLd, breadcrumbLd } from "@/lib/seo";
import { SiteHeader, SiteFooter } from "@/components/SiteShell";
import { Hero, FaqList, CtaBand, JsonLdScript } from "@/components/Marketing";

export const metadata: Metadata = pageMetadata({
  title: "Frequently asked questions",
  description: "What ExplainCanvas is, which classes it covers, what it costs, how explanations are checked, what parents receive, and how to cancel. Straight answers.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <JsonLdScript data={[breadcrumbLd([{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }]), faqLd(GENERAL_FAQ)]} />
      <SiteHeader />
      <Hero eyebrow="FAQ" title="Straight answers." lede="Everything a parent or student usually asks before the first question. If yours is missing, write to hello@explaincanvas.com and a person replies." cta={null} />
      <section className="mx-auto mt-12 max-w-4xl px-6">
        <FaqList items={GENERAL_FAQ} />
      </section>
      <section className="mx-auto mt-20 max-w-6xl px-6">
        <CtaBand />
      </section>
      <SiteFooter />
    </div>
  );
}
