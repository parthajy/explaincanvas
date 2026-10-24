import { q, one } from "@/lib/db";

/**
 * Thin, typed wrapper over the Postgres credit functions.
 * All arithmetic and locking lives in the database so that the API route, the worker and
 * any future admin tool cannot disagree about a balance.
 */

export class InsufficientCreditsError extends Error {
  constructor(public readonly needed: number, public readonly available: number | null = null) {
    super(`insufficient credits: need ${needed}`);
    this.name = "InsufficientCreditsError";
  }
}

function isInsufficient(err: unknown): boolean {
  return ((err as { message?: string })?.message ?? "").includes("insufficient_credits");
}

export async function creditBalance(accountId: string): Promise<number> {
  const row = await one<{ b: number }>(`select credits_balance($1) as b`, [accountId]);
  return Number(row.b ?? 0);
}

export interface GrantInput {
  accountId: string;
  amount: number;
  bucket: "plan" | "topup" | "streak" | "free" | "promo";
  refType: string;
  refId: string;
  /** Idempotency key. The same key never grants twice. */
  key: string;
  expiresAt?: Date | null;
  note?: string;
  type?: "grant" | "topup" | "refund" | "adjust";
}

export async function grantCredits(input: GrantInput): Promise<number> {
  const row = await one<{ id: string }>(`select credits_grant($1,$2,$3,$4,$5,$6,$7,$8,$9::ledger_entry_type) as id`, [
    input.accountId,
    input.amount,
    input.bucket,
    input.refType,
    input.refId,
    input.key,
    input.expiresAt ?? null,
    input.note ?? null,
    input.type ?? "grant",
  ]);
  return Number(row.id);
}

export interface ReserveInput {
  accountId: string;
  amount: number;
  refType: "explanation" | "followup";
  refId: string;
  key: string;
  /** Restrict which buckets may fund this reservation (free tier rules). null = any. */
  buckets?: string[] | null;
}

export async function reserveCredits(input: ReserveInput): Promise<number> {
  try {
    const row = await one<{ id: string }>(`select credits_reserve($1,$2,$3,$4,$5,$6) as id`, [
      input.accountId,
      input.amount,
      input.refType,
      input.refId,
      input.key,
      input.buckets ?? null,
    ]);
    return Number(row.id);
  } catch (err) {
    if (isInsufficient(err)) {
      const available = await creditBalance(input.accountId).catch(() => null);
      throw new InsufficientCreditsError(input.amount, available);
    }
    throw err;
  }
}

export async function settleCredits(input: { accountId: string; refType: string; refId: string; finalAmount: number; key: string }): Promise<void> {
  try {
    await q(`select credits_settle($1,$2,$3,$4,$5)`, [input.accountId, input.refType, input.refId, input.finalAmount, input.key]);
  } catch (err) {
    if (isInsufficient(err)) throw new InsufficientCreditsError(input.finalAmount);
    throw err;
  }
}

export async function releaseCredits(input: { accountId: string; refType: string; refId: string; amount: number; key: string }): Promise<void> {
  await q(`select credits_release($1,$2,$3,$4,$5)`, [input.accountId, input.refType, input.refId, input.amount, input.key]);
}

export async function expireDueCredits(): Promise<number> {
  const row = await one<{ n: number }>(`select credits_expire_due() as n`);
  return Number(row.n ?? 0);
}

export interface LedgerRow {
  id: string;
  entry_type: string;
  amount: number;
  bucket: string;
  note: string | null;
  created_at: string;
}

export async function recentLedger(accountId: string, limit = 20): Promise<LedgerRow[]> {
  return q<LedgerRow>(`select id::text, entry_type, amount, bucket, note, created_at from credit_ledger where account_id = $1 order by created_at desc, id desc limit $2`, [accountId, limit]);
}
