import { env } from "@/lib/env";
import { falConfigured, falRun, falDownload } from "@/lib/providers/fal";

/**
 * Narration audio, cheapest-first with automatic fallback down the chain:
 *  premium (ElevenLabs, Pro and Max) -> OpenAI gpt-4o-mini-tts -> ElevenLabs standard -> ElevenLabs via fal.
 *  A provider that errors (no credits, outage) is skipped, so one unfunded account never silences lessons.
 *  Returns null only when nothing is configured.
 */
export function ttsConfigured(): boolean {
  const e = env();
  return Boolean(e.OPENAI_API_KEY) || Boolean(e.ELEVEN_LABS_API_KEY) || falConfigured();
}

const INSTRUCTIONS =
  "You are a warm, clear school teacher explaining to a 12 to 15 year old in India. Indian English pronunciation of names and units. Unhurried, friendly, a little upbeat. Pause briefly between sentences.";

async function openai(text: string): Promise<Buffer> {
  const e = env();
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: e.OPENAI_TTS_MODEL, voice: e.OPENAI_TTS_VOICE, input: text, instructions: INSTRUCTIONS, response_format: "mp3", speed: 1.0 }),
  });
  if (!res.ok) throw new Error(`openai tts failed: ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function elevenlabs(text: string, model: string): Promise<Buffer> {
  const e = env();
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(e.ELEVEN_LABS_VOICE_ID)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": e.ELEVEN_LABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true, speed: 0.95 } }),
  });
  if (!res.ok) throw new Error(`elevenlabs tts failed: ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function synthesizeNarration(text: string, opts: { premium?: boolean } = {}): Promise<{ mp3: Buffer; characters: number; provider: string } | null> {
  const e = env();
  const input = text.slice(0, 4_000);
  const attempts: { name: string; run: () => Promise<Buffer> }[] = [];
  if (opts.premium && e.ELEVEN_LABS_API_KEY) attempts.push({ name: `elevenlabs:${e.ELEVEN_LABS_PREMIUM_MODEL}`, run: () => elevenlabs(input, e.ELEVEN_LABS_PREMIUM_MODEL) });
  if (e.OPENAI_API_KEY) attempts.push({ name: `openai:${e.OPENAI_TTS_MODEL}`, run: () => openai(input) });
  if (e.ELEVEN_LABS_API_KEY) attempts.push({ name: `elevenlabs:${e.ELEVEN_LABS_MODEL}`, run: () => elevenlabs(input, e.ELEVEN_LABS_MODEL) });
  if (falConfigured()) {
    attempts.push({
      name: "elevenlabs-via-fal",
      run: async () => {
        const out = await falRun<{ audio?: { url: string } }>(e.FAL_TTS_MODEL, { text: input, voice: e.FAL_TTS_VOICE, speed: 0.95 });
        if (!out.audio?.url) throw new Error("fal tts returned no audio");
        return falDownload(out.audio.url);
      },
    });
  }
  if (attempts.length === 0) return null;
  const errors: string[] = [];
  for (const a of attempts) {
    try {
      return { mp3: await a.run(), characters: input.length, provider: a.name };
    } catch (err) {
      errors.push(`${a.name}: ${err instanceof Error ? err.message.slice(0, 160) : String(err)}`);
    }
  }
  throw new Error(`all narration providers failed: ${errors.join(" | ")}`);
}
