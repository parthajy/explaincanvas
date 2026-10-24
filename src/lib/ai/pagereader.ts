import { z } from "zod";
import { structuredCall, type ModelUsage } from "@/lib/ai/client";
import { env } from "@/lib/env";

/**
 * Reads a photographed homework or textbook page before routing. Most real questions arrive as a phone photo
 * of a whole page, so we find every question on it, let the student pick one, and keep the image for context.
 */

export const PageRead = z.object({
  /** True when the photo shows one or more written questions or exercises (as opposed to a single diagram or object). */
  isQuestionPage: z.boolean(),
  questions: z.array(z.object({ label: z.string(), text: z.string() })).max(12),
  /** Chapter number and name if printed on the page, else null. */
  chapterHint: z.string().nullable(),
  /** Anything sexual, violent or otherwise not for a child. */
  unsafe: z.boolean(),
});
export type PageRead = z.infer<typeof PageRead>;

const SYSTEM = `You read photos that learners take of textbook pages, worksheets, problem sets, lecture notes and homework, from school to university level.
Return every distinct question or exercise item you can see, in reading order, with its label as printed ("Q3", "4.2 (ii)", "Example 7") and the full question text transcribed faithfully (keep numbers, units and symbols; write maths plainly, e.g. x^2, 3/4, sqrt(2)).
If the photo is a single diagram, object or paragraph with no questions, set isQuestionPage false and return an empty list.
If any part of the image is sexual, violent or otherwise unsuitable for a child, set unsafe true and return nothing else.
Never answer the questions.`;

export async function readPage(image: { mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string }, studentText: string): Promise<{ read: PageRead; usage: ModelUsage }> {
  const { data, usage } = await structuredCall({
    stage: "route",
    model: env().ROUTER_MODEL,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
          { type: "text", text: `The student wrote: "${studentText.slice(0, 300) || "(nothing)"}". List the questions on this page.` },
        ],
      },
    ],
    schema: PageRead,
    maxTokens: 2_000,
    effort: "low",
  });
  return { read: data, usage };
}

/** "solve this", "explain", "Q3 please": the student has not typed a real question, the photo is the question. */
export function textIsThin(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 28) return true;
  return /^(please\s+)?(solve|explain|answer|do|help( me)?( with)?|what is the answer( to)?|answer this|solve this|explain this|this one|q\s*\d+|question\s*\d+)\b/.test(t) && t.length < 60;
}

/** Picks the question the student named ("Q3", "second one") from a read page, if they named one. */
export function pickNamed(read: PageRead, text: string): { label: string; text: string } | null {
  const t = text.toLowerCase();
  const m = /\b(?:q(?:uestion)?\.?\s*)(\d{1,2})\b/.exec(t);
  if (m) {
    const hit = read.questions.find((x) => x.label.toLowerCase().replace(/[^a-z0-9.]/g, "") === `q${m[1]}` || x.label.replace(/[^0-9.]/g, "") === m[1]);
    if (hit) return hit;
  }
  const ord = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"].findIndex((w) => t.includes(w));
  if (ord >= 0 && read.questions[ord]) return read.questions[ord];
  return null;
}
