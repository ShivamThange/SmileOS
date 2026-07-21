import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env, corsOrigins } from "./config/env";
import { requestId } from "./middleware/request-id";
import { globalLimiter } from "./middleware/rate-limit";
import { errorHandler } from "./middleware/error-handler";
import { notFound } from "./middleware/not-found";
import { logger } from "./config/logger";
import { healthRouter } from "./modules/health/health.routes";
import { apiRouter } from "./routes";

/*
 * Express application assembly (spec 3.3 — middleware order). The chain is:
 * request id → logger → CORS → helmet → body parse → rate limit → routes
 * (which internally authenticate → resolve tenant → authorise → validate) →
 * 404 → error handler.
 */
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(requestId);

  // Access log (structured; patient identifiers must never be placed in URLs).
  app.use((req, res, next) => {
    res.on("finish", () => {
      logger.info("request", {
        reqId: req.id, method: req.method, path: req.path,
        status: res.statusCode, ms: req.startedAt ? Date.now() - req.startedAt : undefined,
      });
    });
    next();
  });

  app.use(cors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true }));
  app.use(helmet());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  // Health is unauthenticated and unlimited.
  app.use("/", healthRouter);

  // Everything under the API prefix is rate-limited and versioned.
  app.use(env.API_PREFIX, globalLimiter, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
