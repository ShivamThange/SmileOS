import type { Request, Response } from "express";
import * as authService from "./auth.service";
import { ok, created } from "../../shared/envelope";
import { isProd } from "../../config/env";
import { UserModel } from "../../models/user.model";
import { errors } from "../../shared/errors";
import type { OtpPurpose } from "../../shared/enums";

/*
 * Auth controller (spec 4.1). Translates HTTP to auth-service calls. The refresh
 * token is delivered in an httpOnly, secure, SameSite=strict cookie (spec 3.2);
 * the access token goes in the JSON body for the client to hold in memory.
 */

const REFRESH_COOKIE = "dentalos_rt";

function ctxFrom(req: Request) {
  return { ip: req.ip, userAgent: req.headers["user-agent"], clinicSlug: req.headers["x-clinic-slug"] as string | undefined };
}

function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    expires: expiresAt,
    path: "/api/v1/auth",
  });
}

export async function requestOtp(req: Request, res: Response): Promise<Response> {
  await authService.requestOtp(req.body.email, req.body.purpose as OtpPurpose, ctxFrom(req));
  return ok(res, { sent: true }, { message: "A code has been sent to your email" });
}

export async function verifyOtp(req: Request, res: Response): Promise<Response> {
  const { tokens, user } = await authService.verifyOtp(req.body.email, req.body.purpose as OtpPurpose, req.body.code, ctxFrom(req));
  setRefreshCookie(res, tokens.refreshToken, tokens.expiresAt);
  return ok(res, { accessToken: tokens.accessToken, user: authService.serialiseUser(user) });
}

export async function login(req: Request, res: Response): Promise<Response> {
  const { tokens, user } = await authService.loginPassword(req.body.email, req.body.password, ctxFrom(req));
  setRefreshCookie(res, tokens.refreshToken, tokens.expiresAt);
  return ok(res, { accessToken: tokens.accessToken, user: authService.serialiseUser(user) });
}

export async function refresh(req: Request, res: Response): Promise<Response> {
  const raw = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
  if (!raw) throw errors.authRequired();
  const tokens = await authService.refresh(raw, ctxFrom(req));
  setRefreshCookie(res, tokens.refreshToken, tokens.expiresAt);
  return ok(res, { accessToken: tokens.accessToken });
}

export async function logout(req: Request, res: Response): Promise<Response> {
  const raw = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
  if (raw) await authService.logout(raw);
  res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
  return ok(res, { loggedOut: true });
}

export async function logoutAll(req: Request, res: Response): Promise<Response> {
  await authService.logoutAll(req.auth!.userId);
  res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
  return ok(res, { loggedOut: true });
}

export async function me(req: Request, res: Response): Promise<Response> {
  const user = await authService.getUserById(req.auth!.userId, req.auth!.clinicId);
  return ok(res, authService.serialiseUser(user));
}

export async function updateMe(req: Request, res: Response): Promise<Response> {
  const user = await UserModel.findOneAndUpdate(
    { _id: req.auth!.userId, clinicId: req.auth!.clinicId },
    { $set: req.body, updatedBy: req.auth!.userId },
    { new: true },
  );
  if (!user) throw errors.notFound("User");
  return ok(res, authService.serialiseUser(user));
}

export async function setPassword(req: Request, res: Response): Promise<Response> {
  await authService.setPassword(req.auth!.userId, req.auth!.clinicId, req.body.newPassword);
  return ok(res, { updated: true });
}

export async function listSessions(req: Request, res: Response): Promise<Response> {
  return ok(res, await authService.listSessions(req.auth!.userId));
}

export async function revokeSession(req: Request, res: Response): Promise<Response> {
  await authService.revokeSession(req.params.id, req.auth!.userId);
  return ok(res, { revoked: true });
}

export { created };
