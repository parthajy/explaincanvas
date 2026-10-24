import { nanoid } from "nanoid";
import type { SceneDoc } from "@/lib/scene/schema";
import { storage, storageWritable } from "@/lib/storage";
import { synthesizeNarration, ttsConfigured } from "@/lib/providers/tts";
import { recordAssetCost, assetPrices } from "@/lib/budget";
import { generateIllustration, imagesConfigured } from "@/lib/providers/images";
import { generateClip, videoConfigured } from "@/lib/providers/video";
import { logger } from "@/lib/logger";

/**
 * The rendering stage: attaches narration audio, illustrations and video clips to a scene
 * document, each behind its own provider flag. A failed asset never fails the explanation;
 * the scene simply plays without it. Shared assets live under assets/<explanationId>/ and are
 * served to signed-in users by /api/files.
 */
export interface RenderOptions {
  explanationId: string;
  accountId: string;
  fastVideo: boolean;
  premiumNarration: boolean;
  /** Free accounts get the picture without audio; narration is a paid feature and a real cost. */
  narration: boolean;
  /** Return with whatever is done once this many ms have passed. */
  budgetMs?: number;
}

export interface RenderReport {
  audio: number;
  images: number;
  clips: number;
  errors: string[];
}

const key = (explanationId: string, name: string) => `assets/${explanationId}/${name}`;
const url = (k: string) => `/api/files/${k}`;

export async function renderAssets(doc: SceneDoc, opts: RenderOptions): Promise<{ doc: SceneDoc; report: RenderReport }> {
  const report: RenderReport = { audio: 0, images: 0, clips: 0, errors: [] };
  const started = Date.now();
  const budget = opts.budgetMs ?? 240_000;
  const over = () => Date.now() - started > budget;
  const log = logger.child({ explanationId: opts.explanationId, stage: "render" });
  const out: SceneDoc = structuredClone(doc);
  const prices = assetPrices();

  // Do not generate assets we cannot store.
  const writable = await storageWritable();
  if (!writable.ok) {
    report.errors.push(writable.error ?? "storage not writable");
    log.error({ error: writable.error }, "skipping asset rendering: storage not writable");
    return { doc: out, report };
  }

  for (let i = 0; i < out.scenes.length; i++) {
    const scene = out.scenes[i];

    if (opts.narration && ttsConfigured() && !over()) {
      try {
        const text = "narration" in scene ? scene.narration : scene.kind === "slides" ? scene.slides.map((s) => s.narration).join(" ") : "";
        if (text) {
          const t0 = Date.now();
          const audio = await synthesizeNarration(text, { premium: opts.premiumNarration });
          if (audio) {
            await recordAssetCost({ accountId: opts.accountId, explanationId: opts.explanationId, stage: "tts", provider: audio.provider, units: audio.characters, costPaise: (audio.characters / 1000) * prices.ttsPer1kChars * (opts.premiumNarration ? 2 : 1), latencyMs: Date.now() - t0 });
            const k = key(opts.explanationId, `scene-${i}-${nanoid(6)}.mp3`);
            await storage().put(k, audio.mp3, "audio/mpeg");
            scene.audioUrl = url(k);
            report.audio++;
          }
        }
      } catch (err) {
        report.errors.push(`scene ${i} audio: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (imagesConfigured() && !over()) {
      const items = scene.kind === "steps" ? scene.steps : scene.kind === "slides" ? scene.slides : [];
      for (let j = 0; j < items.length && !over(); j++) {
        const item = items[j] as { imagePrompt?: string; imageUrl?: string };
        if (!item.imagePrompt || item.imageUrl) continue;
        try {
          const t0 = Date.now();
          const img = await generateIllustration(item.imagePrompt);
          if (img) {
            await recordAssetCost({ accountId: opts.accountId, explanationId: opts.explanationId, stage: "image", provider: "fal", units: 1, costPaise: prices.image, latencyMs: Date.now() - t0 });
            const k = key(opts.explanationId, `scene-${i}-item-${j}-${nanoid(6)}.${img.ext}`);
            await storage().put(k, img.bytes, img.contentType);
            item.imageUrl = url(k);
            report.images++;
          }
        } catch (err) {
          report.errors.push(`scene ${i} image ${j}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    if (scene.kind === "video" && videoConfigured() && !over()) {
      for (let j = 0; j < scene.shots.length && !over(); j++) {
        const shot = scene.shots[j];
        if (shot.clipUrl) continue;
        try {
          const t0 = Date.now();
          const clip = await generateClip(shot.prompt, shot.durationSeconds, { fast: opts.fastVideo });
          if (clip) {
            await recordAssetCost({ accountId: opts.accountId, explanationId: opts.explanationId, stage: "video", provider: "fal", units: shot.durationSeconds, costPaise: shot.durationSeconds * prices.videoPerSecond, latencyMs: Date.now() - t0 });
            const k = key(opts.explanationId, `scene-${i}-shot-${j}-${nanoid(6)}.mp4`);
            await storage().put(k, clip.mp4, "video/mp4");
            shot.clipUrl = url(k);
            report.clips++;
          }
        } catch (err) {
          report.errors.push(`scene ${i} shot ${j}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  if (report.errors.length) log.warn({ errors: report.errors }, "some assets failed");
  return { doc: out, report };
}
