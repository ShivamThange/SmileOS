/*
 * Frontend enum surface.
 *
 * Every enum that crosses the API boundary is re-exported from the generated
 * backend mirror (`@/shared/enums`, synced from `server/src/shared/enums.ts`),
 * which is the SINGLE SOURCE OF TRUTH (spec §8.3 — "two divergent copies of an
 * enum is the most reliable way to ship a production-only bug"). Do not redefine
 * these here; run `npm run sync:enums` to refresh the mirror.
 *
 * Only genuinely UI-only vocabularies with no backend equivalent live below.
 */

export {
  APPOINTMENT_STATUS,
  APPOINTMENT_TRANSITIONS,
  APPOINTMENT_TYPES,
  APPOINTMENT_SOURCES,
  USER_ROLES,
  LEAD_STAGES,
  LEAD_SOURCES,
  PLAN_STATUS,
  PLAN_ITEM_STATUS,
  PLAN_ITEM_PRIORITY,
  INVOICE_STATUS,
  PAYMENT_MODES,
  PAYMENT_STATUS,
  RECALL_TYPES,
  RECALL_STATUS,
  TOOTH_CONDITIONS,
  SURFACES,
  LAB_STATUS,
} from "@/shared/enums";

export type {
  AppointmentStatus,
  AppointmentType,
  AppointmentSource,
  UserRole,
  LeadStage,
  LeadSource,
  PlanStatus,
  PlanItemStatus,
  PlanItemPriority,
  InvoiceStatus,
  PaymentMode,
  PaymentStatus,
  RecallType,
  RecallStatus,
  ToothCondition,
  Surface,
  LabStatus,
} from "@/shared/enums";

/* ── UI-only vocabularies (no backend equivalent) ─────────────────────────── */

/** Triage level shown on recovery/recall chips — a presentation grouping, not a
 * persisted field. */
export const URGENCY = ["High", "Moderate", "Routine"] as const;
export type Urgency = (typeof URGENCY)[number];

/** Appointment flag chips shown on cards / list rows. */
export type ApptFlag = "new" | "due" | "consent" | "lead" | "rem";
