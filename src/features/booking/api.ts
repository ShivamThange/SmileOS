import { api } from "@/lib/api";

/*
 * Online booking (spec 5.3) — the public conversion flow. Real availability from
 * the clinic's working hours + capacity; a confirmed slot becomes a real
 * appointment, an abandoned one a lead the desk follows up. Unauthenticated; the
 * clinic resolves from the X-Clinic-Slug header the client attaches.
 */

export interface DaySlots {
  date: string; // YYYY-MM-DD
  weekday: number;
  slots: { morning: string[]; afternoon: string[]; evening: string[] };
  count: number;
}

export function getAvailability(params?: { doctor?: string; durationMin?: number; days?: number }): Promise<DaySlots[]> {
  return api.get<DaySlots[]>("/public/availability", { query: { ...params }, skipAuth: true });
}

export interface PublicDoctor {
  name: string;
  slug?: string;
  registrationNumber?: string;
  avatarUrl?: string | null;
  id?: string;
}
export function getPublicDoctors(): Promise<PublicDoctor[]> {
  return api.get<PublicDoctor[]>("/public/doctors", { skipAuth: true });
}

export interface BookInput {
  name: string;
  phone: string;
  email?: string;
  doctor?: string;
  start: string; // ISO
  durationMin?: number;
  treatment?: string;
  note?: string;
}
export interface BookResult {
  appointmentId?: string;
  patientId?: string;
  start?: string;
}
export function bookAppointment(input: BookInput): Promise<BookResult> {
  return api.post<BookResult>("/public/book", input, { skipAuth: true });
}

/** A started-but-not-finished booking becomes a lead so the desk can chase it. */
export function abandonBooking(input: { name: string; phone: string; email?: string; treatment?: string }): Promise<unknown> {
  return api.post("/public/booking/abandon", input, { skipAuth: true });
}
