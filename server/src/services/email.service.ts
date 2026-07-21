import { env } from "../config/env";
import { logger } from "../config/logger";
import { enqueue } from "../jobs/queue";

/*
 * Email service (spec 5.1). Transactional sends are queued with retry. Without
 * SMTP configured (SMTP_URL empty) the service no-ops and logs — so the OTP
 * flow is fully exercisable in development (the code is printed to the log).
 */

export interface EmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  template?: string;
  data?: Record<string, unknown>;
}

export async function sendEmail(input: EmailInput): Promise<void> {
  if (!env.SMTP_URL) {
    logger.info("Email (no SMTP configured — logged only)", { to: input.to, subject: input.subject, preview: input.text.slice(0, 140) });
    return;
  }
  // Real send is performed by the email queue worker (spec Part 6).
  await enqueue("email", "send", input);
}

/** Convenience: dispatch an OTP code email. */
export async function sendOtpEmail(to: string, code: string, purpose: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Your DentalOS verification code",
    text: `Your verification code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes. (${purpose})`,
  });
}
