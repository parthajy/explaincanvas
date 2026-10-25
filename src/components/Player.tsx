"use client";

import { ncertLabel } from "@/lib/ncert";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SceneDoc, Scene } from "@/lib/scene/schema";
import { SandboxFrame } from "@/components/SandboxFrame";

const REASONS = ["Too complicated", "Can't picture it", "Missing a step", "Explain differently"];
const REPORT_REASONS: { code: "wrong_fact" | "wrong_diagram" | "wrong_answer" | "unclear" | "other"; label: string }[] = [
  { code: "wrong_fact", label: "A fact is wrong" },
  { code: "wrong_diagram", label: "The diagram is wrong" },
  { code: "wrong_answer", label: "The check answer is wrong" },
  { code: "unclear", label: "It is unclear" },
  { code: "other", label: "Something else" },
];

/** Fullscreen overlay for a scene. Uses the Fullscreen API when available, otherwise a fixed overlay. */
function Fullscreen({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.requestFullscreen?.().catch(() => undefined);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onFs = () => !document.fullscreenElement && onClose();
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = "";
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };
  }, [onClose]);
  return createPortal(
    <div ref={ref} className="fixed inset-0 z-50 flex flex-col bg-bg text-text">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="text-[15px] font-medium">{title}</span>
        <button onClick={onClose} className="rounded-full border border-border px-3 py-1.5 text-[13px] hover:border-border-2">
          Close · Esc
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="mx-auto h-full w-full max-w-6xl [&_.scene-svg]:p-6 [&_iframe]:h-[calc(100vh-140px)]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function Img({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="h-auto w-full rounded-xl object-cover" loading="lazy" />;
}

function SceneView({ scene, uploadUrl }: { scene: Scene; uploadUrl: string | null }) {
  switch (scene.kind) {
    case "diagram":
      return (
        <figure>
          <div className="scene-svg overflow-hidden rounded-2xl border border-border p-3" dangerouslySetInnerHTML={{ __html: scene.svg }} />
          {scene.caption && <figcaption className="mt-2 text-sm text-muted">{scene.caption}</figcaption>}
        </figure>
      );
    case "steps":
      return (
        <ol className="space-y-2.5">
          {scene.steps.map((s, i) => (
            <li key={i} className="rounded-2xl border border-border bg-panel p-4">
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-on-primary">{i + 1}</span>
                <p className="text-[15px] leading-relaxed">{s.text}</p>
              </div>
              {s.imageUrl && (
                <div className="mt-3 pl-10">
                  <Img src={s.imageUrl} alt={`Step ${i + 1}`} />
                </div>
              )}
            </li>
          ))}
        </ol>
      );
    case "slides":
      return <Slides slides={scene.slides} />;
    case "three_d":
      return <SandboxFrame code={scene.code} title={scene.title} hint="Drag to rotate. Scroll to zoom." />;
    case "video":
      return (
        <div className="space-y-3">
          {scene.shots.map((shot, i) =>
            shot.clipUrl ? (
              <video key={i} src={shot.clipUrl} controls playsInline className="w-full rounded-2xl border border-border bg-black" />
            ) : (
              <div key={i} className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
                Clip {i + 1} is still being prepared. {shot.prompt}
              </div>
            ),
          )}
        </div>
      );
    case "animation":
      return scene.videoUrl ? (
        <video src={scene.videoUrl} controls playsInline className="w-full rounded-2xl border border-border bg-black" />
      ) : scene.engine === "web" ? (
        <SandboxFrame code={scene.code} title={scene.title} height={460} hint="Press play in the scene. Use the controls to pause or step." />
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
          <p className="font-medium text-text">{scene.title}</p>
          <p className="mt-1">This animation is being prepared. The narration below covers everything it will show.</p>
        </div>
      );
    case "annotation":
      return (
        <div>
          {uploadUrl ? (
            <div className="relative overflow-hidden rounded-2xl border border-border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploadUrl} alt="Your page" className="block h-auto w-full" />
              {scene.annotations.map((a, i) => (
                <div key={i} className="absolute rounded-md border-2 border-black/80 bg-black/5" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }} title={a.note}>
                  <span className="absolute -top-3 left-1 rounded bg-black px-1.5 text-[11px] font-medium text-white">
                    {i + 1}. {a.label}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <ul className="mt-3 space-y-2">
            {scene.annotations.map((a, i) => (
              <li key={i} className="rounded-2xl border border-border bg-panel p-3 text-sm">
                <span className="font-medium">
                  {i + 1}. {a.label}
                </span>
                <span className="text-muted"> — {a.note}</span>
              </li>
            ))}
          </ul>
        </div>
      );
  }
}

function Slides({ slides }: { slides: { title: string; bullets: string[]; narration: string; imageUrl?: string }[] }) {
  const [i, setI] = useState(0);
  const s = slides[i];
  return (
    <div className="rounded-2xl border border-border bg-panel p-5">
      <div className="text-xs text-faint">
        Slide {i + 1} of {slides.length}
      </div>
      <h4 className="mt-1 text-lg font-semibold">{s.title}</h4>
      <div className={s.imageUrl ? "mt-3 grid gap-4 sm:grid-cols-2" : "mt-3"}>
        <ul className="list-disc space-y-1 pl-5 text-[15px]">
          {s.bullets.map((b, k) => (
            <li key={k}>{b}</li>
          ))}
        </ul>
        {s.imageUrl && <Img src={s.imageUrl} alt={s.title} />}
      </div>
      <p className="mt-4 text-sm text-muted">{s.narration}</p>
      <div className="mt-4 flex gap-2">
        <button onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} className="rounded-full border border-border px-3 py-1.5 text-sm disabled:opacity-40">
          Back
        </button>
        <button onClick={() => setI((x) => Math.min(slides.length - 1, x + 1))} disabled={i === slides.length - 1} className="rounded-full bg-primary px-3 py-1.5 text-sm text-on-primary disabled:opacity-40">
          Next
        </button>
      </div>
    </div>
  );
}

/** Narration bar: play/pause with progress, autoplay on scene change when the user already pressed play. */
function Narration({ src, autoPlay, onEnded }: { src: string; autoPlay: boolean; onEnded: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    setProgress(0);
    if (autoPlay) a.play().catch(() => setPlaying(false));
  }, [src, autoPlay]);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-panel px-3 py-2">
      <button
        onClick={() => {
          const a = ref.current;
          if (!a) return;
          if (a.paused) void a.play();
          else a.pause();
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
        aria-label={playing ? "Pause narration" : "Play narration"}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" />
            <rect x="14" y="5" width="4" height="14" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full bg-text transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      <span className="text-xs text-muted">{playing ? "Listening" : "Listen"}</span>
      <audio
        ref={ref}
        src={src}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (a.duration) setProgress((a.currentTime / a.duration) * 100);
        }}
        onEnded={() => {
          setPlaying(false);
          onEnded();
        }}
      />
    </div>
  );
}

