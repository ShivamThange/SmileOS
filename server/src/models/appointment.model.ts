import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin, type BaseFields } from "./plugins/base-fields";
import { APPOINTMENT_STATUS, APPOINTMENT_TYPES, APPOINTMENT_SOURCES } from "../shared/enums";

/*
 * Scheduling domain (spec 2.3). Appointment, Waitlist, BlockedTime. The
 * operatory+start index backs conflict detection and must be fast (spec 2.10).
 */

const reminderRecordSchema = new Schema({ channel: String, sentAt: Date, status: String, hoursBefore: Number }, { _id: false });

const appointmentSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", index: true }, // nullable when from an unconverted lead
  lead: { type: Schema.Types.ObjectId, ref: "Lead" },
  doctor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  operatory: { type: Schema.Types.ObjectId, ref: "Operatory" },
  operatoryLabel: String, // denormalised chair label for fast calendar rendering
  branch: { type: Schema.Types.ObjectId, ref: "Branch" },
  start: { type: Date, required: true, index: true },
  end: { type: Date, required: true },
  durationMinutes: Number,
  type: { type: String, enum: APPOINTMENT_TYPES, default: "treatment" },
  procedures: [{ type: Schema.Types.ObjectId, ref: "Procedure" }],
  planItems: [{ type: Schema.Types.ObjectId, ref: "TreatmentPlanItem" }],
  chiefComplaint: String,
  status: { type: String, enum: APPOINTMENT_STATUS, default: "scheduled", index: true },
  source: { type: String, enum: APPOINTMENT_SOURCES, default: "phone" },
  bookedBy: { type: Schema.Types.ObjectId, ref: "User" },
  confirmedAt: Date,
  checkedInAt: Date,
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancelReason: String,
  cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
  noShow: { type: Boolean, default: false },
  reminders: [reminderRecordSchema],
  notes: String,
  colorOverride: String,
  recurrenceGroup: String,
});

appointmentSchema.plugin(baseFieldsPlugin);
appointmentSchema.index({ clinicId: 1, start: 1 });
appointmentSchema.index({ clinicId: 1, doctor: 1, start: 1 });
appointmentSchema.index({ clinicId: 1, operatory: 1, start: 1 }); // conflict detection
appointmentSchema.index({ clinicId: 1, patient: 1, start: 1 });
appointmentSchema.index({ clinicId: 1, status: 1, start: 1 });

export type Appointment = InferSchemaType<typeof appointmentSchema> & BaseFields;
export type AppointmentDoc = HydratedDocument<Appointment>;
export const AppointmentModel = model<Appointment>("Appointment", appointmentSchema);

/* ----------------------------------------------------------------- Waitlist */

const waitlistSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient" },
  lead: { type: Schema.Types.ObjectId, ref: "Lead" },
  name: String,
  desiredTreatment: String,
  preferredDoctor: { type: Schema.Types.ObjectId, ref: "User" },
  preferredFrom: Date,
  preferredTo: Date,
  timeOfDay: { type: String, enum: ["morning", "afternoon", "evening", "any"], default: "any" },
  urgency: { type: String, enum: ["high", "moderate", "routine"], default: "routine" },
  contactAttempts: { type: Number, default: 0 },
  status: { type: String, enum: ["waiting", "scheduled", "expired", "cancelled"], default: "waiting", index: true },
  expiresAt: Date,
});
waitlistSchema.plugin(baseFieldsPlugin);
waitlistSchema.index({ clinicId: 1, status: 1, createdAt: -1 });

export type Waitlist = InferSchemaType<typeof waitlistSchema> & BaseFields;
export const WaitlistModel = model<Waitlist>("Waitlist", waitlistSchema);

/* --------------------------------------------------------------- BlockedTime */

const blockedTimeSchema = new Schema({
  resourceType: { type: String, enum: ["doctor", "operatory"], required: true },
  doctor: { type: Schema.Types.ObjectId, ref: "User" },
  operatory: { type: Schema.Types.ObjectId, ref: "Operatory" },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  reason: { type: String, enum: ["leave", "conference", "maintenance", "personal"], default: "personal" },
  recurringRule: String,
});
blockedTimeSchema.plugin(baseFieldsPlugin);
blockedTimeSchema.index({ clinicId: 1, start: 1 });

export type BlockedTime = InferSchemaType<typeof blockedTimeSchema> & BaseFields;
export const BlockedTimeModel = model<BlockedTime>("BlockedTime", blockedTimeSchema);

/* ---------------------------------------------------------------- Operatory */

const operatorySchema = new Schema({
  name: { type: String, required: true },
  branch: { type: Schema.Types.ObjectId, ref: "Branch" },
  equipmentNotes: String,
  color: { type: String, default: "#20614E" },
  active: { type: Boolean, default: true },
});
operatorySchema.plugin(baseFieldsPlugin);

export type Operatory = InferSchemaType<typeof operatorySchema> & BaseFields;
export const OperatoryModel = model<Operatory>("Operatory", operatorySchema);
