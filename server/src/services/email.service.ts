import { env } from "../config/env";
import { logger } from "../config/logger";
import { enqueue } from "../jobs/queue";

/*
 * Email service (spec 5.1). Transactional sends are queued with retry and
 * delivered by the email worker (jobs/workers.ts → deliverEmail below). A send
 * is "configured" when either a Resend API key or an SMTP URL is present; with
 * neither, the service no-ops and logs a preview so the OTP flow stays
 * exercisable in local development (the code prints to the server log).
 */

export interface EmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  template?: string;
  data?: Record<string, unknown>;
}

/** True when a real delivery channel is configured. */
export function emailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY || env.SMTP_URL);
}

export async function sendEmail(input: EmailInput): Promise<void> {
  if (!emailConfigured()) {
    logger.info("Email (no provider configured — logged only)", { to: input.to, subject: input.subject, preview: input.text.slice(0, 140) });
    return;
  }
  // Queue for retry when Redis is available; fall back to an inline send when the
  // queue is degraded so transactional mail (e.g. OTP) is never silently dropped.
  const queued = await enqueue("email", "send", input);
  if (!queued) await deliverEmail(input);
}

/**
 * Perform the actual delivery. Called by the email queue worker (and inline when
 * the queue is degraded). Prefers the Resend HTTP API; falls back to SMTP.
 */
export async function deliverEmail(input: EmailInput): Promise<void> {
  if (env.RESEND_API_KEY) {
    await deliverViaResend(input);
    return;
  }
  if (env.SMTP_URL) {
    // SMTP transport is intentionally not bundled (no nodemailer dependency).
    // Configure RESEND_API_KEY for real delivery, or add an SMTP transport here.
    logger.warn("SMTP_URL set but no SMTP transport is bundled — set RESEND_API_KEY to deliver", { to: input.to });
    return;
  }
  logger.info("Email (no provider configured — logged only)", { to: input.to, subject: input.subject });
}

async function deliverViaResend(input: EmailInput): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error("Resend delivery failed", { status: res.status, to: input.to, detail: detail.slice(0, 300) });
    // Throw so the queue worker retries (attempts/backoff configured in queue.ts).
    throw new Error(`Resend responded ${res.status}`);
  }
  const body = (await res.json().catch(() => ({}))) as { id?: string };
  logger.info("Email sent", { to: input.to, subject: input.subject, id: body.id });
}

/** Convenience: dispatch an OTP code email. */
export async function sendOtpEmail(to: string, code: string, purpose: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Your DentalOS verification code",
    text: `Your verification code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes. (${purpose})`,
    html: `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1a1a1a">
      <p>Your DentalOS verification code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:12px 0">${code}</p>
      <p style="color:#666">It expires in ${env.OTP_TTL_MINUTES} minutes.</p>
    </div>`,
  });
}
