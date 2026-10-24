import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { PLANS, formatInr } from "@/lib/billing/plans";
import { Reveal, TypingLine, TimeBars } from "@/components/Motion";
import { LineShow } from "@/components/LineShow";

/**
 * Landing: black and white, large type, quiet greys. Dark hero and footer, white middle.
 * Fixed to the dark palette for the hero regardless of theme.
 */
const dark = {
  bg: "#0a0a0a",
  text: "#fafafa",
  muted: "#8a8a8a",
  faint: "#4a4a4a",
  line: "#1f1f1f",
  panel: "#121212",
};

function Mark({ size = 28, onDark = true }: { size?: number; onDark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="6" y="6" width="52" height="52" rx="14" fill={onDark ? "#fafafa" : "#0a0a0a"} />
      <path d="M19 41 C 25 24, 31 24, 35 33 C 38 40, 42 36, 45 24" stroke={onDark ? "#0a0a0a" : "#fafafa"} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="45" cy="42" r="3.6" fill={onDark ? "#0a0a0a" : "#fafafa"} />
    </svg>
  );
}

function Wordmark({ onDark = true }: { onDark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="ExplainCanvas">
      <Mark onDark={onDark} />
      <span className="text-[17px] font-semibold tracking-tight" style={{ color: onDark ? dark.text : "#0a0a0a" }}>
        Explain<span className="font-normal" style={{ color: onDark ? dark.muted : "#6b6b6b" }}>Canvas</span>
      </span>
    </Link>
  );
}

const FORMATS = [
  ["Labelled diagram", "Structures, circuits, geometry, graphs", "8"],
  ["Numbered steps", "Procedures, constructions, experiments", "26"],
  ["Narrated slides", "A concept with a story or a comparison", "24"],
  ["Animation", "Processes that move or change over time", "32"],
  ["Interactive 3D", "Anything that makes sense when you rotate it", "20"],
  ["Your page, annotated", "Photograph the textbook, get it explained in place", "10"],
];

