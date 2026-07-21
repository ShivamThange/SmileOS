/*
 * Operations mock data — inventory, lab tracking and suppliers. Money in paise.
 */

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  reorderAt: number;
  expiry: string;
  expiryDays: number;
  valuePaise: number;
}

export const inventory: InventoryItem[] = [
  { id: "iv1", name: "Composite resin A2", category: "Restorative", stock: 4, unit: "syringes", reorderAt: 6, expiry: "Nov 2026", expiryDays: 120, valuePaise: 320000 },
  { id: "iv2", name: "Lidocaine 2% cartridges", category: "Anaesthetic", stock: 38, unit: "cartridges", reorderAt: 20, expiry: "Mar 2027", expiryDays: 240, valuePaise: 152000 },
  { id: "iv3", name: "Nitrile gloves (M)", category: "PPE", stock: 2, unit: "boxes", reorderAt: 5, expiry: "—", expiryDays: 999, valuePaise: 90000 },
  { id: "iv4", name: "Osstem implant TS III 4.0", category: "Implants", stock: 7, unit: "units", reorderAt: 4, expiry: "Jan 2028", expiryDays: 540, valuePaise: 1260000 },
  { id: "iv5", name: "Impression material (VPS)", category: "Impression", stock: 9, unit: "cartridges", reorderAt: 6, expiry: "Aug 2026", expiryDays: 28, valuePaise: 234000 },
  { id: "iv6", name: "Fluoride varnish", category: "Preventive", stock: 3, unit: "tubes", reorderAt: 4, expiry: "Sep 2026", expiryDays: 55, valuePaise: 48000 },
];

export function inventoryFlags(i: InventoryItem) {
  return { low: i.stock <= i.reorderAt, nearExpiry: i.expiryDays <= 45 };
}

export type LabStatus = "sent" | "in-lab" | "returning" | "ready" | "overdue";
export interface LabCase {
  id: string;
  patient: string;
  work: string;
  lab: string;
  sent: string;
  due: string;
  status: LabStatus;
}

export const LAB_STATUS_META: Record<LabStatus, { label: string; bg: string; color: string; border: string }> = {
  sent: { label: "Sent", bg: "#F4F3EF", color: "#6E6C64", border: "#E6E4DE" },
  "in-lab": { label: "In lab", bg: "#E8EEF4", color: "#2E6DA4", border: "#C9DAE8" },
  returning: { label: "On the way back", bg: "#EDE3F0", color: "#7A4C8A", border: "#D9C7E0" },
  ready: { label: "Ready to fit", bg: "#EAF1EE", color: "#20614E", border: "#C7DAD1" },
  overdue: { label: "Overdue", bg: "#FBEFED", color: "#A8342A", border: "#EFC7C2" },
};

export const labCases: LabCase[] = [
  { id: "lb1", patient: "Fatima Sheikh", work: "2 zirconia crowns", lab: "Precision Dental Lab", sent: "12 Jul", due: "22 Jul", status: "returning" },
  { id: "lb2", patient: "Sunita Deshmukh", work: "All-on-4 bridge (try-in)", lab: "Precision Dental Lab", sent: "8 Jul", due: "19 Jul", status: "overdue" },
  { id: "lb3", patient: "Amit Kulkarni", work: "Crown, tooth 26", lab: "SmileCraft Lab", sent: "15 Jul", due: "24 Jul", status: "in-lab" },
  { id: "lb4", patient: "Vikram Rao", work: "6 E-max veneers", lab: "Artisan Ceramics", sent: "18 Jul", due: "29 Jul", status: "sent" },
  { id: "lb5", patient: "Kiran Joshi", work: "Night guard", lab: "SmileCraft Lab", sent: "10 Jul", due: "18 Jul", status: "ready" },
];

export interface Supplier {
  id: string;
  name: string;
  kind: string;
  terms: string;
  rating: number;
  outstandingPaise: number;
}

export const suppliers: Supplier[] = [
  { id: "sp1", name: "Precision Dental Lab", kind: "Dental lab", terms: "Net 15", rating: 4.8, outstandingPaise: 920000 },
  { id: "sp2", name: "DentMart Supplies", kind: "Consumables", terms: "Net 30", rating: 4.5, outstandingPaise: 148000 },
  { id: "sp3", name: "Osstem India", kind: "Implants", terms: "Advance", rating: 4.9, outstandingPaise: 0 },
  { id: "sp4", name: "SmileCraft Lab", kind: "Dental lab", terms: "Net 15", rating: 4.2, outstandingPaise: 46000 },
  { id: "sp5", name: "Artisan Ceramics", kind: "Aesthetic lab", terms: "Net 30", rating: 4.7, outstandingPaise: 0 },
];
