import { env } from "@/lib/env";
import { falConfigured, falRun } from "@/lib/providers/fal";

/**
 * Dictation on the server. The browser's own speech recognition is tried first in the client
 * (free); this is the fallback for browsers without it. OpenAI transcription, then fal Whisper.
 */
export function sttConfigured(): boolean {
  return Boolean(env().OPENAI_API_KEY) || falConfigured();
}

async function viaOpenAI(audio: Buffer, mimeType: string): Promise<string> {
  const e = env();
  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : mimeType.includes("wav") ? "wav" : mimeType.includes("mpeg") ? "mp3" : "webm";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `dictation.${ext}`);
  form.append("model", e.OPENAI_STT_MODEL);
  form.append("language", "en");
  form.append("prompt", "A student in India asking an academic question: maths, science, engineering, economics, medicine, humanities. Terms like Newton, photosynthesis, Ohm's law, hypotenuse, eigenvalue, mitochondria.");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${e.OPENAI_API_KEY}` }, body: form });
  if (!res.ok) throw new Error(`openai transcription failed: ${res.status} ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

async function viaFal(audio: Buffer, mimeType: string): Promise<string> {
  const dataUri = `data:${mimeType};base64,${audio.toString("base64")}`;
  const out = await falRun<{ text?: string }>(env().FAL_STT_MODEL, { audio_url: dataUri, task: "transcribe", language: "en" }, { timeoutMs: 90_000, pollMs: 1_500 });
  return (out.text ?? "").trim();
}

export async function transcribe(audio: Buffer, mimeType: string): Promise<string | null> {
  const e = env();
  const attempts: (() => Promise<string>)[] = [];
  if (e.OPENAI_API_KEY) attempts.push(() => viaOpenAI(audio, mimeType));
  if (falConfigured()) attempts.push(() => viaFal(audio, mimeType));
  if (attempts.length === 0) return null;
  const errors: string[] = [];
  for (const a of attempts) {
    try {
      return await a();
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  throw new Error(`transcription failed: ${errors.join(" | ")}`);
}
