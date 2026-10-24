import pino from "pino";

/**
 * JSON logs by default (what App Platform and any log drain want). Pretty printing only when
 * PINO_PRETTY=1, which the worker script sets for local development. Inside the Next.js bundle
 * the pretty transport cannot be resolved, so it must never be enabled there.
 */
const level = process.env.LOG_LEVEL ?? "info";
const base = { service: "explaincanvas" };
const redact = {
  paths: ["*.apiKey", "*.authorization", "req.headers.authorization", "*.email"],
  censor: "[redacted]",
};

function build() {
  if (process.env.PINO_PRETTY === "1" && !process.env.NEXT_RUNTIME) {
    try {
      return pino({ level, base, redact, transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } });
    } catch {
      // fall through to plain JSON
    }
  }
  return pino({ level, base, redact });
}

export const logger = build();

export type Logger = typeof logger;

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
