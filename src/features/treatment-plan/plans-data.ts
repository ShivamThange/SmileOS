/*
 * Treatment-plan mock records for the Console side (list + builder). Values are
 * in paise, consistent with the rest of the mock data and the money formatter.
 * The patient-facing present view (/plan) renders the seeded "Ramesh" plan;
 * these drive the staff worklist of plans across every acceptance state.
 */

export type PlanStatus = "draft" | "presented" | "accepted" | "partial" | "declined";

export interface PlanItem {
  name: string;
  pricePaise: number;
}
export interface PlanStage {
  title: string;
  when: string;
  items: PlanItem[];
}
export interface TreatmentPlan {
  id: string;
  patientId: string;
  patient: string;
  title: string;
  status: PlanStatus;
  discountPct: number;
  updated: string;
  presentedOn?: string;
  doctor: string;
  stages: PlanStage[];
}

export const PLAN_STATUS_META: Record<PlanStatus, { label: string; bg: string; color: string; border: string }> = {
  draft: { label: "Draft", bg: "#F4F3EF", color: "#6E6C64", border: "#E6E4DE" },
  presented: { label: "Presented", bg: "#FAF3E7", color: "#8A6B33", border: "#E5D2AC" },
  accepted: { label: "Accepted", bg: "#EAF1EE", color: "#20614E", border: "#C7DAD1" },
  partial: { label: "Partly accepted", bg: "#EDE3F0", color: "#7A4C8A", border: "#D9C7E0" },
  declined: { label: "Declined", bg: "#FBEFED", color: "#A8342A", border: "#EFC7C2" },
};

const rs = (rupees: number) => rupees * 100;

export const treatmentPlans: TreatmentPlan[] = [
  {
    id: "tp1",
    patientId: "p1",
    patient: "Ramesh Iyer",
    title: "Implant, gum treatment & finishing caps",
    status: "presented",
    discountPct: 10,
    updated: "20 Jul",
    presentedOn: "20 Jul 2026",
    doctor: "Dr. Meher",
    stages: [
      { title: "Getting the foundation right", when: "Now · one visit", items: [
        { name: "Deep clean & gum treatment", pricePaise: rs(4500) },
        { name: "One filling, lower right", pricePaise: rs(2000) },
      ] },
      { title: "Replacing the missing tooth", when: "In 2–3 weeks", items: [
        { name: "Single tooth implant, lower left", pricePaise: rs(42000) },
      ] },
      { title: "The finishing caps", when: "In about 3 months", items: [
        { name: "Cap on the new implant", pricePaise: rs(18000) },
        { name: "Cap on the cracked tooth, upper right", pricePaise: rs(24000) },
      ] },
    ],
  },
  {
    id: "tp2",
    patientId: "p2",
    patient: "Sunita Deshmukh",
    title: "Full-arch rehabilitation (upper)",
    status: "accepted",
    discountPct: 8,
    updated: "18 Jul",
    presentedOn: "16 Jul 2026",
    doctor: "Dr. Meher",
    stages: [
      { title: "Extractions & grafting", when: "Now", items: [
        { name: "Extraction of 3 mobile teeth", pricePaise: rs(9000) },
        { name: "Bone graft, upper right", pricePaise: rs(16000) },
      ] },
      { title: "Implant placement", when: "In 6 weeks", items: [
        { name: "4 implants (All-on-4)", pricePaise: rs(180000) },
      ] },
      { title: "Final bridge", when: "In 4 months", items: [
        { name: "Fixed zirconia bridge", pricePaise: rs(95000) },
      ] },
    ],
  },
  {
    id: "tp3",
    patientId: "p3",
    patient: "Amit Kulkarni",
    title: "Root canal & crown, upper left",
    status: "draft",
    discountPct: 0,
    updated: "19 Jul",
    doctor: "Dr. Kulkarni",
    stages: [
      { title: "Root canal", when: "Now", items: [
        { name: "RCT, tooth 26", pricePaise: rs(8500) },
      ] },
      { title: "Crown", when: "In 2 weeks", items: [
        { name: "Zirconia crown, tooth 26", pricePaise: rs(12000) },
      ] },
    ],
  },
  {
    id: "tp4",
    patientId: "p4",
    patient: "Preeti Nair",
    title: "Clear aligners, full correction",
    status: "partial",
    discountPct: 5,
    updated: "15 Jul",
    presentedOn: "12 Jul 2026",
    doctor: "Dr. Patil",
    stages: [
      { title: "Records & setup", when: "Now", items: [
        { name: "Scans, photos & treatment setup", pricePaise: rs(12000) },
      ] },
      { title: "Aligner therapy", when: "Over 14 months", items: [
        { name: "Clear aligners — full course", pricePaise: rs(148000) },
        { name: "Retainers (upper & lower)", pricePaise: rs(9000) },
      ] },
    ],
  },
  {
    id: "tp5",
    patientId: "p5",
    patient: "Vikram Rao",
    title: "Smile design — 6 veneers",
    status: "declined",
    discountPct: 10,
    updated: "9 Jul",
    presentedOn: "6 Jul 2026",
    doctor: "Dr. Meher",
    stages: [
      { title: "Mock-up & preparation", when: "Now", items: [
        { name: "Digital smile design & mock-up", pricePaise: rs(8000) },
      ] },
      { title: "Veneers", when: "In 3 weeks", items: [
        { name: "6 E-max veneers", pricePaise: rs(84000) },
      ] },
    ],
  },
  {
    id: "tp6",
    patientId: "p6",
    patient: "Fatima Sheikh",
    title: "Two implants, lower right",
    status: "presented",
    discountPct: 7,
    updated: "20 Jul",
    presentedOn: "20 Jul 2026",
    doctor: "Dr. Meher",
    stages: [
      { title: "Implant placement", when: "Now", items: [
        { name: "2 implants, teeth 45 & 46", pricePaise: rs(78000) },
      ] },
      { title: "Crowns", when: "In 3 months", items: [
        { name: "2 zirconia crowns", pricePaise: rs(36000) },
      ] },
    ],
  },
];

/** Gross (paise) before discount. */
export function planGross(plan: TreatmentPlan): number {
  return plan.stages.reduce((sum, st) => sum + st.items.reduce((s, it) => s + it.pricePaise, 0), 0);
}
/** Net (paise) after the plan discount. */
export function planNet(plan: TreatmentPlan): number {
  const gross = planGross(plan);
  return gross - Math.round((gross * plan.discountPct) / 100);
}

export function findPlan(id: string): TreatmentPlan | undefined {
  return treatmentPlans.find((p) => p.id === id);
}
