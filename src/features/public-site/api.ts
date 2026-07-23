import { api } from "@/lib/api";

/*
 * Public Site endpoints (spec 4.13). Unauthenticated — the clinic is resolved
 * from the X-Clinic-Slug header the client attaches. These are the only place
 * public URLs are written. An appointment request is a *lead*, not a confirmed
 * booking: it lands in the Console's Growth pipeline for the desk to call back.
 */

export interface AppointmentRequestInput {
  name: string;
  phone: string;
  /** What the visit is about — free text or a picked interest. */
  about?: string;
  /** A rough day the patient prefers ("this Saturday"), refined on callback. */
  preferredDay?: string;
}

/** POST /public/appointment-request → creates a website lead. */
export function requestAppointment(input: AppointmentRequestInput): Promise<{ leadId: string }> {
  return api.post<{ leadId: string }>("/public/appointment-request", input, { skipAuth: true });
}

/** A publicly-visible procedure (GET /public/services) — for the treatments grid. */
export interface PublicService {
  _id: string;
  name: string;
  friendlyName?: string;
  category?: string;
  description?: string;
  defaultPricePaise?: number;
}
export function getPublicServices(): Promise<PublicService[]> {
  return api.get<PublicService[]>("/public/services", { skipAuth: true });
}

/** A doctor with a public profile (GET /public/doctors) — for the dentists section. */
export interface PublicDoctorProfile {
  name: string;
  avatarUrl?: string | null;
  specialisations?: string[];
  qualifications?: string[];
  yearsExperience?: number;
  bio?: string;
  registrationNumber?: string;
}
export function getPublicDoctors(): Promise<PublicDoctorProfile[]> {
  return api.get<PublicDoctorProfile[]>("/public/doctors", { skipAuth: true });
}
