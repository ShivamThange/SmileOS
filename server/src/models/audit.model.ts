import { Schema, model, type InferSchemaType } from "mongoose";
import { baseFieldsPlugin } from "./plugins/base-fields";

/*
 * AuditLog (spec 2.9 / Part 0 rule 2). Every state change a human might later
 * ask "who did this and when" about writes an entry. Never deleted by
 * application logic; retained for the statutory period.
 */

const auditSchema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: "User" },
  actorRole: String,
  action: { type: String, required: true }, // e.g. "patient.create", "payment.refund"
  resourceType: { type: String, required: true, index: true },
  resourceId: { type: String, index: true },
  patient: { type: Schema.Types.ObjectId, ref: "Patient" },
  before: Schema.Types.Mixed,
  after: Schema.Types.Mixed,
  ip: String,
  userAgent: String,
  outcome: { type: String, enum: ["success", "failure"], default: "success" },
});

auditSchema.plugin(baseFieldsPlugin);
auditSchema.index({ clinicId: 1, createdAt: -1 });
auditSchema.index({ clinicId: 1, resourceType: 1, resourceId: 1 });

export type Audit = InferSchemaType<typeof auditSchema>;
export const AuditModel = model("AuditLog", auditSchema);
