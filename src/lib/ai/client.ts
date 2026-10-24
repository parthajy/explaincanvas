import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * One place that talks to Claude. Every call is structured (zod-validated), priced,
 * and returns usage so the pipeline can record cost per explanation.
 */

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (client) return client;
  const e = env();
  client = new Anthropic(e.ANTHROPIC_API_KEY ? { apiKey: e.ANTHROPIC_API_KEY } : {});
  return client;
}

/** Server-side refusal fallback: a safety decline re-runs on Anthropic's recommended model. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
/** Haiku 5.5 has no server-side fallback; sending the parameter would be rejected. */
function supportsFallbacks(model: string): boolean {
  return !model.startsWith("claude-haiku");
}

export const INR_PER_USD = 88;

/** USD per million tokens. Keep in step with the pricing page. */
const PRICE: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

export interface ModelUsage {
  stage: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costPaise: number;
  latencyMs: number;
}

export function priceUsage(stage: string, model: string, usage: Anthropic.Usage | Anthropic.Beta.BetaUsage, latencyMs: number): ModelUsage {
  const p = PRICE[model] ?? PRICE["claude-opus-5-5"];
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
  const usd =
    (inputTokens * p.input + outputTokens * p.output + cacheReadTokens * p.cacheRead + cacheWriteTokens * p.cacheWrite) / 1_000_000;
  return {
    stage,
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    costPaise: Math.round(usd * INR_PER_USD * 100),
    latencyMs,
  };
}

export class RefusalError extends Error {
  constructor(public readonly category: string | null, explanation?: string | null) {
    super(`model refused (${category ?? "unknown"})${explanation ? `: ${explanation}` : ""}`);
    this.name = "RefusalError";
  }
}

export class ModelOutputError extends Error {
  constructor(message: string, public readonly rawText?: string) {
    super(message);
    this.name = "ModelOutputError";
  }
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface StructuredCallInput<S extends z.ZodType> {
  stage: string;
  model: string;
  /** Stable system text, cached. Put anything volatile in `messages`. */
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  schema: S;
  maxTokens?: number;
  effort?: Effort;
}

export interface StructuredCallResult<T> {
  data: T;
  usage: ModelUsage;
  servedBy: string;
}

/**
 * A single structured call. Always streams (the SDK refuses non-streaming requests whose output
 * cap could take more than ten minutes), then validates the JSON against the schema, prices the
 * usage, and turns refusals and truncation into typed errors the pipeline can act on.
 */
export async function structuredCall<S extends z.ZodType>(input: StructuredCallInput<S>): Promise<StructuredCallResult<z.infer<S>>> {
  const started = Date.now();
  const useFallbacks = supportsFallbacks(input.model);
  const stream = anthropic().beta.messages.stream({
    model: input.model,
    max_tokens: input.maxTokens ?? 16_000,
    system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
    messages: input.messages,
    output_config: {
      format: zodOutputFormat(input.schema),
      ...(input.effort ? { effort: input.effort } : {}),
    },
    ...(useFallbacks ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
  });
  const response = await stream.finalMessage();
  const usage = priceUsage(input.stage, response.model, response.usage, Date.now() - started);

  if (response.stop_reason === "refusal") {
    const details = response.stop_details && response.stop_details.type === "refusal" ? response.stop_details : null;
    throw new RefusalError(details?.category ?? null, details?.explanation ?? null);
  }
  if (response.stop_reason === "max_tokens") {
    throw new ModelOutputError(`${input.stage}: output truncated at max_tokens`);
  }
  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ModelOutputError(`${input.stage}: output was not JSON`, text.slice(0, 2000));
  }
  const parsed = input.schema.safeParse(json);
  if (!parsed.success) {
    throw new ModelOutputError(`${input.stage}: output did not match schema: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, text.slice(0, 2000));
  }

  logger.debug({ stage: input.stage, model: response.model, usage }, "structured call ok");
  return { data: parsed.data as z.infer<S>, usage, servedBy: response.model };
}

/**
 * Streams a plain-text answer. Calls onText with the accumulated text as it grows.
 * Resolves with the final text and priced usage.
 */
export async function streamText(input: {
  stage: string;
  model: string;
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  maxTokens?: number;
  effort?: Effort;
  onText?: (accumulated: string) => void;
  signal?: AbortSignal;
}): Promise<{ text: string; usage: ModelUsage; refused: boolean }> {
  const started = Date.now();
  const useFallbacks = supportsFallbacks(input.model);
  const stream = anthropic().beta.messages.stream(
    {
      model: input.model,
      max_tokens: input.maxTokens ?? 4_000,
      system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
      messages: input.messages,
      ...(input.effort ? { output_config: { effort: input.effort } } : {}),
      ...(useFallbacks ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
    },
    { signal: input.signal },
  );
  let acc = "";
  stream.on("text", (delta) => {
    acc += delta;
    input.onText?.(acc);
  });
  const final = await stream.finalMessage();
  const usage = priceUsage(input.stage, final.model, final.usage, Date.now() - started);
  return { text: acc, usage, refused: final.stop_reason === "refusal" };
}
