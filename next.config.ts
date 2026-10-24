import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The product is per-user and dynamic end to end; the classic rendering model keeps
  // route handlers and server components request-time by default.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["pino", "pino-pretty"],
};

export default nextConfig;
