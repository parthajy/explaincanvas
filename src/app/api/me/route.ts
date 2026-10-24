import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/chat/api";
import { getPlanForAccount } from "@/lib/billing/subscription";
import { creditBalance } from "@/lib/credits/ledger";
import { students } from "@/lib/repo";
import { isAdminEmail } from "@/lib/admin";

/** GET /api/me — who am I, what plan, how many credits, which students. */
export const GET = handle(async () => {
  const user = await requireUser();
  const [{ plan, subscription }, balance, kids] = await Promise.all([getPlanForAccount(user.id), creditBalance(user.id), students.list(user.id)]);
  return NextResponse.json({
    id: user.id,
    email: user.email,
    plan: { code: plan.code, name: plan.name, periodEnd: subscription?.period_end ?? null },
    balance,
    isAdmin: isAdminEmail(user.email),
    students: kids.map(({ id, name, class_level }) => ({ id, name, class_level })),
  });
});
