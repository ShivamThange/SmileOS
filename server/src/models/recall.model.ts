import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin, type BaseFields } from "./plugins/base-fields";
import { RECALL_TYPES, RECALL_STATUS } from "../shared/enums";

/*
 * Recall (spec 2.5). Auto-created by a completion hook using the procedure's
 * default recall interval, or manually. Index clinic+status+dueDate (spec 2.10).
 */

const recallSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  type: { type: String, enum: RECALL_TYPES, default: "hygiene" },
  source: { type: String, enum: ["auto", "manual"], default: "auto" },
  dueDate: { type: Date, required: true },
  intervalDays: Number,
  priority: { type: String, enum: ["high", "moderate", "routine"], default: "routine" },
  status: { type: String, enum: RECALL_STATUS, default: "pending", index: true },
  contactAttempts: [{ date: Date, channel: String, outcome: String, by: { type: Schema.Types.ObjectId, ref: "User" } }],
  appointment: { type: Schema.Types.ObjectId, ref: "Appointment" },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
  fromProcedure: { type: Schema.Types.ObjectId, ref: "Procedure" },
  notes: String,
});

recallSchema.plugin(baseFieldsPlugin);
recallSchema.index({ clinicId: 1, status: 1, dueDate: 1 });
recallSchema.index({ clinicId: 1, patient: 1 });

export type Recall = InferSchemaType<typeof recallSchema> & BaseFields;
export type RecallDoc = HydratedDocument<Recall>;
export const RecallModel = model<Recall>("Recall", recallSchema);
