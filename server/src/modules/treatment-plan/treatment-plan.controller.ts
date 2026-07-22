import type { Request, Response } from "express";
import { ok, created } from "../../shared/envelope";
import { parsePageParams, buildPagination } from "../../utils/pagination";
import { TreatmentPlanModel, TreatmentPlanItemModel } from "../../models/treatment-plan.model";
import { recordAudit } from "../../services/audit.service";
import { errors } from "../../shared/errors";
import * as svc from "./treatment-plan.service";
import * as revenue from "./revenue.service";

/* Treatment plan + revenue controller (spec 4.7). */

const ACCEPTED_STATUSES = ["accepted", "scheduled", "in_progress", "completed"];

export async function list(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = { clinicId: req.clinicId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.doctor) filter.doctor = req.query.doctor;
  if (req.query.patient) filter.patient = req.query.patient;

  const { page, limit, skip, sort } = parsePageParams(req, { defaultSort: "planDate" });
  const [plans, total] = await Promise.all([
    TreatmentPlanModel.find(filter).sort(sort).skip(skip).limit(limit).populate("patient doctor").lean(),
    TreatmentPlanModel.countDocuments(filter),
  ]);

  // Batch the item totals per plan so the list can show accepted/deferred value
  // and item counts without an N+1 (item-level status is the whole design).
  const ids = plans.map((p) => p._id);
  const agg = ids.length
    ? await TreatmentPlanItemModel.aggregate([
        { $match: { plan: { $in: ids } } },
        {
          $group: {
            _id: "$plan",
            grossPaise: { $sum: "$lineTotalPaise" },
            acceptedPaise: { $sum: { $cond: [{ $in: ["$status", ACCEPTED_STATUSES] }, "$lineTotalPaise", 0] } },
            itemCount: { $sum: 1 },
            acceptedCount: { $sum: { $cond: [{ $in: ["$status", ACCEPTED_STATUSES] }, 1, 0] } },
          },
        },
      ])
    : [];
  const totalsById = new Map(agg.map((a) => [String(a._id), a]));

  const data = plans.map((p) => {
    const t = totalsById.get(String(p._id));
    const grossPaise = t?.grossPaise ?? 0;
    const acceptedPaise = t?.acceptedPaise ?? 0;
    return {
      ...p,
      totals: {
        grossPaise,
        acceptedPaise,
        deferredPaise: grossPaise - acceptedPaise,
        itemCount: t?.itemCount ?? 0,
        acceptedCount: t?.acceptedCount ?? 0,
      },
    };
  });
  return ok(res, data, { pagination: buildPagination(page, limit, total) });
}

export async function create(req: Request, res: Response): Promise<Response> {
  const plan = await TreatmentPlanModel.create({ ...req.body, clinicId: req.clinicId, createdBy: req.auth!.userId, updatedBy: req.auth!.userId });
  recordAudit(req, { action: "treatment_plan.create", resourceType: "treatment_plan", resourceId: String(plan._id), patient: plan.patient });
  return created(res, plan, "Treatment plan created");
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const plan = await TreatmentPlanModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).populate("patient doctor").lean();
  if (!plan) throw errors.notFound("Treatment plan");
  const items = await TreatmentPlanItemModel.find({ clinicId: req.clinicId, plan: req.params.id }).sort({ sequence: 1 }).lean();
  const totals = await svc.planTotals(req.clinicId!, req.params.id);
  return ok(res, { ...plan, items, totals });
}

export async function update(req: Request, res: Response): Promise<Response> {
  const plan = await TreatmentPlanModel.findOneAndUpdate({ _id: req.params.id, clinicId: req.clinicId }, { $set: req.body, updatedBy: req.auth!.userId }, { new: true });
  if (!plan) throw errors.notFound("Treatment plan");
  await svc.recomputeTotals(req.clinicId!, req.params.id);
  return ok(res, plan);
}

export async function remove(req: Request, res: Response): Promise<Response> {
  const plan = await TreatmentPlanModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!plan) throw errors.notFound("Treatment plan");
  await (plan as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  recordAudit(req, { action: "treatment_plan.delete", resourceType: "treatment_plan", resourceId: req.params.id });
  return ok(res, { deleted: true });
}

