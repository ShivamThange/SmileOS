/*
 * Cross-cutting constants (spec Part 0 / Part 3). Business rules that are
 * referenced from multiple layers live here so they have one definition.
 */

/** Asia/Kolkata is fixed for this product (spec 2.1). */
export const CLINIC_TIMEZONE = "Asia/Kolkata";
export const CURRENCY = "INR";

/** Token audiences keep a patient token from ever addressing a Console endpoint (spec 3.2). */
export const TOKEN_AUDIENCE = {
  staff: "dentalos-staff",
  patient: "dentalos-patient",
} as const;
export type TokenAudience = (typeof TOKEN_AUDIENCE)[keyof typeof TOKEN_AUDIENCE];

/** Clinical notes lock after this window; afterwards only append-only amendments (spec 2.4). */
export const CLINICAL_NOTE_LOCK_HOURS = 24;

/** OTP hardening (spec 3.1). */
export const OTP = {
  length: 6,
  maxVerifyAttempts: 5,
  requestsPerEmailPer15Min: 3,
  requestsPerIpPerHour: 10,
};

/** Recovery worklist staleness window in days — items older drop out of the recoverable pipeline (spec 2.5). */
export const RECOVERY_STALENESS_DAYS = 120;

/** Quiet hours for outbound patient messaging, local clinic time (spec 2.8). Mandatory. */
export const QUIET_HOURS = { start: 21, end: 8 };

/** Default appointment scheduling parameters (overridable per clinic). */
export const SCHEDULING = {
  slotGranularityMinutes: 15,
  defaultDurationMinutes: 30,
  bufferMinutes: 5,
  onlineBookingMinLeadMinutes: 120,
};
