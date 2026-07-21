import { Router } from "express";
import * as ctrl from "./auth.controller";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { rateLimit } from "../../middleware/rate-limit";
import { requireDb } from "../../middleware/require-db";
import { asyncHandler } from "../../shared/http";
import { otpRequestSchema, otpVerifySchema, loginSchema, setPasswordSchema, updateMeSchema } from "./auth.validator";

/*
 * Auth routes (spec 4.1). OTP request/verify carry tight rate limits (spec 3.1):
 * 3 per email / 15 min and 10 per IP / hour on request; verify is limited too.
 */
export const authRouter = Router();

const perEmail = rateLimit({ windowMs: 15 * 60_000, max: 3, bucket: "otp-email", keyBy: (req) => String(req.body?.email ?? req.ip) });
const perIpHour = rateLimit({ windowMs: 60 * 60_000, max: 10, bucket: "otp-ip" });
const verifyLimit = rateLimit({ windowMs: 15 * 60_000, max: 10, bucket: "otp-verify", keyBy: (req) => String(req.body?.email ?? req.ip) });
const loginLimit = rateLimit({ windowMs: 15 * 60_000, max: 10, bucket: "login", keyBy: (req) => String(req.body?.email ?? req.ip) });

authRouter.post("/otp/request", requireDb, perIpHour, perEmail, validate({ body: otpRequestSchema }), asyncHandler(ctrl.requestOtp));
authRouter.post("/otp/verify", requireDb, verifyLimit, validate({ body: otpVerifySchema }), asyncHandler(ctrl.verifyOtp));
authRouter.post("/login", requireDb, loginLimit, validate({ body: loginSchema }), asyncHandler(ctrl.login));
authRouter.post("/refresh", requireDb, asyncHandler(ctrl.refresh));
authRouter.post("/logout", asyncHandler(ctrl.logout));

authRouter.use(authenticate());
authRouter.post("/logout-all", requireDb, asyncHandler(ctrl.logoutAll));
authRouter.get("/me", requireDb, asyncHandler(ctrl.me));
authRouter.patch("/me", requireDb, validate({ body: updateMeSchema }), asyncHandler(ctrl.updateMe));
authRouter.post("/password/set", requireDb, validate({ body: setPasswordSchema }), asyncHandler(ctrl.setPassword));
authRouter.get("/sessions", requireDb, asyncHandler(ctrl.listSessions));
authRouter.delete("/sessions/:id", requireDb, asyncHandler(ctrl.revokeSession));
