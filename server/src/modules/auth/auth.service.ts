import type { Types } from "mongoose";
import { UserModel, type UserDoc } from "../../models/user.model";
import { OtpModel } from "../../models/otp.model";
import { SessionModel } from "../../models/session.model";
import { resolveClinic } from "../../services/clinic-context";
import { sendOtpEmail } from "../../services/email.service";
import { numericCode, sha256, opaqueToken } from "../../utils/ids";
import { hashPassword, verifyPassword } from "../../utils/password";
import { signAccessToken, generateRefreshToken, refreshExpiry } from "../../services/token.service";
import { TOKEN_AUDIENCE, type TokenAudience } from "../../config/constants";
import { env } from "../../config/env";
import { AppError, ERROR_CODES, errors } from "../../shared/errors";
import { effectivePermissions, type Permission } from "../../shared/rbac";
import type { OtpPurpose, UserRole } from "../../shared/enums";
import { logger } from "../../config/logger";

/*
 * Auth service (spec 3.1-3.2). All business logic for the three entry paths
 * (email OTP, Google, password) and the one session system. Controllers only
 * translate HTTP; everything below is testable without it.
 */

interface Ctx {
  ip?: string;
  userAgent?: string;
  clinicSlug?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/* ------------------------------------------------------------------ OTP ---- */

export async function requestOtp(identifier: string, purpose: OtpPurpose, ctx: Ctx): Promise<void> {
  const code = numericCode(6);
  await OtpModel.create({
    identifier: identifier.toLowerCase(),
    channel: "email",
    purpose,
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000),
    requestIp: ctx.ip,
  });
  await sendOtpEmail(identifier, code, purpose);
  logger.info("OTP requested", { purpose });
}

export async function verifyOtp(identifier: string, purpose: OtpPurpose, code: string, ctx: Ctx): Promise<{ tokens: TokenPair; user: UserDoc }> {
  const email = identifier.toLowerCase();
  const otp = await OtpModel.findOne({ identifier: email, purpose, consumed: false }).sort({ createdAt: -1 });
  if (!otp) throw new AppError(ERROR_CODES.AUTH_OTP_EXPIRED, "No pending code — request a new one");
  if (otp.expiresAt.getTime() < Date.now()) throw new AppError(ERROR_CODES.AUTH_OTP_EXPIRED, "Code expired");
  if (otp.attempts >= otp.maxAttempts) throw new AppError(ERROR_CODES.AUTH_OTP_INVALID, "Too many attempts — request a new code");

  if (otp.codeHash !== sha256(code)) {
    otp.attempts += 1;
    await otp.save();
    throw new AppError(ERROR_CODES.AUTH_OTP_INVALID, "Incorrect code");
  }
  otp.consumed = true;
  await otp.save();

  const clinic = await resolveClinic(ctx.clinicSlug);
  let user = await UserModel.findOne({ clinicId: clinic._id, email });

  if (!user) {
    // Staff accounts are invited by an admin, never self-registered here.
    if (purpose !== "registration" && purpose !== "booking") {
      throw errors.authInvalid("No account for that email");
    }
    // Booking/registration flow may create a lightweight staff-side patient user
    // is out of scope here; portal patient accounts are provisioned separately.
    throw errors.authInvalid("No account for that email");
  }

  const audience: TokenAudience = TOKEN_AUDIENCE.staff;
  const tokens = await issueSession(user, audience, ctx);
  user.lastLoginAt = new Date();
  user.failedLoginCount = 0;
  await user.save();
  return { tokens, user };
}

/* ------------------------------------------------------------- password ---- */

export async function loginPassword(email: string, password: string, ctx: Ctx): Promise<{ tokens: TokenPair; user: UserDoc }> {
  const clinic = await resolveClinic(ctx.clinicSlug);
  const user = await UserModel.findOne({ clinicId: clinic._id, email: email.toLowerCase() });
  if (!user) throw errors.authInvalid();
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) throw new AppError(ERROR_CODES.AUTH_LOCKED, "Account temporarily locked");
  if (!user.active) throw errors.authInvalid("Account inactive");

  const okPass = await verifyPassword(password, user.passwordHash);
  if (!okPass) {
    user.failedLoginCount = (user.failedLoginCount ?? 0) + 1;
    if (user.failedLoginCount >= 5) user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    throw errors.authInvalid();
  }
  user.failedLoginCount = 0;
  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueSession(user, TOKEN_AUDIENCE.staff, ctx);
  return { tokens, user };
}

