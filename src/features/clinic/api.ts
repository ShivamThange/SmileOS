import { api } from "@/lib/api";

/*
 * Clinic endpoints. Public reads resolve the clinic from the X-Clinic-Slug
 * header (attached by the client); authenticated reads resolve it from the token.
 * These typed functions are the ONLY place clinic URLs are written.
 */

export interface ClinicBranding {
  primary: string;
  primaryHover: string;
  canvas: string;
  fontSans: string;
  fontSerif: string;
}

export interface ClinicAddress {
  line1?: string;
  line2?: string;
  locality?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface WorkingDay {
  day: number;
  open: string;
  close: string;
  closed?: boolean;
}

/** The public clinic profile (GET /public/clinic) — safe for the Site/Booking. */
export interface PublicClinic {
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  branding: ClinicBranding;
  logoUrl?: string;
  address?: ClinicAddress;
  geo?: { lat: number; lng: number };
  phones?: string[];
  email?: string;
  social?: Record<string, string>;
  workingHours?: WorkingDay[];
  holidays?: { date: string; label?: string }[];
}

/** Public clinic profile — no auth; used by the Site, Calculator and Booking. */
export function getPublicClinic(): Promise<PublicClinic> {
  return api.get<PublicClinic>("/public/clinic", { skipAuth: true });
}

/** Authenticated clinic config for the Console (resolved from the token). */
export function getClinic(): Promise<PublicClinic> {
  return api.get<PublicClinic>("/clinic");
}

/** Clinic feature flags (GET /clinic/features) — drives nav + route gating. */
export function getClinicFeatures(): Promise<Record<string, boolean>> {
  return api.get<Record<string, boolean>>("/clinic/features");
}

/** Update clinic branding (PATCH /clinic/branding). Requires settings:update. */
export function updateClinicBranding(branding: Partial<ClinicBranding>): Promise<ClinicBranding> {
  return api.patch<ClinicBranding>("/clinic/branding", branding);
}

/** Update clinic profile fields (PATCH /clinic). Requires settings:update. */
export function updateClinic(patch: Record<string, unknown>): Promise<PublicClinic> {
  return api.patch<PublicClinic>("/clinic", patch);
}

/** Toggle clinic feature flags (PATCH /clinic/features). Requires settings:update. */
export function updateClinicFeatures(features: Record<string, boolean>): Promise<Record<string, boolean>> {
  return api.patch<Record<string, boolean>>("/clinic/features", features);
}
