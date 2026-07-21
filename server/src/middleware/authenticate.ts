import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { verifyAccessToken } from "../services/token.service";
import { TOKEN_AUDIENCE, type TokenAudience } from "../config/constants";
import { AppError, ERROR_CODES, errors } from "../shared/errors";
import { effectivePermissions, type Permission } from "../shared/rbac";
import type { UserRole } from "../shared/enums";
import { UserModel } from "../models/user.model";

/*
 * Authentication (spec 3.2 / 3.3). Reads the bearer access token, verifies it
 * against the required audience, and attaches the principal (with computed
 * permission set) to the request. Staff and patient audiences are separate so a
 * patient token can never address a Console endpoint.
 */

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

export function authenticate(audience: TokenAudience = TOKEN_AUDIENCE.staff) {
  return async function (req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const token = extractToken(req);
      if (!token) throw errors.authRequired();

      let claims;
      try {
        claims = verifyAccessToken(token, audience);
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) throw new AppError(ERROR_CODES.AUTH_EXPIRED, "Session expired");
        if (err instanceof jwt.JsonWebTokenError && /audience/i.test(err.message)) throw new AppError(ERROR_CODES.AUTH_AUDIENCE, "Wrong token audience");
        throw new AppError(ERROR_CODES.AUTH_INVALID, "Invalid token");
      }

      // Patient tokens carry their permissions implicitly (own records only).
      let permissions: Set<Permission>;
      if (audience === TOKEN_AUDIENCE.patient) {
        permissions = new Set();
      } else {
        // Load override grants/denials so permission changes take effect on next request.
        const user = await UserModel.findOne({ _id: claims.sub, clinicId: claims.cid, active: true }).lean();
        if (!user) throw errors.authInvalid("Account not found or inactive");
        permissions = effectivePermissions(
          user.role as UserRole,
          (user.permissionGrants ?? []) as Permission[],
          (user.permissionDenials ?? []) as Permission[],
        );
      }

      req.auth = {
        userId: claims.sub,
        clinicId: claims.cid,
        role: claims.role,
        audience,
        sessionId: claims.sid,
        permissions,
        patientId: claims.pid,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Patient-portal variant. */
export const authenticatePatient = authenticate(TOKEN_AUDIENCE.patient);
