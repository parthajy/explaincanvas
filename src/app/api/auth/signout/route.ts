import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(): Promise<Response> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (id) await destroySession(id).catch(() => undefined);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
