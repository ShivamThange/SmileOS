import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

/*
 * Request id + timing (spec Part 7). Threads a correlation id through every
 * layer and echoes it in the response header for support/debugging.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.id = (req.headers["x-request-id"] as string) || randomUUID();
  req.startedAt = Date.now();
  res.setHeader("x-request-id", req.id);
  next();
}
