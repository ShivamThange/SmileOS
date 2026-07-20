import type { AppointmentStatus, ApptFlag, LeadStage, Urgency } from "@/types/enums";

/*
 * The clinical-status colour model — fixed across brands (a tooth's or
 * appointment's meaning must not change because a clinic rebranded). Values
 * are hex, applied inline where Tailwind tokens can't express the exact mix.
 */

export interface StatusStyle {
  bg: string;
  border: string;
  color: string;
  sub: string;
  label: string;
  labelColor: string;
  hatch?: boolean;
}

export const appointmentStatusStyle: Record<AppointmentStatus, StatusStyle> = {
  booked: { bg: "#FFFFFF", border: "#DDDBD3", color: "#21201C", sub: "#6E6C64", label: "Booked", labelColor: "#6E6C64" },
  confirmed: { bg: "#EAF1EE", border: "#C7DAD1", color: "#21201C", sub: "#5B7A6E", label: "Confirmed", labelColor: "#20614E" },
  arrived: { bg: "#FAF3E7", border: "#E5D2AC", color: "#21201C", sub: "#8A6B33", label: "Arrived", labelColor: "#9A6215" },
  inchair: { bg: "#20614E", border: "#17493A", color: "#F7F6F3", sub: "#BFD5CC", label: "In the chair", labelColor: "#CBDDD5" },
  done: { bg: "#F4F3EF", border: "#E6E4DE", color: "#98968C", sub: "#B0AEA4", label: "Done", labelColor: "#98968C" },
  cancelled: { bg: "transparent", border: "#E6E4DE", color: "#98968C", sub: "#B0AEA4", label: "Cancelled", labelColor: "#98968C", hatch: true },
  noshow: { bg: "#FBEFED", border: "#EFC7C2", color: "#21201C", sub: "#B07770", label: "No-show", labelColor: "#A8342A" },
};

export interface ChipStyle {
  bg: string;
  color: string;
  border: string;
}

export function urgencyStyle(u: Urgency): ChipStyle {
  if (u === "High") return { bg: "#FBEFED", color: "#A8342A", border: "#EFC7C2" };
  if (u === "Moderate") return { bg: "#FAF3E7", color: "#9A6215", border: "#EBD9BC" };
  return { bg: "#F4F3EF", color: "#6E6C64", border: "#E6E4DE" };
}

export const flagLabel: Record<ApptFlag, string> = {
  new: "NEW",
  due: "₹ DUE",
  consent: "CONSENT",
  lead: "LEAD",
  rem: "✓ REMINDED",
};

export interface LeadStageDef {
  id: LeadStage;
  label: string;
  accent: string;
}

export const leadStages: LeadStageDef[] = [
  { id: "new", label: "New enquiry", accent: "#9A6215" },
  { id: "contacted", label: "Contacted", accent: "#2E6DA4" },
  { id: "consult", label: "Consult booked", accent: "#7A4C8A" },
  { id: "won", label: "Converted", accent: "#20614E" },
  { id: "lost", label: "Lost", accent: "#98968C" },
];

/** Mono single-hue ramp used across bar/segment charts. */
export const chartGreens = ["#20614E", "#4E8A75", "#8FB5A6", "#CBDDD5", "#D4E0DA"];
