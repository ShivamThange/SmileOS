/*
 * Billing mock data — invoices, payments and expenses. All money in paise, to
 * match the formatter and the rest of the mock layer. Aging buckets are derived
 * off each invoice's balance so the Pending payments screen and the dashboard
 * agree on the same numbers.
 */

export type InvoiceStatus = "paid" | "partial" | "unpaid" | "overdue";

export interface Invoice {
  id: string;
  no: string;
  patientId: string;
  patient: string;
  date: string;
  ageDays: number;
  summary: string;
  totalPaise: number;
  paidPaise: number;
  status: InvoiceStatus;
}

export type PayMethod = "UPI" | "Card" | "Cash" | "Net-banking";

export interface Payment {
  id: string;
  date: string;
  time: string;
  patient: string;
  method: PayMethod;
  amountPaise: number;
  against: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  vendor: string;
  note: string;
  amountPaise: number;
}

const rs = (r: number) => r * 100;

export const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; bg: string; color: string; border: string }> = {
  paid: { label: "Paid", bg: "#EAF1EE", color: "#20614E", border: "#C7DAD1" },
  partial: { label: "Part-paid", bg: "#FAF3E7", color: "#8A6B33", border: "#E5D2AC" },
  unpaid: { label: "Unpaid", bg: "#F4F3EF", color: "#6E6C64", border: "#E6E4DE" },
  overdue: { label: "Overdue", bg: "#FBEFED", color: "#A8342A", border: "#EFC7C2" },
};

export const invoices: Invoice[] = [
  { id: "in1", no: "INV-2607", patientId: "p1", patient: "Ramesh Iyer", date: "20 Jul", ageDays: 0, summary: "Deep clean & filling", totalPaise: rs(6500), paidPaise: rs(6500), status: "paid" },
  { id: "in2", no: "INV-2606", patientId: "p2", patient: "Sunita Deshmukh", date: "18 Jul", ageDays: 2, summary: "CBCT scan & consultation", totalPaise: rs(4000), paidPaise: rs(0), status: "unpaid" },
  { id: "in3", no: "INV-2605", patientId: "p4", patient: "Preeti Nair", date: "15 Jul", ageDays: 5, summary: "Aligner records & setup", totalPaise: rs(12000), paidPaise: rs(6000), status: "partial" },
  { id: "in4", no: "INV-2601", patientId: "p6", patient: "Fatima Sheikh", date: "28 Jun", ageDays: 22, summary: "Implant placement (stage 1)", totalPaise: rs(78000), paidPaise: rs(40000), status: "partial" },
  { id: "in5", no: "INV-2588", patientId: "p3", patient: "Amit Kulkarni", date: "2 Jun", ageDays: 48, summary: "Root canal, tooth 26", totalPaise: rs(8500), paidPaise: rs(0), status: "overdue" },
  { id: "in6", no: "INV-2599", patientId: "p5", patient: "Vikram Rao", date: "24 Jun", ageDays: 26, summary: "Smile design mock-up", totalPaise: rs(8000), paidPaise: rs(3750), status: "overdue" },
  { id: "in7", no: "INV-2604", patientId: "p2", patient: "Sunita Deshmukh", date: "12 Jul", ageDays: 8, summary: "Scaling & polishing", totalPaise: rs(1800), paidPaise: rs(1800), status: "paid" },
];

export const payments: Payment[] = [
  { id: "pm1", date: "20 Jul", time: "10:24", patient: "Ramesh Iyer", method: "UPI", amountPaise: rs(6500), against: "INV-2607" },
  { id: "pm2", date: "20 Jul", time: "12:10", patient: "Preeti Nair", method: "Card", amountPaise: rs(6000), against: "INV-2605" },
  { id: "pm3", date: "19 Jul", time: "16:38", patient: "Fatima Sheikh", method: "Net-banking", amountPaise: rs(40000), against: "INV-2601" },
  { id: "pm4", date: "18 Jul", time: "11:02", patient: "Sunita Deshmukh", method: "Cash", amountPaise: rs(1800), against: "INV-2604" },
  { id: "pm5", date: "17 Jul", time: "18:20", patient: "Vikram Rao", method: "UPI", amountPaise: rs(3750), against: "INV-2599" },
  { id: "pm6", date: "16 Jul", time: "09:45", patient: "Aarav Menon", method: "UPI", amountPaise: rs(2200), against: "INV-2603" },
];

export const expenses: Expense[] = [
  { id: "ex1", date: "19 Jul", category: "Lab", vendor: "Precision Dental Lab", note: "Zirconia crowns × 4", amountPaise: rs(9200) },
  { id: "ex2", date: "18 Jul", category: "Consumables", vendor: "DentMart Supplies", note: "Composite, burs, gloves", amountPaise: rs(14800) },
  { id: "ex3", date: "16 Jul", category: "Rent", vendor: "Westend Centre", note: "Clinic rent — July", amountPaise: rs(85000) },
  { id: "ex4", date: "15 Jul", category: "Salaries", vendor: "Payroll", note: "Front desk & assistants", amountPaise: rs(142000) },
  { id: "ex5", date: "12 Jul", category: "Equipment", vendor: "Osstem India", note: "Implant kit servicing", amountPaise: rs(18500) },
  { id: "ex6", date: "10 Jul", category: "Marketing", vendor: "Google Ads", note: "Local campaign — July", amountPaise: rs(22000) },
];

export function invoiceBalance(inv: Invoice): number {
  return inv.totalPaise - inv.paidPaise;
}

/** Receivables split into <30d and 30d+ aging buckets (paise). */
export function receivablesAging() {
  const outstanding = invoices.filter((i) => invoiceBalance(i) > 0);
  const under30 = outstanding.filter((i) => i.ageDays < 30).reduce((s, i) => s + invoiceBalance(i), 0);
  const over30 = outstanding.filter((i) => i.ageDays >= 30).reduce((s, i) => s + invoiceBalance(i), 0);
  return { under30, over30, total: under30 + over30, count: outstanding.length, outstanding };
}
