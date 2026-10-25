import type { Metadata } from "next";
import { PLANS, TOPUPS, formatInr } from "@/lib/billing/plans";
import { CheckoutButton } from "@/components/CheckoutButton";
import { SiteHeader, SiteFooter, PageTitle } from "@/components/SiteShell";
import { pageMetadata, softwareLd, faqLd, breadcrumbLd } from "@/lib/seo";
import { JsonLdScript, FaqList } from "@/components/Marketing";
import { isAppMode } from "@/lib/appmode";

export const metadata: Metadata = pageMetadata({ title: "Pricing: plans from ₹599 a month", description: "Credits are the unit. Student ₹599, Pro ₹1,999, Max ₹4,999 a month, Max Annual ₹50,000. Free accounts get the library and about five fresh explanations a week. Prices exclude GST.", path: "/pricing" });

const PRICING_FAQ = [
  { q: "What is a credit worth?", a: "About one rupee of generation work. A diagram is 8 credits, an annotated photo 10, a 3D model 20, slides 24, a step-by-step solution 26, an animation 32. Library lessons cost 1 credit and follow-up questions 2." },
  { q: "Do unused credits expire?", a: "Plan credits roll over for one month after the month they were granted. Top-up credits stay valid while you are subscribed." },
  { q: "Is GST included?", a: "No. Prices shown exclude 18% GST, which is added at checkout and shown before you pay. Our payment partner issues the GST invoice." },
  { q: "Can I change or cancel my plan?", a: "Yes, any time from Account, Manage billing. Upgrades apply immediately; cancellations keep access until the end of the paid period." },
  { q: "Which payment methods work?", a: "UPI, debit and credit cards, through Dodo Payments, our merchant of record. We never see card numbers." },
];

const ORDER = ["student", "pro", "max", "max_annual"] as const;

const CREDIT_TABLE: [string, number][] = [
  ["Library lesson, already made for another student", 1],
  ["Follow-up question", 2],
  ["Labelled diagram", 8],
  ["Annotated photo of your page", 10],
  ["Interactive 3D", 20],
  ["Narrated slides", 24],
  ["Illustrated steps", 26],
  ["Animation", 32],
  ["Generated video", 65],
];

export default async function PricingPage() {
  const app = await isAppMode();
  const buy = (item: string, label: string, primary?: boolean) =>
    app ? <p className="rounded-full border border-border px-4 py-2.5 text-center text-[13px] text-muted">Available on explaincanvas.com</p> : <CheckoutButton item={item} label={label} primary={primary} />;
  return (
    <div className="min-h-dvh bg-bg text-text">
      <JsonLdScript data={[breadcrumbLd([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }]), softwareLd(Object.values(PLANS).map((p) => ({ name: p.name, pricePaise: p.pricePaise, interval: p.interval }))), faqLd(PRICING_FAQ)]} />
      <SiteHeader />
      {app && (
        <div className="mx-auto mt-6 max-w-6xl px-6">
          <div className="rounded-2xl border border-border bg-panel px-5 py-4 text-[14px] text-muted">Plans and credits are managed on the ExplainCanvas website in a browser. Everything you buy there works here straight away.</div>
        </div>
      )}
      <PageTitle eyebrow="Pricing" title="Simple pricing." lede="One credit is about one rupee of work. A diagram is 8, an animation 32, a library lesson 1. Unused plan credits roll over one month. Prices exclude 18% GST, added at checkout. Pay by UPI or card." />

      <section className="mx-auto mt-12 max-w-6xl px-6">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-4">
          {ORDER.map((code) => {
            const p = PLANS[code];
            const highlight = code === "pro";
            return (
              <div key={code} className="relative flex flex-col bg-panel p-7">
                {highlight && <span className="absolute right-5 top-5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-on-primary">Most chosen</span>}
                <div className="text-[13px] text-muted">{p.name}</div>
                <div className="mt-2 text-[34px] font-semibold tracking-tight tabular">
                  {formatInr(p.pricePaise)}
                  <span className="text-[13px] font-normal text-muted">/{p.interval === "year" ? "year" : "month"}</span>
                </div>
                <div className="mt-5 text-[15px]">
                  <span className="font-medium tabular">{p.creditsPerMonth.toLocaleString("en-IN")}</span> credits a month
                </div>
                <ul className="mt-3 space-y-1.5 text-[14px] text-muted">
                  <li>
                    {p.studentProfiles} student profile{p.studentProfiles > 1 ? "s" : ""}
                  </li>
                  <li>Daily parent report by email</li>
                  <li>Narrated explanations</li>
                  {p.priorityRendering && <li>Priority rendering</li>}
                  {p.premiumNarration && <li>Premium voice</li>}
                  {p.fastVideo && <li>Fast video generation</li>}
                  <li>Top-ups when you run low</li>
                </ul>
                <p className="mt-4 text-[12px] text-faint">{p.blurb}</p>
                <div className="mt-auto pt-7">
                  {buy(code, `Choose ${p.name}`, highlight)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <h2 className="text-[26px] font-semibold tracking-tight">Top-ups</h2>
        <p className="mt-1 text-[14px] text-muted">For subscribers who need more this month. Top-up credits never expire while you are subscribed.</p>
        <div className="mt-5 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-3">
          {Object.values(TOPUPS).map((t) => (
            <div key={t.code} className="bg-panel p-6">
              <div className="text-[13px] text-muted">{t.name}</div>
              <div className="mt-1 text-[28px] font-semibold tabular">{formatInr(t.pricePaise)}</div>
              <div className="mt-1 text-[14px]">
                <span className="font-medium tabular">{t.credits} credits</span> <span className="text-muted">· {formatInr(Math.round(t.pricePaise / t.credits))} each</span>
              </div>
              <div className="mt-5">
                {buy(t.code, "Add credits")}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <h2 className="text-[26px] font-semibold tracking-tight">What credits buy</h2>
        <div className="mt-5 divide-y divide-border border-y border-border">
          {CREDIT_TABLE.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-6 py-3.5 text-[15px]">
              <span>{k}</span>
              <span className="tabular font-medium">{v}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-faint">Free accounts get unlimited library lessons and about five fresh explanations a week, refilled every Monday.</p>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <h2 className="text-[30px] font-semibold tracking-[-0.03em] md:text-[40px]">Pricing questions.</h2>
        <div className="mt-8">
          <FaqList items={PRICING_FAQ} />
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
