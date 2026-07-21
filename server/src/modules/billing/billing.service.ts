import { InvoiceModel, PaymentModel, computeBalance, type InvoiceDoc } from "../../models/billing.model";
import { ClinicModel } from "../../models/clinic.model";
import { nextSeq } from "../../models/counter.model";
import { padSeq } from "../../utils/ids";
import { errors } from "../../shared/errors";

/*
 * Billing service (spec 2.6 / 4.8). Invoice numbers are sequential per clinic
 * per financial year (India: Apr–Mar). Balances/statuses are always derived
 * from payments, never stored as mutable increments (Part 0 rule 4).
 */

function financialYear(d = new Date()): string {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // April = month 3
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export async function allocateInvoiceNumber(clinicId: string): Promise<string> {
  const clinic = await ClinicModel.findById(clinicId).select("numbering").lean();
  const prefix = clinic?.numbering?.invoicePrefix ?? "INV-";
  const width = clinic?.numbering?.invoiceWidth ?? 4;
  const fy = financialYear();
  const seq = await nextSeq(clinicId, `invoice:${fy}`);
  return padSeq(prefix, seq, width);
}

function lineTotal(line: { unitPricePaise?: number; quantity?: number; discountPaise?: number }): number {
  return Math.max(0, (line.unitPricePaise ?? 0) * (line.quantity ?? 1) - (line.discountPaise ?? 0));
}

export async function createInvoice(clinicId: string, actorId: string, input: Record<string, unknown>): Promise<InvoiceDoc> {
  const lines = ((input.lines as Record<string, number>[]) ?? []).map((l) => ({ ...l, lineTotalPaise: lineTotal(l) }));
  const subtotal = lines.reduce((s, l) => s + l.lineTotalPaise, 0);
  const discount = Number(input.discountPaise ?? 0);
  const tax = Number(input.taxPaise ?? 0);
  const total = Math.max(0, subtotal - discount + tax);
  const invoiceNumber = await allocateInvoiceNumber(clinicId);
  return InvoiceModel.create({
    ...input, clinicId, invoiceNumber, lines,
    subtotalPaise: subtotal, discountPaise: discount, taxPaise: tax, totalPaise: total,
    status: "unpaid", createdBy: actorId, updatedBy: actorId,
  });
}

/** Recompute an invoice's status from its payments (spec Part 0 rule 4). */
export async function refreshInvoiceStatus(clinicId: string, invoiceId: string): Promise<void> {
  const invoice = await InvoiceModel.findOne({ _id: invoiceId, clinicId });
  if (!invoice) return;
  const payments = await PaymentModel.find({ clinicId, invoice: invoiceId }).select("amountPaise status").lean();
  const balance = computeBalance(invoice.totalPaise, payments);
  const overdue = invoice.dueDate && invoice.dueDate.getTime() < Date.now();
  invoice.status = balance <= 0 ? "paid" : payments.some((p) => p.status === "success") ? "partial" : overdue ? "overdue" : "unpaid";
  await invoice.save();
}

export async function recordPayment(clinicId: string, actorId: string, input: Record<string, unknown>): Promise<unknown> {
  const payment = await PaymentModel.create({ ...input, clinicId, receivedBy: actorId, status: "success", createdBy: actorId, updatedBy: actorId });
  if (input.invoice) await refreshInvoiceStatus(clinicId, String(input.invoice));
  return payment;
}

export async function invoiceWithBalance(clinicId: string, invoiceId: string): Promise<Record<string, unknown>> {
  const invoice = await InvoiceModel.findOne({ _id: invoiceId, clinicId }).populate("patient", "firstName lastName phone").lean();
  if (!invoice) throw errors.notFound("Invoice");
  const payments = await PaymentModel.find({ clinicId, invoice: invoiceId }).lean();
  return { ...invoice, payments, balancePaise: computeBalance(invoice.totalPaise, payments as { amountPaise: number; status: string }[]) };
}

export async function pendingPayments(clinicId: string): Promise<Record<string, unknown>> {
  const open = await InvoiceModel.find({ clinicId, status: { $in: ["unpaid", "partial", "overdue"] } }).populate("patient", "firstName lastName phone").lean();
  const rows: Record<string, unknown>[] = [];
  let under30 = 0, over30 = 0;
  for (const inv of open) {
    const payments = await PaymentModel.find({ clinicId, invoice: inv._id }).select("amountPaise status").lean();
    const balance = computeBalance(inv.totalPaise, payments);
    if (balance <= 0) continue;
    const ageDays = Math.floor((Date.now() - new Date(inv.date).getTime()) / 86400000);
    if (ageDays >= 30) over30 += balance; else under30 += balance;
    rows.push({ id: String(inv._id), invoiceNumber: inv.invoiceNumber, patient: inv.patient, totalPaise: inv.totalPaise, balancePaise: balance, ageDays, date: inv.date });
  }
  rows.sort((a, b) => (b.ageDays as number) - (a.ageDays as number));
  return { rows, under30Paise: under30, over30Paise: over30, totalPaise: under30 + over30, count: rows.length };
}

export async function dailySummary(clinicId: string, day = new Date()): Promise<Record<string, unknown>> {
  const start = new Date(day); start.setHours(0, 0, 0, 0);
  const end = new Date(day); end.setHours(23, 59, 59, 999);
  const payments = await PaymentModel.find({ clinicId, date: { $gte: start, $lte: end }, status: "success" }).select("amountPaise mode").lean();
  const byMode: Record<string, number> = {};
  let total = 0;
  for (const p of payments) { byMode[p.mode] = (byMode[p.mode] ?? 0) + p.amountPaise; total += p.amountPaise; }
  return { date: start, totalPaise: total, byMode, count: payments.length };
}
