"use client";

import { useEffect, useRef, useState } from "react";

/** Fades and lifts children in when they scroll into view. CSS only after the first observation. */
export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("is-in");
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Cycles through example questions with a typing effect. */
export function TypingLine({ items, className = "" }: { items: string[]; className?: string }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState("");
  const [phase, setPhase] = useState<"typing" | "hold" | "deleting">("typing");

  useEffect(() => {
    const target = items[i % items.length];
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (shown.length < target.length) t = setTimeout(() => setShown(target.slice(0, shown.length + 1)), 28 + Math.random() * 40);
      else t = setTimeout(() => setPhase("hold"), 1600);
    } else if (phase === "hold") {
      t = setTimeout(() => setPhase("deleting"), 400);
    } else {
      if (shown.length > 0) t = setTimeout(() => setShown(shown.slice(0, -1)), 14);
      else
        t = setTimeout(() => {
          setI((x) => x + 1);
          setPhase("typing");
        }, 0);
    }
    return () => clearTimeout(t);
  }, [shown, phase, i, items]);

  return (
    <span className={className} aria-live="polite">
      {shown}
      <span className="caret" aria-hidden>
        |
      </span>
    </span>
  );
}

/** Two bars that fill when seen: the "time back" comparison. */
export function TimeBars({ dark }: { dark: { panel: string; line: string; muted: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (setOn(true), io.disconnect())), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="space-y-10">
      <div>
        <div className="flex items-end justify-between">
          <span className="text-[14px]" style={{ color: dark.muted }}>
            Searching for it
          </span>
          <span className="text-[52px] font-semibold leading-none tracking-tight tabular md:text-[56px]">
            40:00 <span className="text-[14px] font-normal" style={{ color: dark.muted }}>minutes</span>
          </span>
        </div>
        <div className="mt-3 h-14 w-full overflow-hidden rounded-xl" style={{ background: dark.panel, border: `1px solid ${dark.line}` }}>
          <div className="h-full rounded-xl" style={{ width: on ? "100%" : "0%", background: "#2a2a2a", transition: "width 2.2s cubic-bezier(.2,.7,.2,1)" }} />
        </div>
      </div>
      <div>
        <div className="flex items-end justify-between">
          <span className="text-[14px]" style={{ color: dark.muted }}>
            Seeing it, with ExplainCanvas
          </span>
          <span className="text-[52px] font-semibold leading-none tracking-tight tabular md:text-[56px]">
            2:00 <span className="text-[14px] font-normal" style={{ color: dark.muted }}>minutes</span>
          </span>
        </div>
        <div className="mt-3 h-14 w-full overflow-hidden rounded-xl" style={{ background: dark.panel, border: `1px solid ${dark.line}` }}>
          <div className="h-full rounded-xl bg-white" style={{ width: on ? "5%" : "0%", transition: "width 1.2s .4s cubic-bezier(.2,.7,.2,1)" }} />
        </div>
      </div>
    </div>
  );
}

/** A diagram that draws itself: strokes animate in when scrolled into view. */
export function DrawnDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (el.classList.add("is-in"), io.disconnect())), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="draw rounded-3xl border border-[#1f1f1f] bg-[#0f0f0f] p-6">
      <svg viewBox="0 0 560 300" className="h-auto w-full" role="img" aria-label="Diagram of Newton's third law drawing itself">
        <defs>
          <marker id="aw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="#fafafa" />
          </marker>
        </defs>
        <rect className="s1" x="70" y="120" width="150" height="80" rx="10" fill="none" stroke="#fafafa" strokeWidth="2" />
        <text className="t1" x="145" y="167" textAnchor="middle" fontSize="15" fill="#fafafa" fontFamily="system-ui">
          Block
        </text>
        <rect className="s2" x="380" y="70" width="46" height="180" rx="8" fill="none" stroke="#8a8a8a" strokeWidth="2" />
        <text className="t2" x="403" y="272" textAnchor="middle" fontSize="13" fill="#8a8a8a" fontFamily="system-ui">
          Wall
        </text>
        <line className="s3" x1="222" y1="145" x2="372" y2="145" stroke="#fafafa" strokeWidth="3" markerEnd="url(#aw)" />
        <text className="t3" x="296" y="132" textAnchor="middle" fontSize="13" fill="#fafafa" fontFamily="system-ui">
          Block pushes wall
        </text>
        <line className="s4" x1="378" y1="175" x2="228" y2="175" stroke="#8a8a8a" strokeWidth="3" markerEnd="url(#aw)" />
        <text className="t4" x="303" y="198" textAnchor="middle" fontSize="13" fill="#8a8a8a" fontFamily="system-ui">
          Wall pushes block
        </text>
        <text className="t5" x="280" y="38" textAnchor="middle" fontSize="15" fontWeight="600" fill="#fafafa" fontFamily="system-ui">
          Equal size, opposite direction, different bodies
        </text>
      </svg>
    </div>
  );
}
