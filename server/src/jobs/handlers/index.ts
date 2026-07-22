import { runInventoryAlerts } from "./inventory-alerts";
import { runOverdueInstalments } from "./overdue-instalments";
import { runRecallGenerator } from "./recall-generator";
import { runBirthdayGreetings } from "./birthday-greetings";
import { runOwnerDigest } from "./owner-digest";
import { runReminderDispatcher } from "./reminder-dispatcher";

/*
 * Scheduled-job dispatch table. Maps a repeatable job's name (registered in
 * workers.ts SCHEDULES) to the handler that does the real work. Names not in
 * this table fall through to the log-only processor (still stubs: reminder
 * dispatch, reconciliation, materialisation — those need the external
 * integrations wired first).
 */
export const SCHEDULED_HANDLERS: Record<string, () => Promise<unknown>> = {
  "reminder-dispatcher": runReminderDispatcher,
  "inventory-alerts": runInventoryAlerts,
  "overdue-instalment-reminders": runOverdueInstalments,
  "recall-generator": runRecallGenerator,
  "birthday-greetings": runBirthdayGreetings,
  "owner-daily-digest": runOwnerDigest,
};

export {
  runInventoryAlerts,
  runOverdueInstalments,
  runRecallGenerator,
  runBirthdayGreetings,
  runOwnerDigest,
  runReminderDispatcher,
};
