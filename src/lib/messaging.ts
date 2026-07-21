/*
 * The suppression layer.
 *
 * This is the least glamorous module in the product and one of the most
 * important. Three separate engines can now message the same patient — the
 * recovery queue, the recall engine and the treatment-plan follow-up — and each
 * of them, on its own terms, is right to. Between them they can send Ramesh
 * three messages on a Tuesday afternoon, at which point he mutes the clinic and
 * every future message from every engine is worth nothing.
 *
 * WhatsApp makes this sharper than email ever was. Messages cost money, Meta
 * enforces template rules, and a block is permanent and invisible — you don't
 * find out you've been muted, you just stop getting replies.
 *
 * The rules below are deliberately conservative. Retrofitting suppression after
 * an installed base has been trained to ignore you is not really possible.
 */

export type MessageChannel = "whatsapp" | "sms" | "call" | "email";

export type MessageKind =
  /* The patient did something and this is the answer. Never suppressed. */
  | "reply"
  | "receipt"
  | "confirmation"
  /* We initiated it, and it concerns a specific commitment they made. */
  | "reminder"
  | "running-late"
  /* We initiated it, and it is asking for something. Suppressible. */
  | "recovery"
  | "recall"
  | "plan-followup"
  /* Marketing. Suppressed most aggressively. */
  | "campaign"
  | "review-request";

/**
 * Transactional messages answer something the patient just did. Suppressing
 * them would be worse than the noise they create — a receipt that never arrives
 * is a support call.
 */
const TRANSACTIONAL: MessageKind[] = ["reply", "receipt", "confirmation"];

/** Time-critical: about an appointment that exists and is imminent. */
const TIME_CRITICAL: MessageKind[] = ["reminder", "running-late"];

const MARKETING: MessageKind[] = ["campaign", "review-request"];

export interface SentMessage {
  id: string;
  patientId: string;
  kind: MessageKind;
  channel: MessageChannel;
  at: number;
}

export interface SuppressionContext {
  patientId: string;
  kind: MessageKind;
  /** Everything already sent to anyone, most recent first or not — order free. */
  log: SentMessage[];
  /** Hours until this patient's next appointment, if they have one. */
  hoursToNextAppointment?: number;
  /** They have an open plan and we are mid-conversation about it. */
  planConversationOpen?: boolean;
  /** They already have a balance being actively chased. */
  beingChasedForMoney?: boolean;
  /** They asked not to be contacted for a while. */
  suppressedUntil?: number;
  /** Override for tests; defaults to now. */
  now?: number;
}

export interface Verdict {
  allowed: boolean;
  /** "block" stops the send. "warn" lets it through with a visible caution. */
  severity: "ok" | "warn" | "block";
  /** Written for the receptionist, not for a log file. */
  reason?: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Clinic quiet hours, local time. Nothing goes out outside these. */
const EARLIEST_HOUR = 8;
const LATEST_HOUR = 21;

export function checkSuppression(ctx: SuppressionContext): Verdict {
  const now = ctx.now ?? Date.now();
  const mine = ctx.log.filter((m) => m.patientId === ctx.patientId);

  // Transactional messages always go. They are answers, not approaches.
  if (TRANSACTIONAL.includes(ctx.kind)) return { allowed: true, severity: "ok" };

  // --- hard blocks ---------------------------------------------------------

  if (ctx.suppressedUntil && now < ctx.suppressedUntil) {
    const days = Math.ceil((ctx.suppressedUntil - now) / DAY);
    return {
      allowed: false,
      severity: "block",
      reason: `They asked us to leave it — ${days} day${days === 1 ? "" : "s"} still to go.`,
    };
  }

  const hour = new Date(now).getHours();
  if (hour < EARLIEST_HOUR || hour >= LATEST_HOUR) {
    return {
      allowed: false,
      severity: "block",
      reason: `It's outside messaging hours (${EARLIEST_HOUR}am–${LATEST_HOUR - 12}pm). It'll queue for the morning.`,
    };
  }

  /*
   * One message per patient per day, across every channel. This single rule
   * does more for deliverability than any amount of template tuning.
   */
  const today = mine.filter((m) => now - m.at < DAY && !TRANSACTIONAL.includes(m.kind));
  if (today.length > 0) {
    const last = today.sort((a, b) => b.at - a.at)[0];
    return {
      allowed: false,
      severity: "block",
      reason: `Already messaged today about ${describe(last.kind)}. One a day, across all channels.`,
    };
  }

  // --- context blocks ------------------------------------------------------

  /*
   * Someone due in tomorrow does not need chasing about money or recalls. They
   * are about to be standing in front of you, which is a far better place to
   * have that conversation.
   */
  if (
    ctx.hoursToNextAppointment !== undefined &&
    ctx.hoursToNextAppointment <= 48 &&
    !TIME_CRITICAL.includes(ctx.kind)
  ) {
    return {
      allowed: false,
      severity: "block",
      reason: `They're in within ${Math.round(ctx.hoursToNextAppointment)}h — have this conversation at the desk instead.`,
    };
  }

  if (MARKETING.includes(ctx.kind) && ctx.beingChasedForMoney) {
    return {
      allowed: false,
      severity: "block",
      reason: "They owe us money and we're already chasing it. Marketing on top of that reads badly.",
    };
  }

  if (ctx.kind === "recall" && ctx.planConversationOpen) {
    return {
      allowed: false,
      severity: "block",
      reason: "We're mid-conversation about their treatment plan. A recall now cuts across it.",
    };
  }

  // --- warnings ------------------------------------------------------------

  const thisWeek = mine.filter((m) => now - m.at < 7 * DAY && !TRANSACTIONAL.includes(m.kind));
  if (thisWeek.length >= 2) {
    return {
      allowed: true,
      severity: "warn",
      reason: `Third approach this week. Worth a call instead — messages are starting to stack up.`,
    };
  }

  if (ctx.kind === "recovery" && ctx.planConversationOpen) {
    return {
      allowed: true,
      severity: "warn",
      reason: "They're reading the plan. Reference what they've been looking at rather than the balance.",
    };
  }

  return { allowed: true, severity: "ok" };
}

function describe(kind: MessageKind): string {
  switch (kind) {
    case "recovery":
      return "unscheduled treatment";
    case "recall":
      return "their check-up being due";
    case "plan-followup":
      return "their treatment plan";
    case "campaign":
      return "a promotion";
    case "review-request":
      return "leaving a review";
    case "reminder":
      return "an upcoming appointment";
    case "running-late":
      return "running late";
    default:
      return "something else";
  }
}

/** Human label for the kind, used in the message log UI. */
export const MESSAGE_KIND_LABEL: Record<MessageKind, string> = {
  reply: "Reply",
  receipt: "Receipt",
  confirmation: "Confirmation",
  reminder: "Reminder",
  "running-late": "Running late",
  recovery: "Recovery",
  recall: "Recall",
  "plan-followup": "Plan follow-up",
  campaign: "Campaign",
  "review-request": "Review request",
};
