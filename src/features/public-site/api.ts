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
