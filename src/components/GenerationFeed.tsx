"use client";

import { useEffect, useState } from "react";
import type { ExplanationRow } from "@/lib/chat/types";

/**
 * What the student reads while an explanation is being made. A real pipeline has four stages and
 * each takes a while, so instead of one frozen label we show the stage, what is happening inside it,
 * the elapsed time, and an honest estimate. The lines rotate every few seconds so it never looks stuck.
 */

type Stage = "routing" | "teaching" | "verifying" | "rendering";
const ORDER: Stage[] = ["routing", "teaching", "verifying", "rendering"];

const STAGE_TITLE: Record<Stage, string> = {
  routing: "Reading your question",
  teaching: "Building the explanation",
  verifying: "Checking it",
  rendering: "Finishing touches",
};

const FORMAT_NAME: Record<string, string> = {
  diagram: "a labelled diagram",
  steps: "step-by-step working",
  slides: "a short slide deck",
  animation: "an animation",
  three_d: "a 3D model you can rotate",
  video: "a short video",
  annotation: "notes on your photo",
};

/** Rough typical durations in seconds, used only for the progress bar and the estimate. */
const TYPICAL: Record<string, Record<Stage, number>> = {
  default: { routing: 6, teaching: 45, verifying: 20, rendering: 15 },
  diagram: { routing: 6, teaching: 40, verifying: 18, rendering: 12 },
  steps: { routing: 6, teaching: 45, verifying: 20, rendering: 25 },
  slides: { routing: 6, teaching: 50, verifying: 20, rendering: 40 },
  animation: { routing: 6, teaching: 70, verifying: 25, rendering: 12 },
  three_d: { routing: 6, teaching: 70, verifying: 25, rendering: 12 },
  video: { routing: 6, teaching: 45, verifying: 20, rendering: 120 },
  annotation: { routing: 6, teaching: 35, verifying: 15, rendering: 12 },
};

function lines(stage: Stage, format: string | null, concept: string | null): string[] {
  const what = concept ? `“${concept}”` : "this";
  const fmt = format ? FORMAT_NAME[format] ?? format : null;
  switch (stage) {
    case "routing":
      return ["Working out which class and chapter this belongs to.", "Deciding whether a diagram, steps, an animation or a 3D model will teach it best.", "Checking the library in case another student already asked this."];
    case "teaching": {
      const base = fmt ? [`Making ${fmt} for ${what}.`] : [`Writing the explanation for ${what}.`];
      const byFormat: Record<string, string[]> = {
        diagram: ["Placing each part so the labels never overlap.", "Drawing the arrows so they point the right way.", "Keeping only the labels that matter."],
        steps: ["Writing one step per line, with the reason for each.", "Picking a worked example a student can follow.", "Making sure no step is skipped."],
        slides: ["Deciding what goes on each slide.", "Writing short bullets, not paragraphs.", "Describing the picture for each slide."],
        animation: ["Writing the code that moves the parts.", "Timing the motion to the narration.", "Adding play, pause and a scrubber."],
        three_d: ["Modelling the parts in three dimensions.", "Choosing which parts you can tap or rotate.", "Lighting it so the labels are readable."],
        video: ["Writing the shots for the video.", "Describing real-world footage of the phenomenon.", "Writing narration that spans the shots."],
        annotation: ["Reading your photo closely.", "Deciding where each note should sit on the page.", "Keeping notes short enough to read on a phone."],
      };
      return [...base, ...(byFormat[format ?? ""] ?? ["Building it from what a student of your class already knows.", "Defining every technical word the first time it appears."]), "Writing the narration.", "Writing one check question for the end."];
    }
    case "verifying":
      return ["A second model is checking every fact, label and number.", "Comparing with the NCERT definition for your class.", "Checking the check question has one right answer.", "If anything is off, it is sent back once to be fixed."];
    case "rendering":
      return format === "video" ? ["Generating the video clips. This is the slow part.", "Recording the narration.", "Stitching clips and narration together."] : format === "slides" || format === "steps" ? ["Generating a small illustration for each part.", "Recording the narration.", "Laying it out for your screen."] : ["Recording the narration.", "Preparing it for your screen."];
  }
}

const ASIDES = [
  "Tip: after it appears, tap “Keep going” to go one step deeper.",
  "Tip: the check question at the end is how your parent's report knows you understood.",
  "Tip: you can photograph a whole homework page next time. We find every question on it.",
  "Tip: tap “Explain it simpler” if the first version is too much.",
  "Tip: the library is free. Anything already made costs one credit.",
  "Tip: the expand button shows any picture full screen.",
];

export function GenerationFeed({ ex }: { ex: ExplanationRow }) {
  const stage: Stage = (ORDER as string[]).includes(ex.status) ? (ex.status as Stage) : "routing";
  const [now, setNow] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      setTick((x) => x + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const started = new Date(ex.created_at).getTime();
  const elapsed = Math.max(0, Math.round((now - started) / 1000));
  const format = ex.format ?? null;
  const typical = TYPICAL[format ?? "default"] ?? TYPICAL.default;
  const total = ORDER.reduce((s, k) => s + typical[k], 0);
  const before = ORDER.slice(0, ORDER.indexOf(stage)).reduce((s, k) => s + typical[k], 0);
  // Progress creeps within the current stage and never reaches the end of it until the next stage arrives.
  const inStage = Math.min(0.92, Math.max(0, (elapsed - before) / typical[stage]));
  const progress = Math.min(0.97, (before + inStage * typical[stage]) / total);
  const msgs = lines(stage, format, ex.concept_title ?? null);
  const line = msgs[Math.floor(tick / 4) % msgs.length];
  const aside = ASIDES[Math.floor(tick / 9) % ASIDES.length];
  const estimate = Math.max(10, total - elapsed);
  const longWait = elapsed > total + 30;

  return (
    <div className="rounded-3xl border border-border bg-panel p-4 text-[14px]" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-text opacity-40" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-text" />
          </span>
          {STAGE_TITLE[stage]}
        </div>
        <div className="tabular text-[12px] text-faint">
          {elapsed}s{!longWait && ` · about ${estimate}s more`}
        </div>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-text transition-all duration-1000" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        {ORDER.map((s) => {
          const done = ORDER.indexOf(s) < ORDER.indexOf(stage);
          const current = s === stage;
          return (
            <li key={s} className={done ? "text-muted line-through decoration-border-2" : current ? "text-text" : "text-faint"}>
              {done ? "✓ " : current ? "→ " : "· "}
              {STAGE_TITLE[s]}
            </li>
          );
        })}
      </ol>
      <p key={line} className="rise mt-3 leading-relaxed text-muted">
        {line}
      </p>
      <p className="mt-2 text-[12px] text-faint">{longWait ? "Taking longer than usual. It is still working, and you will not be charged if it fails." : aside}</p>
      {ex.credits_quoted > 0 && stage !== "routing" && <p className="mt-1 text-[12px] text-faint">{ex.credits_quoted} credits, charged only when it is ready.</p>}
    </div>
  );
}
