import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin, type BaseFields } from "./plugins/base-fields";
import { PLAN_STATUS, PLAN_ITEM_STATUS, PLAN_ITEM_PRIORITY } from "../shared/enums";

/*
 * Treatment & revenue core (spec 2.5). TreatmentPlan holds phases; the atomic
 * revenue unit is the separate TreatmentPlanItem collection — the row in the
 * recovery worklist. Item-level status is "the whole design": patients accept
 * the root canal and defer the crown. Money is paise; derived totals are
 * computed, never stored mutably.
 */

const phaseSchema = new Schema({
  key: String,
  name: String,
  sequence: Number,
  description: String,
  targetTimeframe: String,
}, { _id: true });

const treatmentPlanSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  doctor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  planDate: { type: Date, default: Date.now },
  title: String,
  clinicalSummary: String,
  phases: [phaseSchema],
  discountPct: { type: Number, default: 0 },
  discountPaise: { type: Number, default: 0 },
  discountReason: String,
  discountApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
  taxPaise: { type: Number, default: 0 },
  status: { type: String, enum: PLAN_STATUS, default: "draft", index: true },
  presentedAt: Date,
  decisionAt: Date,
  decisionChannel: { type: String, enum: ["in_clinic", "portal", "whatsapp"] },
  validUntil: Date,
  notes: String,
  pdfKey: String,
  publicToken: { type: String, index: true }, // tokenised patient-facing view
});

treatmentPlanSchema.plugin(baseFieldsPlugin);
treatmentPlanSchema.index({ clinicId: 1, status: 1, planDate: -1 });
treatmentPlanSchema.index({ clinicId: 1, patient: 1 });

export type TreatmentPlan = InferSchemaType<typeof treatmentPlanSchema> & BaseFields;
export type TreatmentPlanDoc = HydratedDocument<TreatmentPlan>;
export const TreatmentPlanModel = model<TreatmentPlan>("TreatmentPlan", treatmentPlanSchema);

/* ------------------------------------------------------- TreatmentPlanItem -- */

const followUpSchema = new Schema({
  nextFollowUpDate: Date,
  contactAttempts: { type: Number, default: 0 },
  lastContactDate: Date,
  lastContactOutcome: String,
  assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
  snoozeUntil: Date,
}, { _id: false });

const planItemSchema = new Schema({
  plan: { type: Schema.Types.ObjectId, ref: "TreatmentPlan", required: true, index: true },
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true }, // denormalised for worklist
  phaseKey: String,
  procedure: { type: Schema.Types.ObjectId, ref: "Procedure" },
  name: String,
  teeth: [Number],
  surfaces: [String],
  quantity: { type: Number, default: 1 },
  unitPricePaise: { type: Number, default: 0 },
  discountPaise: { type: Number, default: 0 },
  lineTotalPaise: { type: Number, default: 0 },
  priority: { type: String, enum: PLAN_ITEM_PRIORITY, default: "recommended" },
  sequence: { type: Number, default: 0 },
  justification: String,
  status: { type: String, enum: PLAN_ITEM_STATUS, default: "proposed", index: true },
  decisionAt: Date,
  decisionReason: String,
  scheduledAppointment: { type: Schema.Types.ObjectId, ref: "Appointment" },
  completingAppointment: { type: Schema.Types.ObjectId, ref: "Appointment" },
  completionDate: Date,
  performingDoctor: { type: Schema.Types.ObjectId, ref: "User" },
  invoiceLine: { type: Schema.Types.ObjectId, ref: "Invoice" },
  presentedAt: Date, // stamped when the parent plan is presented — acceptance analytics measure from here
  followUp: { type: followUpSchema, default: () => ({}) },
});

planItemSchema.plugin(baseFieldsPlugin);
// The recovery-worklist query lives here (spec 2.10) — this index is essential.
planItemSchema.index({ clinicId: 1, status: 1, "followUp.nextFollowUpDate": 1 });
planItemSchema.index({ clinicId: 1, patient: 1 });
planItemSchema.index({ clinicId: 1, plan: 1 });

export type TreatmentPlanItem = InferSchemaType<typeof planItemSchema> & BaseFields;
export type TreatmentPlanItemDoc = HydratedDocument<TreatmentPlanItem>;
export const TreatmentPlanItemModel = model<TreatmentPlanItem>("TreatmentPlanItem", planItemSchema);