export async function setPassword(userId: string, clinicId: string, newPassword: string): Promise<void> {
  const user = await UserModel.findOne({ _id: userId, clinicId });
  if (!user) throw errors.notFound("User");
  user.passwordHash = await hashPassword(newPassword);
  if (!user.authProviders.includes("password")) user.authProviders.push("password");
  await user.save();
}

/* -------------------------------------------------------------- sessions --- */

async function issueSession(user: UserDoc, audience: TokenAudience, ctx: Ctx): Promise<TokenPair> {
  const family = opaqueToken(12);
  const refreshToken = generateRefreshToken();
  const expiresAt = refreshExpiry();
  const session = await SessionModel.create({
    clinicId: user.clinicId,
    user: user._id,
    audience,
    family,
    tokenHash: sha256(refreshToken),
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    expiresAt,
  });

  const accessToken = signAccessToken({
    sub: String(user._id),
    cid: String(user.clinicId),
    role: user.role as UserRole,
    sid: String(session._id),
    pv: 0,
    audience,
  });
  return { accessToken, refreshToken, expiresAt };
}

export async function refresh(rawToken: string, ctx: Ctx): Promise<TokenPair> {
  const tokenHash = sha256(rawToken);
  const session = await SessionModel.findOne({ tokenHash });
  if (!session) throw new AppError(ERROR_CODES.AUTH_INVALID, "Invalid refresh token");

  // Reuse detection: a revoked token being presented revokes the whole family.
  if (session.revoked) {
    await SessionModel.updateMany({ family: session.family }, { revoked: true, revokedReason: "reuse_detected" });
    throw new AppError(ERROR_CODES.AUTH_INVALID, "Session revoked");
  }
  if (session.expiresAt.getTime() < Date.now()) throw new AppError(ERROR_CODES.AUTH_EXPIRED, "Session expired");

  const user = await UserModel.findOne({ _id: session.user, active: true });
  if (!user) throw errors.authInvalid("Account not found");

  // Rotate: revoke this token, issue a new one in the same family.
  const newRaw = generateRefreshToken();
  session.revoked = true;
  session.revokedReason = "rotated";
  session.lastUsedAt = new Date();
  await session.save();

  const next = await SessionModel.create({
    clinicId: session.clinicId,
    user: user._id,
    audience: session.audience,
    family: session.family,
    tokenHash: sha256(newRaw),
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    expiresAt: refreshExpiry(),
  });

  const accessToken = signAccessToken({
    sub: String(user._id),
    cid: String(user.clinicId),
    role: user.role as UserRole,
    sid: String(next._id),
    pv: 0,
    audience: session.audience as TokenAudience,
  });
  return { accessToken, refreshToken: newRaw, expiresAt: next.expiresAt };
}

export async function logout(refreshTokenRaw: string): Promise<void> {
  await SessionModel.updateOne({ tokenHash: sha256(refreshTokenRaw) }, { revoked: true, revokedReason: "logout" });
}

export async function logoutAll(userId: string): Promise<void> {
  await SessionModel.updateMany({ user: userId, revoked: false }, { revoked: true, revokedReason: "logout_all" });
}

export async function listSessions(userId: string): Promise<unknown[]> {
  return SessionModel.find({ user: userId, revoked: false }).select("ip userAgent issuedAt lastUsedAt expiresAt").sort({ createdAt: -1 }).lean();
}

export async function revokeSession(sessionId: string, userId: string): Promise<void> {
  await SessionModel.updateOne({ _id: sessionId, user: userId }, { revoked: true, revokedReason: "revoked" });
}

/* -------------------------------------------------------------------- me --- */

export function serialiseUser(user: UserDoc): Record<string, unknown> {
  const perms = effectivePermissions(
    user.role as UserRole,
    (user.permissionGrants ?? []) as Permission[],
    (user.permissionDenials ?? []) as Permission[],
  );
  return {
    id: String(user._id),
    clinicId: String(user.clinicId),
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    doctor: user.doctor ?? null,
    permissions: [...perms],
  };
}

export async function getUserById(userId: string, clinicId: string): Promise<UserDoc> {
  const user = await UserModel.findOne({ _id: userId as unknown as Types.ObjectId, clinicId });
  if (!user) throw errors.notFound("User");
  return user;
}
