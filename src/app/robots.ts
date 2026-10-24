import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = env().APP_URL;
  return {
    rules: [{ userAgent: "*", allow: ["/", "/library", "/pricing", "/login", "/learn", "/how-it-works", "/for-parents", "/faq", "/legal"], disallow: ["/api/", "/c/", "/account", "/admin", "/s/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
