import { TreatmentPlanModel, TreatmentPlanItemModel } from "../../models/treatment-plan.model";
import { RECOVERY_STALENESS_DAYS } from "../../config/constants";
import type { FilterQuery } from "mongoose";
import type { TreatmentPlanItem } from "../../models/treatment-plan.model";

/*
 * Revenue metrics + the unscheduled-treatment recovery worklist (spec 2.5 /
 * 4.7). This is the product's centrepiece: money already diagnosed and earned,
 * sitting uncollected, made visible. All computed from source records.
 */

/** Plans that are still "live" for recovery — not declined, not expired. */
async function livePlanIds(clinicId: string): Promise<unknown[]> {
  const plans = await TreatmentPlanModel.find({
    clinicId,
    status: { $nin: ["declined", "expired", "completed"] },
    $or: [{ validUntil: { $exists: false } }, { validUntil: null }, { validUntil: { $gte: new Date() } }],
  }).select("_id").lean();
  return plans.map((p) => p._id);
}

/** The worklist query: accepted/proposed items with no future appointment, on live plans. */
export async function unscheduledFilter(clinicId: string, q: Record<string, unknown> = {}): Promise<FilterQuery<TreatmentPlanItem>> {
  const planIds = await livePlanIds(clinicId);
  const filter: FilterQuery<TreatmentPlanItem> = {
    clinicId,
    status: { $in: ["proposed", "accepted"] },
    plan: { $in: planIds },
    $or: [{ scheduledAppointment: { $exists: false } }, { scheduledAppointment: null }],
  };
  if (q.priority) filter.priority = q.priority as string;
  if (q.assigned) filter["followUp.assignedTo"] = q.assigned;
  if (q.followUpDue === "true") filter["followUp.nextFollowUpDate"] = { $lte: new Date() };
  if (q.minValue) filter.lineTotalPaise = { $gte: Number(q.minValue) };
  return filter;
}

export async function unscheduledList(clinicId: string, q: Record<string, unknown>): Promise<unknown[]> {
  const filter = await unscheduledFilter(clinicId, q);
  const rows = await TreatmentPlanItemModel.find(filter)
    .sort({ lineTotalPaise: -1 })
    .limit(Number(q.limit ?? 100))
    .populate("patient", "firstName lastName phone")
    .populate("plan", "planDate title")
    .lean();
  return rows.map((r) => {
    const planDate = (r.plan as { planDate?: Date } | null)?.planDate;
    const daysSince = planDate ? Math.floor((Date.now() - new Date(planDate).getTime()) / 86400000) : null;
    return { ...r, id: String(r._id), daysSincePlanned: daysSince };
  });
}

export async function unscheduledSummary(clinicId: string): Promise<Record<string, unknown>> {
  const filter = await unscheduledFilter(clinicId, {});
  const items = await TreatmentPlanItemModel.find(filter).select("lineTotalPaise patient createdAt plan").populate("plan", "planDate").lean();

  const totalValue = items.reduce((s, i) => s + i.lineTotalPaise, 0);
  const patients = new Set(items.map((i) => String(i.patient))).size;
  const staleCutoff = Date.now() - RECOVERY_STALENESS_DAYS * 86400000;
  let recoverable = 0;
  const ageing = { under30: 0, under90: 0, over90: 0 };
  for (const i of items) {
    const planDate = (i.plan as { planDate?: Date } | null)?.planDate;
    const t = planDate ? new Date(planDate).getTime() : Date.now();
    if (t >= staleCutoff) recoverable += i.lineTotalPaise;
    const days = (Date.now() - t) / 86400000;
    if (days < 30) ageing.under30 += i.lineTotalPaise;
    else if (days < 90) ageing.under90 += i.lineTotalPaise;
    else ageing.over90 += i.lineTotalPaise;
  }
  return { totalValuePaise: totalValue, patientCount: patients, recoverablePaise: recoverable, ageing, itemCount: items.length };
}

/** Case acceptance rate = accepted item value ÷ presented item value (spec 2.5). */
export async function caseAcceptance(clinicId: string): Promise<Record<string, unknown>> {
  const items = await TreatmentPlanItemModel.find({ clinicId, presentedAt: { $exists: true } }).select("lineTotalPaise status").lean();
  const presented = items.reduce((s, i) => s + i.lineTotalPaise, 0);
  const accepted = items.filter((i) => ["accepted", "scheduled", "in_progress", "completed"].includes(i.status)).reduce((s, i) => s + i.lineTotalPaise, 0);
  const scheduled = items.filter((i) => ["scheduled", "in_progress", "completed"].includes(i.status)).reduce((s, i) => s + i.lineTotalPaise, 0);
  return {
    presentedPaise: presented,
    acceptedPaise: accepted,
    acceptanceRate: presented ? Math.round((accepted / presented) * 100) : 0,
    schedulingRate: accepted ? Math.round((scheduled / accepted) * 100) : 0,
  };
}
