import { randomBytes } from "node:crypto";
import { z } from "zod";
import { env, googleConfigured } from "@/lib/env";

/**
 * Google OAuth 2.0 authorization-code flow, implemented directly: one redirect out, one code
 * exchange, one id_token verification through Google's tokeninfo endpoint. No SDK.
 *
 * Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (Web application client in Google Cloud Console)
 * with the redirect URI `${APP_URL}/auth/google/callback`.
 */

export const GOOGLE_STATE_COOKIE = "vz_gstate";

export function redirectUri(): string {
  return `${env().APP_URL}/auth/google/callback`;
}

/** Random state binds the callback to the browser that started the flow. */
export function newState(): string {
  return randomBytes(24).toString("base64url");
}

export function buildAuthUrl(state: string): string {
  const e = env();
  const params = new URLSearchParams({
    client_id: e.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

const TokenResponse = z.object({ id_token: z.string().min(10) });

const TokenInfo = z.object({
  aud: z.string(),
  sub: z.string(),
  email: z.string().email(),
  email_verified: z.union([z.literal("true"), z.literal(true)]).optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
  exp: z.string().optional(),
});

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

/** Exchange the code, then verify the id_token with Google and check it was issued for us. */
export async function exchangeCode(code: string): Promise<GoogleIdentity> {
  const e = env();
  if (!googleConfigured()) throw new GoogleAuthError("google not configured");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: e.GOOGLE_CLIENT_ID!, client_secret: e.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri(), grant_type: "authorization_code" }),
  });
  if (!tokenRes.ok) throw new GoogleAuthError(`token exchange failed: ${tokenRes.status}`);
  const token = TokenResponse.safeParse(await tokenRes.json());
  if (!token.success) throw new GoogleAuthError("token response missing id_token");

  const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.data.id_token)}`);
  if (!infoRes.ok) throw new GoogleAuthError(`tokeninfo failed: ${infoRes.status}`);
  const info = TokenInfo.safeParse(await infoRes.json());
  if (!info.success) throw new GoogleAuthError("tokeninfo malformed");
  if (info.data.aud !== e.GOOGLE_CLIENT_ID) throw new GoogleAuthError("id_token audience mismatch");
  if (!(info.data.email_verified === "true" || info.data.email_verified === true)) throw new GoogleAuthError("google email not verified");
  if (info.data.exp && Number(info.data.exp) * 1000 < Date.now()) throw new GoogleAuthError("id_token expired");

  return { sub: info.data.sub, email: info.data.email, name: info.data.name ?? null, picture: info.data.picture ?? null };
}
