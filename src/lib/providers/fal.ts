import { env } from "@/lib/env";

/**
 * fal.ai queue API: one key, many models (Veo, Kling, Flux, Imagen, ElevenLabs, ...).
 * Submit -> poll status -> fetch result. Model ids are configuration; see fal.ai/models.
 */
export function falConfigured(): boolean {
  return Boolean(env().FAL_KEY);
}

function headers() {
  return { Authorization: `Key ${env().FAL_KEY}`, "Content-Type": "application/json" };
}

export class FalError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "FalError";
  }
}

interface Submitted {
  request_id: string;
  status_url: string;
  response_url: string;
}

/** Runs a model through the queue and returns its JSON result. */
export async function falRun<T>(modelId: string, input: Record<string, unknown>, opts: { timeoutMs?: number; pollMs?: number } = {}): Promise<T> {
  if (!falConfigured()) throw new FalError("fal not configured");
  const timeoutMs = opts.timeoutMs ?? 5 * 60_000;
  const pollMs = opts.pollMs ?? 3_000;

  const submit = await fetch(`https://queue.fal.run/${modelId}`, { method: "POST", headers: headers(), body: JSON.stringify(input) });
  if (!submit.ok) throw new FalError(`fal submit failed: ${submit.status} ${(await submit.text().catch(() => "")).slice(0, 300)}`, submit.status);
  const job = (await submit.json()) as Submitted;
  if (!job.status_url || !job.response_url) throw new FalError("fal submit returned no queue urls");

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const st = await fetch(job.status_url, { headers: headers() });
    if (!st.ok) throw new FalError(`fal status failed: ${st.status}`, st.status);
    const status = (await st.json()) as { status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | string; error?: unknown };
    if (status.status === "COMPLETED") {
      const res = await fetch(job.response_url, { headers: headers() });
      if (!res.ok) throw new FalError(`fal result failed: ${res.status}`, res.status);
      return (await res.json()) as T;
    }
    if (status.status === "FAILED") throw new FalError(`fal job failed: ${JSON.stringify(status.error ?? "").slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new FalError("fal job timed out");
}

/** Downloads a result file fal hosts for us. */
export async function falDownload(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new FalError(`fal download failed: ${res.status}`, res.status);
  return Buffer.from(await res.arrayBuffer());
}
