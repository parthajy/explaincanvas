import { z } from "zod";

/**
 * Environment is validated once at import. A missing or malformed variable fails loudly at boot,
 * not in the middle of a student's request.
 */
const ServerEnv = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  /** DigitalOcean Managed Postgres connection string (sslmode=require) or the local docker URL. */
  DATABASE_URL: z.string().min(10),
  /** PEM of the cluster CA from the DigitalOcean control panel. Verifies TLS in production. */
  DATABASE_CA_CERT: z.string().optional(),
  DATABASE_SSL: z.enum(["off", "require", "no-verify"]).default("off"),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(8),

  /** DigitalOcean Spaces (S3 compatible). When unset, uploads go to .data/uploads on disk. */
  SPACES_BUCKET: z.string().optional(),
  SPACES_REGION: z.string().default("blr1"),
  SPACES_KEY: z.string().optional(),
  SPACES_SECRET: z.string().optional(),

  /** Transactional email for sign-in links. When unset, links are logged and written to .data/last-magic-link.txt. */
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("ExplainCanvas <hello@explaincanvas.com>")
  /** Where parent replies and support mail go. */,
  SUPPORT_EMAIL: z.string().default("hello@explaincanvas.com"),

  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /** Comma-separated emails allowed into /admin. */
  ADMIN_EMAILS: z.string().default("").transform((s) => s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)),

  /** Google OAuth (Web application client). Unset outside production = the Google button signs in a local test parent. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  /** Optional: the SDK also resolves `ant auth login` profiles when unset. */
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  /** Paid plans teach on Opus (measured: medium effort failed verification where high passes, and a retry costs more than it saves). Free accounts teach on Haiku at about 1/15th the cost; the Sonnet verifier and an Opus revision pass keep the floor on quality. */
  TEACHING_MODEL: z.string().default("claude-opus-5-5"),
  TEACHING_MODEL_FREE: z.string().default("claude-haiku-5-5"),
  TEACHING_RETRY_MODEL: z.string().default("claude-opus-5-5"),
  TEACHING_EFFORT: z.enum(["low", "medium", "high"]).default("high"),
  VERIFY_MODEL: z.string().default("claude-sonnet-5-5"),
  ROUTER_MODEL: z.string().default("claude-haiku-5-5"),
  FOLLOWUP_MODEL: z.string().default("claude-haiku-5-5"),
  FOLLOWUP_ESCALATION_MODEL: z.string().default("claude-sonnet-5-5"),

  /** fal.ai: one key for video, images and premium voice. Model ids are configuration (see fal.ai/models). */
  FAL_KEY: z.string().optional(),
  FAL_IMAGE_MODEL: z.string().default("fal-ai/flux/schnell"),
  FAL_VIDEO_MODEL: z.string().default("fal-ai/veo3.1/lite"),
  FAL_VIDEO_MODEL_FAST: z.string().default("fal-ai/veo3.1/fast"),
  FAL_TTS_MODEL: z.string().default("fal-ai/elevenlabs/tts/turbo-v2.5"),
  FAL_TTS_VOICE: z.string().default("Rachel"),
  FAL_STT_MODEL: z.string().default("fal-ai/whisper"),

  /** OpenAI: narration (gpt-4o-mini-tts) and dictation (transcription). Cheapest voice option. */
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TTS_MODEL: z.string().default("gpt-4o-mini-tts"),
  OPENAI_TTS_VOICE: z.string().default("coral"),
  OPENAI_STT_MODEL: z.string().default("gpt-4o-mini-transcribe"),

  /** ElevenLabs narration. Unset = ElevenLabs via fal when FAL_KEY is set, else no audio. */
  ELEVEN_LABS_API_KEY: z.string().optional(),
  ELEVEN_LABS_VOICE_ID: z.string().default("21m00Tcm4TlvDq8ikWAM"),
  ELEVEN_LABS_MODEL: z.string().default("eleven_turbo_v2_5"),
  ELEVEN_LABS_PREMIUM_MODEL: z.string().default("eleven_multilingual_v2"),
  /** Gemini API key: Imagen illustrations and Veo clips. Unset = no images, no video. */
  GEMINI_API_KEY: z.string().optional(),
  IMAGE_MODEL: z.string().default("imagen-4.0-generate-001"),
  VIDEO_MODEL: z.string().default("veo-3.1-lite-generate-preview"),
  VIDEO_MODEL_FAST: z.string().default("veo-3.1-fast-generate-preview"),
  /** Hard ceiling on provider spend per calendar month (IST). 0 disables the guard. */
  MONTHLY_BUDGET_INR: z.coerce.number().min(0).default(25_000),
  /** Fraction of the budget at which free accounts lose fresh generations (library stays open). */
  BUDGET_FREE_PAUSE_AT: z.coerce.number().min(0).max(2).default(0.7),
  /** Fraction at which every fresh generation pauses until the month turns. */
  BUDGET_HARD_PAUSE_AT: z.coerce.number().min(0).max(3).default(1.05),
  /** Non-model unit prices in paise so narration, images and video count against the budget. */
  COST_TTS_PAISE_PER_1K_CHARS: z.coerce.number().min(0).default(900),
  COST_IMAGE_PAISE: z.coerce.number().min(0).default(30),
  COST_VIDEO_PAISE_PER_SECOND: z.coerce.number().min(0).default(3_000),
  /** Android wrapper (Trusted Web Activity). Fingerprints: upload key and Play app-signing key, comma-separated. */
  ANDROID_PACKAGE_NAME: z.string().default("com.explaincanvas.app"),
  ANDROID_SHA256_FINGERPRINTS: z.string().default("").transform((s) => s.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean)),
  /** Hour of day (IST, 0-23) when the daily parent report goes out. */
  PARENT_REPORT_HOUR_IST: z.coerce.number().int().min(0).max(23).default(20),

  /** Dodo Payments (merchant of record). Test and live have separate keys, secrets and product ids. */
  DODO_API_KEY: z.string().optional(),
  DODO_WEBHOOK_SECRET: z.string().optional(),
  DODO_MODE: z.enum(["test", "live"]).default("test"),
  DODO_PRODUCT_STUDENT: z.string().optional(),
  DODO_PRODUCT_PRO: z.string().optional(),
  DODO_PRODUCT_MAX: z.string().optional(),
  DODO_PRODUCT_MAX_ANNUAL: z.string().optional(),
  DODO_PRODUCT_TOPUP_SMALL: z.string().optional(),
  DODO_PRODUCT_TOPUP_MEDIUM: z.string().optional(),
  DODO_PRODUCT_TOPUP_LARGE: z.string().optional(),

  WORKER_ID: z.string().default(() => `worker-${process.pid}`),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),

  /** Feature flags: renderers switch on only when their pipeline is live. */
  ENABLE_FORMATS: z
    .string()
    .default("diagram,steps,slides,three_d,annotation,animation")
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),
});

export type ServerEnv = z.infer<typeof ServerEnv>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  // A blank value in .env.local means "not set", not "set to the empty string".
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ""));
  const parsed = ServerEnv.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
    throw new Error(`Invalid environment:\n  ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function paymentsConfigured(): boolean {
  const e = env();
  return Boolean(e.DODO_API_KEY && e.DODO_WEBHOOK_SECRET);
}

export function spacesConfigured(): boolean {
  const e = env();
  return Boolean(e.SPACES_BUCKET && e.SPACES_KEY && e.SPACES_SECRET);
}

export function googleConfigured(): boolean {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}
