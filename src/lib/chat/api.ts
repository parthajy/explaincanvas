import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/** Shared helpers for route handlers: auth, validation, uniform error shape. */

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, message?: string) {
    super(message ?? code);
    this.name = "HttpError";
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "unauthenticated");
  return user;
}

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new HttpError(400, "invalid_body", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return parsed.data;
}

export function handle(fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> => {
    const requestId = crypto.randomUUID();
    try {
      const res = await fn(req, ctx);
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.code, message: err.message, requestId }, { status: err.status, headers: { "x-request-id": requestId } });
      }
      logger.error({ err, requestId, url: req.url }, "unhandled route error");
      return NextResponse.json({ error: "internal", requestId }, { status: 500, headers: { "x-request-id": requestId } });
    }
  };
}

/** Throws 429 when a subject exceeds `limit` calls per `windowMs` in the given scope. */
export function enforceRateLimit(scope: string, subject: string, limit: number, windowMs: number) {
  const r = rateLimit(`${scope}:${subject}`, limit, windowMs);
  if (!r.ok) throw new HttpError(429, "rate_limited", `Too many requests. Try again in ${r.retryAfterSeconds} seconds.`);
}

export { clientIp };
