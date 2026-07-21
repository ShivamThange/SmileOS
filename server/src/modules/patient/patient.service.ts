import type { FilterQuery } from "mongoose";
import { PatientModel, MedicalHistoryModel, deriveAlerts, type Patient, type PatientDoc } from "../../models/patient.model";
import { AppointmentModel } from "../../models/appointment.model";
import { InvoiceModel, PaymentModel, computeBalance } from "../../models/billing.model";
import { ClinicModel } from "../../models/clinic.model";
import { nextSeq } from "../../models/counter.model";
import { padSeq } from "../../utils/ids";
import { errors } from "../../shared/errors";

/*
 * Patient service (spec 2.2 / 4.4). All patient business logic — number
 * allocation, the alerts/balance/next-visit summary, duplicate detection —
 * lives here, tenant-scoped by an explicit clinicId argument.
 */

export async function allocatePatientNumber(clinicId: string): Promise<string> {
  const clinic = await ClinicModel.findById(clinicId).select("numbering").lean();
  const prefix = clinic?.numbering?.patientPrefix ?? "MDC-";
  const width = clinic?.numbering?.patientWidth ?? 4;
  const seq = await nextSeq(clinicId, "patient");
  return padSeq(prefix, seq, width);
}

export async function createPatient(clinicId: string, actorId: string, input: Partial<Patient> & { firstName: string; phone: string }): Promise<PatientDoc> {
  const existing = await PatientModel.findOne({ clinicId, phone: input.phone });
  if (existing) throw errors.duplicate("A patient with that phone already exists");
  const patientNumber = await allocatePatientNumber(clinicId);
  const patient = await PatientModel.create({ ...input, clinicId, patientNumber, createdBy: actorId, updatedBy: actorId });
  await MedicalHistoryModel.create({ clinicId, patient: patient._id, createdBy: actorId });
  return patient;
}

export function buildPatientFilter(clinicId: string, q: Record<string, unknown>): FilterQuery<Patient> {
  const filter: FilterQuery<Patient> = { clinicId };
  if (q.status) filter.status = q.status;
  if (q.tag) filter.tags = q.tag;
  if (q.hasBalance === "true") filter.balancePaise = { $gt: 0 };
  if (q.recallDue === "true") filter.nextRecallDate = { $lte: new Date() };
  if (q.search) {
    const s = String(q.search).trim();
    filter.$or = [
      { firstName: new RegExp(s, "i") },
      { lastName: new RegExp(s, "i") },
      { phone: new RegExp(s.replace(/\s/g, ""), "i") },
      { patientNumber: new RegExp(s, "i") },
    ];
  }
  return filter;
}

export async function getSummary(clinicId: string, patientId: string): Promise<Record<string, unknown>> {
  const patient = await PatientModel.findOne({ _id: patientId, clinicId }).lean();
  if (!patient) throw errors.notFound("Patient");

  const [mh, nextAppt, invoices] = await Promise.all([
    MedicalHistoryModel.findOne({ clinicId, patient: patientId }).sort({ version: -1 }).lean(),
    AppointmentModel.findOne({ clinicId, patient: patientId, start: { $gte: new Date() }, status: { $nin: ["cancelled", "no_show"] } }).sort({ start: 1 }).lean(),
    InvoiceModel.find({ clinicId, patient: patientId }).select("_id totalPaise").lean(),
  ]);

  const balance = await computePatientBalance(clinicId, patientId, invoices);

  return {
    id: String(patient._id),
    patientNumber: patient.patientNumber,
    name: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
    phone: patient.phone,
    alerts: deriveAlerts(mh),
    balancePaise: balance,
    lastVisit: patient.lastVisit ?? null,
    nextVisit: nextAppt ? { id: String(nextAppt._id), start: nextAppt.start, proc: nextAppt.chiefComplaint } : null,
    nextRecallDate: patient.nextRecallDate ?? null,
  };
}

export async function computePatientBalance(clinicId: string, patientId: string, invoices?: { _id: unknown; totalPaise: number }[]): Promise<number> {
  const invs = invoices ?? (await InvoiceModel.find({ clinicId, patient: patientId }).select("_id totalPaise").lean());
  if (!invs.length) return 0;
  const invoiceIds = invs.map((i) => i._id);
  const payments = await PaymentModel.find({ clinicId, invoice: { $in: invoiceIds } }).select("amountPaise status").lean();
  const total = invs.reduce((s, i) => s + (i.totalPaise ?? 0), 0);
  return computeBalance(total, payments);
}

export async function getFullPatient(clinicId: string, patientId: string): Promise<Record<string, unknown>> {
  const patient = await PatientModel.findOne({ _id: patientId, clinicId }).lean();
  if (!patient) throw errors.notFound("Patient");
  const mh = await MedicalHistoryModel.findOne({ clinicId, patient: patientId }).sort({ version: -1 }).lean();
  return { ...patient, alerts: deriveAlerts(mh), balancePaise: await computePatientBalance(clinicId, patientId) };
}

export async function checkDuplicate(clinicId: string, phone: string, name?: string): Promise<{ duplicate: boolean; matches: unknown[] }> {
  const or: FilterQuery<Patient>[] = [{ phone }];
  if (name) or.push({ firstName: new RegExp(name, "i") });
  const matches = await PatientModel.find({ clinicId, $or: or }).select("patientNumber firstName lastName phone").limit(5).lean();
  return { duplicate: matches.some((m) => m.phone === phone), matches };
}
