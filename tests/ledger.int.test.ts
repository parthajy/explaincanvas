import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";

/**
 * Integration tests against the local Postgres (docker compose). Skipped when DATABASE_URL is unset.
 * They exercise the SQL functions directly: reserve / settle / release / expire and the job queue.
 */
const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("credit ledger (Postgres)", () => {
  let pool: Pool;
  let account: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url!.replace(/[?&]sslmode=[^&]+/, "") });
    const { rows: [u] } = await pool.query<{ id: string }>(`insert into users(email) values ($1) returning id`, [`ledger-${Date.now()}@test.local`]);
    account = u.id;
    await pool.query(`select credits_grant($1, 8, 'free', 'signup', $2, $3)`, [account, account, `free-signup:${account}`]);
  });
  afterAll(async () => pool.end());

  const balance = async () => Number((await pool.query(`select credits_balance($1) as b`, [account])).rows[0].b);
  const call = (sql: string, params: unknown[]) => pool.query(sql, params);

  it("new accounts start with the free diagram grant", async () => {
    expect(await balance()).toBe(8);
  });

  it("grants are idempotent on key", async () => {
    await call(`select credits_grant($1, 100, 'plan', 'test', 'g1', $2)`, [account, `g1:${account}`]);
    await call(`select credits_grant($1, 100, 'plan', 'test', 'g1', $2)`, [account, `g1:${account}`]);
    expect(await balance()).toBe(108);
  });

  it("reserve then settle lower releases the difference, idempotently", async () => {
    await call(`select credits_reserve($1, 32, 'explanation', 'e1', $2)`, [account, `r:e1:${account}`]);
    expect(await balance()).toBe(76);
    await call(`select credits_settle($1, 'explanation', 'e1', 8, $2)`, [account, `s:e1:${account}`]);
    expect(await balance()).toBe(100);
    await call(`select credits_settle($1, 'explanation', 'e1', 8, $2)`, [account, `s:e1:${account}`]);
    expect(await balance()).toBe(100);
  });

  it("release restores a full reservation and refuses to over-release", async () => {
    await call(`select credits_reserve($1, 24, 'explanation', 'e2', $2)`, [account, `r:e2:${account}`]);
    expect(await balance()).toBe(76);
    await call(`select credits_release($1, 'explanation', 'e2', 24, $2)`, [account, `rel:e2:${account}`]);
    expect(await balance()).toBe(100);
    await expect(call(`select credits_release($1, 'explanation', 'e2', 1, $2)`, [account, `rel2:e2:${account}`])).rejects.toThrow(/exceeds/);
  });

  it("bucket restriction keeps free users off plan credits", async () => {
    await expect(call(`select credits_reserve($1, 50, 'explanation', 'e3', $2, array['free'])`, [account, `r:e3:${account}`])).rejects.toThrow(/insufficient_credits/);
    expect(await balance()).toBe(100);
  });

  it("insufficient balance is rejected and leaves the ledger untouched", async () => {
    await expect(call(`select credits_reserve($1, 1000, 'explanation', 'e4', $2)`, [account, `r:e4:${account}`])).rejects.toThrow(/insufficient_credits/);
    expect(await balance()).toBe(100);
  });

  it("consumes the earliest-expiring grant first and expires leftovers", async () => {
    const soon = new Date(Date.now() + 60_000);
    await call(`select credits_grant($1, 10, 'plan', 'test', 'soon', $2, $3)`, [account, `soon:${account}`, soon]);
    expect(await balance()).toBe(110);
    await call(`select credits_reserve($1, 6, 'explanation', 'e5', $2)`, [account, `r:e5:${account}`]);
    const { rows } = await pool.query(`select remaining from credit_grants_v where account_id = $1 and bucket = 'plan' and expires_at is not null order by expires_at limit 1`, [account]);
    expect(Number(rows[0].remaining)).toBe(4); // drawn from the soon-expiring grant
    await call(`update credit_ledger set expires_at = now() - interval '1 second' where idempotency_key = $1`, [`soon:${account}`]);
    expect(await balance()).toBe(100); // expired grant no longer counts
    const n = (await pool.query(`select credits_expire_due() as n`)).rows[0].n;
    expect(Number(n)).toBeGreaterThanOrEqual(1);
    expect(await balance()).toBe(100);
  });
});

d("job queue (Postgres)", () => {
  let pool: Pool;
  beforeAll(() => {
    pool = new Pool({ connectionString: url!.replace(/[?&]sslmode=[^&]+/, "") });
  });
  afterAll(async () => pool.end());

  it("enqueue is idempotent, claim is exclusive, fail backs off then dead-letters", async () => {
    const key = `test:${Date.now()}`;
    const id1 = (await pool.query(`select jobs_enqueue('render.heavy', '{"a":1}'::jsonb, $1, 0::smallint, now(), 2) as id`, [key])).rows[0].id;
    const id2 = (await pool.query(`select jobs_enqueue('render.heavy', '{"a":1}'::jsonb, $1, 0::smallint, now(), 2) as id`, [key])).rows[0].id;
    expect(id1).toBe(id2);

    const a = (await pool.query(`select id from jobs_claim('A', array['render.heavy'], 50)`)).rows.map((r) => r.id);
    expect(a).toContain(id1);
    const b = (await pool.query(`select id from jobs_claim('B', array['render.heavy'], 50)`)).rows.map((r) => r.id);
    expect(b).not.toContain(id1);

    await pool.query(`select jobs_fail($1, 'A', 'boom', true)`, [id1]);
    let row = (await pool.query(`select status, attempts, run_after from jobs where id = $1`, [id1])).rows[0];
    expect(row.status).toBe("queued");
    expect(new Date(row.run_after).getTime()).toBeGreaterThan(Date.now());

    await pool.query(`update jobs set run_after = now() - interval '1 second' where id = $1`, [id1]);
    const again = await pool.query(`select id from jobs_claim_one($1, 'A')`, [id1]);
    expect(again.rows.length).toBe(1);
    await pool.query(`select jobs_fail($1, 'A', 'boom2', true)`, [id1]);
    row = (await pool.query(`select status, attempts from jobs where id = $1`, [id1])).rows[0];
    expect(row.status).toBe("dead");
    expect(row.attempts).toBe(2);
  });

  it("reaps stale running jobs", async () => {
    const id = (await pool.query(`select jobs_enqueue('render.heavy', '{}'::jsonb, $1) as id`, [`stale:${Date.now()}`])).rows[0].id;
    await pool.query(`select jobs_claim_one($1, 'Z')`, [id]);
    await pool.query(`update jobs set heartbeat_at = now() - interval '10 minutes' where id = $1`, [id]);
    const n = (await pool.query(`select jobs_reap_stale(120) as n`)).rows[0].n;
    expect(Number(n)).toBeGreaterThanOrEqual(1);
    expect((await pool.query(`select status from jobs where id = $1`, [id])).rows[0].status).toBe("queued");
  });
});
