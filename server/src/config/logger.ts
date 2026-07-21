import { isProd } from "./env";

/*
 * Minimal structured logger (spec Part 7 — Observability). Emits JSON in
 * production with a request id threaded through, human-readable lines in dev.
 * Patient identifiers must be redacted by callers before logging.
 */

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = isProd ? ORDER.info : ORDER.debug;

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (ORDER[level] < threshold) return;
  const rec = { ts: new Date().toISOString(), level, msg, ...meta };
  const line = isProd ? JSON.stringify(rec) : `${rec.ts} ${level.toUpperCase().padEnd(5)} ${msg}${meta ? " " + JSON.stringify(meta) : ""}`;
  // eslint-disable-next-line no-console
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
  /** Child logger that stamps a request id onto every line. */
  child: (bindings: Record<string, unknown>) => ({
    debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, { ...bindings, ...meta }),
    info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, { ...bindings, ...meta }),
    warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, { ...bindings, ...meta }),
    error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, { ...bindings, ...meta }),
  }),
};
