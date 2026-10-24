import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const started = Date.now();
  try {
    await q("select 1");
    return NextResponse.json({ ok: true, db: "up", ms: Date.now() - started });
  } catch (err) {
    return NextResponse.json({ ok: false, db: err instanceof Error ? err.message : "down", ms: Date.now() - started }, { status: 503 });
  }
}
