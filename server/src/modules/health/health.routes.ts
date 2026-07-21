import { Router } from "express";
import { ok } from "../../shared/envelope";
import { isDbConnected } from "../../config/db";
import { isRedisReady } from "../../config/redis";
import { env } from "../../config/env";

/*
 * Health endpoints (spec Part 7). `/healthz` is a liveness probe; `/readyz`
 * reports dependency connectivity so orchestration and the team can see when the
 * server is running degraded (no DB / no Redis).
 */
export const healthRouter = Router();

healthRouter.get("/healthz", (_req, res) => ok(res, { status: "ok", uptime: process.uptime() }));

healthRouter.get("/readyz", (_req, res) => {
  const db = isDbConnected();
  const redis = isRedisReady();
  ok(res, {
    status: db ? "ready" : "degraded",
    env: env.NODE_ENV,
    dependencies: { mongo: db ? "up" : "down", redis: redis ? "up" : "down" },
  });
});
