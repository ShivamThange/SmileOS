import { Router } from "express";
import { asyncHandler } from "../../shared/http";
import { ok } from "../../shared/envelope";
import { authenticatePatient } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { requireDb } from "../../middleware/require-db";
import { errors } from "../../shared/errors";
import { PatientModel, deriveAlerts, MedicalHistoryModel } from "../../models/patient.model";
import { AppointmentModel } from "../../models/appointment.model";
import { TreatmentPlanModel, TreatmentPlanItemModel } from "../../models/treatment-plan.model";
import { RecallModel } from "../../models/recall.model";
import { InvoiceModel } from "../../models/billing.model";
import { computePatientBalance } from "../patient/patient.service";

/*
 * Patient Portal (spec 4.14). A separate token audience. EVERY endpoint derives
 * the patient identity from the token and ignores any identifier in the path —
 * the most common patient-portal vulnerability is trusting a client-supplied id.
 */
export const portalRouter = Router();

portalRouter.use(requireDb, authenticatePatient, resolveTenant);

/** The authenticated patient's own id — never from the request path. */
function selfId(req: import("express").Request): string {
  const id = req.auth?.patientId;
  if (!id) throw errors.forbidden("This token is not a patient token");
  return id;
}

portalRouter.get("/me", asyncHandler(async (req, res) => {
  const patient = await PatientModel.findOne({ _id: selfId(req), clinicId: req.clinicId }).lean();
  if (!patient) throw errors.notFound("Patient");
  const mh = await MedicalHistoryModel.findOne({ clinicId: req.clinicId, patient: patient._id }).sort({ version: -1 }).lean();
  return ok(res, {
    id: String(patient._id), name: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
    phone: patient.phone, email: patient.email, alerts: deriveAlerts(mh),
    marketingConsent: patient.marketingConsent,
  });
}));

portalRouter.get("/dashboard", asyncHandler(async (req, res) => {
  const patientId = selfId(req);
  const clinicId = req.clinicId!;
  const [nextAppt, balance, plans, recalls] = await Promise.all([
    AppointmentModel.findOne({ clinicId, patient: patientId, start: { $gte: new Date() }, status: { $nin: ["cancelled", "no_show"] } }).sort({ start: 1 }).lean(),
    computePatientBalance(clinicId, patientId),
    TreatmentPlanModel.find({ clinicId, patient: patientId, status: { $in: ["presented", "partially_accepted"] } }).select("title status planDate").lean(),
    RecallModel.find({ clinicId, patient: patientId, status: { $in: ["pending", "contacted"] } }).select("type dueDate").lean(),
  ]);
  return ok(res, {
    nextVisit: nextAppt ? { id: String(nextAppt._id), start: nextAppt.start, detail: nextAppt.chiefComplaint } : null,
    balancePaise: balance,
    pendingPlans: plans.map((p) => ({ id: String(p._id), title: p.title, status: p.status })),
    dueRecalls: recalls,
  });
}));

portalRouter.get("/appointments", asyncHandler(async (req, res) => {
  const rows = await AppointmentModel.find({ clinicId: req.clinicId, patient: selfId(req) }).sort({ start: -1 }).select("start end status type chiefComplaint").lean();
  return ok(res, rows);
}));

portalRouter.get("/treatment-plans", asyncHandler(async (req, res) => {
  const rows = await TreatmentPlanModel.find({ clinicId: req.clinicId, patient: selfId(req) }).select("title status planDate").lean();
  return ok(res, rows);
}));

portalRouter.get("/invoices", asyncHandler(async (req, res) => {
  const rows = await InvoiceModel.find({ clinicId: req.clinicId, patient: selfId(req) }).sort({ date: -1 }).select("invoiceNumber date totalPaise status").lean();
  return ok(res, rows);
}));

/** Remote per-item plan decision — the at-home conversion path (spec 4.14). */
portalRouter.post("/treatment-plans/:id/decision", asyncHandler(async (req, res) => {
  // Ownership: the plan must belong to this patient (from the token), not the path patient.
  const plan = await TreatmentPlanModel.findOne({ _id: req.params.id, clinicId: req.clinicId, patient: selfId(req) });
  if (!plan) throw errors.notFound("Treatment plan");
  const now = new Date();
  for (const d of req.body.decisions ?? []) {
    const status = d.outcome === "accepted" ? "accepted" : d.outcome === "declined" ? "declined" : "proposed";
    await TreatmentPlanItemModel.updateOne({ _id: d.itemId, clinicId: req.clinicId, plan: plan._id }, { status, decisionAt: now, decisionReason: d.reason });
  }
  plan.decisionChannel = "portal";
  plan.decisionAt = now;
  await plan.save();
  return ok(res, { recorded: true });
}));
