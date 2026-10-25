import { cookies } from "next/headers";

/**
 * "App mode": the site opened inside the Android wrapper. The wrapper launches /?source=app, the proxy sets
 * a long-lived cookie, and pages hide anything that sells digital goods, because Google Play requires its own
 * billing for purchases made inside an app. Credits are bought on the website and simply used in the app.
 */
export const APP_COOKIE = "ec_app";

export async function isAppMode(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(APP_COOKIE)?.value === "1";
}
