import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin } from "./plugins/base-fields";
import { CLINIC_TIMEZONE, CURRENCY, SCHEDULING } from "../config/constants";

/*
 * Clinic (spec 2.1) — the tenant root and the whitelabelling payload that drives
 * frontend theming. Not tenant-scoped (it *is* the tenant). Integration
 * credentials are references to a secrets store, never raw secrets.
 */

const workingDaySchema = new Schema(
  {
    weekday: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday
    isOpen: { type: Boolean, default: true },
    open: { type: String, default: "09:00" },
    close: { type: String, default: "20:00" },
    breaks: [{ start: String, end: String }],
  },
  { _id: false },
);

const clinicSchema = new Schema(
  {
    name: { type: String, required: true },
    legalName: String,
    slug: { type: String, required: true, unique: true, index: true },
    shortInitial: { type: String, default: "M" },
    logoUrl: String,
    faviconUrl: String,
    branding: {
      primary: { type: String, default: "#20614E" },
      primaryHover: { type: String, default: "#17493A" },
      canvas: { type: String, default: "#F4F3EF" },
      fontSans: { type: String, default: "IBM Plex Sans" },
      fontSerif: { type: String, default: "IBM Plex Serif" },
    },
    tagline: String,
    description: String,
    registrationNumbers: [{ label: String, value: String }],
    gstin: String,
    address: { line1: String, line2: String, locality: String, city: String, state: String, pincode: String },
    geo: { lat: Number, lng: Number },
    phones: [String],
    email: String,
    websiteDomain: String,
    social: { instagram: String, facebook: String, google: String, youtube: String },
    timezone: { type: String, default: CLINIC_TIMEZONE },
    currency: { type: String, default: CURRENCY },
    workingHours: { type: [workingDaySchema], default: [] },
    holidays: [{ date: String, label: String }],
    scheduling: {
      slotGranularityMinutes: { type: Number, default: SCHEDULING.slotGranularityMinutes },
      defaultDurationMinutes: { type: Number, default: SCHEDULING.defaultDurationMinutes },
      bufferMinutes: { type: Number, default: SCHEDULING.bufferMinutes },
      onlineBookingMinLeadMinutes: { type: Number, default: SCHEDULING.onlineBookingMinLeadMinutes },
      cancellationWindowHours: { type: Number, default: 24 },
      allowDoctorOverlap: { type: Boolean, default: false },
    },
    features: {
      publicSite: { type: Boolean, default: true },
      onlineBooking: { type: Boolean, default: true },
      costCalculator: { type: Boolean, default: true },
      patientPortal: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      payments: { type: Boolean, default: true },
      inventory: { type: Boolean, default: true },
      labTracking: { type: Boolean, default: true },
      multiDoctor: { type: Boolean, default: true },
      reviewRequests: { type: Boolean, default: true },
      recallEngine: { type: Boolean, default: true },
      insuranceClaims: { type: Boolean, default: false },
    },
    plan: { tier: { type: String, default: "growth" }, seats: { type: Number, default: 10 }, renewsAt: Date },
    integrations: {
      smtpRef: String, razorpayRef: String, whatsappRef: String, storageRef: String,
    },
    // Sequence config for human-readable numbers.
    numbering: {
      patientPrefix: { type: String, default: "MDC-" },
      patientWidth: { type: Number, default: 4 },
      invoicePrefix: { type: String, default: "INV-" },
      invoiceWidth: { type: Number, default: 4 },
    },
  },
  { minimize: false },
);

clinicSchema.plugin(baseFieldsPlugin, { tenantScoped: false });

export type Clinic = InferSchemaType<typeof clinicSchema>;
export type ClinicDoc = HydratedDocument<Clinic>;
export const ClinicModel = model("Clinic", clinicSchema);
