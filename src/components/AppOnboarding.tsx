"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { LineShow } from "@/components/LineShow";
import { TypingLine } from "@/components/Motion";

/**
 * What the Android app shows before sign-in instead of the marketing site: three swipeable screens,
 * then the login page. Seen once, remembered on the device, so the second launch goes straight to sign-in.
 */
const SEEN_KEY = "ec-onboarded";

const SLIDES = [
  {
    eyebrow: "Ask",
    title: "Type anything you are stuck on.",
    body: "In your own words. Or dictate it. Or photograph the whole homework page and tap the question you want.",
  },
  {
    eyebrow: "See",
    title: "Understand it visually.",
    body: "The answer arrives as a diagram, steps, slides, an animation or a 3D model, whichever teaches it best. Checked for accuracy, then narrated.",
  },
  {
    eyebrow: "Check",
    title: "Know it clicked.",
    body: "One quick question at the end. Get it right and your streak grows. Parents can get an evening email of what was understood.",
  },
];

export function AppOnboarding() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) === "1") router.replace("/login");
    } catch {}
  }, [router]);

  function finish() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    router.push("/login");
  }
  const next = () => (i < SLIDES.length - 1 ? setI(i + 1) : finish());
  const s = SLIDES[i];

  return (
    <div
      className="flex min-h-dvh flex-col bg-[#0a0a0a] text-[#fafafa]"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (dx < -50) next();
        else if (dx > 50 && i > 0) setI(i - 1);
      }}
    >
      <header className="flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2.5">
          <LogoMark size={26} />
          <span className="text-[16px] font-semibold tracking-tight">
            Explain<span className="font-normal text-[#8a8a8a]">Canvas</span>
          </span>
        </div>
        <button onClick={finish} className="text-[14px] text-[#8a8a8a] hover:text-white">
          Skip
        </button>
      </header>

      <main className="flex flex-1 flex-col justify-center px-6 pb-6 pt-8">
        <div key={i} className="rise">
          {i === 0 && (
            <div className="rounded-[26px] border border-[#1f1f1f] bg-[#121212] p-2">
              <div className="flex items-center gap-3 rounded-[20px] border border-[#1f1f1f] bg-[#0a0a0a] px-4 py-3">
                <span className="text-[20px] text-[#8a8a8a]">+</span>
                <div className="min-h-[28px] flex-1 text-[15px]">
                  <TypingLine items={["Why don't action and reaction forces cancel out?", "Show me how the heart pumps blood in 3D", "Give me an intuition for the Fourier transform"]} />
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fafafa] text-[#0a0a0a]">↑</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2 text-[12px] text-[#4a4a4a]">
                <span>Type · Dictate · Photo</span>
                <span>Any subject · Any level</span>
              </div>
            </div>
          )}
          {i === 1 && <LineShow />}
          {i === 2 && (
            <div className="rounded-[26px] border border-[#1f1f1f] bg-[#121212] p-5">
              <div className="text-[12px] text-[#8a8a8a]">Check question</div>
              <div className="mt-2 text-[16px] font-medium">If the wall pushes back on your hand with equal force, why does your hand still move the ball?</div>
              <div className="mt-4 space-y-2 text-[14px]">
                <div className="rounded-xl border border-[#1f1f1f] px-3 py-2 text-[#8a8a8a]">The forces cancel each other</div>
                <div className="rounded-xl border border-[#fafafa] px-3 py-2">They act on different objects ✓</div>
                <div className="rounded-xl border border-[#1f1f1f] px-3 py-2 text-[#8a8a8a]">The ball is lighter</div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#0a0a0a] px-3 py-2 text-[12px] text-[#8a8a8a]">
                <span>3-day streak</span>
                <span>Report sent to parent · 8:00 pm</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-10">
          <span className="inline-block rounded-full border border-[#1f1f1f] px-3 py-1 text-[12px] text-[#8a8a8a]">{s.eyebrow}</span>
          <h1 className="mt-4 text-[34px] font-semibold leading-[1.05] tracking-[-0.03em]">{s.title}</h1>
          <p className="mt-4 text-[16px] leading-relaxed text-[#8a8a8a]">{s.body}</p>
        </div>
      </main>

      <footer className="flex items-center justify-between px-6 pb-8">
        <div className="flex gap-1.5" aria-label={`Screen ${i + 1} of ${SLIDES.length}`}>
          {SLIDES.map((_, k) => (
            <button key={k} onClick={() => setI(k)} className="h-1.5 rounded-full transition-all" style={{ width: k === i ? 20 : 6, background: k === i ? "#fafafa" : "#2a2a2a" }} aria-label={`Go to screen ${k + 1}`} />
          ))}
        </div>
        <button onClick={next} className="rounded-full bg-[#fafafa] px-6 py-3 text-[15px] font-medium text-[#0a0a0a]">
          {i < SLIDES.length - 1 ? "Next" : "Get started"}
        </button>
      </footer>
    </div>
  );
}
