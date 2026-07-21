import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { connectDb, disconnectDb } from "./config/db";
import { getRedis, disconnectRedis } from "./config/redis";

/*
 * Entry point. Best-effort connects to Mongo and Redis (degraded mode if
 * unavailable), starts the HTTP server, and wires graceful shutdown.
 */
async function main(): Promise<void> {
  await connectDb();
  getRedis(); // initialise the shared client (queues + rate limiting)

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`DentalOS API listening on :${env.PORT}${env.API_PREFIX}`, { env: env.NODE_ENV });
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down`);
    server.close(async () => {
      await disconnectRedis();
      await disconnectDb();
      process.exit(0);
    });
    // Failsafe hard-exit.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => logger.error("Unhandled rejection", { reason: String(reason) }));
}

void main();
