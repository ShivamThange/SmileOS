import { env } from "../config/env";
import { logger } from "../config/logger";
import { QUIET_HOURS } from "../config/constants";
import { enqueue } from "../jobs/queue";

/*
 * WhatsApp Business Cloud service (spec 5.4). Template sends within the 24-hour
 * window, quiet-hours suppression (mandatory), and delivery tracking. Without a
 * token configured it no-ops and logs, so reminder flows are exercisable.
 */

/** True if the current clinic-local hour falls inside quiet hours (spec 2.8). */
export function inQuietHours(date = new Date()): boolean {
  const h = date.getHours();
  return h >= QUIET_HOURS.start || h < QUIET_HOURS.end;
}

export interface WaSend { to: string; template: string; variables?: Record<string, string>; respectQuietHours?: boolean; }

export async function sendTemplate(input: WaSend): Promise<{ queued: boolean; suppressed?: boolean }> {
  if (input.respectQuietHours !== false && inQuietHours()) {
    logger.info("WhatsApp suppressed — quiet hours", { template: input.template });
    return { queued: false, suppressed: true };
  }
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) {
    logger.info("WhatsApp not configured — logged only", { to: input.to, template: input.template });
    return { queued: false };
  }
  await enqueue("whatsapp", "template", input);
  return { queued: true };
}
