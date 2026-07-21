import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin, type BaseFields } from "./plugins/base-fields";
import { TOOTH_PRESENCE, TOOTH_CONDITIONS, SURFACES } from "../shared/enums";

/*
 * Clinical domain (spec 2.4). DentalChart (one active per patient, changes
 * append to ChartHistory), PerioChart, ClinicalNote (locks after a window, then
 * append-only amendments), Prescription, ConsentForm.
 */

const surfaceEntrySchema = new Schema({
  surface: { type: String, enum: SURFACES },
  condition: { type: String, enum: TOOTH_CONDITIONS },
  severity: String,
  diagnosedDate: Date,
  diagnosingDoctor: { type: Schema.Types.ObjectId, ref: "User" },
  note: String,
}, { _id: false });

const toothRecordSchema = new Schema({
  toothNumber: { type: Number, required: true },
  presence: { type: String, enum: TOOTH_PRESENCE, default: "present" },
  extractedDate: Date,
  extractedReason: String,
  wholeConditions: [{ type: String, enum: TOOTH_CONDITIONS }],
  surfaces: [surfaceEntrySchema],
  restorations: [{ material: String, date: Date, surfaces: [String] }],
  endodonticStatus: String,
  prosthetic: { type: { type: String }, system: String, date: Date },
  mobility: Number,
  periapical: String,
}, { _id: false });

const dentalChartSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, unique: true, index: true },
  numberingSystem: { type: String, default: "FDI" },
  dentition: { type: String, enum: ["permanent", "mixed", "primary"], default: "permanent" },
  teeth: { type: Map, of: toothRecordSchema, default: {} },
});
dentalChartSchema.plugin(baseFieldsPlugin);

export type DentalChart = InferSchemaType<typeof dentalChartSchema> & BaseFields;
export type DentalChartDoc = HydratedDocument<DentalChart>;
export const DentalChartModel = model<DentalChart>("DentalChart", dentalChartSchema);

/* -------------------------------------------------------------- ChartHistory */

const chartHistorySchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  toothNumber: Number,
  change: Schema.Types.Mixed, // before/after for the tooth
  doctor: { type: Schema.Types.ObjectId, ref: "User" },
});
chartHistorySchema.plugin(baseFieldsPlugin);
chartHistorySchema.index({ clinicId: 1, patient: 1, createdAt: -1 });

export type ChartHistory = InferSchemaType<typeof chartHistorySchema> & BaseFields;
export const ChartHistoryModel = model<ChartHistory>("ChartHistory", chartHistorySchema);

/* ---------------------------------------------------------------- PerioChart */

const perioChartSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  examDate: { type: Date, default: Date.now },
  doctor: { type: Schema.Types.ObjectId, ref: "User" },
  // per-tooth six-site measurements
  measurements: { type: Map, of: Schema.Types.Mixed, default: {} },
  indices: { bleedingPct: Number, plaquePct: Number, pocketDistribution: Schema.Types.Mixed },
});
perioChartSchema.plugin(baseFieldsPlugin);
perioChartSchema.index({ clinicId: 1, patient: 1, examDate: -1 });

export type PerioChart = InferSchemaType<typeof perioChartSchema> & BaseFields;
export const PerioChartModel = model<PerioChart>("PerioChart", perioChartSchema);

/* --------------------------------------------------------------- ClinicalNote */

const clinicalNoteSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  appointment: { type: Schema.Types.ObjectId, ref: "Appointment" },
  doctor: { type: Schema.Types.ObjectId, ref: "User", required: true },
  noteDate: { type: Date, default: Date.now },
  chiefComplaint: String,
  historyPresentIllness: String,
  examination: String,
  investigations: String,
  diagnosis: [{ text: String, teeth: [Number] }],
  procedures: [{ procedure: { type: Schema.Types.ObjectId, ref: "Procedure" }, teeth: [Number] }],
  anaesthesia: String,
  materials: [{ name: String, batchNumber: String }],
  complications: String,
  postOpInstructions: String,
  advice: String,
  nextVisitPlan: String,
  attachments: [{ key: String, name: String }],
  signed: { type: Boolean, default: false },
  signedAt: Date,
  lockedAt: Date,
  amendments: [{ text: String, author: { type: Schema.Types.ObjectId, ref: "User" }, at: Date }],
});
clinicalNoteSchema.plugin(baseFieldsPlugin);
clinicalNoteSchema.index({ clinicId: 1, patient: 1, noteDate: -1 });

export type ClinicalNote = InferSchemaType<typeof clinicalNoteSchema> & BaseFields;
export type ClinicalNoteDoc = HydratedDocument<ClinicalNote>;
export const ClinicalNoteModel = model<ClinicalNote>("ClinicalNote", clinicalNoteSchema);

/* --------------------------------------------------------------- Prescription */

const prescriptionSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  doctor: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, default: Date.now },
  appointment: { type: Schema.Types.ObjectId, ref: "Appointment" },
  medications: [{
    drug: String, strength: String, form: String, dosage: String, frequency: String,
    durationDays: Number, route: String, timing: String, quantity: Number, instructions: String,
  }],
  advice: String,
  followUpDate: Date,
  signatureKey: String,
  pdfKey: String,
  warnings: [String], // allergy / interaction cross-check results
});
prescriptionSchema.plugin(baseFieldsPlugin);
prescriptionSchema.index({ clinicId: 1, patient: 1, date: -1 });

export type Prescription = InferSchemaType<typeof prescriptionSchema> & BaseFields;
export type PrescriptionDoc = HydratedDocument<Prescription>;
export const PrescriptionModel = model<Prescription>("Prescription", prescriptionSchema);

/* ---------------------------------------------------------------- ConsentForm */

const consentFormSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  template: { type: Schema.Types.ObjectId, ref: "ConsentTemplate" },
  procedure: String,
  contentSnapshot: String, // the actual text presented, not just a pointer
  signatureKey: String,
  otpAccepted: { verified: Boolean, at: Date, ip: String },
  witness: String,
  signedAt: Date,
  ip: String,
  pdfKey: String,
});
consentFormSchema.plugin(baseFieldsPlugin);
consentFormSchema.index({ clinicId: 1, patient: 1 });

export type ConsentForm = InferSchemaType<typeof consentFormSchema> & BaseFields;
export const ConsentFormModel = model<ConsentForm>("ConsentForm", consentFormSchema);
