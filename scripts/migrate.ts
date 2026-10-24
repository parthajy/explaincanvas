/**
 * Applies db/migrations/*.sql in filename order, once each, inside a transaction.
 *   pnpm migrate            # apply pending
 *   pnpm migrate --status   # list
 * Safe to run on every deploy (App Platform pre-deploy job) and on every worker boot.
 */
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const dir = path.resolve(process.cwd(), "db/migrations");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const ssl =
  process.env.DATABASE_SSL === "no-verify"
    ? { rejectUnauthorized: false }
    : process.env.DATABASE_CA_CERT
      ? { ca: process.env.DATABASE_CA_CERT, rejectUnauthorized: true }
      : /sslmode=require/.test(url)
        ? { rejectUnauthorized: false }
        : undefined;

const pool = new Pool({ connectionString: url.replace(/[?&]sslmode=[^&]+/, ""), ...(ssl ? { ssl } : {}) });

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
    // Serialise concurrent runners (web pre-deploy and worker boot can race).
    await client.query(`select pg_advisory_lock(hashtext('schema_migrations'))`);
    const applied = new Set((await client.query<{ name: string }>(`select name from schema_migrations`)).rows.map((r) => r.name));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    if (process.argv.includes("--status")) {
      for (const f of files) console.log(`${applied.has(f) ? "applied " : "pending "} ${f}`);
      return;
    }
    let n = 0;
    for (const f of files) {
      if (applied.has(f)) continue;
      const sql = fs.readFileSync(path.join(dir, f), "utf8");
      process.stdout.write(`applying ${f} ... `);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(`insert into schema_migrations(name) values ($1)`, [f]);
        await client.query("commit");
        console.log("ok");
        n++;
      } catch (err) {
        await client.query("rollback");
        console.log("FAILED");
        throw err;
      }
    }
    console.log(n === 0 ? "nothing to apply" : `applied ${n} migration(s)`);
  } finally {
    await client.query(`select pg_advisory_unlock(hashtext('schema_migrations'))`).catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
