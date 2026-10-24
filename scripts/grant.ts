/**
 * Dev helper: grant promo credits (spendable on any plan, including Free) to an account by email.
 *   pnpm grant parent@example.com 500
 */
import { Pool } from "pg";

const [email, amountArg] = process.argv.slice(2);
if (!email || !amountArg) {
  console.error("usage: pnpm grant <email> <credits>");
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL!.replace(/[?&]sslmode=[^&]+/, "") });

async function main() {
  const { rows: [u] } = await pool.query<{ id: string }>(`select id from users where lower(email) = lower($1)`, [email]);
  if (!u) throw new Error(`no account with email ${email}`);
  await pool.query(`select credits_grant($1, $2, 'promo', 'manual', 'dev-grant', $3, now() + interval '60 days', 'dev grant', 'grant')`, [u.id, Number(amountArg), `dev-grant:${u.id}:${Date.now()}`]);
  const { rows: [b] } = await pool.query(`select credits_balance($1) as b`, [u.id]);
  console.log(`granted ${amountArg} to ${email}; balance now ${b.b}`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
