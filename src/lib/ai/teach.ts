import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { structuredCall, type ModelUsage } from "@/lib/ai/client";
import { TEACHING_SYSTEM, formatLabel } from "@/lib/ai/prompts";
import { slugify } from "@/lib/ai/router";
import { Format, SCENE_VERSION, SceneDoc, Subject, type SceneDoc as SceneDocT } from "@/lib/scene/schema";
import { sanitizeSvg, SvgRejectedError } from "@/lib/render/svg";
import { env } from "@/lib/env";

/**
 * The model writes against a deliberately loose schema (structured outputs support a JSON Schema
 * subset). We then normalise, sanitise and validate against the strict SceneDoc.
 */
const LooseScene = z.object({
  kind: Format,
  title: z.string(),
  narration: z.string(),
  // diagram
  svg: z.string().nullable(),
  caption: z.string().nullable(),
  // steps
  steps: z.array(z.object({ text: z.string(), imagePrompt: z.string().nullable() })).nullable(),
  // slides
  slides: z.array(z.object({ title: z.string(), bullets: z.array(z.string()), imagePrompt: z.string().nullable(), narration: z.string() })).nullable(),
  // animation / three_d
  engine: z.enum(["web", "manim", "remotion"]).nullable(),
  code: z.string().nullable(),
  interactions: z.array(z.string()).nullable(),
  // video
  shots: z.array(z.object({ prompt: z.string(), durationSeconds: z.number() })).nullable(),
  // annotation
  imageRef: z.string().nullable(),
  annotations: z
    .array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), label: z.string(), note: z.string() }))
    .nullable(),
});

export const TeachOutput = z.object({
  title: z.string(),
  summary: z.string(),
  audienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  concept: z.object({ key: z.string(), title: z.string(), subject: Subject, classLevel: z.number(), chapter: z.string().nullable() }),
  scenes: z.array(LooseScene),
  check: z.object({ question: z.string(), options: z.array(z.string()), answerIndex: z.number(), explanation: z.string() }),
  sources: z.array(z.object({ kind: z.enum(["ncert", "user_upload", "general"]), note: z.string() })),
});
export type TeachOutput = z.infer<typeof TeachOutput>;

export interface TeachInput {
  question: string;
  format: Format;
  concept: { key: string; title: string; subject: Subject; classLevel: number; chapter?: string | null };
  imageBase64?: { mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string } | null;
  /** From a failed verification: what to fix. */
  revisionNotes?: string[];
  language?: "english" | "hinglish";
  /** "Chapter 8, Force and Laws of Motion" once the router has mapped it. */
  ncertIndex?: string;
  /** Parsed from the question: "Ex 4.2 Q3". */
  ncertHint?: { chapter: number | null; ref: string | null };
}

export class SceneBuildError extends Error {
  constructor(message: string, public readonly issues: string[]) {
    super(message);
    this.name = "SceneBuildError";
  }
}

