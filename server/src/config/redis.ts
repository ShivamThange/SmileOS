import IORedis, { type Redis } from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

/*
 * Redis connection (spec Part 6). Used for the job queues and rate limiting.
 * Like the database, it is optional at boot: without it, queues fall back to a
 * synchronous/no-op mode and rate limiting falls back to an in-memory store.
 */

let client: Redis | null = null;
let ready = false;

export function getRedis(): Redis | null {
  if (client) return client;
  try {
    client = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
    });
    client.on("ready", () => { ready = true; logger.info("Redis connected"); });
    client.on("error", (err) => { ready = false; logger.debug("Redis error", { error: err.message }); });
    client.on("end", () => { ready = false; });
  } catch (err) {
    logger.warn("Redis unavailable — queues and rate limiting run in degraded mode", { error: (err as Error).message });
    client = null;
  }
  return client;
}

export function isRedisReady(): boolean {
  return ready && client?.status === "ready";
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
    ready = false;
  }
}
