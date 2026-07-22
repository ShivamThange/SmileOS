import { PatientModel } from "../../models/patient.model";
import { RecallModel } from "../../models/recall.model";
import { logger } from "../../config/logger";
import { activeClinics } from "./util";

/*
 * Recall generator (spec Part 6 / 2.5). Daily sweep for lapsed patients: an
 * active patient whose last visit is past the hygiene interval and who has no
 * open recall gets a hygiene recall. Bounded per clinic per run so a first run
 * on a large clinic can't stampede.
 */
const HYGIENE_INTERVAL_DAYS = 180;
const LAPSE_THRESHOLD_DAYS = 165; // create slightly before the full interval
const MAX_PER_CLINIC = 200;

export async function runRecallGenerator(): Promise<{ clinics: number; created: number }> {
  const cutoff = new Date(Date.now() - LAPSE_THRESHOLD_DAYS * 86_400_000);
  const clinics = await activeClinics();
  let created = 0;

  for (const clinic of clinics) {
    const patients = await PatientModel.find({
      clinicId: clinic._id,
      status: "active",
      lastVisit: { $lt: cutoff },
    })
      .select("_id lastVisit")
      .limit(MAX_PER_CLINIC)
      .lean();

    for (const patient of patients) {
      const open = await RecallModel.findOne({
        clinicId: clinic._id,
        patient: patient._id,
        status: { $in: ["pending", "contacted", "scheduled"] },
      })
        .select("_id")
        .lean();
      if (open) continue;

      const base = patient.lastVisit ? new Date(patient.lastVisit) : new Date();
      const dueDate = new Date(base.getTime() + HYGIENE_INTERVAL_DAYS * 86_400_000);
      await RecallModel.create({
        clinicId: clinic._id,
        patient: patient._id,
        type: "hygiene",
        source: "auto",
        dueDate,
        intervalDays: HYGIENE_INTERVAL_DAYS,
        priority: "routine",
        status: "pending",
      });
      created += 1;
    }
  }

  logger.info("job:recall-generator", { clinics: clinics.length, created });
  return { clinics: clinics.length, created };
}
