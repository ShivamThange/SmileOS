import { Types } from "mongoose";
import { AppointmentModel, type AppointmentDoc } from "../../models/appointment.model";
import { RecallModel } from "../../models/recall.model";
import { ProcedureModel } from "../../models/procedure.model";
import { PatientModel } from "../../models/patient.model";
import { APPOINTMENT_TRANSITIONS, type AppointmentStatus } from "../../shared/enums";
import { AppError, ERROR_CODES, errors } from "../../shared/errors";
import { enqueue } from "../../jobs/queue";
import { logger } from "../../config/logger";

/*
 * Appointment service (spec 2.3 / 4.5). The two expensive areas — conflict
 * detection and the status state machine — are enforced here, in the service
 * layer, and covered by their own logic so they are testable without HTTP.
 */

interface Overlap {
  clinicId: string;
  operatory?: string;
  doctor?: string;
  start: Date;
  end: Date;
  excludeId?: string;
  allowDoctorOverlap?: boolean;
}

/** Enforce: an operatory cannot host two overlapping non-cancelled appointments. */
export async function assertNoConflict(o: Overlap): Promise<void> {
  const timeOverlap = { start: { $lt: o.end }, end: { $gt: o.start } };
  const notTerminal = { status: { $nin: ["cancelled", "no_show"] } };

  if (o.operatory) {
    const clash = await AppointmentModel.findOne({
      clinicId: o.clinicId, operatory: o.operatory, ...timeOverlap, ...notTerminal,
      ...(o.excludeId ? { _id: { $ne: o.excludeId } } : {}),
    }).select("_id start end patient doctor").lean();
    if (clash) throw errors.conflictSlot({ conflictWith: String(clash._id), start: clash.start, end: clash.end });
  }

  // A doctor may only double-book across operatories if the clinic allows it.
  if (o.doctor && !o.allowDoctorOverlap) {
    const clash = await AppointmentModel.findOne({
      clinicId: o.clinicId, doctor: o.doctor, ...timeOverlap, ...notTerminal,
      ...(o.excludeId ? { _id: { $ne: o.excludeId } } : {}),
    }).select("_id start end").lean();
    if (clash) throw errors.conflictSlot({ conflictWith: String(clash._id), start: clash.start, end: clash.end, reason: "doctor_busy" });
  }
}

export async function createAppointment(clinicId: string, actorId: string, input: Record<string, unknown>): Promise<AppointmentDoc> {
  const start = new Date(input.start as string);
  const end = new Date(input.end as string);
  if (!(start < end)) throw errors.validation({ end: "End must be after start" });

  await assertNoConflict({
    clinicId, operatory: input.operatory as string | undefined, doctor: input.doctor as string,
    start, end, allowDoctorOverlap: Boolean(input.allowDoctorOverlap),
  });

  return AppointmentModel.create({
    ...input, clinicId, start, end,
    durationMinutes: Math.round((end.getTime() - start.getTime()) / 60000),
    createdBy: actorId, updatedBy: actorId,
  });
}

/** Validate + apply a status transition against the lifecycle map (spec 2.3). */
export async function transition(clinicId: string, id: string, to: AppointmentStatus, actorId: string, extra: Record<string, unknown> = {}): Promise<AppointmentDoc> {
  const appt = await AppointmentModel.findOne({ _id: id, clinicId });
  if (!appt) throw errors.notFound("Appointment");
  const from = appt.status as AppointmentStatus;
  if (!APPOINTMENT_TRANSITIONS[from].includes(to)) {
    throw new AppError(ERROR_CODES.CONFLICT_STATE, `Cannot move an appointment from ${from} to ${to}`);
  }

  appt.status = to;
  appt.updatedBy = actorId as unknown as Types.ObjectId;
  const now = new Date();
  if (to === "confirmed") appt.confirmedAt = now;
  if (to === "checked_in") appt.checkedInAt = now;
  if (to === "in_progress") appt.startedAt = now;
  if (to === "completed") appt.completedAt = now;
  if (to === "cancelled") { appt.cancelledAt = now; appt.cancelReason = String(extra.reason ?? ""); appt.cancelledBy = actorId as unknown as Types.ObjectId; }
  if (to === "no_show") appt.noShow = true;
  await appt.save();

  if (to === "completed") await onCompleted(appt);
  if (to === "no_show") await enqueue("whatsapp", "no_show_followup", { appointmentId: String(appt._id) });

  return appt;
}

/** Completion side-effects (spec 4.5 / Part 6 event-driven): recall, invoice draft, review, inventory. */
async function onCompleted(appt: AppointmentDoc): Promise<void> {
  try {
    // Generate recalls from completed procedures' default intervals.
    if (appt.patient && appt.procedures?.length) {
      const procs = await ProcedureModel.find({ _id: { $in: appt.procedures }, clinicId: appt.clinicId }).select("defaultRecallIntervalDays").lean();
      for (const p of procs) {
        if (p.defaultRecallIntervalDays) {
          const dueDate = new Date(Date.now() + p.defaultRecallIntervalDays * 86400000);
          await RecallModel.create({ clinicId: appt.clinicId, patient: appt.patient, dueDate, intervalDays: p.defaultRecallIntervalDays, source: "auto", fromProcedure: p._id });
        }
      }
    }
    if (appt.patient) await PatientModel.updateOne({ _id: appt.patient, clinicId: appt.clinicId }, { lastVisit: new Date() });
    // Draft invoice, review request and inventory deduction run through the queue.
    await enqueue("pdf", "draft_invoice", { appointmentId: String(appt._id) });
    await enqueue("whatsapp", "review_request", { appointmentId: String(appt._id) });
  } catch (err) {
    logger.error("Appointment completion side-effects failed", { error: (err as Error).message, appointmentId: String(appt._id) });
  }
}

/** Calendar payload: appointments plus the range's resources in one shape (spec 4.5). */
export async function calendarPayload(clinicId: string, from: Date, to: Date): Promise<Record<string, unknown>> {
  const appointments = await AppointmentModel.find({ clinicId, start: { $gte: from, $lte: to } })
    .select("patient doctor operatory operatoryLabel start end status type chiefComplaint colorOverride")
    .populate("patient", "firstName lastName phone")
    .lean();
  return { range: { from, to }, appointments };
}
