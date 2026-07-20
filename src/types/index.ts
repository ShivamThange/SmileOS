import type { AppointmentStatus, ApptFlag, LeadStage, Urgency } from "./enums";

export interface Patient {
  id: string;
  name: string;
  pno: string; // human-readable patient number
  agesex: string; // "52 M"
  phone: string;
  balancePaise: number;
  ltvPaise: number;
  alert: string; // medical alert, empty if none
  lastVisit: string;
  nextVisit: string;
  timeline: { date: string; text: string }[];
}

export interface Appointment {
  id: string;
  chair: string;
  doctor: string;
  name: string;
  agesex: string;
  proc: string;
  start: number; // decimal hour
  dur: number; // decimal hours
  status: AppointmentStatus;
  flags: ApptFlag[];
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string;
  interest: string;
  valuePaise: number;
  age: string;
  stage: LeadStage;
  followUp: string;
}

/** A treatment-plan line item as it appears in the recovery worklist. */
export interface RecoveryRow {
  id: string;
  patientId: string;
  proc: string;
  tooth: string;
  type: string;
  valuePaise: number;
  planned: string;
  ago: string;
  urgency: Urgency;
  doctor: string;
  lastContact: string;
  lastSub: string;
  due: string; // "today" | "overdue" | a date string
  dueText?: string;
  finding: string;
  reason: string;
  declined?: boolean;
}

export interface WaitlistEntry {
  name: string;
  want: string;
  since: string;
}