/** Turn loose model output into a strict SceneDoc. Throws SceneBuildError listing problems. */
export function buildSceneDoc(out: TeachOutput, format: Format): SceneDocT {
  const problems: string[] = [];
  const scenes = out.scenes.map((s, i) => {
    const kind = s.kind === format || format === "annotation" ? s.kind : s.kind; // keep the model's kind; verify format below
    try {
      switch (kind) {
        case "diagram":
          return { kind, title: s.title, svg: sanitizeSvg(s.svg ?? ""), caption: s.caption ?? "", narration: s.narration };
        case "steps":
          return {
            kind,
            title: s.title,
            steps: (s.steps ?? []).map((st) => ({ text: st.text, imagePrompt: st.imagePrompt ?? undefined })),
            narration: s.narration,
          };
        case "slides":
          return {
            kind,
            title: s.title,
            slides: (s.slides ?? []).map((sl) => ({
              title: sl.title,
              bullets: sl.bullets,
              imagePrompt: sl.imagePrompt ?? undefined,
              narration: sl.narration,
            })),
          };
        case "animation":
          return { kind, title: s.title, engine: s.engine ?? "web", code: s.code ?? "", narration: s.narration };
        case "three_d":
          return { kind, title: s.title, code: s.code ?? "", interactions: s.interactions ?? [], narration: s.narration };
        case "video":
          return {
            kind,
            title: s.title,
            shots: (s.shots ?? []).map((sh) => ({ prompt: sh.prompt, durationSeconds: Math.round(sh.durationSeconds) })),
            narration: s.narration,
          };
        case "annotation":
          return { kind, title: s.title, imageRef: s.imageRef ?? "upload", annotations: s.annotations ?? [], narration: s.narration };
      }
    } catch (err) {
      if (err instanceof SvgRejectedError) problems.push(`scene ${i}: svg rejected (${err.message})`);
      else throw err;
      return null;
    }
  });

  const candidate = {
    version: SCENE_VERSION,
    title: out.title,
    concept: {
      key: slugify(out.concept.key || out.concept.title),
      title: out.concept.title,
      subject: out.concept.subject,
      classLevel: out.concept.classLevel,
      board: "CBSE",
      chapter: out.concept.chapter ?? undefined,
    },
    format,
    audienceLevel: out.audienceLevel,
    summary: out.summary,
    scenes: scenes.filter(Boolean),
    check: out.check,
    followUps: [],
    sources: out.sources,
  };

  const parsed = SceneDoc.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) problems.push(`${issue.path.join(".")}: ${issue.message}`);
  }
  if (problems.length > 0) throw new SceneBuildError("scene document invalid", problems);
  return parsed.data as SceneDocT;
}

export async function teach(input: TeachInput): Promise<{ doc: SceneDocT; usage: ModelUsage[] }> {
  const e = env();
  const usages: ModelUsage[] = [];
  let notes = input.revisionNotes ?? [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const hinglish = input.language === "hinglish";
    const text = [
      hinglish ? "LANGUAGE: HINGLISH. This whole explanation must be written in Hinglish (see the Hinglish rule). English-only output is a failure." : "",
      `Format: ${input.format} (${formatLabel(input.format)}).`,
      `Concept: ${input.concept.title} (key: ${input.concept.key}), subject ${input.concept.subject}, Class ${input.concept.classLevel}${input.concept.chapter ? `, chapter: ${input.concept.chapter}` : ""}.`,
      input.ncertIndex ? `NCERT chapter for this concept: ${input.ncertIndex}. Follow that chapter's treatment, notation and definitions.` : "",
      input.ncertHint?.ref || input.ncertHint?.chapter ? `The student referred to ${input.ncertHint.chapter ? `Chapter ${input.ncertHint.chapter}` : ""}${input.ncertHint.chapter && input.ncertHint.ref ? ", " : ""}${input.ncertHint.ref ?? ""}: treat that exercise question as the worked example and answer it fully.` : "",
      `Student's question:\n${input.question}`,
      hinglish ? "Reminder: narration, captions, steps, bullets, the check question, its options and its explanation are all in Hinglish. Example of the voice: \"Dekho, jab hum ball ko upar phenkte hain, gravity usko wapas neeche kheenchti hai. Yahi force hai weight.\"" : "",
      notes.length ? `Fix these problems from the previous attempt:\n- ${notes.join("\n- ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (input.imageBase64) {
      content.push({ type: "image", source: { type: "base64", media_type: input.imageBase64.mediaType, data: input.imageBase64.data } });
    }
    content.push({ type: "text", text });

    const { data, usage } = await structuredCall({
      stage: attempt === 0 ? "teach" : "teach-retry",
      model: e.TEACHING_MODEL,
      system: TEACHING_SYSTEM,
      messages: [{ role: "user", content }],
      schema: TeachOutput,
      maxTokens: 24_000,
      effort: "high",
    });
    usages.push(usage);

    try {
      return { doc: buildSceneDoc(data, input.format), usage: usages };
    } catch (err) {
      if (err instanceof SceneBuildError && attempt === 0) {
        notes = [...notes, ...err.issues.slice(0, 8)];
        continue;
      }
      throw err;
    }
  }
  throw new SceneBuildError("scene document invalid after retry", notes);
}
