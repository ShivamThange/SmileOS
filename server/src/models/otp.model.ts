import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin } from "./plugins/base-fields";
import { OTP_PURPOSES, CHANNELS } from "../shared/enums";

/*
 * OtpToken (spec 2.1 / 3.1). Codes are hashed, never stored plaintext, expire
 * in 10 minutes, and are consumed atomically on verification. A TTL index
 * reaps expired documents automatically.
 */

const otpSchema = new Schema({
  identifier: { type: String, required: true, index: true }, // email or phone
  channel: { type: String, enum: CHANNELS, default: "email" },
  purpose: { type: String, enum: OTP_PURPOSES, required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  expiresAt: { type: Date, required: true },
  consumed: { type: Boolean, default: false },
  requestIp: String,
});

otpSchema.plugin(baseFieldsPlugin, { tenantScoped: false });
otpSchema.index({ identifier: 1, purpose: 1, consumed: 1 });
// TTL — Mongo removes the doc shortly after expiry.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type Otp = InferSchemaType<typeof otpSchema>;
export type OtpDoc = HydratedDocument<Otp>;
export const OtpModel = model("OtpToken", otpSchema);
