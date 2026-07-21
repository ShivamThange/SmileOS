import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin, type BaseFields } from "./plugins/base-fields";
import { PATIENT_STATUS, GENDERS } from "../shared/enums";

/*
 * Patient domain (spec 2.2). Patient, MedicalHistory (versioned), FamilyGroup,
 * Document. Indexes per 2.10: clinic+phone (unique), clinic+patientNumber
 * (unique), and a text index over name + phone for search.
 */

const patientSchema = new Schema({
  patientNumber: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: String,
  dob: Date,
  ageFallback: Number, // when DOB unknown — common in Indian practice
  gender: { type: String, enum: GENDERS },
  bloodGroup: String,
  phone: { type: String, required: true, index: true },
  altPhone: String,
  whatsapp: String,
  email: { type: String, lowercase: true },
  address: { line1: String, line2: String, locality: String, city: String, state: String, pincode: String },
  occupation: String,
  referralSource: String,
  referredByPatient: { type: Schema.Types.ObjectId, ref: "Patient" },
  abhaNumber: String, // ABDM readiness (spec 5.6)
  govtIdRef: String,
  emergencyContact: { name: String, relationship: String, phone: String },
  photoUrl: String,
  familyGroup: { type: Schema.Types.ObjectId, ref: "FamilyGroup" },
  tags: [String],
  notes: String,
  marketingConsent: { whatsapp: { type: Boolean, default: false }, sms: { type: Boolean, default: false }, email: { type: Boolean, default: false } },
  portalEnabled: { type: Boolean, default: false },
  portalUser: { type: Schema.Types.ObjectId, ref: "User" },
  status: { type: String, enum: PATIENT_STATUS, default: "active", index: true },
  firstVisit: Date,
  lastVisit: Date,
  nextRecallDate: Date,
  // Derived, refreshed nightly (spec 2.2 / Part 6).
  ltvPaise: { type: Number, default: 0 },
  balancePaise: { type: Number, default: 0 },
});

patientSchema.plugin(baseFieldsPlugin);
patientSchema.index({ clinicId: 1, phone: 1 }, { unique: true });
patientSchema.index({ clinicId: 1, patientNumber: 1 }, { unique: true });
patientSchema.index({ firstName: "text", lastName: "text", phone: "text" });

export type Patient = InferSchemaType<typeof patientSchema> & BaseFields;
export type PatientDoc = HydratedDocument<Patient>;
export const PatientModel = model<Patient>("Patient", patientSchema);

/* ------------------------------------------------------------ MedicalHistory */

const allergySchema = new Schema({ substance: String, reaction: String, severity: { type: String, enum: ["low", "moderate", "high"] } }, { _id: false });

const medicalHistorySchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  version: { type: Number, default: 1 },
  allergies: [allergySchema],
  medications: [String],
  conditions: {
    diabetes: Boolean, hypertension: Boolean, cardiac: Boolean, thyroid: Boolean,
    asthma: Boolean, bleedingDisorder: Boolean, other: [String],
  },
  pastSurgeries: [String],
  hospitalisations: [String],
  pregnancy: { isPregnant: Boolean, trimester: Number },
  tobacco: { uses: Boolean, form: String, note: String }, // gutkha/pan masala — oral-cancer screening signal
  alcohol: { uses: Boolean, note: String },
  dentalHistory: String,
  anaesthesiaComplications: String,
  notes: String,
});

medicalHistorySchema.plugin(baseFieldsPlugin);
medicalHistorySchema.index({ clinicId: 1, patient: 1, version: -1 });

export type MedicalHistory = InferSchemaType<typeof medicalHistorySchema> & BaseFields;
export const MedicalHistoryModel = model<MedicalHistory>("MedicalHistory", medicalHistorySchema);

/** Compute the top-level alerts array the patient read endpoint must surface (spec 2.2). */
export function deriveAlerts(mh: MedicalHistory | null): string[] {
  if (!mh) return [];
  const alerts: string[] = [];
  for (const a of mh.allergies ?? []) if (a.substance) alerts.push(`Allergy: ${a.substance}${a.severity === "high" ? " (severe)" : ""}`);
  const c = (mh.conditions ?? {}) as Record<string, unknown>;
  if (c.diabetes) alerts.push("Type 2 diabetes");
  if (c.hypertension) alerts.push("Hypertension");
  if (c.cardiac) alerts.push("Cardiac condition");
  if (c.bleedingDisorder) alerts.push("Bleeding disorder");
  if ((mh.pregnancy as { isPregnant?: boolean } | undefined)?.isPregnant) alerts.push("Pregnant");
  return alerts;
}

/* --------------------------------------------------------------- FamilyGroup */

const familyGroupSchema = new Schema({
  name: { type: String, required: true },
  members: [{ patient: { type: Schema.Types.ObjectId, ref: "Patient" }, relationship: String }],
  primaryContact: { type: Schema.Types.ObjectId, ref: "Patient" },
  sharedBilling: { type: Boolean, default: false },
});
familyGroupSchema.plugin(baseFieldsPlugin);

export type FamilyGroup = InferSchemaType<typeof familyGroupSchema> & BaseFields;
export const FamilyGroupModel = model<FamilyGroup>("FamilyGroup", familyGroupSchema);

/* ------------------------------------------------------------------ Document */

const documentSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  category: { type: String, enum: ["xray", "opg", "cbct", "intraoral", "consent", "lab_report", "prescription", "insurance", "identity", "other"], default: "other" },
  storageKey: { type: String, required: true },
  originalName: String,
  mimeType: String,
  size: Number,
  thumbnailKey: String,
  appointment: { type: Schema.Types.ObjectId, ref: "Appointment" },
  treatment: { type: Schema.Types.ObjectId, ref: "TreatmentPlanItem" },
  toothRefs: [Number],
  captureDate: Date,
  description: String,
  marketingConsent: { type: Boolean, default: false },
});
documentSchema.plugin(baseFieldsPlugin);
documentSchema.index({ clinicId: 1, patient: 1, createdAt: -1 });

export type Document = InferSchemaType<typeof documentSchema> & BaseFields;
export const DocumentModel = model<Document>("Document", documentSchema);
