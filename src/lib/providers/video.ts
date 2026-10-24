import { env } from "@/lib/env";
import { falConfigured, falRun, falDownload } from "@/lib/providers/fal";

/**
 * Short real-world clips. fal.ai when FAL_KEY is set (FAL_VIDEO_MODEL, FAL_VIDEO_MODEL_FAST),
 * otherwise the Gemini API's Veo models when GEMINI_API_KEY is set, otherwise none.
 */
export function videoConfigured(): boolean {
  return falConfigured() || Boolean(env().GEMINI_API_KEY);
}

const STYLE = "Documentary style, realistic, steady camera, no text overlays, no people's faces.";
const VIDEO_TIMEOUT_MS = 6 * 60_000;

export async function generateClip(prompt: string, durationSeconds: number, opts: { fast?: boolean } = {}): Promise<{ mp4: Buffer } | null> {
  const e = env();
  const seconds = Math.min(8, Math.max(4, Math.round(durationSeconds)));
  const fullPrompt = `${STYLE} ${prompt}`;

  if (falConfigured()) {
    const model = opts.fast ? e.FAL_VIDEO_MODEL_FAST : e.FAL_VIDEO_MODEL;
    const out = await falRun<{ video?: { url: string } }>(model, { prompt: fullPrompt, duration: `${seconds}s`, aspect_ratio: "16:9", resolution: "720p", generate_audio: false }, { timeoutMs: VIDEO_TIMEOUT_MS, pollMs: 5_000 });
    if (!out.video?.url) throw new Error("fal returned no video");
    return { mp4: await falDownload(out.video.url) };
  }

  if (e.GEMINI_API_KEY) {
    const model = opts.fast ? e.VIDEO_MODEL_FAST : e.VIDEO_MODEL;
    const headers = { "Content-Type": "application/json", "x-goog-api-key": e.GEMINI_API_KEY };
    const start = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`, {
      method: "POST",
      headers,
      body: JSON.stringify({ instances: [{ prompt: fullPrompt }], parameters: { aspectRatio: "16:9", durationSeconds: seconds, resolution: "720p" } }),
    });
    if (!start.ok) throw new Error(`video start failed: ${start.status} ${(await start.text().catch(() => "")).slice(0, 200)}`);
    const op = (await start.json()) as { name?: string };
    if (!op.name) throw new Error("video start returned no operation");
    const deadline = Date.now() + VIDEO_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10_000));
      const poll = await fetch(`https://generativelanguage.googleapis.com/v1beta/${op.name}`, { headers });
      if (!poll.ok) throw new Error(`video poll failed: ${poll.status}`);
      const status = (await poll.json()) as { done?: boolean; error?: { message?: string }; response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[] } } };
      if (status.error) throw new Error(`video generation error: ${status.error.message ?? "unknown"}`);
      if (status.done) {
        const uri = status.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        if (!uri) throw new Error("video finished without a file");
        const file = await fetch(uri, { headers: { "x-goog-api-key": e.GEMINI_API_KEY } });
        if (!file.ok) throw new Error(`video download failed: ${file.status}`);
        return { mp4: Buffer.from(await file.arrayBuffer()) };
      }
    }
    throw new Error("video generation timed out");
  }
  return null;
}
