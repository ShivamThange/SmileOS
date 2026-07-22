import { AppointmentModel } from "../../models/appointment.model";
import { PaymentModel } from "../../models/billing.model";
import { LeadModel } from "../../models/growth.model";
import { UserModel } from "../../models/user.model";
import { enqueue } from "../queue";
import { logger } from "../../config/logger";
import { activeClinics, startOfToday, endOfToday } from "./util";

/*
 * Owner daily digest (spec Part 6). A once-a-day snapshot — appointments,
 * collections, new leads — queued as an email to each clinic's owner. Numbers
 * come from real records; money stays in paise until the template formats it.
 */
export async function runOwnerDigest(): Promise<{ digests: number }> {
  const from = startOfToday();
  const to = endOfToday();
  const clinics = await activeClinics();
  let digests = 0;

  for (const clinic of clinics) {
    const [appointments, payments, newLeads, owner] = await Promise.all([
      AppointmentModel.countDocuments({ clinicId: clinic._id, start: { $gte: from, $lte: to } }),
      PaymentModel.find({ clinicId: clinic._id, status: "success", date: { $gte: from, $lte: to } }).select("amountPaise").lean(),
      LeadModel.countDocuments({ clinicId: clinic._id, createdAt: { $gte: from, $lte: to } }),
      UserModel.findOne({ clinicId: clinic._id, role: "owner", active: true }).select("email").lean(),
    ]);
    if (!owner?.email) continue;

    const collectedPaise = payments.reduce((s, p) => s + (p.amountPaise ?? 0), 0);
    await enqueue("email", "owner_daily_digest", {
      clinicId: String(clinic._id),
      to: owner.email,
      metrics: { appointments, collectedPaise, newLeads },
    });
    digests += 1;
  }

  logger.info("job:owner-digest", { digests });
  return { digests };
}
