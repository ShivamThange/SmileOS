import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin, type BaseFields } from "./plugins/base-fields";
import { USER_ROLES, AUTH_PROVIDERS } from "../shared/enums";

/*
 * User (spec 2.1) — staff account, clinic-scoped, email unique per clinic. OTP
 * and Google users may have no password hash. The doctor sub-document is
 * populated only when the role is doctor and powers the public site + scheduling.
 */

const doctorProfileSchema = new Schema(
  {
    registrationNumber: String,
    qualifications: [String],
    specialisations: [String],
    yearsExperience: Number,
    bio: String,
    publicProfile: { type: Boolean, default: false },
    consultationFeePaise: { type: Number, default: 0 },
    slug: { type: String, index: true },
    signatureUrl: String,
  },
  { _id: false },
);

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: String,
  passwordHash: { type: String, default: null },
  authProviders: { type: [String], enum: AUTH_PROVIDERS, default: ["otp"] },
  role: { type: String, enum: USER_ROLES, required: true, index: true },
  // Explicit permission overrides layered on top of the role (spec 3.4).
  permissionGrants: { type: [String], default: [] },
  permissionDenials: { type: [String], default: [] },
  avatarUrl: String,
  employment: { title: String, joinedAt: Date, employeeCode: String },
  doctor: { type: doctorProfileSchema, default: undefined },
  workingSchedule: { type: Schema.Types.Mixed },
  leave: [{ from: Date, to: Date, reason: String, approved: Boolean }],
  active: { type: Boolean, default: true, index: true },
  lastLoginAt: Date,
  failedLoginCount: { type: Number, default: 0 },
  lockedUntil: Date,
});

userSchema.plugin(baseFieldsPlugin);
userSchema.index({ clinicId: 1, email: 1 }, { unique: true });

export type User = InferSchemaType<typeof userSchema> & BaseFields;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model<User>("User", userSchema);
