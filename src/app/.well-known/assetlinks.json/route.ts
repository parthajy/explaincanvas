import { NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * Digital Asset Links: tells Android that the ExplainCanvas app may open explaincanvas.com without
 * the browser bar (Trusted Web Activity). Fingerprints come from the signing key in ANDROID_SHA256_FINGERPRINTS;
 * both the upload key and Google Play's app-signing key belong here once the app is enrolled in Play App Signing.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const e = env();
  const fingerprints = e.ANDROID_SHA256_FINGERPRINTS;
  const body = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: { namespace: "android_app", package_name: e.ANDROID_PACKAGE_NAME, sha256_cert_fingerprints: fingerprints },
        },
      ]
    : [];
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600", "Content-Type": "application/json" } });
}
