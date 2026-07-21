import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { AppError, ERROR_CODES } from "../shared/errors";
import { fail } from "../shared/envelope";
import { logger } from "../config/logger";
import { isProd } from "../config/env";

/*
 * Central error handler (spec Part 1 / 3.3 — last in the chain). Translates any
 * thrown error into the standard failure envelope with a machine-readable code.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): Response {
  // Zod validation → field map
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) fields[issue.path.join(".") || "_"] = issue.message;
    return fail(res, 422, { code: ERROR_CODES.VALIDATION_FAILED, message: "Validation failed", fields });
  }

  // Known application errors
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error(err.message, { code: err.code, reqId: req.id });
    return fail(res, err.status, { code: err.code, message: err.message, fields: err.fields, meta: err.meta });
  }

  // Mongo duplicate key
  if (err instanceof mongoose.mongo.MongoServerError && (err as { code?: number }).code === 11000) {
    return fail(res, 409, { code: ERROR_CODES.CONFLICT_DUPLICATE, message: "A record with those details already exists" });
  }

  // Mongoose validation
  if (err instanceof mongoose.Error.ValidationError) {
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(err.errors)) fields[k] = v.message;
    return fail(res, 422, { code: ERROR_CODES.VALIDATION_FAILED, message: "Validation failed", fields });
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error("Unhandled error", { message, reqId: req.id, stack: err instanceof Error ? err.stack : undefined });
  return fail(res, 500, { code: ERROR_CODES.INTERNAL, message: isProd ? "Something went wrong" : message });
}
