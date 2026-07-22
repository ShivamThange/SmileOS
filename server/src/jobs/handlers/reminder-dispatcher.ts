import { AppointmentModel } from "../../models/appointment.model";
import { enqueue } from "../queue";
import { logger } from "../../config/logger";

/*
 * Appointment reminder dispatcher (spec Part 6). Runs frequently; sends a
 * reminder as each upcoming appointment enters a reminder band. Two bands —
 * ~24h and ~2h before — deduped by the reminders already recorded on the
 * appointment, so each band fires at most once. Quiet hours are enforced
 * downstream by the WhatsApp send.
 */
const BANDS = [
  { hoursBefore: 24, loHours: 2, hiHours: 24 },
  { hoursBefore: 2, loHours: 0, hiHours: 2 },
];

export async function runReminderDispatcher(): Promise<{ sent: number }> {
  const now = Date.now();
  let sent = 0;

  for (const band of BANDS) {
    const from = new Date(now + band.loHours * 3_600_000);
    const to = new Date(now + band.hiHours * 3_600_000);
    const appts = await AppointmentModel.find({
      status: { $in: ["scheduled", "confirmed"] },
      start: { $gt: from, $lte: to },
      "reminders.hoursBefore": { $ne: band.hoursBefore },
      patient: { $ne: null },
    }).select("_id clinicId patient start reminders");

    for (const appt of appts) {
      appt.reminders.push({ channel: "whatsapp", sentAt: new Date(), status: "queued", hoursBefore: band.hoursBefore } as never);
      await appt.save();
      await enqueue("whatsapp", "appointment_reminder", {
        clinicId: String(appt.clinicId),
        appointmentId: String(appt._id),
        patient: String(appt.patient),
        hoursBefore: band.hoursBefore,
      });
      sent += 1;
    }
  }

  logger.info("job:reminder-dispatcher", { sent });
  return { sent };
}
