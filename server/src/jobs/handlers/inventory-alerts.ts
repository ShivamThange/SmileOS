import { NotificationModel } from "../../models/communication.model";
import { lowStock, expiringSoon } from "../../modules/operations/operations.service";
import { logger } from "../../config/logger";
import { activeClinics, clinicAdmins, startOfToday } from "./util";

/*
 * Inventory alerts (spec Part 6). Once a day, surface low-stock and soon-to-
 * expire items to each clinic's owners/admins as notifications. Idempotent per
 * day: a second run doesn't duplicate the alert.
 */
export async function runInventoryAlerts(): Promise<{ clinics: number; alerts: number }> {
  let alerts = 0;
  const clinics = await activeClinics();

  for (const clinic of clinics) {
    const clinicId = String(clinic._id);
    const [low, expiring] = await Promise.all([lowStock(clinicId), expiringSoon(clinicId, 30)]);
    if (low.length === 0 && expiring.length === 0) continue;

    const admins = await clinicAdmins(clinic._id);
    const title = "Inventory needs attention";
    const body = [
      low.length ? `${low.length} item(s) at/below reorder level` : null,
      expiring.length ? `${expiring.length} item(s) expiring within 30 days` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    for (const admin of admins) {
      // De-dupe: skip if this admin already got today's inventory alert.
      const existing = await NotificationModel.findOne({
        clinicId: clinic._id,
        recipient: admin._id,
        type: "inventory_alert",
        createdAt: { $gte: startOfToday() },
      })
        .select("_id")
        .lean();
      if (existing) continue;

      await NotificationModel.create({
        clinicId: clinic._id,
        recipient: admin._id,
        type: "inventory_alert",
        title,
        body,
        link: "/app/operations/inventory",
        priority: "high",
      });
      alerts += 1;
    }
  }

  logger.info("job:inventory-alerts", { clinics: clinics.length, alerts });
  return { clinics: clinics.length, alerts };
}
