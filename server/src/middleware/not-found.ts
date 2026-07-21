import type { Request, Response } from "express";
import { fail } from "../shared/envelope";
import { ERROR_CODES } from "../shared/errors";

/** Terminal 404 for unmatched routes, in the standard envelope. */
export function notFound(req: Request, res: Response): Response {
  return fail(res, 404, { code: ERROR_CODES.NOT_FOUND, message: `No route for ${req.method} ${req.path}` });
}
