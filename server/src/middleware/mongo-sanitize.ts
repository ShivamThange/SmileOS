import type { Request, Response, NextFunction } from "express";

/*
 * NoSQL-operator sanitisation (spec 3.3). Defence in depth behind the per-route
 * Zod schemas: strips any key starting with `$` (query operators) or containing
 * `.` (dotted-path writes) from request input, so a crafted body like
 * `{ "email": { "$gt": "" } }` can never reach a Mongo query — even on a route
 * whose schema is loose. Values are left untouched; only dangerous keys go.
 */

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 12 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith("$") || key.includes(".")) continue;
    out[key] = scrub(val, depth + 1);
  }
  return out;
}

export function mongoSanitize(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") req.body = scrub(req.body);
  // req.query / req.params are replaced key-by-key (the objects themselves are
  // read-only getters on some Express versions, so mutate in place).
  for (const container of [req.query, req.params] as Record<string, unknown>[]) {
    if (!container || typeof container !== "object") continue;
    for (const key of Object.keys(container)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete container[key];
      } else {
        container[key] = scrub(container[key], 1);
      }
    }
  }
  next();
}
