import { LeadModel, LeadActivityModel } from "../../models/growth.model";
import { RecallModel } from "../../models/recall.model";
import { createPatient } from "../patient/patient.service";
import { LEAD_STAGES } from "../../shared/enums";
import { errors } from "../../shared/errors";

/*
 * Growth service (spec 2.7 / 4.9). Lead conversion carries history across to a
 * new patient; time-to-first-contact is derived from the first outbound
 * activity; recall summary buckets by overdue band.
 */

export async function logActivity(clinicId: string, actorId: string, leadId: string, input: Record<string, unknown>): Promise<void> {
  await LeadActivityModel.create({ ...input, clinicId, lead: leadId, staff: actorId, createdBy: actorId });
  if (input.direction === "out") {
    await LeadModel.updateOne({ _id: leadId, clinicId, firstContactAt: { $exists: false } }, { firstContactAt: new Date() });
  }
}

export async function setStage(clinicId: string, actorId: string, leadId: string, stage: string, lostReason?: string): Promise<void> {
  if (!LEAD_STAGES.includes(stage as never)) throw errors.validation({ stage: "Unknown stage" });
  const patch: Record<string, unknown> = { stage, updatedBy: actorId };
  if (stage === "lost") patch.lostReason = lostReason;
  await LeadModel.updateOne({ _id: leadId, clinicId }, patch);
  await LeadActivityModel.create({ clinicId, lead: leadId, type: "stage_change", content: stage, staff: actorId, createdBy: actorId });
}

export async function convertLead(clinicId: string, actorId: string, leadId: string): Promise<{ patientId: string }> {
  const lead = await LeadModel.findOne({ _id: leadId, clinicId });
  if (!lead) throw errors.notFound("Lead");
  if (lead.convertedPatient) return { patientId: String(lead.convertedPatient) };

  const [firstName, ...rest] = lead.name.split(" ");
  const patient = await createPatient(clinicId, actorId, {
    firstName, lastName: rest.join(" ") || undefined,
    phone: lead.phone ?? "", email: lead.email ?? undefined,
    referralSource: lead.source, tags: ["from-lead"],
  });
  lead.stage = "won";
  lead.convertedPatient = patient._id;
  lead.convertedAt = new Date();
  await lead.save();
  return { patientId: String(patient._id) };
}

/** Time-to-first-contact (minutes) surfaced on the list (spec 2.7). */
export function timeToFirstContactMin(lead: { createdAt: Date; firstContactAt?: Date | null }): number | null {
  if (!lead.firstContactAt) return null;
  return Math.round((new Date(lead.firstContactAt).getTime() - new Date(lead.createdAt).getTime()) / 60000);
}

export async function leadSummary(clinicId: string): Promise<Record<string, unknown>> {
  const leads = await LeadModel.find({ clinicId }).select("stage source estimatedValuePaise createdAt firstContactAt").lean();
  const byStage: Record<string, number> = {};
  const bySource: Record<string, { count: number; won: number }> = {};
  let pipelineValue = 0;
  let contactTimes: number[] = [];
  for (const l of leads) {
    byStage[l.stage] = (byStage[l.stage] ?? 0) + 1;
    if (!["won", "lost"].includes(l.stage)) pipelineValue += l.estimatedValuePaise ?? 0;
    const src = (bySource[l.source] ??= { count: 0, won: 0 });
    src.count += 1;
    if (l.stage === "won") src.won += 1;
    const t = timeToFirstContactMin(l);
    if (t !== null) contactTimes.push(t);
  }
  const avgFirstContact = contactTimes.length ? Math.round(contactTimes.reduce((a, b) => a + b, 0) / contactTimes.length) : null;
  return { byStage, bySource, pipelineValuePaise: pipelineValue, avgFirstContactMin: avgFirstContact, total: leads.length };
}

export async function recallSummary(clinicId: string): Promise<Record<string, unknown>> {
  const recalls = await RecallModel.find({ clinicId, status: { $in: ["pending", "contacted"] } }).select("dueDate type").lean();
  const now = Date.now();
  let due = 0, overdue = 0, critical = 0;
  for (const r of recalls) {
    const overdueDays = (now - new Date(r.dueDate).getTime()) / 86400000;
    due += 1;
    if (overdueDays > 0) overdue += 1;
    if (overdueDays >= 30) critical += 1;
  }
  return { due, overdue, critical };
}
