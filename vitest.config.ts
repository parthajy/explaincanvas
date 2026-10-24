import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

/** Load .env.local (if present) so integration tests can reach the local Postgres. */
function envFromFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const integration = process.env.RUN_INT === "1";

export default defineConfig({
  test: {
    include: integration ? ["tests/**/*.int.test.ts"] : ["tests/**/*.test.ts"],
    exclude: integration ? ["node_modules"] : ["node_modules", "tests/**/*.int.test.ts"],
    environment: "node",
    env: envFromFile(path.resolve(__dirname, ".env.local")),
    testTimeout: 30_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
