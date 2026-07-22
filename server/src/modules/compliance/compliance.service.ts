import { PatientModel } from "../../models/patient.model";
import { AppointmentModel } from "../../models/appointment.model";
import { InvoiceModel, PaymentModel } from "../../models/billing.model";
import { TreatmentPlanModel } from "../../models/treatment-plan.model";
import { errors } from "../../shared/errors";

/*
 * Compliance service (spec Part 7 — DPDP). Implements the data-subject rights
 * a clinic must honour: access (assemble everything held about a patient),
 * consent withdrawal, and erasure. Erasure anonymises direct identifiers rather
 * than deleting the record, because financial and clinical entries must be kept
 * for the statutory period — the DPDP-compliant middle path.
 */

/** Assemble a patient's held data across collections (the access right). */
export async function patientDataExport(clinicId: string, patientId: string): Promise<Record<string, unknown>> {
  const patient = await PatientModel.findOne({ _id: patientId, clinicId }).lean();
  if (!patient) throw errors.notFound("Patient");

  const [appointments, invoices, payments, plans] = await Promise.all([
    AppointmentModel.find({ clinicId, patient: patientId }).select("start end status type doctor").sort({ start: -1 }).lean(),
    InvoiceModel.find({ clinicId, patient: patientId }).select("invoiceNumber totalPaise status createdAt").sort({ createdAt: -1 }).lean(),
    PaymentModel.find({ clinicId, patient: patientId }).select("amountPaise mode status date receiptNumber").sort({ date: -1 }).lean(),
    TreatmentPlanModel.find({ clinicId, patient: patientId }).select("title status presentedAt totalPaise").sort({ createdAt: -1 }).lean(),
  ]);

  return {
    generatedAt: new Date(),
    patient,
    records: { appointments, invoices, payments, treatmentPlans: plans },
    counts: { appointments: appointments.length, invoices: invoices.length, payments: payments.length, treatmentPlans: plans.length },
  };
}

/** Withdraw all marketing consent for a patient. */
export async function withdrawConsent(clinicId: string, actorId: string, patientId: string): Promise<unknown> {
  const patient = await PatientModel.findOneAndUpdate(
    { _id: patientId, clinicId },
    { marketingConsent: { whatsapp: false, sms: false, email: false }, updatedBy: actorId },
    { new: true },
  ).lean();
  if (!patient) throw errors.notFound("Patient");
  return patient;
}

/**
 * Anonymise a patient's direct identifiers while retaining the record and its
 * financial/clinical links. Irreversible; the caller must have confirmed and
 * hold the delete permission.
 */
export async function anonymisePatient(clinicId: string, actorId: string, patientId: string): Promise<unknown> {
  const patient = await PatientModel.findOne({ _id: patientId, clinicId });
  if (!patient) throw errors.notFound("Patient");

  const redacted = `redacted-${String(patient._id).slice(-6)}`;
  patient.firstName = "Redacted";
  patient.lastName = "";
  // Phone is unique-indexed per clinic; keep it unique but non-identifying.
  patient.phone = `000${String(patient._id).slice(-9)}`;
  patient.email = undefined as never;
  patient.dob = undefined as never;
  patient.address = undefined as never;
  patient.emergencyContact = undefined as never;
  patient.marketingConsent = { whatsapp: false, sms: false, email: false } as never;
  patient.status = "inactive" as never;
  patient.tags = [...(patient.tags ?? []), "erased"];
  patient.notes = redacted as never;
  patient.updatedBy = actorId as never;
  await patient.save();

  return { id: String(patient._id), anonymised: true };
}
