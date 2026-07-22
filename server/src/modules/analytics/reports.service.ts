import { InvoiceModel, PaymentModel } from "../../models/billing.model";
import { AppointmentModel } from "../../models/appointment.model";
import { PatientModel } from "../../models/patient.model";
import { LeadModel } from "../../models/growth.model";
import { UserModel } from "../../models/user.model";
import { TreatmentPlanItemModel } from "../../models/treatment-plan.model";
import { Types } from "mongoose";

/*
 * Analytics report library (spec 4.12 / 5.12). Every report shares one
 * contract: a date range, an optional previous-period comparison, and a
 * grouping granularity. Series come from real aggregates; money stays in paise.
 */

export type GroupBy = "day" | "week" | "month";

export interface Range {
  from: Date;
  to: Date;
  groupBy: GroupBy;
  compare: boolean;
}

interface ReportResult {
  range: { from: Date; to: Date; groupBy: GroupBy };
  series: Record<string, unknown>[];
  totals: Record<string, number>;
  comparison?: { previous: { from: Date; to: Date }; totals: Record<string, number>; deltaPct: Record<string, number> };
}

const FORMAT: Record<GroupBy, string> = { day: "%Y-%m-%d", week: "%Y-%U", month: "%Y-%m" };

function oid(clinicId: string): Types.ObjectId {
  return new Types.ObjectId(clinicId);
}

/** The equal-length window immediately preceding [from, to]. */
function previousRange(from: Date, to: Date): { from: Date; to: Date } {
  const span = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - span), to: new Date(from.getTime()) };
}

function deltaPct(current: Record<string, number>, previous: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(current)) {
    const prev = previous[key] ?? 0;
    out[key] = prev === 0 ? (current[key] ? 100 : 0) : Math.round(((current[key] - prev) / prev) * 100);
  }
  return out;
}

/* ---- The individual aggregates (each keyed by clinic + date window) -------- */

