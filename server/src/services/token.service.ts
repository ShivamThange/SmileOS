import jwt, { type SignOptions } from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { env } from "../config/env";
import { TOKEN_AUDIENCE, type TokenAudience } from "../config/constants";
import type { UserRole } from "../shared/enums";

/*
 * Token service (spec 3.2). Short-lived access tokens (15m) carry identity,
 * clinic, role, permission-set version and session id. Long-lived refresh
 * tokens (30d) are opaque random strings stored hashed server-side and rotated
 * on every use. Patient and staff tokens use distinct audiences.
 */

export interface AccessClaims {
  sub: string; // userId
  cid: string; // clinicId
  role: UserRole | "patient";
  aud: TokenAudience;
  sid: string; // sessionId
  pv: number; // permission-set version
  pid?: string; // patientId for portal tokens
}

export function signAccessToken(claims: Omit<AccessClaims, "aud"> & { audience: TokenAudience }): string {
  const { audience, ...rest } = claims;
  const opts: SignOptions = { expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"], audience };
  return jwt.sign(rest, env.JWT_ACCESS_SECRET, opts);
}

export function verifyAccessToken(token: string, audience: TokenAudience): AccessClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { audience }) as jwt.JwtPayload;
  return {
    sub: String(decoded.sub),
    cid: String(decoded.cid),
    role: decoded.role,
    aud: audience,
    sid: String(decoded.sid),
    pv: Number(decoded.pv ?? 0),
    pid: decoded.pid ? String(decoded.pid) : undefined,
  };
}

/** Opaque refresh token (returned to client) — only its hash is persisted. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export const AUDIENCES = TOKEN_AUDIENCE;
