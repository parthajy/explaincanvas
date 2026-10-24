import type { Metadata } from "next";
import { CREDIT_COST } from "@/lib/billing/plans";
import { pageMetadata, breadcrumbLd } from "@/lib/seo";
import { SiteHeader, SiteFooter } from "@/components/SiteShell";
import { Hero, SectionTitle, Steps, AskLink, CtaBand, JsonLdScript } from "@/components/Marketing";

export const metadata: Metadata = pageMetadata({
  title: "How ExplainCanvas works",
  description: "Ask in your own words or photograph the page. The AI picks the format that fits the idea, draws it, verifies it, narrates it, and asks one check question. Here is each step.",
  path: "/how-it-works",
});

const FORMATS: { key: keyof typeof CREDIT_COST; name: string; when: string }[] = [
  { key: "diagram", name: "Diagram", when: "Parts, forces, flows, anything with labelled arrows. The default for most Science doubts." },
  { key: "steps", name: "Steps", when: "Working out a Maths problem or a numerical, one line at a time with the reason for each." },
  { key: "slides", name: "Slides", when: "A process with stages, like the nitrogen cycle or a chapter summary before a test." },
  { key: "animation", name: "Animation", when: "Things that move or change: waves, circuits, projectile motion, reactions." },
  { key: "three_d", name: "3D model", when: "Things with an inside: the heart, a plant cell, a magnetic field around a wire. Rotate it yourself." },
  { key: "annotation", name: "Annotated photo", when: "Your own textbook page or worksheet, marked up to show where the idea sits." },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <JsonLdScript
        data={[
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "How it works", path: "/how-it-works" }]),
          {
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "How to get a visual explanation on ExplainCanvas",
            step: [
              { "@type": "HowToStep", name: "Ask", text: "Type the doubt in your own words, dictate it, or photograph the page." },
              { "@type": "HowToStep", name: "See", text: "The explanation arrives as a diagram, steps, slides, an animation or a 3D model, with narration." },
              { "@type": "HowToStep", name: "Check", text: "Answer one check question. Correct answers go into the parent's daily report." },
            ],
          },
        ]}
      />
      <SiteHeader />
      <Hero eyebrow="How it works" title="Ask. See. Check." lede="Three steps, under three minutes, and a picture that was built for the exact question your child asked." secondary={{ label: "Browse free lessons", href: "/library" }} />

      <section className="mx-auto mt-16 max-w-6xl px-6">
        <Steps />
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <SectionTitle title="The right picture for the idea." lede="You never choose a format. The AI reads the question and picks the one that will make it click. Credits shown are what each costs on a plan." />
        <div className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {FORMATS.map((f) => (
            <div key={f.key} className="bg-panel p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[18px] font-semibold tracking-tight">{f.name}</h3>
                <span className="text-[12px] tabular text-faint">{CREDIT_COST[f.key]} credits</span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{f.when}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <SectionTitle title="What happens before you see it." lede="Speed matters, but being right matters more. Every fresh explanation goes through this." />
        <ol className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-4">
          {[
            ["Route", "A fast model reads the question, decides the class level and subject, and picks the format."],
            ["Teach", "Our strongest model writes the explanation as a scene: shapes, labels, narration, the check question."],
            ["Verify", "A separate pass checks the facts, the diagram labels and the answer key, and sends it back once if anything is off."],
            ["Keep", "Explanations that pass and get answered correctly join the free library, so the next student gets them for one credit."],
          ].map(([t, b], i) => (
            <li key={t} className="bg-panel p-6">
              <div className="text-[12px] tabular text-faint">0{i + 1}</div>
              <div className="mt-2 text-[18px] font-semibold tracking-tight">{t}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <SectionTitle title="Try one of these." />
        <div className="mt-6 flex flex-wrap gap-2">
          {["Why don't action and reaction forces cancel out?", "Show me how blood flows through the heart", "How do I complete the square?", "Why does a lemon battery work?", "Show me the parts of a plant cell in 3D"].map((q) => (
            <AskLink key={q} q={q} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <CtaBand />
      </section>
      <SiteFooter />
    </div>
  );
}
