import { api } from "@/lib/api";
import type { AppointmentStatus, AppointmentType } from "@/shared/enums";

/*
 * Appointment endpoints (spec 4.5). The calendar reads one payload
 * (/appointments/calendar) — appointments plus the resources and hours that
 * frame the grid — and mutates through create / reschedule / status-transition
 * routes that run the server-side conflict engine. The desk never books mock.
 */

export interface ApiAppointment {
  id: string;
  patientId: string | null;
  patientName: string;
  patientPhone: string | null;
  doctorId: string | null;
  doctorName: string;
  operatory: string | null;
  operatoryLabel: string | null;
  start: string;
  end: string;
  status: AppointmentStatus;
  type: AppointmentType;
  chiefComplaint: string | null;
  colorOverride: string | null;
  noShow: boolean;
}

export interface CalendarResource {
  id: string;
  name: string;
  color?: string;
}

export interface CalendarPayload {
  range: { from: string; to: string };
  appointments: ApiAppointment[];
  operatories: CalendarResource[];
  doctors: { id: string; name: string }[];
  workingHours: { day: number; open: string; close: string; closed?: boolean }[];
  scheduling?: { slotMinutes?: number; bufferMinutes?: number } | null;
}

/** GET /appointments/calendar?from&to — the whole day/range in one payload. */
export function getCalendar(from: Date, to: Date): Promise<CalendarPayload> {
  return api.get<CalendarPayload>("/appointments/calendar", { query: { from: from.toISOString(), to: to.toISOString() } });
}

export interface CreateAppointmentInput {
  patient?: string;
  lead?: string;
  doctor: string;
  operatory?: string;
  operatoryLabel?: string;
  start: string;
  end: string;
  type?: AppointmentType;
  chiefComplaint?: string;
  procedures?: string[];
  notes?: string;
  allowDoctorOverlap?: boolean;
}

/** POST /appointments — books a slot; may 409 CONFLICT_SLOT. */
export function createAppointment(input: CreateAppointmentInput): Promise<ApiAppointment> {
  return api.post<ApiAppointment>("/appointments", input);
}

/** POST /appointments/:id/reschedule — move/resize; may 409 CONFLICT_SLOT. */
export function rescheduleAppointment(id: string, body: { start: string; end: string; operatory?: string; notify?: boolean }): Promise<ApiAppointment> {
  return api.post<ApiAppointment>(`/appointments/${id}/reschedule`, body);
}

/** The status-transition verbs (spec 4.5 state machine). */
export function confirmAppointment(id: string) { return api.post<ApiAppointment>(`/appointments/${id}/confirm`); }
export function checkInAppointment(id: string) { return api.post<ApiAppointment>(`/appointments/${id}/check-in`); }
export function startAppointment(id: string) { return api.post<ApiAppointment>(`/appointments/${id}/start`); }
export function completeAppointment(id: string) { return api.post<ApiAppointment>(`/appointments/${id}/complete`); }
export function cancelAppointment(id: string, reason: string) { return api.post<ApiAppointment>(`/appointments/${id}/cancel`, { reason }); }
export function noShowAppointment(id: string) { return api.post<ApiAppointment>(`/appointments/${id}/no-show`); }
