import type { Request, Response, NextFunction } from "express";
import { errors } from "../shared/errors";

/*
 * Tenant resolution (spec 3.3). Attaches clinicId to the request from the
 * authenticated principal. The repository layer injects it into every query, so
 * no service method ever accepts a filter that could omit clinic scoping — the
 * one thing preventing a cross-clinic leak the day this goes multi-tenant.
 */
export function resolveTenant(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth?.clinicId) return next(errors.authRequired());
  req.clinicId = req.auth.clinicId;
  next();
}
