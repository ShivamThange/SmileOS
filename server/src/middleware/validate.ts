import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodTypeAny, type infer as ZInfer } from "zod";
import { AppError, ERROR_CODES } from "../shared/errors";

/*
 * Validation (spec 3.3 / Part 7). Schema validation runs before the controller.
 * Validated + coerced values replace the raw ones so controllers read typed,
 * trusted input. Also the first line against NoSQL operator injection: string
 * schemas reject objects, so `{ $gt: "" }` never reaches a query.
 */

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: Schemas) {
  return function (req: Request, _res: Response, next: NextFunction): void {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of err.issues) fields[issue.path.join(".") || "_"] = issue.message;
        return next(new AppError(ERROR_CODES.VALIDATION_FAILED, "Validation failed", { fields }));
      }
      next(err);
    }
  };
}

/** Helper to infer a validated body type in controllers. */
export type Infer<T extends ZodTypeAny> = ZInfer<T>;