export async function addItem(req: Request, res: Response): Promise<Response> {
  await svc.addItem(req.clinicId!, req.auth!.userId, req.params.id, req.body);
  return ok(res, await svc.planTotals(req.clinicId!, req.params.id), { message: "Item added" });
}

export async function updateItem(req: Request, res: Response): Promise<Response> {
  await svc.updateItem(req.clinicId!, req.params.id, req.body);
  return ok(res, { updated: true });
}

export async function removeItem(req: Request, res: Response): Promise<Response> {
  const item = await TreatmentPlanItemModel.findOneAndDelete({ _id: req.params.id, clinicId: req.clinicId });
  if (!item) throw errors.notFound("Plan item");
  await svc.recomputeTotals(req.clinicId!, String(item.plan));
  return ok(res, { deleted: true });
}

export async function present(req: Request, res: Response): Promise<Response> {
  const plan = await svc.present(req.clinicId!, req.params.id);
  recordAudit(req, { action: "treatment_plan.present", resourceType: "treatment_plan", resourceId: req.params.id, patient: plan.patient });
  return ok(res, { status: plan.status, presentedAt: plan.presentedAt, publicToken: plan.publicToken });
}

export async function decision(req: Request, res: Response): Promise<Response> {
  const totals = await svc.decide(req.clinicId!, req.auth!.userId, req.params.id, req.body.decisions, req.body.channel ?? "in_clinic");
  recordAudit(req, { action: "treatment_plan.decision", resourceType: "treatment_plan", resourceId: req.params.id });
  return ok(res, totals);
}

export async function scheduleItem(req: Request, res: Response): Promise<Response> {
  await svc.scheduleItem(req.clinicId!, req.params.id, req.body.appointmentId);
  return ok(res, { scheduled: true });
}

/* --------------------------------------------------------- recovery worklist */

export async function unscheduled(req: Request, res: Response): Promise<Response> {
  return ok(res, await revenue.unscheduledList(req.clinicId!, req.query as Record<string, unknown>));
}
export async function unscheduledSummary(req: Request, res: Response): Promise<Response> {
  return ok(res, await revenue.unscheduledSummary(req.clinicId!));
}
export async function caseAcceptance(req: Request, res: Response): Promise<Response> {
  return ok(res, await revenue.caseAcceptance(req.clinicId!));
}

async function itemAction(req: Request, patch: Record<string, unknown>): Promise<void> {
  const item = await TreatmentPlanItemModel.findOne({ _id: req.params.itemId, clinicId: req.clinicId });
  if (!item) throw errors.notFound("Plan item");
  Object.assign(item, patch);
  await item.save();
}

export async function logContact(req: Request, res: Response): Promise<Response> {
  const item = await TreatmentPlanItemModel.findOne({ _id: req.params.itemId, clinicId: req.clinicId });
  if (!item) throw errors.notFound("Plan item");
  item.followUp = { ...item.followUp, contactAttempts: (item.followUp?.contactAttempts ?? 0) + 1, lastContactDate: new Date(), lastContactOutcome: req.body.outcome };
  await item.save();
  recordAudit(req, { action: "recovery.contact", resourceType: "treatment_plan", resourceId: req.params.itemId });
  return ok(res, { logged: true });
}

export async function snooze(req: Request, res: Response): Promise<Response> {
  await itemAction(req, { "followUp.snoozeUntil": new Date(req.body.until), "followUp.nextFollowUpDate": new Date(req.body.until) });
  return ok(res, { snoozed: true });
}

export async function declineItem(req: Request, res: Response): Promise<Response> {
  await itemAction(req, { status: "declined", decisionAt: new Date(), decisionReason: req.body.reason });
  recordAudit(req, { action: "recovery.decline", resourceType: "treatment_plan", resourceId: req.params.itemId });
  return ok(res, { declined: true });
}

export async function assign(req: Request, res: Response): Promise<Response> {
  await itemAction(req, { "followUp.assignedTo": req.body.userId });
  return ok(res, { assigned: true });
}
