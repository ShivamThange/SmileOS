import { InstalmentPlanModel } from "../../models/billing.model";
import { enqueue } from "../queue";
import { logger } from "../../config/logger";

/*
 * Overdue instalment reminders (spec Part 6). Marks past-due schedule entries
 * overdue and queues one reminder, throttled so a patient isn't messaged more
 * than once every three days for the same instalment.
 */
const REMINDER_THROTTLE_MS = 3 * 24 * 60 * 60 * 1000;

export async function runOverdueInstalments(): Promise<{ plans: number; reminders: number }> {
  const now = new Date();
  const plans = await InstalmentPlanModel.find({ status: "active", "schedule.dueDate": { $lt: now } });

  let reminders = 0;
  let touched = 0;

  for (const plan of plans) {
    let changed = false;
    for (const entry of plan.schedule ?? []) {
      if (entry.status === "paid" || !entry.dueDate || new Date(entry.dueDate) >= now) continue;

      if (entry.status !== "overdue") {
        entry.status = "overdue";
        changed = true;
      }

      const lastReminder = (entry.reminders ?? []).at(-1)?.sentAt;
      const due = !lastReminder || now.getTime() - new Date(lastReminder).getTime() > REMINDER_THROTTLE_MS;
      if (due) {
        entry.reminders = [...(entry.reminders ?? []), { sentAt: now }] as never;
        changed = true;
        await enqueue("whatsapp", "instalment_overdue_reminder", {
          clinicId: String(plan.clinicId),
          patient: String(plan.patient),
          instalmentPlan: String(plan._id),
          sequence: entry.sequence,
          amountPaise: entry.amountPaise,
        });
        reminders += 1;
      }
    }
    if (changed) {
      touched += 1;
      await plan.save();
    }
  }

  logger.info("job:overdue-instalments", { plans: touched, reminders });
  return { plans: touched, reminders };
}
