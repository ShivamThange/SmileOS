import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { UserRole, Action, Resource } from "./enums";
import type { TokenAudience } from "../config/constants";

/*
 * HTTP shared types + helpers. The authenticated principal and resolved tenant
 * are attached to the request by middleware; every downstream layer reads them
 * from here rather than re-deriving.
 */

export interface AuthPrincipal {
  userId: string;
  clinicId: string;
  role: UserRole | "patient";
  audience: TokenAudience;
  sessionId: string;
  permissions: Set<`${Resource}:${Action}`>;
  /** For portal tokens: the patient this principal *is* (ownership is derived, never from the path). */
  patientId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      auth?: AuthPrincipal;
      clinicId?: string;
      startedAt?: number;
    }
  }
}

/** Wrap an async handler so thrown errors reach the error middleware. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

