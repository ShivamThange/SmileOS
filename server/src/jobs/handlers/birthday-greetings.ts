import { PatientModel } from "../../models/patient.model";
import { enqueue } from "../queue";
import { logger } from "../../config/logger";

/*
 * Birthday greetings (spec Part 6). Queues a WhatsApp greeting to patients whose
 * birthday is today and who have opted in. Consent is checked here; quiet hours
 * are enforced downstream by the WhatsApp send.
 */
export async function runBirthdayGreetings(): Promise<{ greeted: number }> {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // Match on month/day of the stored dob regardless of year.
  const patients = await PatientModel.find({
    dob: { $ne: null },
    "marketingConsent.whatsapp": true,
    status: "active",
    $expr: {
      $and: [{ $eq: [{ $month: "$dob" }, month] }, { $eq: [{ $dayOfMonth: "$dob" }, day] }],
    },
  })
    .select("_id clinicId firstName phone")
    .lean();

  for (const patient of patients) {
    await enqueue("whatsapp", "birthday_greeting", {
      clinicId: String(patient.clinicId),
      patient: String(patient._id),
      to: patient.phone,
      respectQuietHours: true,
    });
  }

  logger.info("job:birthday-greetings", { greeted: patients.length });
  return { greeted: patients.length };
}