async function revenueSeries(clinicId: string, from: Date, to: Date, groupBy: GroupBy) {
  const rows = await InvoiceModel.aggregate([
    { $match: { clinicId: oid(clinicId), isDeleted: { $ne: true }, createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: { $dateToString: { format: FORMAT[groupBy], date: "$createdAt" } }, valuePaise: { $sum: "$totalPaise" }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const totals = rows.reduce((acc, r) => ({ valuePaise: acc.valuePaise + r.valuePaise, count: acc.count + r.count }), { valuePaise: 0, count: 0 });
  return { series: rows.map((r) => ({ period: r._id, valuePaise: r.valuePaise, count: r.count })), totals };
}

async function collectionsSeries(clinicId: string, from: Date, to: Date, groupBy: GroupBy) {
  const rows = await PaymentModel.aggregate([
    { $match: { clinicId: oid(clinicId), isDeleted: { $ne: true }, status: "success", date: { $gte: from, $lte: to } } },
    { $group: { _id: { $dateToString: { format: FORMAT[groupBy], date: "$date" } }, collectedPaise: { $sum: "$amountPaise" }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const totals = rows.reduce((acc, r) => ({ collectedPaise: acc.collectedPaise + r.collectedPaise, count: acc.count + r.count }), { collectedPaise: 0, count: 0 });
  return { series: rows.map((r) => ({ period: r._id, collectedPaise: r.collectedPaise, count: r.count })), totals };
}

async function appointmentsSeries(clinicId: string, from: Date, to: Date, groupBy: GroupBy) {
  const rows = await AppointmentModel.aggregate([
    { $match: { clinicId: oid(clinicId), isDeleted: { $ne: true }, start: { $gte: from, $lte: to } } },
    { $group: { _id: { period: { $dateToString: { format: FORMAT[groupBy], date: "$start" } }, status: "$status" }, count: { $sum: 1 } } },
  ]);
  const byPeriod: Record<string, Record<string, number>> = {};
  const totals: Record<string, number> = { total: 0, completed: 0, no_show: 0, cancelled: 0 };
  for (const r of rows) {
    const p = (byPeriod[r._id.period] ??= { total: 0 });
    p[r._id.status] = (p[r._id.status] ?? 0) + r.count;
    p.total += r.count;
    totals.total += r.count;
    if (r._id.status in totals) totals[r._id.status] += r.count;
  }
  const series = Object.entries(byPeriod)
    .map(([period, v]) => ({ period, ...v }))
    .sort((a, b) => a.period.localeCompare(b.period));
  totals.noShowRatePct = totals.total ? Math.round((totals.no_show / totals.total) * 100) : 0;
  return { series, totals };
}

async function patientsSeries(clinicId: string, from: Date, to: Date, groupBy: GroupBy) {
  const rows = await PatientModel.aggregate([
    { $match: { clinicId: oid(clinicId), isDeleted: { $ne: true }, createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: { $dateToString: { format: FORMAT[groupBy], date: "$createdAt" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const totals = { newPatients: rows.reduce((s, r) => s + r.count, 0) };
  return { series: rows.map((r) => ({ period: r._id, newPatients: r.count })), totals };
}

async function leadsSeries(clinicId: string, from: Date, to: Date) {
  const rows = await LeadModel.aggregate([
    { $match: { clinicId: oid(clinicId), isDeleted: { $ne: true }, createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: { stage: "$stage", source: "$source" }, count: { $sum: 1 } } },
  ]);
  const byStage: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let total = 0;
  let won = 0;
  for (const r of rows) {
    byStage[r._id.stage] = (byStage[r._id.stage] ?? 0) + r.count;
    if (r._id.source) bySource[r._id.source] = (bySource[r._id.source] ?? 0) + r.count;
    total += r.count;
    if (r._id.stage === "won") won += r.count;
  }
  return {
    series: Object.entries(bySource).map(([source, count]) => ({ source, count })),
    totals: { total, won, conversionPct: total ? Math.round((won / total) * 100) : 0, ...byStage },
  };
}

const ACCEPTED_ITEM = ["accepted", "scheduled", "in_progress", "completed"];

async function caseAcceptanceSeries(clinicId: string, from: Date, to: Date, groupBy: GroupBy) {
  const rows = await TreatmentPlanItemModel.aggregate([
    { $match: { clinicId: oid(clinicId), isDeleted: { $ne: true }, presentedAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateToString: { format: FORMAT[groupBy], date: "$presentedAt" } },
        presented: { $sum: 1 },
        presentedValuePaise: { $sum: "$lineTotalPaise" },
        accepted: { $sum: { $cond: [{ $in: ["$status", ACCEPTED_ITEM] }, 1, 0] } },
        acceptedValuePaise: { $sum: { $cond: [{ $in: ["$status", ACCEPTED_ITEM] }, "$lineTotalPaise", 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const totals = rows.reduce(
    (acc, r) => ({
      presented: acc.presented + r.presented,
      accepted: acc.accepted + r.accepted,
      presentedValuePaise: acc.presentedValuePaise + r.presentedValuePaise,
      acceptedValuePaise: acc.acceptedValuePaise + r.acceptedValuePaise,
    }),
    { presented: 0, accepted: 0, presentedValuePaise: 0, acceptedValuePaise: 0 },
  );
  const series = rows.map((r) => ({
    period: r._id,
    presented: r.presented,
    accepted: r.accepted,
    acceptanceRatePct: r.presented ? Math.round((r.accepted / r.presented) * 100) : 0,
    acceptedValuePaise: r.acceptedValuePaise,
  }));
  return { series, totals: { ...totals, acceptanceRatePct: totals.presented ? Math.round((totals.accepted / totals.presented) * 100) : 0 } };
}

async function treatmentsSeries(clinicId: string, from: Date, to: Date) {
  const rows = await TreatmentPlanItemModel.aggregate([
    { $match: { clinicId: oid(clinicId), isDeleted: { $ne: true }, presentedAt: { $gte: from, $lte: to }, name: { $ne: null } } },
    { $group: { _id: "$name", count: { $sum: "$quantity" }, valuePaise: { $sum: "$lineTotalPaise" }, accepted: { $sum: { $cond: [{ $in: ["$status", ACCEPTED_ITEM] }, 1, 0] } } } },
    { $sort: { valuePaise: -1 } },
    { $limit: 50 },
  ]);
  const totals = rows.reduce((acc, r) => ({ count: acc.count + r.count, valuePaise: acc.valuePaise + r.valuePaise }), { count: 0, valuePaise: 0 });
  return { series: rows.map((r) => ({ procedure: r._id, count: r.count, valuePaise: r.valuePaise, accepted: r.accepted })), totals };
}

const SIMPLE: Record<string, (clinicId: string, from: Date, to: Date, groupBy: GroupBy) => Promise<{ series: Record<string, unknown>[]; totals: Record<string, number> }>> = {
  revenue: revenueSeries,
  collections: collectionsSeries,
  appointments: appointmentsSeries,
  patients: patientsSeries,
  leads: (clinicId, from, to) => leadsSeries(clinicId, from, to),
  "case-acceptance": caseAcceptanceSeries,
  treatments: (clinicId, from, to) => treatmentsSeries(clinicId, from, to),
};

export const REPORT_TYPES = [...Object.keys(SIMPLE), "doctors"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/** Per-doctor production + collection over the window (no period series). */
export async function doctorsReport(clinicId: string, from: Date, to: Date): Promise<ReportResult> {
  const doctors = await UserModel.find({ clinicId, role: "doctor" }).select("_id name").lean();
  const series: Record<string, unknown>[] = [];
  let productionPaise = 0;
  let collectionPaise = 0;
  for (const doc of doctors) {
    const invoices = await InvoiceModel.find({ clinicId: oid(clinicId), performingDoctor: doc._id, createdAt: { $gte: from, $lte: to } }).select("_id totalPaise").lean();
    const prod = invoices.reduce((s, i) => s + (i.totalPaise ?? 0), 0);
    const ids = invoices.map((i) => i._id);
    const payments = ids.length ? await PaymentModel.find({ clinicId: oid(clinicId), invoice: { $in: ids }, status: "success" }).select("amountPaise").lean() : [];
    const coll = payments.reduce((s, p) => s + (p.amountPaise ?? 0), 0);
    productionPaise += prod;
    collectionPaise += coll;
    series.push({ doctorId: String(doc._id), name: doc.name, productionPaise: prod, collectionPaise: coll });
  }
  return { range: { from, to, groupBy: "month" }, series, totals: { productionPaise, collectionPaise } };
}

/** Run any report with the shared range + comparison contract. */
export async function runReport(type: ReportType, clinicId: string, range: Range): Promise<ReportResult> {
  if (type === "doctors") {
    const result = await doctorsReport(clinicId, range.from, range.to);
    return result;
  }
  const fn = SIMPLE[type];
  const current = await fn(clinicId, range.from, range.to, range.groupBy);
  const result: ReportResult = { range: { from: range.from, to: range.to, groupBy: range.groupBy }, series: current.series, totals: current.totals };

  if (range.compare) {
    const prev = previousRange(range.from, range.to);
    const previous = await fn(clinicId, prev.from, prev.to, range.groupBy);
    result.comparison = { previous: prev, totals: previous.totals, deltaPct: deltaPct(current.totals, previous.totals) };
  }
  return result;
}

/** Flatten a report's series to CSV for /analytics/export. */
export function toCsv(report: ReportResult): string {
  if (report.series.length === 0) return "";
  const columns = Array.from(new Set(report.series.flatMap((row) => Object.keys(row))));
  const header = columns.join(",");
  const lines = report.series.map((row) => columns.map((c) => JSON.stringify(row[c] ?? "")).join(","));
  return [header, ...lines].join("\n");
}
