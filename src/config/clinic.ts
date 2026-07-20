/*
 * Clinic config — loaded once at boot. In production this comes from
 * GET /clinic and drives theming + feature flags. Rebranding for a new
 * clinic is a change to this object (and the brand tokens), never a code fork.
 */

export interface ClinicFeatures {
  publicSite: boolean;
  onlineBooking: boolean;
  costCalculator: boolean;
  patientPortal: boolean;
  whatsapp: boolean;
  payments: boolean;
  inventory: boolean;
  labTracking: boolean;
  multiDoctor: boolean;
  reviewRequests: boolean;
  recallEngine: boolean;
  insuranceClaims: boolean;
}

export interface ClinicConfig {
  id: string;
  name: string;
  shortInitial: string;
  branch: string;
  locality: string;
  city: string;
  timezone: string;
  currency: string;
  ownerName: string;
  features: ClinicFeatures;
}

export const clinicConfig: ClinicConfig = {
  id: "clinic_meher",
  name: "Meher Dental Care",
  shortInitial: "M",
  branch: "Aundh branch",
  locality: "Aundh",
  city: "Pune",
  timezone: "Asia/Kolkata",
  currency: "INR",
  ownerName: "Dr. Anjali Meher",
  features: {
    publicSite: true,
    onlineBooking: true,
    costCalculator: true,
    patientPortal: true,
    whatsapp: true,
    payments: true,
    inventory: true,
    labTracking: true,
    multiDoctor: true,
    reviewRequests: true,
    recallEngine: true,
    insuranceClaims: false,
  },
};

/** The date the prototype is anchored to (matches the seeded mock data). */
export const TODAY_LABEL = "Mon, 20 Jul 2026";
