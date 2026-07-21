import type { Request, Response, NextFunction } from "express";
import { errors } from "../shared/errors";
import type { Resource, Action } from "../shared/enums";
import type { Permission } from "../shared/rbac";

/*
 * Authorisation (spec 3.4). Guards a route by a required resource:action. The
 * effective permission set was computed at authentication time. Patient-portal
 * ownership is enforced separately, inside the portal controllers, never here.
 */
export function authorize(resource: Resource, action: Action) {
  const needed = `${resource}:${action}` as Permission;
  return function (req: Request, _res: Response, next: NextFunction): void {
    if (!req.auth) return next(errors.authRequired());
    if (!req.auth.permissions.has(needed)) {
      return next(errors.forbidden(`Requires permission ${needed}`));
    }
    next();
  };
}

/** Guard requiring any one of several permissions. */
export function authorizeAny(...perms: Permission[]) {
  return function (req: Request, _res: Response, next: NextFunction): void {
    if (!req.auth) return next(errors.authRequired());
    if (!perms.some((p) => req.auth!.permissions.has(p))) {
      return next(errors.forbidden(`Requires one of: ${perms.join(", ")}`));
    }
    next();
  };
}
