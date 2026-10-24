import { z } from "zod";
import { structuredCall, type ModelUsage } from "@/lib/ai/client";
import { VERIFY_SYSTEM } from "@/lib/ai/prompts";
import type { SceneDoc } from "@/lib/scene/schema";
import { env } from "@/lib/env";

export const VerifyOutput = z.object({
  verdict: z.enum(["pass", "fail"]),
  /** Three "keep going" questions; cheap to produce here and keeps the teach schema small. */
  followUps: z.array(z.string()),
  issues: z.array(
    z.object({
      sceneIndex: z.number().int(),
      severity: z.enum(["minor", "major"]),
      description: z.string(),
      fix: z.string(),
    }),
  ),
});
export type VerifyOutput = z.infer<typeof VerifyOutput>;

/** Strip bulky code and SVG before review so the reviewer focuses on content, not bytes. */
function compactForReview(doc: SceneDoc) {
  return {
    ...doc,
    scenes: doc.scenes.map((s) => {
      switch (s.kind) {
        case "diagram": {
          // Keep text labels from the SVG so label errors are catchable.
          const labels = Array.from(s.svg.matchAll(/<text[^>]*>([^<]{1,80})<\/text>|<tspan[^>]*>([^<]{1,80})<\/tspan>/g))
            .map((m) => (m[1] ?? m[2] ?? "").trim())
            .filter(Boolean);
          return { kind: s.kind, title: s.title, caption: s.caption, narration: s.narration, svgLabels: labels };
        }
        case "animation":
        case "three_d":
          return { ...s, code: `[${s.code.length} chars of code omitted]` };
        default:
          return s;
      }
    }),
  };
}

export async function verify(doc: SceneDoc, question: string, language: "english" | "hinglish" = "english"): Promise<{ result: VerifyOutput; usage: ModelUsage }> {
  const e = env();
  const { data, usage } = await structuredCall({
    stage: "verify",
    model: e.VERIFY_MODEL,
    system: language === "hinglish" ? `${VERIFY_SYSTEM}\n\nThis explanation is intentionally written in Hinglish (Hindi in Latin script mixed with English, technical terms in English). Judge the science and the clarity; do not flag the language itself.` : VERIFY_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Student's question: ${question}\n\nScene document (JSON):\n${JSON.stringify(compactForReview(doc), null, 1)}`,
      },
    ],
    schema: VerifyOutput,
    maxTokens: 4_000,
    effort: "medium",
  });
  return { result: data, usage };
}
