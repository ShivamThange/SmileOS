import { AppointmentModel } from "../models/appointment.model";
import { ReviewModel } from "../models/growth.model";
import { deductForProcedure } from "../modules/operations/operations.service";
import { requestReview } from "../modules/reputation/reputation.service";
import { logger } from "../config/logger";

/*
 * Domain event fan-out (spec Part 6, event-driven jobs). These run the
 * follow-on effects of a domain event. They are best-effort: a failure here is
 * logged but never rolls back the action that triggered it — a completed
 * appointment stays completed even if a downstream deduction fails.
 */

/**
 * Appointment completed → deduct the consumables for each procedure performed
 * and queue a review request (once per appointment). Recall generation is
 * handled by the daily generator, so it isn't duplicated here.
 */
export async function onAppointmentCompleted(clinicId: string, actorId: string, appointmentId: string): Promise<void> {
  try {
    const appt = await AppointmentModel.findOne({ _id: appointmentId, clinicId }).select("patient procedures").lean();
    if (!appt) return;

    for (const procedureId of appt.procedures ?? []) {
      await deductForProcedure(clinicId, actorId, String(procedureId), `appointment:${appointmentId}`);
    }

    if (appt.patient) {
      const existing = await ReviewModel.findOne({ clinicId, appointment: appointmentId }).select("_id").lean();
      if (!existing) {
        await requestReview(clinicId, actorId, { patient: String(appt.patient), appointment: appointmentId, channel: "whatsapp" });
      }
    }
  } catch (err) {
    logger.error("event:appointment-completed fan-out failed", { appointmentId, error: (err as Error).message });
  }
}
