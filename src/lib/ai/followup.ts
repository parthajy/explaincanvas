import { streamText, type ModelUsage } from "@/lib/ai/client";
import { FOLLOWUP_SYSTEM } from "@/lib/ai/prompts";
import type { SceneDoc } from "@/lib/scene/schema";
import { env } from "@/lib/env";

function contextFrom(doc: SceneDoc | null): string {
  if (!doc) return "No explanation is available in this chat.";
  const narration = doc.scenes
    .map((s, i) => {
      const n = "narration" in s ? s.narration : s.kind === "slides" ? s.slides.map((sl) => sl.narration).join(" ") : "";
      return `Scene ${i + 1} (${s.kind}, ${s.title}): ${n}`;
    })
    .join("\n");
  return `Explanation title: ${doc.title}\nConcept: ${doc.concept.title}, Class ${doc.concept.classLevel}\nSummary: ${doc.summary}\n${narration}`;
}

export async function answerFollowup(input: {
  question: string;
  doc: SceneDoc | null;
  recentTurns: { role: "user" | "assistant"; text: string }[];
  hard: boolean;
  language?: "english" | "hinglish";
  onText?: (accumulated: string) => void;
  signal?: AbortSignal;
}): Promise<{ text: string; usage: ModelUsage; refused: boolean }> {
  const e = env();
  const model = input.hard ? e.FOLLOWUP_ESCALATION_MODEL : e.FOLLOWUP_MODEL;
  const history = input.recentTurns.slice(-6).map((t) => `${t.role === "user" ? "Student" : "Assistant"}: ${t.text.slice(0, 500)}`).join("\n");
  return streamText({
    stage: input.hard ? "followup-hard" : "followup",
    model,
    system: FOLLOWUP_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${contextFrom(input.doc)}\n\nRecent chat:\n${history || "none"}${input.language === "hinglish" ? "\n\nAnswer in natural Hinglish (Hindi in Latin script mixed with English); keep technical terms in English." : ""}\n\nStudent's follow-up question:\n${input.question}`,
      },
    ],
    maxTokens: 1_200,
    effort: input.hard ? "medium" : "low",
    onText: input.onText,
    signal: input.signal,
  });
}
