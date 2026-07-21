import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin, type BaseFields } from "./plugins/base-fields";
import { INVOICE_STATUS, PAYMENT_MODES, PAYMENT_STATUS } from "../shared/enums";

/*
 * Billing domain (spec 2.6). Money is paise. amountPaid and balance are
 * computed projections, never authoritative mutable fields — payments are the
 * source of truth (Part 0 rule 4).
 */

const invoiceLineSchema = new Schema({
  procedure: { type: Schema.Types.ObjectId, ref: "Procedure" },
  description: String,
  teeth: [Number],
  quantity: { type: Number, default: 1 },
  unitPricePaise: { type: Number, default: 0 },
  discountPaise: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0 },
  lineTotalPaise: { type: Number, default: 0 },
  performingDoctor: { type: Schema.Types.ObjectId, ref: "User" }, // enables doctor-wise production reporting
  planItem: { type: Schema.Types.ObjectId, ref: "TreatmentPlanItem" },
}, { _id: true });

const invoiceSchema = new Schema({
  invoiceNumber: { type: String, required: true },
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  familyBilling: { type: Schema.Types.ObjectId, ref: "FamilyGroup" },
  date: { type: Date, default: Date.now },
  dueDate: Date,
  lines: [invoiceLineSchema],
  subtotalPaise: { type: Number, default: 0 },
  discountPaise: { type: Number, default: 0 },
  discountReason: String,
  discountApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
  taxPaise: { type: Number, default: 0 },
  totalPaise: { type: Number, default: 0 },
  status: { type: String, enum: INVOICE_STATUS, default: "unpaid", index: true },
  appointments: [{ type: Schema.Types.ObjectId, ref: "Appointment" }],
  treatmentPlan: { type: Schema.Types.ObjectId, ref: "TreatmentPlan" },
  notes: String,
  terms: String,
  pdfKey: String,
  dispatch: [{ channel: String, sentAt: Date }],
});

invoiceSchema.plugin(baseFieldsPlugin);
invoiceSchema.index({ clinicId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ clinicId: 1, status: 1, dueDate: 1 });
invoiceSchema.index({ clinicId: 1, patient: 1 });

export type Invoice = InferSchemaType<typeof invoiceSchema> & BaseFields;
export type InvoiceDoc = HydratedDocument<Invoice>;
export const InvoiceModel = model<Invoice>("Invoice", invoiceSchema);

/* ------------------------------------------------------------------ Payment */

const paymentSchema = new Schema({
  invoice: { type: Schema.Types.ObjectId, ref: "Invoice", index: true }, // nullable for advances
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  amountPaise: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  mode: { type: String, enum: PAYMENT_MODES, required: true },
  referenceNumber: String,
  gateway: { orderId: String, paymentId: String, signature: String },
  status: { type: String, enum: PAYMENT_STATUS, default: "success", index: true },
  receivedBy: { type: Schema.Types.ObjectId, ref: "User" },
  receiptNumber: String,
  receiptPdfKey: String,
  notes: String,
  reconciled: { type: Boolean, default: false },
});

paymentSchema.plugin(baseFieldsPlugin);
paymentSchema.index({ clinicId: 1, date: -1 });
paymentSchema.index({ clinicId: 1, invoice: 1 });

export type Payment = InferSchemaType<typeof paymentSchema> & BaseFields;
export type PaymentDoc = HydratedDocument<Payment>;
export const PaymentModel = model<Payment>("Payment", paymentSchema);

/* ------------------------------------------------------------ InstalmentPlan */

const instalmentSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  treatmentPlan: { type: Schema.Types.ObjectId, ref: "TreatmentPlan" },
  invoice: { type: Schema.Types.ObjectId, ref: "Invoice" },
  totalPaise: { type: Number, required: true },
  downPaymentPaise: { type: Number, default: 0 },
  count: { type: Number, default: 3 },
  schedule: [{ sequence: Number, dueDate: Date, amountPaise: Number, status: { type: String, enum: ["pending", "paid", "overdue"], default: "pending" }, payment: { type: Schema.Types.ObjectId, ref: "Payment" }, reminders: [{ sentAt: Date }] }],
  status: { type: String, enum: ["active", "completed", "defaulted", "cancelled"], default: "active" },
  notes: String,
});
instalmentSchema.plugin(baseFieldsPlugin);
instalmentSchema.index({ clinicId: 1, status: 1 });

export type InstalmentPlan = InferSchemaType<typeof instalmentSchema> & BaseFields;
export const InstalmentPlanModel = model<InstalmentPlan>("InstalmentPlan", instalmentSchema);

/* ------------------------------------------------------------------ Expense */

const expenseSchema = new Schema({
  date: { type: Date, default: Date.now },
  category: { type: String, required: true },
  vendor: String,
  supplier: { type: Schema.Types.ObjectId, ref: "Supplier" },
  description: String,
  amountPaise: { type: Number, required: true },
  taxPaise: { type: Number, default: 0 },
  mode: { type: String, enum: PAYMENT_MODES },
  paidBy: { type: Schema.Types.ObjectId, ref: "User" },
  attachmentKey: String,
  recurring: { type: Boolean, default: false },
});
expenseSchema.plugin(baseFieldsPlugin);
expenseSchema.index({ clinicId: 1, date: -1 });

export type Expense = InferSchemaType<typeof expenseSchema> & BaseFields;
export const ExpenseModel = model<Expense>("Expense", expenseSchema);

/* ------------------------------------------------------------------- Refund */

const refundSchema = new Schema({
  payment: { type: Schema.Types.ObjectId, ref: "Payment", required: true },
  patient: { type: Schema.Types.ObjectId, ref: "Patient" },
  amountPaise: { type: Number, required: true },
  reason: String,
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  mode: { type: String, enum: PAYMENT_MODES },
  status: { type: String, enum: ["pending", "processed", "failed"], default: "pending" },
  gatewayRefundId: String,
  date: { type: Date, default: Date.now },
});
refundSchema.plugin(baseFieldsPlugin);
refundSchema.index({ clinicId: 1, date: -1 });

export type Refund = InferSchemaType<typeof refundSchema> & BaseFields;
export const RefundModel = model<Refund>("Refund", refundSchema);

/** Balance is always computed from payments, never stored (Part 0 rule 4). */
export function computeBalance(totalPaise: number, payments: { amountPaise: number; status: string }[]): number {
  const paid = payments.filter((p) => p.status === "success").reduce((s, p) => s + p.amountPaise, 0);
  return totalPaise - paid;
}
