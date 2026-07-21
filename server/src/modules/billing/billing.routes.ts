import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/http";
import { ok, created } from "../../shared/envelope";
import { paginate } from "../../shared/list";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import { recordAudit } from "../../services/audit.service";
import { InvoiceModel, PaymentModel, ExpenseModel } from "../../models/billing.model";
import * as svc from "./billing.service";
import { createOrder, verifyCheckoutSignature } from "../../services/payment.service";
import { errors } from "../../shared/errors";

/*
 * Billing routes (spec 4.8). Invoices, payments (offline record; gateway flows
 * are stubbed in the payment service/webhook), pending receivables, expenses.
 * The invoice detail always returns a server-computed balance.
 */
const guard = [requireDb, authenticate(), resolveTenant] as const;

const paymentSchema = z.object({
  invoice: z.string().optional(),
  patient: z.string(),
  amountPaise: z.number().int().positive(),
  mode: z.enum(["cash", "upi", "card", "netbanking", "cheque", "bank_transfer", "gateway", "wallet", "insurance"]),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});
const expenseSchema = z.object({
  category: z.string(), vendor: z.string().optional(), description: z.string().optional(),
  amountPaise: z.number().int().nonnegative(), mode: z.string().optional(), date: z.coerce.date().optional(),
});

/* Invoices */
export const invoiceRouter = Router();
invoiceRouter.use(...guard);
invoiceRouter.get("/", authorize("invoice", "read"), asyncHandler((req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.patient) filter.patient = req.query.patient;
  return paginate(req, res, InvoiceModel, filter, { defaultSort: "date", populate: ["patient"] });
}));
invoiceRouter.post("/", authorize("invoice", "create"), asyncHandler(async (req, res) => {
  const invoice = await svc.createInvoice(req.clinicId!, req.auth!.userId, req.body);
  recordAudit(req, { action: "invoice.create", resourceType: "invoice", resourceId: String(invoice._id), patient: invoice.patient });
  return created(res, invoice, "Invoice created");
}));
invoiceRouter.get("/:id", authorize("invoice", "read"), asyncHandler(async (req, res) => ok(res, await svc.invoiceWithBalance(req.clinicId!, req.params.id))));

/* Payments */
export const paymentRouter = Router();
paymentRouter.use(...guard);
paymentRouter.get("/", authorize("payment", "read"), asyncHandler((req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.patient) filter.patient = req.query.patient;
  return paginate(req, res, PaymentModel, filter, { defaultSort: "date", populate: ["patient"] });
}));
paymentRouter.post("/", authorize("payment", "create"), validate({ body: paymentSchema }), asyncHandler(async (req, res) => {
  const payment = await svc.recordPayment(req.clinicId!, req.auth!.userId, req.body);
  recordAudit(req, { action: "payment.create", resourceType: "payment", resourceId: String((payment as { _id: unknown })._id), patient: req.body.patient });
  return created(res, payment, "Payment recorded");
}));
paymentRouter.get("/daily-summary", authorize("payment", "read"), asyncHandler(async (req, res) =>
  ok(res, await svc.dailySummary(req.clinicId!, req.query.date ? new Date(String(req.query.date)) : undefined))));

// Gateway checkout (spec 5.3): create an order, then verify the returned
// signature. The webhook remains the authoritative status; verify only unblocks
// the UI. A pending payment row is created on order and confirmed by the webhook.
paymentRouter.post("/create-order", authorize("payment", "create"), validate({ body: z.object({ invoice: z.string(), amountPaise: z.number().int().positive(), patient: z.string() }) }), asyncHandler(async (req, res) => {
  const order = await createOrder(req.body.amountPaise, req.body.invoice);
  await PaymentModel.create({ clinicId: req.clinicId, invoice: req.body.invoice, patient: req.body.patient, amountPaise: req.body.amountPaise, mode: "gateway", status: "pending", gateway: { orderId: order.orderId }, createdBy: req.auth!.userId });
  return created(res, order, "Order created");
}));
paymentRouter.post("/verify", authorize("payment", "create"), validate({ body: z.object({ orderId: z.string(), paymentId: z.string(), signature: z.string() }) }), asyncHandler(async (req, res) => {
  const valid = verifyCheckoutSignature(req.body.orderId, req.body.paymentId, req.body.signature);
  if (!valid) throw errors.internal("Signature verification failed");
  return ok(res, { verified: true, note: "Final status is confirmed by webhook" });
}));

/* Expenses */
export const expenseRouter = Router();
expenseRouter.use(...guard);
expenseRouter.get("/", authorize("expense", "read"), asyncHandler((req, res) => paginate(req, res, ExpenseModel, {}, { defaultSort: "date" })));
expenseRouter.post("/", authorize("expense", "create"), validate({ body: expenseSchema }), asyncHandler(async (req, res) => {
  const expense = await ExpenseModel.create({ ...req.body, clinicId: req.clinicId, paidBy: req.auth!.userId, createdBy: req.auth!.userId });
  return created(res, expense, "Expense recorded");
}));

/* Pending payments — mounted under /revenue by the aggregator too */
export async function pendingPaymentsHandler(req: import("express").Request, res: import("express").Response): Promise<import("express").Response> {
  return ok(res, await svc.pendingPayments(req.clinicId!));
}