export function Player({
  explanationId,
  doc,
  uploadUrl,
  onReexplain,
  onAsk,
  onSimpler,
  onHinglish,
}: {
  explanationId: string;
  doc: SceneDoc;
  uploadUrl?: string | null;
  onReexplain: (reason: string) => Promise<void>;
  /** Send a follow-up question into the chat. */
  onAsk?: (text: string) => Promise<void>;
  /** One tap: same idea, simpler words. */
  onSimpler?: () => Promise<void>;
  /** One tap: same idea in Hinglish. */
  onHinglish?: () => Promise<void>;
}) {
  const ncert = ncertLabel(doc.concept.classLevel, doc.concept.subject, doc.concept.ncert?.chapter, doc.concept.ncert?.ref);
  const [shareState, setShareState] = useState<"idle" | "copied" | "error">("idle");
  async function share(channel: "native" | "whatsapp" = "native") {
    try {
      const res = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ explanationId }) });
      const { url } = await res.json();
      if (channel === "whatsapp") {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${doc.title}\n${url}`)}`, "_blank", "noopener");
        return;
      }
      if (navigator.share) await navigator.share({ title: doc.title, text: doc.summary, url });
      else await navigator.clipboard.writeText(url);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2000);
    } catch {
      setShareState("error");
    }
  }
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [result, setResult] = useState<{ passed: boolean; correctIndex: number; explanation: string; streak: { current_days: number } | null } | null>(null);
  const [askingWhy, setAskingWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [full, setFull] = useState(false);
  const [reporting, setReporting] = useState<"idle" | "open" | "sent">("idle");
  const scene = doc.scenes[idx];
  const last = idx === doc.scenes.length - 1;
  const audioUrl = (scene as { audioUrl?: string }).audioUrl;

  async function check(i: number) {
    if (result) return;
    setAnswer(i);
    setBusy(true);
    try {
      const res = await fetch(`/api/explanations/${explanationId}/check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answerIndex: i }) });
      if (res.ok) {
        const r = await res.json();
        setResult(r);
        try {
          navigator.vibrate?.(r.passed ? 30 : [40, 60, 40]);
        } catch {}
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold">{scene.title || doc.title}</h3>
          {ncert && <div className="truncate text-[11px] text-faint">{ncert}</div>}
        </div>
        <div className="flex items-center gap-3">
          {doc.scenes.length > 1 && (
            <div className="flex items-center gap-1.5">
              {doc.scenes.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-text" : "w-1.5 bg-border-2"}`} aria-label={`Scene ${i + 1}`} />
              ))}
            </div>
          )}
          <button onClick={() => void share("whatsapp")} className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted hover:border-border-2 hover:text-text" aria-label="Share on WhatsApp" title="Share on WhatsApp">
            WhatsApp
          </button>
          <button onClick={() => void share()} className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted hover:border-border-2 hover:text-text" aria-label="Share this explanation" title="Share">
            {shareState === "copied" ? "Link copied" : shareState === "error" ? "Could not share" : "Share"}
          </button>
          <button onClick={() => setFull(true)} className="rounded-full border border-border p-1.5 text-muted hover:border-border-2 hover:text-text" aria-label="View full screen" title="Full screen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      </div>

      <SceneView scene={scene} uploadUrl={uploadUrl ?? null} />
      {full && (
        <Fullscreen title={scene.title || doc.title} onClose={() => setFull(false)}>
          <SceneView scene={scene} uploadUrl={uploadUrl ?? null} />
          {"narration" in scene && <p className="mx-auto mt-6 max-w-3xl text-[17px] leading-8">{scene.narration}</p>}
        </Fullscreen>
      )}

      {audioUrl && (
        <div onClickCapture={() => setListening(true)}>
          <Narration src={audioUrl} autoPlay={listening} onEnded={() => !last && setIdx(idx + 1)} />
        </div>
      )}
      <p className="text-[15px] leading-7 text-text">{"narration" in scene ? scene.narration : null}</p>

      {doc.scenes.length > 1 && (
        <div className="flex items-center gap-2">
          {idx > 0 && (
            <button onClick={() => setIdx(idx - 1)} className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-border-2">
              Previous
            </button>
          )}
          {!last && (
            <button onClick={() => setIdx(idx + 1)} className="rounded-full bg-primary px-4 py-1.5 text-sm text-on-primary">
              Next
            </button>
          )}
        </div>
      )}

      {last && (
        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Quick check</div>
          <p className="mt-1.5 font-medium">{doc.check.question}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {doc.check.options.map((o, i) => {
              const state = result ? (i === result.correctIndex ? "right" : i === answer ? "wrong" : "idle") : answer === i ? "picked" : "idle";
              const cls = state === "right" ? "border-success" : state === "wrong" ? "border-danger" : state === "picked" ? "border-text" : "border-border hover:border-border-2";
              return (
                <button key={i} disabled={busy || Boolean(result)} onClick={() => void check(i)} className={`rounded-xl border bg-panel px-3 py-2 text-left text-sm ${cls}`}>
                  <span className="mr-2 text-faint">{String.fromCharCode(65 + i)}.</span>
                  {o}
                </button>
              );
            })}
          </div>
          {result && (
            <div className="mt-3 text-sm">
              <p className={result.passed ? "font-medium text-success" : "font-medium text-danger"}>
                {result.passed ? "Correct." : "Not quite."} <span className="font-normal text-text">{result.explanation}</span>
              </p>
              {result.passed && result.streak && (
                <p className="mt-1 text-xs text-muted">
                  Streak: {result.streak.current_days} day{result.streak.current_days === 1 ? "" : "s"}. One streak credit added.
                </p>
              )}
            </div>
          )}
          {doc.followUps && doc.followUps.length > 0 && onAsk && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Keep going</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {doc.followUps.map((f) => (
                  <button key={f} onClick={() => void onAsk(f)} className="rounded-full border border-border px-3 py-1.5 text-[13px] hover:border-border-2">
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3">
            {reporting === "idle" && (
              <button onClick={() => setReporting("open")} className="text-sm text-muted underline-offset-4 hover:underline">
                Report a mistake
              </button>
            )}
            {reporting === "sent" && <span className="text-sm text-muted">Thanks. We&apos;ll check it and fix the lesson.</span>}
            {reporting === "open" && (
              <div className="flex w-full flex-wrap gap-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.code}
                    onClick={async () => {
                      await fetch(`/api/explanations/${explanationId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: r.code }) });
                      setReporting("sent");
                    }}
                    className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-border-2"
                  >
                    {r.label}
                  </button>
                ))}
                <button onClick={() => setReporting("idle")} className="px-2 text-xs text-muted">
                  Cancel
                </button>
              </div>
            )}
            {onSimpler && (
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onSimpler();
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:border-border-2 disabled:opacity-50"
              >
                Explain it simpler
              </button>
            )}
            {onHinglish && doc.language !== "hinglish" && (
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onHinglish();
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-border-2 disabled:opacity-50"
              >
                Hinglish mein samjhao
              </button>
            )}
            {!askingWhy ? (
              <button onClick={() => setAskingWhy(true)} className="text-sm text-muted underline-offset-4 hover:underline">
                I didn&apos;t get it
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await onReexplain(r);
                      } finally {
                        setBusy(false);
                        setAskingWhy(false);
                      }
                    }}
                    disabled={busy}
                    className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-border-2"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
