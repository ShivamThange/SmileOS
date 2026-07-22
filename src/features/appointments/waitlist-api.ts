import { api } from "@/lib/api";

/*
 * Waitlist (spec 4.5) — patients wanting an earlier slot. The desk works freed
 * gaps from here: slot someone in, log a callback, or remove them.
 */

export interface ApiWaitlistEntry {
  id: string;
  name: string;
  phone: string | null;
  desiredTreatment: string;
  preferredDoctor: string | null;
  timeOfDay: string;
  urgency: "high" | "moderate" | "routine";
  contactAttempts: number;
  createdAt: string;
}

export function listWaitlist(): Promise<ApiWaitlistEntry[]> {
  return api.get<ApiWaitlistEntry[]>("/waitlist");
}
export function scheduleWaitlist(id: string): Promise<unknown> {
  return api.post(`/waitlist/${id}/schedule`);
}
export function removeWaitlist(id: string): Promise<unknown> {
  return api.delete(`/waitlist/${id}`);
}
