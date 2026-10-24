import { q } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * A hard monthly ceiling on provider spend. Every model call, narration, image and video clip is
 * recorded in usage_events with its cost, so month-to-date spend is one query. Above FREE_PAUSE_AT of
 * the budget, free accounts lose fresh generations (library stays open). Above HARD_PAUSE_AT, everyone
 * does. Paid plans keep going in between because they earn more than they cost.
 * The number is cached for a minute; a minute of overshoot at our volumes is a few rupees.
 */

export interface BudgetState {
  budgetPaise: number;
  spentPaise: number;
  fraction: number;
  freePaused: boolean;
  allPaused: boolean;
  /** Linear projection to month end from the days elapsed. */
  projectedPaise: number;
  monthStartIso: string;
}

let cache: { at: number; state: BudgetState } | null = null;

export async function budgetState(force = false): Promise<BudgetState> {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.state;
  const e = env();
  const budgetPaise = Math.round(e.MONTHLY_BUDGET_INR * 100);
  const row = (await q<{ spent: string; month_start: string; day_frac: string }>(
    `with m as (select date_trunc('month', now() at time zone 'Asia/Kolkata') as start)
     select coalesce((select sum(cost_paise) from usage_events u, m where u.created_at >= (m.start at time zone 'Asia/Kolkata')), 0)::text spent,
            (select start from m)::text month_start,
            (extract(epoch from ((now() at time zone 'Asia/Kolkata') - (select start from m))) / extract(epoch from ((select start from m) + interval '1 month' - (select start from m))))::text day_frac`,
  ))[0];
  const spentPaise = Number(row?.spent ?? 0);
  const frac = Math.max(0.02, Number(row?.day_frac ?? 0.5));
  const state: BudgetState = {
    budgetPaise,
    spentPaise,
    fraction: budgetPaise > 0 ? spentPaise / budgetPaise : 0,
    freePaused: budgetPaise > 0 && spentPaise >= budgetPaise * e.BUDGET_FREE_PAUSE_AT,
    allPaused: budgetPaise > 0 && spentPaise >= budgetPaise * e.BUDGET_HARD_PAUSE_AT,
    projectedPaise: Math.round(spentPaise / frac),
    monthStartIso: row?.month_start ?? "",
  };
  cache = { at: Date.now(), state };
  if (state.allPaused) logger.warn({ spentPaise, budgetPaise }, "monthly budget exhausted: fresh generations paused");
  return state;
}

/** Records a non-model provider cost (narration, image, video) so it counts against the budget. */
export async function recordAssetCost(input: { accountId: string; explanationId: string; stage: "tts" | "image" | "video"; provider: string; units: number; costPaise: number; latencyMs?: number }): Promise<void> {
  try {
    await q(
      `insert into usage_events(account_id, explanation_id, stage, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_paise, latency_ms)
       values ($1,$2,$3,$4,$5,0,0,0,$6,$7)`,
      [input.accountId, input.explanationId, input.stage, input.provider, Math.round(input.units), Math.max(0, Math.round(input.costPaise)), input.latencyMs ?? 0],
    );
  } catch (err) {
    logger.warn({ err }, "asset cost insert failed");
  }
}

/** Unit prices for non-model providers, in paise. Conservative; override by env when invoices say otherwise. */
export function assetPrices() {
  const e = env();
  return {
    ttsPer1kChars: e.COST_TTS_PAISE_PER_1K_CHARS,
    image: e.COST_IMAGE_PAISE,
    videoPerSecond: e.COST_VIDEO_PAISE_PER_SECOND,
  };
}
