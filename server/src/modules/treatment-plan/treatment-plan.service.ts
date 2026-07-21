import { Types } from "mongoose";
import { TreatmentPlanModel, TreatmentPlanItemModel, type TreatmentPlanDoc } from "../../models/treatment-plan.model";
import { pctPaise } from "../../utils/money";
import { opaqueToken } from "../../utils/ids";
import { errors } from "../../shared/errors";
import { enqueue } from "../../jobs/queue";
import type { PlanItemStatus } from "../../shared/enums";

/*
 * Treatment plan service (spec 2.5 / 4.7) — the revenue core. Item-level status
 * is the whole design: a plan is a set of independently-decidable items. Totals
 * are recomputed server-side on every mutation so the displayed figure is
 * always authoritative; derived revenue metrics are computed, never stored.
 */

/** Line total for an item: unit × qty − discount, floored at zero. */
function lineTotal(unitPricePaise: number, quantity: number, discountPaise: number): number {
  return Math.max(0, unitPricePaise * quantity - discountPaise);
}

/** Recompute and persist plan-level totals from its items (authoritative). */
export async function recomputeTotals(clinicId: string, planId: string): Promise<TreatmentPlanDoc> {
  const plan = await TreatmentPlanModel.findOne({ _id: planId, clinicId });
  if (!plan) throw errors.notFound("Treatment plan");
  const items = await TreatmentPlanItemModel.find({ clinicId, plan: planId }).lean();
  const subtotal = items.reduce((s, it) => s + (it.lineTotalPaise ?? 0), 0);
  const discount = plan.discountPct ? pctPaise(subtotal, plan.discountPct) : plan.discountPaise ?? 0;
  plan.discountPaise = discount;
  await plan.save();
  return plan;
}

/** Presented / net / accepted / completed totals derived from live items. */
export async function planTotals(clinicId: string, planId: string): Promise<Record<string, number>> {
  const plan = await TreatmentPlanModel.findOne({ _id: planId, clinicId }).lean();
  const items = await TreatmentPlanItemModel.find({ clinicId, plan: planId }).lean();
  const grossPaise = items.reduce((s, it) => s + (it.lineTotalPaise ?? 0), 0);
  const discountPaise = plan?.discountPct ? pctPaise(grossPaise, plan.discountPct) : plan?.discountPaise ?? 0;
  const acceptedPaise = items.filter((i) => ["accepted", "scheduled", "in_progress", "completed"].includes(i.status)).reduce((s, it) => s + it.lineTotalPaise, 0);
  const completedPaise = items.filter((i) => i.status === "completed").reduce((s, it) => s + it.lineTotalPaise, 0);
  return { grossPaise, discountPaise, netPaise: grossPaise - discountPaise, acceptedPaise, completedPaise };
}

export async function addItem(clinicId: string, actorId: string, planId: string, input: Record<string, unknown>): Promise<void> {
  const plan = await TreatmentPlanModel.findOne({ _id: planId, clinicId }).lean();
  if (!plan) throw errors.notFound("Treatment plan");
  const unit = Number(input.unitPricePaise ?? 0);
  const qty = Number(input.quantity ?? 1);
  const disc = Number(input.discountPaise ?? 0);
  await TreatmentPlanItemModel.create({
    ...input, clinicId, plan: planId, patient: plan.patient,
    unitPricePaise: unit, quantity: qty, discountPaise: disc,
    lineTotalPaise: lineTotal(unit, qty, disc),
    createdBy: actorId, updatedBy: actorId,
  });
  await recomputeTotals(clinicId, planId);
}

export async function updateItem(clinicId: string, itemId: string, patch: Record<string, unknown>): Promise<void> {
  const item = await TreatmentPlanItemModel.findOne({ _id: itemId, clinicId });
  if (!item) throw errors.notFound("Plan item");
  Object.assign(item, patch);
  item.lineTotalPaise = lineTotal(item.unitPricePaise, item.quantity, item.discountPaise);
  await item.save();
  await recomputeTotals(clinicId, String(item.plan));
}

/** Mark a plan presented — stamps the timestamp all acceptance analytics measure from. */
export async function present(clinicId: string, planId: string): Promise<TreatmentPlanDoc> {
  const plan = await TreatmentPlanModel.findOne({ _id: planId, clinicId });
  if (!plan) throw errors.notFound("Treatment plan");
  const now = new Date();
  plan.status = "presented";
  plan.presentedAt = now;
  if (!plan.publicToken) plan.publicToken = opaqueToken();
  await plan.save();
  await TreatmentPlanItemModel.updateMany({ clinicId, plan: planId, presentedAt: { $exists: false } }, { presentedAt: now });
  return plan;
}

interface Decision { itemId: string; outcome: "accepted" | "declined" | "deferred"; reason?: string; followUpDate?: string; }

/** Record per-item decisions in one batched call (spec 4.7). */
export async function decide(clinicId: string, actorId: string, planId: string, decisions: Decision[], channel: string): Promise<Record<string, number>> {
  const now = new Date();
  for (const d of decisions) {
    const status: PlanItemStatus = d.outcome === "accepted" ? "accepted" : d.outcome === "declined" ? "declined" : "proposed";
    const update: Record<string, unknown> = { status, decisionAt: now, decisionReason: d.reason, updatedBy: actorId };
    // Deferred items re-enter the recovery worklist with the stated follow-up date.
    if (d.outcome === "deferred" && d.followUpDate) update["followUp.nextFollowUpDate"] = new Date(d.followUpDate);
    await TreatmentPlanItemModel.updateOne({ _id: d.itemId, clinicId, plan: planId }, { $set: update });
  }

  // Roll the plan status up from its items.
  const items = await TreatmentPlanItemModel.find({ clinicId, plan: planId }).select("status").lean();
  const anyAccepted = items.some((i) => i.status === "accepted");
  const allDecided = items.every((i) => i.status !== "proposed");
  const allDeclined = items.every((i) => i.status === "declined");
  const plan = await TreatmentPlanModel.findOne({ _id: planId, clinicId });
  if (plan) {
    plan.status = allDeclined ? "declined" : anyAccepted && allDecided ? "accepted" : anyAccepted ? "partially_accepted" : plan.status;
    plan.decisionAt = now;
    plan.decisionChannel = channel as never;
    await plan.save();
    if (anyAccepted) await enqueue("pdf", "draft_invoice_from_plan", { planId });
  }
  return planTotals(clinicId, planId);
}

/** Schedule an accepted item onto an appointment. */
export async function scheduleItem(clinicId: string, itemId: string, appointmentId: string): Promise<void> {
  const item = await TreatmentPlanItemModel.findOne({ _id: itemId, clinicId });
  if (!item) throw errors.notFound("Plan item");
  item.scheduledAppointment = appointmentId as unknown as Types.ObjectId;
  if (item.status === "accepted") item.status = "scheduled";
  await item.save();
}
