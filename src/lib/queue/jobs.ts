import { z } from "zod";
import { q, one } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Durable Postgres-backed job queue. Claiming uses SELECT ... FOR UPDATE SKIP LOCKED inside
 * jobs_claim(), so any number of workers can run. Failures back off exponentially and
 * dead-letter after max_attempts. Workers heartbeat; a reaper requeues jobs whose worker died.
 */

export const JobKind = z.enum(["explanation.generate", "lesson.promote", "parent.report", "credits.expire", "billing.cycle", "sessions.purge", "uploads.purge", "render.heavy", "email.send", "lifecycle.sweep", "credits.free_refill"]);
export type JobKind = z.infer<typeof JobKind>;

export interface JobRow {
  id: string;
  kind: JobKind;
  payload: unknown;
  idempotency_key: string;
  status: "queued" | "running" | "succeeded" | "failed" | "dead";
  priority: number;
  attempts: number;
  max_attempts: number;
  run_after: string;
  locked_by: string | null;
  last_error: string | null;
}

export async function enqueue(input: { kind: JobKind; payload: unknown; key: string; priority?: number; runAfter?: Date; maxAttempts?: number }): Promise<string> {
  const row = await one<{ id: string }>(`select jobs_enqueue($1,$2,$3,$4::smallint,$5,$6) as id`, [
    input.kind,
    JSON.stringify(input.payload ?? {}),
    input.key,
    input.priority ?? 0,
    input.runAfter ?? new Date(),
    input.maxAttempts ?? 3,
  ]);
  return row.id;
}

export async function claim(workerId: string, kinds: JobKind[], limit = 1): Promise<JobRow[]> {
  return q<JobRow>(`select * from jobs_claim($1,$2,$3)`, [workerId, kinds, limit]);
}

export async function claimOne(jobId: string, workerId: string): Promise<JobRow | null> {
  const rows = await q<JobRow>(`select * from jobs_claim_one($1,$2)`, [jobId, workerId]);
  return rows[0] ?? null;
}

export async function getJob(jobId: string): Promise<JobRow | null> {
  const rows = await q<JobRow>(`select * from jobs where id = $1`, [jobId]);
  return rows[0] ?? null;
}

export async function heartbeat(jobId: string, workerId: string): Promise<void> {
  await q(`select jobs_heartbeat($1,$2)`, [jobId, workerId]);
}

export async function complete(jobId: string, workerId: string, result?: unknown): Promise<void> {
  await q(`select jobs_complete($1,$2,$3)`, [jobId, workerId, result == null ? null : JSON.stringify(result)]);
}

export async function fail(jobId: string, workerId: string, err: unknown, retryable = true): Promise<void> {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  await q(`select jobs_fail($1,$2,$3,$4)`, [jobId, workerId, message.slice(0, 2000), retryable]);
}

export async function reapStale(staleSeconds = 120): Promise<number> {
  const row = await one<{ n: number }>(`select jobs_reap_stale($1) as n`, [staleSeconds]);
  return Number(row.n ?? 0);
}

/** Errors that should go straight to dead-letter instead of retrying. */
export class NonRetryableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "NonRetryableError";
  }
}

export type JobHandler = (job: JobRow, ctx: { heartbeat: () => Promise<void>; signal: AbortSignal }) => Promise<unknown>;

export interface WorkerOptions {
  workerId: string;
  handlers: Partial<Record<JobKind, JobHandler>>;
  pollMs?: number;
  heartbeatMs?: number;
  concurrency?: number;
}

/**
 * Runs until the returned stop() is called. Each claimed job gets a heartbeat timer and an
 * AbortSignal that fires on shutdown so long-running handlers can bail out cleanly.
 */
export function startWorker(opts: WorkerOptions): { stop: () => Promise<void> } {
  const pollMs = opts.pollMs ?? 1000;
  const heartbeatMs = opts.heartbeatMs ?? 15_000;
  const concurrency = opts.concurrency ?? 2;
  const kinds = Object.keys(opts.handlers) as JobKind[];
  const log = logger.child({ worker: opts.workerId });
  const controller = new AbortController();
  let inFlight = 0;
  let stopped = false;
  let loopDone: (() => void) | null = null;

  async function runOne(job: JobRow) {
    inFlight++;
    const handler = opts.handlers[job.kind];
    const jl = log.child({ jobId: job.id, kind: job.kind, attempt: job.attempts });
    const hb = setInterval(() => {
      heartbeat(job.id, opts.workerId).catch((e) => jl.warn({ err: e }, "heartbeat failed"));
    }, heartbeatMs);
    const started = Date.now();
    try {
      if (!handler) throw new NonRetryableError(`no handler for ${job.kind}`);
      const result = await handler(job, { heartbeat: () => heartbeat(job.id, opts.workerId), signal: controller.signal });
      await complete(job.id, opts.workerId, result);
      jl.info({ ms: Date.now() - started }, "job succeeded");
    } catch (err) {
      const retryable = !(err instanceof NonRetryableError);
      jl.error({ err, retryable, ms: Date.now() - started }, "job failed");
      await fail(job.id, opts.workerId, err, retryable).catch((e) => jl.error({ err: e }, "could not record failure"));
    } finally {
      clearInterval(hb);
      inFlight--;
    }
  }

  async function loop() {
    let lastReap = 0;
    while (!stopped) {
      try {
        if (Date.now() - lastReap > 60_000) {
          const n = await reapStale();
          if (n > 0) log.warn({ n }, "requeued stale jobs");
          lastReap = Date.now();
        }
        const free = concurrency - inFlight;
        if (free > 0) {
          const jobs = await claim(opts.workerId, kinds, free);
          for (const job of jobs) void runOne(job);
          if (jobs.length > 0) continue;
        }
      } catch (err) {
        log.error({ err }, "worker loop error");
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
    while (inFlight > 0) await new Promise((r) => setTimeout(r, 100));
    loopDone?.();
  }

  const done = new Promise<void>((resolve) => (loopDone = resolve));
  void loop();
  log.info({ kinds, concurrency }, "worker started");

  return {
    stop: async () => {
      stopped = true;
      controller.abort();
      await done;
      log.info("worker stopped");
    },
  };
}