export function Landing() {
  return (
    <div style={{ background: dark.bg, color: dark.text }} className="min-h-screen">
      {/* Hero */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-[14px] md:flex" style={{ color: dark.muted }}>
          <Link href="/how-it-works" className="hover:text-white">
            How it works
          </Link>
          <Link href="/learn" className="hover:text-white">
            Guides
          </Link>
          <Link href="/library" className="hover:text-white">
            Library
          </Link>
          <Link href="/for-parents" className="hover:text-white">
            For parents
          </Link>
          <Link href="/pricing" className="hover:text-white">
            Pricing
          </Link>
        </nav>
        <Link href="/login" className="rounded-full px-4 py-2 text-[14px] font-medium" style={{ background: dark.text, color: dark.bg }}>
          Start free
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-12 md:pt-20">
        <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-12">
          <div>
            <span className="inline-block rounded-full border px-3 py-1 text-[12px] tracking-wide" style={{ borderColor: dark.line, color: dark.muted }}>
              Any subject · Any level · School to research
            </span>
            <h1 className="mt-7 text-[42px] font-semibold leading-[1.02] tracking-[-0.03em] md:text-[64px] lg:text-[72px]">
              Type anything you are stuck on. <span style={{ color: dark.muted }}>Understand it visually.</span>
            </h1>
            <p className="mt-7 max-w-xl text-[17px] leading-relaxed" style={{ color: dark.muted }}>
              A diagram, a set of steps, an animation or a 3D model, whichever teaches it best. Made for the question, checked for accuracy, then one question to prove it clicked.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/login" className="rounded-full px-6 py-3 text-[15px] font-medium" style={{ background: dark.text, color: dark.bg }}>
                Start free. First diagram on us
              </Link>
              <Link href="/library" className="rounded-full border px-6 py-3 text-[15px] font-medium hover:bg-white/5" style={{ borderColor: dark.line }}>
                Browse free lessons
              </Link>
            </div>
            <p className="mt-4 text-[12px]" style={{ color: dark.faint }}>
              Sign in with Google. No card. Plans from {formatInr(PLANS.student.pricePaise)} a month.
            </p>
          </div>
          <Reveal delay={120}>
            <LineShow />
          </Reveal>
        </div>

        {/* Live-looking composer */}
        <div className="mt-14">
          <Reveal>
            <div className="mx-auto max-w-3xl rounded-[28px] border p-2" style={{ borderColor: dark.line, background: dark.panel }}>
              <div className="flex items-center gap-3 rounded-[22px] px-4 py-3" style={{ background: dark.bg, border: `1px solid ${dark.line}` }}>
                <span className="text-[20px]" style={{ color: dark.muted }}>
                  +
                </span>
                <div className="min-h-[28px] flex-1 text-[16px]">
                  <TypingLine
                    items={[
                      "Why don't action and reaction forces cancel out?",
                      "Give me an intuition for the Fourier transform.",
                      "Show me the parts of the heart in 3D.",
                      "Explain Ohm's law with a circuit.",
                      "Why does gradient descent overshoot?",
                    ]}
                  />
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: dark.text, color: dark.bg }}>
                  ↑
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2 text-[12px]" style={{ color: dark.faint }}>
                <span>Type · Dictate · Photo</span>
                <span>Reading your question → Writing → Checking → Drawing</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Concept marquee */}
      <div className="mt-20 overflow-hidden border-y py-4" style={{ borderColor: dark.line }}>
        <div className="marquee flex w-max gap-10 whitespace-nowrap text-[14px]" style={{ color: dark.muted }}>
          {[...Array(2)].flatMap((_, k) =>
            ["Newton's third law", "Photosynthesis", "Ohm's law", "Linear equations", "Cell division", "Refraction of light", "Pythagoras theorem", "Acids and bases", "Moon phases", "Human heart", "Probability", "Electromagnets"].map((c) => (
              <span key={`${k}-${c}`}>{c}</span>
            )),
          )}
        </div>
      </div>

      {/* Time back block, in the style of the reference */}
      <section className="mx-auto max-w-6xl px-6 pt-28">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <span className="inline-block rounded-full border px-3 py-1 text-[12px]" style={{ borderColor: dark.line, color: dark.muted }}>
              Time back
            </span>
            <h2 className="mt-6 text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[64px]">
              Forty minutes of searching. <span style={{ color: dark.muted }}>Two minutes of seeing.</span>
            </h2>
            <p className="mt-6 max-w-lg text-[16px] leading-relaxed" style={{ color: dark.muted }}>
              A stuck student scrolls three videos and a forum before anything lands. ExplainCanvas reads the question, picks the one picture that teaches it, and checks the picture before the student sees it.
            </p>
            <p className="mt-4 text-[12px]" style={{ color: dark.faint }}>
              Typical. Yours will vary.
            </p>
          </div>
          <TimeBars dark={dark} />
        </div>
      </section>

      {/* White middle */}
      <section id="how" className="mt-28 bg-white text-[#0a0a0a]">
        <div className="mx-auto max-w-6xl px-6 py-28">
          <h2 className="text-[36px] font-semibold tracking-[-0.03em] md:text-[56px]">Three steps, every time.</h2>
          <p className="mt-4 max-w-xl text-[16px] text-[#6b6b6b]">The student never decides how something should be explained. That is the product&apos;s job.</p>
          <Reveal>
          <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-[#e5e5e5] bg-[#e5e5e5] md:grid-cols-3">
            {[
              ["01", "Ask, or photograph the page", "Type it in your own words, dictate it, or point the camera at the textbook."],
              ["02", "See it the way it makes sense", "The format that teaches it best is chosen, the explanation is written, then checked by a second pass before it is shown."],
              ["03", "Prove it clicked", "One check question. Get it and it goes into your evening report. Miss it and it explains again, differently."],
            ].map(([n, t, b]) => (
              <div key={n} className="bg-white p-8">
                <div className="text-[12px] tabular text-[#9a9a9a]">{n}</div>
                <h3 className="mt-6 text-[20px] font-semibold tracking-tight">{t}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#6b6b6b]">{b}</p>
              </div>
            ))}
          </div>
          </Reveal>

          <div id="formats" className="mt-28 grid items-start gap-12 md:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-[36px] font-semibold tracking-[-0.03em] md:text-[48px]">The right picture for the idea.</h2>
              <p className="mt-4 text-[16px] text-[#6b6b6b]">The cheapest format that teaches correctly wins. A correct diagram beats a beautiful video with the valves opening in the wrong order.</p>
            </div>
            <div className="divide-y divide-[#e5e5e5] border-y border-[#e5e5e5]">
              {FORMATS.map(([name, forWhat, credits]) => (
                <div key={name} className="flex items-baseline justify-between gap-6 py-4">
                  <div>
                    <div className="text-[16px] font-medium">{name}</div>
                    <div className="text-[14px] text-[#6b6b6b]">{forWhat}</div>
                  </div>
                  <div className="shrink-0 text-[13px] tabular text-[#9a9a9a]">{credits} credits</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-28 grid items-center gap-12 md:grid-cols-2">
            <div>
              <span className="inline-block rounded-full border border-[#e5e5e5] px-3 py-1 text-[12px] text-[#6b6b6b]">For parents</span>
              <h2 className="mt-6 text-[36px] font-semibold tracking-[-0.03em] md:text-[48px]">Know what clicked today. Every day.</h2>
              <p className="mt-4 text-[16px] leading-relaxed text-[#6b6b6b]">You are paying for understanding, so you should see it. Each evening your child studies, one short email: what they understood, measured by the check question, and what still needs work.</p>
            </div>
            <Reveal delay={120}>
            <div className="rounded-3xl border border-[#e5e5e5] p-7">
              <div className="text-[12px] text-[#9a9a9a]">ExplainCanvas · daily report</div>
              <div className="mt-2 text-[22px] font-semibold tracking-tight">Aarav studied today</div>
              <div className="mt-5 text-[13px] font-medium">Understood</div>
              <ul className="mt-1 space-y-1 text-[15px] text-[#4a4a4a]">
                <li>Newton&apos;s third law</li>
                <li>Balanced and unbalanced forces</li>
              </ul>
              <div className="mt-4 text-[13px] font-medium">Still working on</div>
              <ul className="mt-1 text-[15px] text-[#4a4a4a]">
                <li>Inertia and mass</li>
              </ul>
              <div className="mt-6 text-[12px] text-[#9a9a9a]">Streak: 4 days</div>
            </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pricing on dark */}
      <section className="mx-auto max-w-6xl px-6 py-28">
        <h2 className="text-[36px] font-semibold tracking-[-0.03em] md:text-[56px]">Simple pricing.</h2>
        <p className="mt-4 max-w-xl text-[16px]" style={{ color: dark.muted }}>
          Credits are the unit. A diagram is 8, an animation 32, a library lesson 1. Unused plan credits roll over a month.
        </p>
        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl md:grid-cols-4" style={{ background: dark.line, border: `1px solid ${dark.line}` }}>
          {(["student", "pro", "max", "max_annual"] as const).map((c) => {
            const p = PLANS[c];
            return (
              <Link key={c} href="/pricing" className="p-7 transition hover:bg-white/5" style={{ background: dark.bg }}>
                <div className="text-[13px]" style={{ color: dark.muted }}>
                  {p.name}
                </div>
                <div className="mt-2 text-[32px] font-semibold tracking-tight tabular">
                  {formatInr(p.pricePaise)}
                  <span className="text-[13px] font-normal" style={{ color: dark.muted }}>
                    /{p.interval === "year" ? "yr" : "mo"}
                  </span>
                </div>
                <div className="mt-4 text-[14px]">{p.creditsPerMonth.toLocaleString("en-IN")} credits a month</div>
                <div className="mt-1 text-[13px]" style={{ color: dark.muted }}>
                  {p.studentProfiles} student{p.studentProfiles > 1 ? "s" : ""}
                </div>
              </Link>
            );
          })}
        </div>
        <p className="mt-4 text-[12px]" style={{ color: dark.faint }}>
          Prices exclude 18% GST, added at checkout. Pay by UPI or card. Free accounts get unlimited library lessons and one fresh diagram.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-28">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border p-10 md:flex-row md:items-center" style={{ borderColor: dark.line }}>
          <h2 className="text-[28px] font-semibold tracking-tight md:text-[36px]">Stuck on a chapter? Take a photo.</h2>
          <Link href="/login" className="rounded-full px-6 py-3 text-[15px] font-medium" style={{ background: dark.text, color: dark.bg }}>
            Start free
          </Link>
        </div>
      </section>

      <footer className="overflow-hidden border-t" style={{ borderColor: dark.line }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={22} className="hidden" />
            <Mark size={22} />
            <span className="text-[12px]" style={{ color: dark.muted }}>
              Type anything you are stuck on. Understand it visually.
            </span>
          </div>
          <nav className="flex flex-wrap gap-6 text-[12px]" style={{ color: dark.muted }}>
            <Link href="/library">Library</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/refunds">Refunds</Link>
            <a href="mailto:hello@explaincanvas.com">Contact</a>
          </nav>
        </div>
        <div className="pointer-events-none select-none px-6 pb-2 text-center text-[19vw] font-semibold leading-none tracking-[-0.05em]" style={{ color: "#141414" }}>
          ExplainCanvas
        </div>
      </footer>
    </div>
  );
}
