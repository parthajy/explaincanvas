import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { structuredCall, type ModelUsage } from "@/lib/ai/client";
import { ROUTER_SYSTEM } from "@/lib/ai/prompts";
import { Format, Subject } from "@/lib/scene/schema";
import { env } from "@/lib/env";
import { levelLabel } from "@/lib/levels";

export const RouterDecision = z.object({
  intent: z.enum(["explain", "solve", "followup", "chitchat", "offtopic", "unsafe"]),
  subject: Subject,
  classLevel: z.number().int().min(1).max(20),
  concept: z.object({
    key: z.string(),
    title: z.string(),
    chapter: z.string().nullable(),
  }),
  format: Format,
  formatReason: z.string(),
  needsHardModel: z.boolean(),
  /** NCERT chapter number from the index in the message; null when unknown. */
  ncertChapter: z.number().int().min(1).max(20).nullable(),
  /** Short reply to show for chitchat, offtopic and unsafe. Empty otherwise. */
  reply: z.string(),
});
export type RouterDecision = z.infer<typeof RouterDecision>;

export interface RouterInput {
  text: string;
  imageBase64?: { mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string } | null;
  studentClass?: number | null;
  /** Compact context: last few turns, newest last. */
  recentTurns: { role: "user" | "assistant"; text: string }[];
  hasPriorExplanation: boolean;
  enabledFormats: Format[];
  /** Free users only get the diagram renderer for fresh generations. */
  forceFormat?: Format | null;
  /** "Science: 1 ...; 2 ... || Maths: 1 ...; 2 ..." for the student's class. */
  ncertIndex?: string;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export async function routeMessage(input: RouterInput): Promise<{ decision: RouterDecision; usage: ModelUsage }> {
  const e = env();
  const enabled = input.forceFormat ? [input.forceFormat] : input.enabledFormats;
  const context = input.recentTurns
    .slice(-6)
    .map((t) => `${t.role === "user" ? "Student" : "Assistant"}: ${t.text.slice(0, 400)}`)
    .join("\n");

  const header = [
    `Enabled formats: ${enabled.join(", ")}.`,
    input.studentClass ? `Learner's level: ${input.studentClass} (${levelLabel(input.studentClass)}).` : "Learner's level: unknown.",
    `A previous explanation exists in this chat: ${input.hasPriorExplanation ? "yes" : "no"}.`,
    input.imageBase64 ? "The student attached a photo (shown)." : "No photo attached.",
    input.ncertIndex ? `Textbook chapter index for this learner's class. ${input.ncertIndex}` : "No chapter index available: set ncertChapter to null.",
    context ? `Recent chat:\n${context}` : "Recent chat: none.",
    `Student's message:\n${input.text}`,
  ].join("\n\n");

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.imageBase64) {
    content.push({ type: "image", source: { type: "base64", media_type: input.imageBase64.mediaType, data: input.imageBase64.data } });
  }
  content.push({ type: "text", text: header });

  const { data, usage } = await structuredCall({
    stage: "route",
    model: e.ROUTER_MODEL,
    system: ROUTER_SYSTEM,
    messages: [{ role: "user", content }],
    schema: RouterDecision,
    maxTokens: 1_200,
    effort: "low",
  });

  // Normalise and enforce the enabled set regardless of what the model said.
  const decision: RouterDecision = {
    ...data,
    concept: { ...data.concept, key: slugify(data.concept.key || data.concept.title) || "general-concept" },
    format: enabled.includes(data.format) ? data.format : enabled.includes("diagram") ? "diagram" : enabled[0],
    classLevel: input.studentClass ?? data.classLevel,
  };
  return { decision, usage };
}
