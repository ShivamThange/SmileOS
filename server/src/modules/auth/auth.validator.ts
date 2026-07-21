import { z } from "zod";
import { OTP_PURPOSES } from "../../shared/enums";

/* Auth request schemas (spec 4.1). */

export const otpRequestSchema = z.object({
  email: z.string().email(),
  purpose: z.enum(OTP_PURPOSES).default("login"),
});

export const otpVerifySchema = z.object({
  email: z.string().email(),
  purpose: z.enum(OTP_PURPOSES).default("login"),
  code: z.string().regex(/^\d{6}$/, "6-digit code required"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const setPasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "At least 8 characters"),
});

export const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});
