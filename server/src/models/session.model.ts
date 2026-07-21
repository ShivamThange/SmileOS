import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin, type BaseFields } from "./plugins/base-fields";

/*
 * Session / RefreshToken (spec 2.1 / 3.2). Refresh tokens are stored hashed and
 * rotated on every use; a `family` groups a login lineage so replay of a
 * revoked token can revoke the whole family (reuse detection).
 */

const sessionSchema = new Schema({
  // Exactly one of user (staff) / patient (portal) is set, per audience.
  user: { type: Schema.Types.ObjectId, ref: "User", index: true },
  patient: { type: Schema.Types.ObjectId, ref: "Patient", index: true },
  audience: { type: String, required: true }, // staff | patient
  family: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  deviceFingerprint: String,
  ip: String,
  userAgent: String,
  issuedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  lastUsedAt: Date,
  revoked: { type: Boolean, default: false },
  revokedReason: String,
});

sessionSchema.plugin(baseFieldsPlugin);
sessionSchema.index({ clinicId: 1, user: 1 });

export type Session = InferSchemaType<typeof sessionSchema> & BaseFields;
export type SessionDoc = HydratedDocument<Session>;
export const SessionModel = model<Session>("Session", sessionSchema);
