import { env } from "@/lib/env";
import { falConfigured, falRun, falDownload } from "@/lib/providers/fal";

/**
 * Illustrations for steps and slides. fal.ai when FAL_KEY is set (model from FAL_IMAGE_MODEL),
 * otherwise the Gemini API's Imagen models when GEMINI_API_KEY is set, otherwise none.
 */
export function imagesConfigured(): boolean {
  const e = env();
  return falConfigured() || Boolean(e.GEMINI_API_KEY);
}

const STYLE = "Simple, clean educational illustration for a school textbook, flat colours, white background, no text, no watermark.";

export async function generateIllustration(prompt: string): Promise<{ bytes: Buffer; contentType: string; ext: string } | null> {
  const e = env();
  const fullPrompt = `${STYLE} ${prompt}`;

  if (falConfigured()) {
    const out = await falRun<{ images?: { url: string; content_type?: string }[] }>(e.FAL_IMAGE_MODEL, {
      prompt: fullPrompt,
      image_size: "landscape_4_3",
      num_images: 1,
      enable_safety_checker: true,
    });
    const img = out.images?.[0];
    if (!img?.url) throw new Error("fal returned no image");
    const bytes = await falDownload(img.url);
    const isJpeg = (img.content_type ?? "").includes("jpeg") || img.url.endsWith(".jpg");
    return { bytes, contentType: isJpeg ? "image/jpeg" : "image/png", ext: isJpeg ? "jpg" : "png" };
  }

  if (e.GEMINI_API_KEY) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${e.IMAGE_MODEL}:predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": e.GEMINI_API_KEY },
      body: JSON.stringify({ instances: [{ prompt: fullPrompt }], parameters: { sampleCount: 1, aspectRatio: "4:3", personGeneration: "dont_allow" } }),
    });
    if (!res.ok) throw new Error(`image generation failed: ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const json = (await res.json()) as { predictions?: { bytesBase64Encoded?: string }[] };
    const b64 = json.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error("image generation returned no image");
    return { bytes: Buffer.from(b64, "base64"), contentType: "image/png", ext: "png" };
  }
  return null;
}
