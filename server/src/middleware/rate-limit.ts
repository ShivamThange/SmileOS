import type { Request, Response, NextFunction } from "express";
import { getRedis, isRedisReady } from "../config/redis";
import { fail } from "../shared/envelope";
import { ERROR_CODES } from "../shared/errors";

/*
 * Rate limiting (spec 3.1 / Part 7). Fixed-window counter in Redis when it's
 * available, with an in-memory fallback so the limiter still works (per
 * instance) in degraded mode. Keyed by IP by default; auth flows key by email.
 */

interface Options {
  windowMs: number;
  max: number;
  keyBy?: (req: Request) => string;
  bucket?: string;
}

const memory = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(opts: Options) {
  const bucket = opts.bucket ?? "rl";
  const keyBy = opts.keyBy ?? ((req: Request) => req.ip ?? "unknown");

  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    const key = `${bucket}:${keyBy(req)}`;
    const now = Date.now();
    let count: number;
    let resetAt: number;

    if (isRedisReady()) {
      const redis = getRedis()!;
      const windowKey = `${key}:${Math.floor(now / opts.windowMs)}`;
      count = await redis.incr(windowKey);
      if (count === 1) await redis.pexpire(windowKey, opts.windowMs);
      resetAt = (Math.floor(now / opts.windowMs) + 1) * opts.windowMs;
    } else {
      const entry = memory.get(key);
      if (!entry || entry.resetAt < now) {
        resetAt = now + opts.windowMs;
        memory.set(key, { count: 1, resetAt });
        count = 1;
      } else {
        entry.count += 1;
        count = entry.count;
        resetAt = entry.resetAt;
      }
    }

    res.setHeader("x-ratelimit-limit", opts.max);
    res.setHeader("x-ratelimit-remaining", Math.max(0, opts.max - count));

    if (count > opts.max) {
      res.setHeader("retry-after", Math.ceil((resetAt - now) / 1000));
      fail(res, 429, { code: ERROR_CODES.RATE_LIMIT, message: "Too many requests — please slow down" });
      return;
    }
    next();
  };
}

/** Sensible default limiter for the whole API surface. */
export const globalLimiter = rateLimit({ windowMs: 60_000, max: 300, bucket: "global" });
