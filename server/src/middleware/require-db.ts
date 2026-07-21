import type { Request, Response, NextFunction } from "express";
import { isDbConnected } from "../config/db";
import { errors } from "../shared/errors";

/*
 * Guards data endpoints so that, in degraded (no-DB) mode, they return a clear
 * 503 instead of hanging on a connection that will never resolve.
 */
export function requireDb(_req: Request, _res: Response, next: NextFunction): void {
  if (!isDbConnected()) return next(errors.dbUnavailable());
  next();
}
