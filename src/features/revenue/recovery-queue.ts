import type { RecoveryRow, Patient } from "@/types";
import { inr } from "@/lib/format";
import { clinicConfig } from "@/config/clinic";
import { renderById } from "@/features/settings/use-templates-store";

/*
 * Scoring the recovery worklist.
 *
 * A list gets worked from the top, and the top of a sorted-by-date list is
 * simply the most recent — which is almost never the most recoverable. So each
 * deferred plan is scored on five things, and the queue is ordered by the
 * result rather than by when the plan happened to be written.
 *
 *   value          — bigger cases are worth the call, all else equal
 *   clinical urgency — a tooth that will abscess outranks a whitening
 *   contact recency  — somebody rung yesterday must not be rung today
 *   responsiveness   — this patient's own history of picking up
 *   plan engagement  — did they open the plan we sent, and how often
 *
 * The last one is the interesting one. Someone who opened their plan three
 * times and never replied is a hot lead who is stuck on something. Someone who
 * never opened it needs an entirely different first sentence. Most practice
 * software cannot tell the two apart and so sends both the same message.
 */

/** How many calls make up a day's queue. Finite, and it empties. */
export const DAILY_QUEUE_SIZE = 8;

export type Outcome = "reached" | "no-answer" | "call-back" | "not-interested" | "booked";

export const OUTCOMES: { id: Outcome; label: string; tone: "primary" | "plain" | "muted" }[] = [
  { id: "booked", label: "Booked", tone: "primary" },
  { id: "reached", label: "Spoke — thinking", tone: "plain" },
  { id: "call-back", label: "Call back", tone: "plain" },
  { id: "no-answer", label: "No answer", tone: "plain" },
  { id: "not-interested", label: "Not now", tone: "muted" },
];

export interface Engagement {
  /** Times the treatment plan link was opened. */
  planViews: number;
  /** Whether they have ever replied to a message from the clinic. */
  everReplied: boolean;
  /** Days since the clinic last made contact; large means overdue a call. */
  daysSinceContact: number;
}

export interface ScoredRow {
  row: RecoveryRow;
  patient: Patient;
  engagement: Engagement;
  score: number;
  /** Why this one is near the top, in one clause. */
  reason: string;
  draft: string;
}

/*
 * Engagement is not in the mock data yet, so it is derived deterministically
 * from the row id. Stable across reloads, which matters — a queue that
 * reshuffles itself on every render is a queue nobody trusts.
 */
function deriveEngagement(row: RecoveryRow): Engagement {
  const seed = row.id.split("").reduce((s, c) => s + c.charCodeAt(0) * 7, 0);
  const never = row.lastContact.toLowerCase().startsWith("never");
  return {
    planViews: seed % 5,
    everReplied: seed % 3 !== 0,
    daysSinceContact: never ? 99 : (seed % 17) + 1,
  };
}

const URGENCY_WEIGHT = { High: 1, Moderate: 0.72, Routine: 0.45 } as const;

export function scoreRow(row: RecoveryRow, patient: Patient): ScoredRow {
  const engagement = deriveEngagement(row);

  // Value, compressed — a ₹2L case matters more than a ₹20k one, but not ten
  // times more, because the ₹20k one might actually say yes today.
  const valueScore = Math.min(1, Math.log10(row.valuePaise / 100 + 1) / 5.5);

  const urgency = URGENCY_WEIGHT[row.urgency];

  // Overdue a call is good; called yesterday is bad.
  const contactScore = Math.min(1, engagement.daysSinceContact / 21);

  const responsiveness = engagement.everReplied ? 0.85 : 0.4;

  // The strongest single signal available: they went and looked at the plan.
  const engagementScore = Math.min(1, engagement.planViews / 3);

  const score = Math.round(
    100 *
      (valueScore * 0.28 +
        urgency * 0.24 +
        contactScore * 0.2 +
        responsiveness * 0.11 +
        engagementScore * 0.17),
  );

  return {
    row,
    patient,
    engagement,
    score,
    reason: explain(row, engagement),
    draft: draftMessage(row, patient, engagement),
  };
}

function explain(row: RecoveryRow, e: Engagement): string {
  if (e.planViews >= 3 && !e.everReplied)
    return `Opened the plan ${e.planViews} times and never replied — they're stuck on something, not uninterested.`;
  if (e.daysSinceContact >= 99) return "Never been contacted about this. Nobody has asked yet.";
  if (row.urgency === "High" && row.due === "overdue")
    return "Clinically urgent and already past the follow-up date.";
  if (e.planViews === 0 && e.daysSinceContact > 14)
    return "Never opened the plan. Worth checking the link even reached them.";
  if (row.urgency === "High") return "High clinical urgency — delay makes this more expensive to fix.";
  if (e.daysSinceContact > 14) return `Last contact was ${e.daysSinceContact} days ago.`;
  return "In reach, and the value justifies the call.";
}

/**
 * A first sentence, already written.
 *
 * The receptionist has forty of these to make. If she has to invent an opening
 * line each time she will make five and stop. Each draft names the specific
 * tooth and the specific reason they held off, because a generic "just checking
 * in about your treatment" is the message patients have learned to ignore.
 */
export function draftMessage(row: RecoveryRow, patient: Patient, e: Engagement): string {
  const vars = {
    name: patient.name.split(" ")[0],
    fullName: patient.name,
    clinic: clinicConfig.name,
    doctor: row.doctor,
    procedure: row.proc.toLowerCase(),
    tooth: row.tooth.toLowerCase(),
    amount: inr(row.valuePaise),
    date: row.planned,
  };

  /*
   * Which template applies is a product decision; the words themselves belong
   * to the clinic. Editing any of these in Settings changes what actually goes
   * out from this queue.
   */
  if (e.planViews >= 3 && !e.everReplied) return renderById("msg.recovery.stuck", vars);
  if (e.planViews === 0) return renderById("msg.recovery.unopened", vars);
  if (row.urgency === "High") return renderById("msg.recovery.urgent", vars);
  return renderById("msg.recovery.general", vars);
}

/** Score, sort, and cut to a day's work. */
export function buildQueue(
  rows: RecoveryRow[],
  patients: Patient[],
  size = DAILY_QUEUE_SIZE,
): ScoredRow[] {
  return rows
    .filter((r) => !r.declined)
    .map((r) => {
      const p = patients.find((x) => x.id === r.patientId);
      return p ? scoreRow(r, p) : null;
    })
    .filter((s): s is ScoredRow => s !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, size);
}
