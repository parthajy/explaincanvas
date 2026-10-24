import type { Metadata } from "next";
import Link from "next/link";
import { PLANS, formatInr } from "@/lib/billing/plans";
import { pageMetadata, faqLd, breadcrumbLd } from "@/lib/seo";
import { SiteHeader, SiteFooter } from "@/components/SiteShell";
import { Hero, SectionTitle, Steps, FaqList, CtaBand, JsonLdScript } from "@/components/Marketing";

export const metadata: Metadata = pageMetadata({
  title: "For parents: proof your child understood, every day",
  description: "A daily email of what your child understood and what still needs work, from ₹599 a month. No tutor scheduling, no 30-minute videos, no guessing. CBSE Classes 6 to 10.",
  path: "/for-parents",
  keywords: ["online tuition alternative", "CBSE doubt solving app", "parent report", "AI tutor for kids India", "BYJU'S alternative"],
});

const FAQ = [
  { q: "How do I know my child is actually learning?", a: "Every explanation ends with one check question. On any day your child studies, you get an email that evening listing the concepts they answered correctly and the ones still being worked on. Nothing to log into." },
  { q: "How much time does it take each day?", a: "A typical session is five to ten minutes: one real doubt, one picture, one check question. It fits after school or before homework rather than replacing either." },
  { q: "Is it safe for my child to use alone?", a: "There is no chat with strangers and no feed. The product answers school questions only, every explanation passes a verification step before it is shown, and anything off-topic is declined politely." },
  { q: "What does it cost compared with tuition?", a: `Student is ${formatInr(PLANS.student.pricePaise)} a month for about 250 credits, roughly nine fresh explanations today and more as the shared library grows, because library lessons cost one credit. Pro at ${formatInr(PLANS.pro.pricePaise)} covers two children. Prices exclude 18% GST. Home tuition for one subject commonly runs ₹3,000 to ₹8,000 a month.` },
  { q: "Can two children share one account?", a: "Yes. Pro allows two student profiles and Max four. Each child's class sets the depth of their explanations, and each gets their own report and streak." },
  { q: "What if we want to stop?", a: "Cancel in two taps from Account, Manage billing. Access continues to the end of the paid period, and unused credits roll over for a month while you are subscribed." },
];

const COMPARE = [
  { label: "Who asks the question", tuition: "The teacher decides the lesson", videos: "The syllabus playlist", ec: "Your child, in their own words" },
  { label: "Format", tuition: "Talk and whiteboard", videos: "Recorded 20 to 40 minute video", ec: "Diagram, steps, animation or 3D, two to three minutes" },
  { label: "Proof it worked", tuition: "Monthly test, if any", videos: "Watch time", ec: "One check question, daily email to you" },
  { label: "Availability", tuition: "Fixed slot", videos: "Any time", ec: "Any time, including 10 pm before the test" },
  { label: "Cost for one child", tuition: "₹3,000 to ₹8,000 a month per subject", videos: "₹1,000 to ₹4,000 a month", ec: `From ${formatInr(PLANS.student.pricePaise)} a month, all subjects` },
];

export default function ForParentsPage() {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <JsonLdScript data={[breadcrumbLd([{ name: "Home", path: "/" }, { name: "For parents", path: "/for-parents" }]), faqLd(FAQ)]} />
      <SiteHeader />
      <Hero eyebrow="For parents" title="Know what clicked today. Every day." lede="Your child asks the doubt. The answer arrives as a picture. One check question tells you both whether it landed, and you get the list that evening. No scheduling, no guessing." secondary={{ label: "See pricing", href: "/pricing" }} />

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <SectionTitle title="What the evening email says." lede="Short, factual, and only on days your child studied." />
        <div className="mt-8 max-w-xl rounded-3xl border border-border bg-panel p-7 text-[15px] leading-relaxed">
          <div className="text-[12px] text-muted">ExplainCanvas · daily report</div>
          <div className="mt-2 text-[20px] font-semibold tracking-tight">Aarav studied today</div>
          <div className="mt-4 font-medium">Understood</div>
          <ul className="mt-1 list-disc pl-5 text-muted">
            <li>Why action and reaction forces don&apos;t cancel</li>
            <li>Image formation by a convex lens</li>
          </ul>
          <div className="mt-4 font-medium">Still working on</div>
          <ul className="mt-1 list-disc pl-5 text-muted">
            <li>Balancing chemical equations</li>
          </ul>
          <p className="mt-4 text-[13px] text-faint">Understood means Aarav answered the check question correctly after the explanation.</p>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <SectionTitle title="Compared with what you may be paying for now." />
        <div className="mt-8 overflow-x-auto rounded-3xl border border-border bg-panel">
          <table className="w-full text-[14px]">
            <thead className="text-left text-[12px] text-muted">
              <tr className="border-b border-border">
                <th className="px-5 py-4 font-medium"> </th>
                <th className="px-5 py-4 font-medium">Home tuition</th>
                <th className="px-5 py-4 font-medium">Video courses</th>
                <th className="px-5 py-4 font-medium text-text">ExplainCanvas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {COMPARE.map((r) => (
                <tr key={r.label}>
                  <td className="px-5 py-4 font-medium">{r.label}</td>
                  <td className="px-5 py-4 text-muted">{r.tuition}</td>
                  <td className="px-5 py-4 text-muted">{r.videos}</td>
                  <td className="px-5 py-4">{r.ec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <SectionTitle title="How a session goes." />
        <div className="mt-8">
          <Steps />
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <SectionTitle title="Questions parents ask us." />
        <div className="mt-8">
          <FaqList items={FAQ} />
        </div>
        <p className="mt-6 text-[14px] text-muted">
          Anything else? Write to <a href="mailto:hello@explaincanvas.com" className="underline underline-offset-4">hello@explaincanvas.com</a> or read the <Link href="/faq" className="underline underline-offset-4">full FAQ</Link>.
        </p>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <CtaBand title="Start with one free explanation." body="Add your child's class, ask one real doubt, and see what the report looks like tonight." />
      </section>
      <SiteFooter />
    </div>
  );
}
