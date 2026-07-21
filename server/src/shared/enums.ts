/*
 * Shared enums — the single source of truth (spec 8.3). "Two divergent copies
 * of an enum is the most reliable way to ship a bug that only appears in
 * production." The frontend imports these; the backend validates against them.
 */

export const USER_ROLES = ["owner", "admin", "doctor", "receptionist", "assistant", "accountant", "lab_technician"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const AUTH_PROVIDERS = ["otp", "google", "password"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const OTP_PURPOSES = ["login", "registration", "booking", "password_reset", "plan_acceptance"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const PATIENT_STATUS = ["active", "inactive", "archived"] as const;
export type PatientStatus = (typeof PATIENT_STATUS)[number];

export const GENDERS = ["male", "female", "other"] as const;
export type Gender = (typeof GENDERS)[number];

export const APPOINTMENT_STATUS = ["scheduled", "confirmed", "checked_in", "in_progress", "completed", "cancelled", "no_show"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];

/** Valid state transitions (spec 2.3). Terminal branches: cancelled, no_show. */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["confirmed", "checked_in", "cancelled", "no_show"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const APPOINTMENT_TYPES = ["consultation", "treatment", "follow_up", "emergency", "recall", "lab_trial"] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export const APPOINTMENT_SOURCES = ["walk_in", "phone", "online", "portal", "whatsapp", "recall_campaign", "lead_conversion"] as const;
export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];

export const PLAN_STATUS = ["draft", "presented", "partially_accepted", "accepted", "declined", "completed", "expired"] as const;
export type PlanStatus = (typeof PLAN_STATUS)[number];

export const PLAN_ITEM_STATUS = ["proposed", "accepted", "declined", "scheduled", "in_progress", "completed", "cancelled"] as const;
export type PlanItemStatus = (typeof PLAN_ITEM_STATUS)[number];

export const PLAN_ITEM_PRIORITY = ["urgent", "recommended", "elective"] as const;
export type PlanItemPriority = (typeof PLAN_ITEM_PRIORITY)[number];

export const INVOICE_STATUS = ["draft", "unpaid", "partial", "paid", "overdue", "cancelled", "refunded"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export const PAYMENT_MODES = ["cash", "upi", "card", "netbanking", "cheque", "bank_transfer", "gateway", "wallet", "insurance"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_STATUS = ["pending", "success", "failed", "refunded", "partially_refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const LEAD_STAGES = ["new", "contacted", "consult", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_SOURCES = ["website", "calculator", "booking_abandon", "phone", "walk_in", "google", "instagram", "facebook", "referral", "listing", "campaign"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const RECALL_TYPES = ["hygiene", "ortho", "implant_review", "post_op", "denture_review", "custom"] as const;
export type RecallType = (typeof RECALL_TYPES)[number];

export const RECALL_STATUS = ["pending", "contacted", "scheduled", "completed", "declined", "lapsed"] as const;
export type RecallStatus = (typeof RECALL_STATUS)[number];

export const TOOTH_PRESENCE = ["present", "missing", "unerupted", "extracted", "impacted"] as const;
export type ToothPresence = (typeof TOOTH_PRESENCE)[number];

export const TOOTH_CONDITIONS = ["caries", "filled", "crown", "rct", "implant", "missing", "wear", "bridge_abutment", "bridge_pontic", "veneer", "planned"] as const;
export type ToothCondition = (typeof TOOTH_CONDITIONS)[number];

export const SURFACES = ["mesial", "distal", "buccal", "lingual", "occlusal"] as const;
export type Surface = (typeof SURFACES)[number];

export const LAB_STATUS = ["impression", "sent", "in_progress", "trial", "remake", "received", "fitted", "cancelled"] as const;
export type LabStatus = (typeof LAB_STATUS)[number];

export const PROCEDURE_CATEGORIES = ["preventive", "restorative", "endodontic", "periodontal", "oral_surgery", "prosthodontic", "orthodontic", "pedodontic", "implant", "cosmetic"] as const;
export type ProcedureCategory = (typeof PROCEDURE_CATEGORIES)[number];

export const PRICE_TIERS = ["standard", "premium", "luxury"] as const;
export type PriceTier = (typeof PRICE_TIERS)[number];

export const CHANNELS = ["whatsapp", "sms", "email"] as const;
export type Channel = (typeof CHANNELS)[number];

export const MESSAGE_STATUS = ["queued", "sent", "delivered", "read", "failed"] as const;
export type MessageStatus = (typeof MESSAGE_STATUS)[number];

export const CAMPAIGN_TYPES = ["recall", "reactivation", "recovery", "promotional", "review_request", "birthday", "festival"] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

/** RBAC resources and actions (spec 3.4). */
export const RESOURCES = ["patient", "medical_history", "appointment", "chart", "clinical_note", "prescription", "treatment_plan", "invoice", "payment", "refund", "expense", "lead", "campaign", "message", "inventory", "lab_case", "staff", "settings", "analytics", "audit_log"] as const;
export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ["create", "read", "update", "delete", "export", "approve"] as const;
export type Action = (typeof ACTIONS)[number];
