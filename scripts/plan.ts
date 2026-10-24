/**
 * Dev/admin helper: put an account on a plan without a payment (manual provider).
 *   pnpm plan parent@example.com pro          # student | pro | max | max_annual
 * Creates the subscription and grants the first month of credits.
 */
import { PLANS, PlanCode } from "@/lib/billing/plans";
import { grantCycle } from "@/lib/billing/fulfil";
import { subscriptions, users } from "@/lib/repo";
import { closeDb } from "@/lib/db";

const [email, planArg] = process.argv.slice(2);
const code = PlanCode.safeParse(planArg);
if (!email || !code.success || code.data === "free") {
  console.error("usage: pnpm plan <email> <student|pro|max|max_annual>");
  process.exit(1);
}
const planCode: PlanCode = code.data;

async function main() {
  const user = await users.byEmail(email);
  if (!user) throw new Error(`no account with email ${email}`);
  const plan = PLANS[planCode];
  const now = new Date();
  const end = new Date(now);
  if (plan.interval === "year") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  const existing = await subscriptions.active(user.id);
  if (existing) await subscriptions.expire(existing.id);
  const sub = await subscriptions.create({ accountId: user.id, planCode: plan.code, periodStart: now, periodEnd: end, provider: "manual", providerRef: `manual:${Date.now()}` });
  await grantCycle(sub, plan, now);
  console.log(`${email} is now on ${plan.name} until ${end.toISOString().slice(0, 10)} with ${plan.creditsPerMonth} credits granted`);
  await closeDb();
}

main().catch(async (e) => {
  console.error(e.message ?? e);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
