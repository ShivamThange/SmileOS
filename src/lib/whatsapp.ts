/*
 * Phone and WhatsApp link helpers.
 *
 * WhatsApp is the clinic's primary channel, not email. Every place a phone
 * number renders should be one tap from a conversation — the desk uses this
 * two hundred times a day. Numbers are stored spaced and unprefixed
 * ("98220 44513"); wa.me needs digits with a country code and no plus.
 */

const DEFAULT_COUNTRY_CODE = "91";

/** Strip formatting and apply the clinic's country code if absent. */
export function normalisePhone(raw: string, countryCode = DEFAULT_COUNTRY_CODE): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith(countryCode) && digits.length > 10) return digits;
  if (digits.length === 10) return countryCode + digits;
  return digits;
}

/** wa.me deep link, optionally pre-filling the first message. */
export function waLink(raw: string, message?: string): string {
  const to = normalisePhone(raw);
  const base = `https://wa.me/${to}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** tel: link for a one-tap call. */
export function telLink(raw: string): string {
  return `tel:+${normalisePhone(raw)}`;
}

/** Display form — "+91 98220 44513". */
export function displayPhone(raw: string, countryCode = DEFAULT_COUNTRY_CODE): string {
  const digits = normalisePhone(raw, countryCode);
  if (!digits) return raw;
  const local = digits.slice(countryCode.length);
  const spaced = local.length === 10 ? `${local.slice(0, 5)} ${local.slice(5)}` : local;
  return `+${countryCode} ${spaced}`;
}

/*
 * Message drafts.
 *
 * These read from the clinic's own templates rather than from string literals
 * here, so an edit in Settings changes what actually goes out. That distinction
 * is the whole point of having a template editor — a settings screen that only
 * changes what the settings screen shows is theatre.
 *
 * Two rules the shipped defaults all follow: name the clinic in the first
 * clause so the patient knows who is writing, and never send a message whose
 * only content is a demand for money.
 */

import { renderById } from "@/features/settings/use-templates-store";

export function draftConfirmation(vars: {
  name: string;
  date: string;
  time: string;
  doctor: string;
  clinic: string;
}): string {
  return renderById("msg.confirmation", vars);
}

export function draftRunningLate(vars: { name: string; clinic: string }): string {
  return renderById("msg.runningLate", vars);
}

export function draftReceipt(vars: { name: string; amount: string; clinic: string }): string {
  return renderById("msg.receipt", vars);
}

export function draftRecall(vars: { name: string; doctor: string; clinic: string }): string {
  return renderById("msg.recall", vars);
}

export function draftPlanSent(vars: {
  name: string;
  doctor: string;
  clinic: string;
  link: string;
}): string {
  return renderById("msg.planSent", vars);
}
