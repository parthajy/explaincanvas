import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * One pool per process. Managed Postgres on DigitalOcean requires TLS; pass the cluster CA
 * through DATABASE_CA_CERT so certificates are verified, or set DATABASE_SSL=no-verify only
 * for a throwaway environment.
 */
let pool: Pool | null = null;

export function db(): Pool {
  if (pool) return pool;
  const e = env();
  const url = e.DATABASE_URL;
  const needsSsl = /sslmode=require/.test(url) || e.DATABASE_SSL === "require" || e.DATABASE_SSL === "no-verify";
  pool = new Pool({
    connectionString: url.replace(/[?&]sslmode=[^&]+/, ""),
    max: e.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 30_000,
    ...(needsSsl
      ? { ssl: e.DATABASE_CA_CERT ? { ca: e.DATABASE_CA_CERT, rejectUnauthorized: true } : { rejectUnauthorized: e.DATABASE_SSL !== "no-verify" } }
      : {}),
  });
  pool.on("error", (err) => logger.error({ err }, "idle postgres client error"));
  return pool;
}

export type Queryable = Pool | PoolClient;

export async function q<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = [], client: Queryable = db()): Promise<T[]> {
  const res = await client.query<T>(text, params);
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = [], client: Queryable = db()): Promise<T> {
  const rows = await q<T>(text, params, client);
  if (rows.length === 0) throw new Error(`expected one row, got none: ${text.slice(0, 80)}`);
  return rows[0];
}

export async function maybe<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = [], client: Queryable = db()): Promise<T | null> {
  const rows = await q<T>(text, params, client);
  return rows[0] ?? null;
}

/** Run fn inside a transaction. Rolls back on throw. */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
