import { Router } from "express";
import { asyncHandler } from "../../shared/http";
import { ok } from "../../shared/envelope";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import { AppointmentModel } from "../../models/appointment.model";
import { PatientModel } from "../../models/patient.model";
import { unscheduledSummary, caseAcceptance } from "../treatment-plan/revenue.service";
import { pendingPayments, dailySummary } from "../billing/billing.service";
import { recallSummary } from "../growth/growth.service";

/*
 * Analytics (spec 4.12). The revenue-at-risk panel is the dashboard's headline:
 * unscheduled treatment value + overdue recalls + receivables ageing — money
 * already earned, sitting uncollected. Composed from the source services so the
 * numbers always agree with the worklists they link to.
 */
const guard = [requireDb, authenticate(), resolveTenant] as const;

export const analyticsRouter = Router();
analyticsRouter.use(...guard);

analyticsRouter.get("/revenue-at-risk", authorize("analytics", "read"), asyncHandler(async (req, res) => {
  const [unscheduled, receivables, recalls] = await Promise.all([
    unscheduledSummary(req.clinicId!),
    pendingPayments(req.clinicId!),
    recallSummary(req.clinicId!),
  ]);
  const atRiskPaise = (unscheduled.totalValuePaise as number) + (receivables.totalPaise as number);
  return ok(res, {
    atRiskPaise,
    unscheduled,
    receivables: { totalPaise: receivables.totalPaise, under30Paise: receivables.under30Paise, over30Paise: receivables.over30Paise, count: receivables.count },
    recalls,
  });
}));

analyticsRouter.get("/dashboard", authorize("analytics", "read"), asyncHandler(async (req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const [todayCount, activePatients, collections, acceptance, unscheduled] = await Promise.all([
    AppointmentModel.countDocuments({ clinicId: req.clinicId, start: { $gte: start, $lte: end } }),
    PatientModel.countDocuments({ clinicId: req.clinicId, status: "active" }),
    dailySummary(req.clinicId!),
    caseAcceptance(req.clinicId!),
    unscheduledSummary(req.clinicId!),
  ]);
  return ok(res, {
    today: { appointments: todayCount },
    patients: { active: activePatients },
    collectionsToday: collections,
    caseAcceptance: acceptance,
    revenueAtRisk: { unscheduledValuePaise: unscheduled.totalValuePaise, patientCount: unscheduled.patientCount },
  });
}));
