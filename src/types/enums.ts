/*
 * Enums — defined ONCE here and imported everywhere. The backend spec's
 * §8.3 warns that two divergent copies of an enum is the most reliable way
 * to ship a production-only bug. When the real API lands, generate this file
 * from the backend validation schemas.
 */

export const APPOINTMENT_STATUS = [
  "booked",
  "confirmed",
  "arrived",
  "inchair",
  "done",
  "cancelled",
  "noshow",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];

export const LEAD_STAGE = ["new", "contacted", "consult", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGE)[number];

export const URGENCY = ["High", "Moderate", "Routine"] as const;
export type Urgency = (typeof URGENCY)[number];

export const USER_ROLE = [
  "owner",
  "admin",
  "doctor",
  "receptionist",
  "assistant",
  "accountant",
  "lab_technician",
] as const;
export type UserRole = (typeof USER_ROLE)[number];

export const TOOTH_CONDITION = [
  "healthy",
  "caries",
  "restored",
  "missing",
  "implant",
  "rct",
  "crown",
  "planned",
  "extraction-advised",
] as const;
export type ToothCondition = (typeof TOOTH_CONDITION)[number];

/** Appointment flag chips shown on cards / list rows. */
export type ApptFlag = "new" | "due" | "consent" | "lead" | "rem";
