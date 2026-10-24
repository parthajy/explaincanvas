"use client";

import { useState } from "react";
import type { SceneDoc } from "@/lib/scene/schema";
import { SandboxFrame } from "@/components/SandboxFrame";

/**
 * Read-only lesson for the public library: scenes, narration and the check question with a
 * local reveal. No credits, no account, no streak. The sign-in call to action sits below it.
 */
export function LessonView({ doc }: { doc: SceneDoc }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const scene = doc.scenes[idx];
  const last = idx === doc.scenes.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{scene.title || doc.title}</h2>
        {doc.scenes.length > 1 && (
          <span className="text-xs text-muted">
            Scene {idx + 1} of {doc.scenes.length}
          </span>
        )}
      </div>

      {scene.kind === "diagram" && <div className="scene-svg overflow-hidden rounded-xl border border-border bg-white p-3" dangerouslySetInnerHTML={{ __html: scene.svg }} />}
      {scene.kind === "steps" && (
        <ol className="space-y-2">
          {scene.steps.map((s, i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-border bg-white p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-text">{i + 1}</span>
              <p className="text-[15px]">{s.text}</p>
            </li>
          ))}
        </ol>
      )}
      {scene.kind === "slides" && (
        <div className="space-y-3">
          {scene.slides.map((s, i) => (
            <div key={i} className="rounded-xl border border-border bg-white p-4">
              <h4 className="font-semibold">{s.title}</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
                {s.bullets.map((b, k) => (
                  <li key={k}>{b}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted">{s.narration}</p>
            </div>
          ))}
        </div>
      )}
      {scene.kind === "three_d" && <SandboxFrame code={scene.code} title={scene.title} hint="Drag to rotate. Scroll to zoom." />}
      {scene.kind === "animation" && scene.engine === "web" && <SandboxFrame code={scene.code} title={scene.title} height={460} hint="Press play in the scene." />}
      {scene.kind === "video" && scene.shots.map((sh, i) => (sh.clipUrl ? <video key={i} src={sh.clipUrl} controls playsInline className="w-full rounded-xl border border-border bg-black" /> : null))}

      {"narration" in scene && <p className="text-[15px] leading-relaxed">{scene.narration}</p>}

      <div className="flex gap-2">
        {idx > 0 && (
          <button onClick={() => setIdx(idx - 1)} className="rounded-lg border border-border px-3 py-1.5 text-sm">
            Previous
          </button>
        )}
        {!last && (
          <button onClick={() => setIdx(idx + 1)} className="rounded-lg bg-primary px-3 py-1.5 text-sm text-on-primary">
            Next
          </button>
        )}
      </div>

      {last && (
        <div className="rounded-2xl border border-border bg-panel-2 p-4">
          <div className="text-xs font-medium text-text">Quick check</div>
          <p className="mt-1 font-medium">{doc.check.question}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {doc.check.options.map((o, i) => {
              const state = picked === null ? "idle" : i === doc.check.answerIndex ? "right" : i === picked ? "wrong" : "idle";
              const cls = state === "right" ? "border-success bg-green-50" : state === "wrong" ? "border-danger bg-red-50" : "border-border hover:bg-white";
              return (
                <button key={i} disabled={picked !== null} onClick={() => setPicked(i)} className={`rounded-xl border bg-white px-3 py-2 text-left text-sm ${cls}`}>
                  <span className="mr-2 text-faint">{String.fromCharCode(65 + i)}.</span>
                  {o}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <p className={`mt-3 text-sm font-medium ${picked === doc.check.answerIndex ? "text-success" : "text-danger"}`}>
              {picked === doc.check.answerIndex ? "Correct." : "Not quite."} {doc.check.explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
