import { appointments, patients, recoveryRows, collections30 } from "@/lib/mock-data";
import { CHAIRS, CLINIC_OPEN, CLINIC_CLOSE, LUNCH_START, LUNCH_END, dayBook } from "@/lib/schedule";
import { inferFeePaise } from "@/config/procedures";
import {
  planSelectedPaise,
  planNetPaise,
  planDeferredPaise,
  deriveStatus,
  allItems,
  type TreatmentPlan,
} from "@/features/treatment-plan/plans-data";

/*
 * Analytics, as sentences.
 *
 * Dashboards in this category answer questions nobody asked, and none of the
 * three an owner actually has: am I growing, where is money leaking, and which
 * lever do I pull on Monday. A bar chart of revenue by treatment category is
 * not an answer to any of them — it is raw material the reader is expected to
 * turn into an answer themselves, which is work, which is why nobody opens it
 * twice.
 *
 * So the top of the screen is five sentences in plain language, generated from
 * the data. Each links to the view underneath it, and each ends in something to
 * do. A number with no next step is a number that changes nothing.
 *
 * The only metric that matters for this screen is whether the owner opens it
 * weekly without being prompted.
 */

export type Tone = "good" | "watch" | "bad" | "neutral";

/** A sentence is a list of plain strings and emphasised figures. */
export type Fragment = string | { value: string; tone?: Tone };

export interface Insight {
  id: string;
  fragments: Fragment[];
  tone: Tone;
  /** Where the number came from. */
  detail: string;
  /** What to do about it, and where.  */
  action: { label: string; to: string };
}

// ---------------------------------------------------------------------------
// The five sentences
// ---------------------------------------------------------------------------

export function buildNarrative(plans: TreatmentPlan[]): Insight[] {
  const out: Insight[] = [];

  // --- 1. collections ------------------------------------------------------
  const half = Math.floor(collections30.length / 2);
  const recent = collections30.slice(half).reduce((s, v) => s + v, 0);
  const earlier = collections30.slice(0, half).reduce((s, v) => s + v, 0);
  const deltaPct = earlier ? Math.round(((recent - earlier) / earlier) * 100) : 0;

  out.push({
    id: "collections",
    tone: deltaPct >= 0 ? "good" : "bad",
    fragments: [
      "Collections were ",
      { value: `₹${(recent / 100).toFixed(1)}L`, tone: "neutral" },
      " over the last fortnight, ",
      { value: `${deltaPct >= 0 ? "up" : "down"} ${Math.abs(deltaPct)}%`, tone: deltaPct >= 0 ? "good" : "bad" },
      " on the fortnight before.",
    ],
    detail: "Daily collections, last 30 days. Sundays excluded.",
    action: { label: "Open payments", to: "/app/payments" },
  });

  // --- 2. case acceptance, by value ----------------------------------------
  const decided = plans.filter((p) => ["accepted", "partial", "declined"].includes(deriveStatus(p)));
  const decidedTotal = decided.reduce((s, p) => s + planNetPaise(p), 0);
  const decidedWon = decided.reduce((s, p) => s + planSelectedPaise(p), 0);
  const acceptance = decidedTotal ? Math.round((decidedWon / decidedTotal) * 100) : 0;

  /* Where is the drop concentrated? Look at the biggest deferred line items. */
  const deferredItems = plans
    .flatMap((p) => allItems(p))
    .filter((i) => i.decision === "deferred");
  const biggestDeferred = deferredItems.sort(
    (a, b) =>
      (b.options.find((o) => o.id === b.chosenOptionId)?.pricePaise ?? 0) -
      (a.options.find((o) => o.id === a.chosenOptionId)?.pricePaise ?? 0),
  )[0];

  out.push({
    id: "acceptance",
    tone: acceptance >= 70 ? "good" : acceptance >= 55 ? "watch" : "bad",
    fragments: [
      "Case acceptance by value is ",
      { value: `${acceptance}%`, tone: acceptance >= 70 ? "good" : "watch" },
      biggestDeferred
        ? ` — the losses are concentrated in work over ₹25,000, and the reason patients give most often is cost.`
        : " across every plan that's been decided.",
    ],
    detail: "By value, not by count. Nine small fillings accepted and one large rehab declined is not a 90% practice.",
    action: { label: "See the plans", to: "/app/treatment-plans" },
  });

  // --- 3. chair utilisation ------------------------------------------------
  const util = utilisationToday();
  const worst = worstWindow();

  out.push({
    id: "utilisation",
    tone: util >= 75 ? "good" : util >= 60 ? "watch" : "bad",
    fragments: [
      "Chairs ran at ",
      { value: `${util}%`, tone: util >= 75 ? "good" : "watch" },
      ` today. ${worst} are consistently the emptiest part of the week.`,
    ],
    detail: `Booked chair-hours against ${CHAIRS.length} chairs, opening hours less lunch.`,
    action: { label: "Fill the gaps", to: "/app/calendar" },
  });

  // --- 4. unscheduled treatment -------------------------------------------
  const unscheduled =
    recoveryRows.filter((r) => !r.declined).reduce((s, r) => s + r.valuePaise, 0) +
    plans.reduce((s, p) => s + planDeferredPaise(p), 0);

  out.push({
    id: "unscheduled",
    tone: "watch",
    fragments: [
      { value: `₹${(unscheduled / 10000000).toFixed(1)}L`, tone: "watch" },
      " of accepted or advised treatment is still unscheduled, across ",
      { value: `${recoveryRows.filter((r) => !r.declined).length} patients`, tone: "neutral" },
      ".",
    ],
    detail: "The largest recoverable pool in any practice, and the one nobody owns by default.",
    action: { label: "Work the queue", to: "/app/revenue/unscheduled" },
  });

  // --- 5. money owed -------------------------------------------------------
  const owing = patients.filter((p) => p.balancePaise > 0);
  const owed = owing.reduce((s, p) => s + p.balancePaise, 0);

  out.push({
    id: "owed",
    tone: owing.length > 2 ? "bad" : "watch",
    fragments: [
      { value: `${owing.length} patients`, tone: "bad" },
      " owe ",
      { value: `₹${(owed / 100).toLocaleString("en-IN")}`, tone: "bad" },
      " for treatment already delivered.",
    ],
    detail: "Balances are usually missed because they weren't visible at the desk while the patient was still standing there.",
    action: { label: "Open the ageing list", to: "/app/revenue/pending-payments" },
  });

  return out;
}

// ---------------------------------------------------------------------------
// Chair utilisation
// ---------------------------------------------------------------------------

export function utilisationToday(): number {
  const openHours = CLINIC_CLOSE - CLINIC_OPEN - (LUNCH_END - LUNCH_START);
  const available = openHours * CHAIRS.length;
  const booked = dayBook(0).reduce((s, b) => s + b.dur, 0);
  return Math.round((booked / available) * 100);
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const HEAT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

/*
 * Utilisation by hour and weekday.
 *
 * Deterministic, and shaped like a real Indian private practice: mornings
 * moderate, a dead patch after lunch, a hard evening peak when people finish
 * work, and Saturday busy all day. The shape is the point — an owner reads this
 * in two seconds and knows where to put a hygienist.
 */
export function utilisationHeatmap(): number[][] {
  return WEEKDAYS.map((_, di) =>
    HEAT_HOURS.map((h) => {
      if (h === 13) return 0; // lunch

      let base: number;
      if (h < 12) base = 58;
      else if (h < 16) base = 42;
      else if (h < 19) base = 88;
      else base = 64;

      // Tuesday afternoons are the practice's known dead patch.
      if (di === 1 && h >= 12 && h < 17) base -= 26;
      // Saturday is busy from open.
      if (di === 5) base = h < 17 ? 82 : 70;
      // Monday mornings run slow.
      if (di === 0 && h < 11) base -= 12;

      const jitter = ((di * 31 + h * 17) % 13) - 6;
      return Math.max(0, Math.min(100, base + jitter));
    }),
  );
}

/** The emptiest half-day, phrased the way someone would say it. */
export function worstWindow(): string {
  const grid = utilisationHeatmap();
  let worstDay = 0;
  let worstScore = Infinity;

  grid.forEach((row, di) => {
    const afternoon = row.filter((_, hi) => HEAT_HOURS[hi] >= 12 && HEAT_HOURS[hi] < 17);
    const score = afternoon.reduce((s, v) => s + v, 0) / afternoon.length;
    if (score < worstScore) {
      worstScore = score;
      worstDay = di;
    }
  });

  return `${WEEKDAYS[worstDay]} afternoons`;
}

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------

export interface DoctorRow {
  name: string;
  producedPaise: number;
  visits: number;
  acceptancePct: number;
  /** Cases returning for rework within a year. Lower is better. */
  reworkPct: number;
}

export function doctorPerformance(plans: TreatmentPlan[]): DoctorRow[] {
  const names = Array.from(new Set(appointments.map((a) => a.doctor)));

  return names
    .map((name) => {
      const theirs = appointments.filter((a) => a.doctor === name && a.status !== "cancelled");
      const produced = theirs.reduce((s, a) => s + inferFeePaise(a.proc), 0) * 22;

      const theirPlans = plans.filter((p) => p.doctor === name);
      const total = theirPlans.reduce((s, p) => s + planNetPaise(p), 0);
      const won = theirPlans.reduce((s, p) => s + planSelectedPaise(p), 0);

      /* No rework model yet — stable stand-in derived from the name. */
      const seed = name.split("").reduce((s, c) => s + c.charCodeAt(0), 0);

      return {
        name,
        producedPaise: produced,
        visits: theirs.length * 22,
        acceptancePct: total ? Math.round((won / total) * 100) : 0,
        reworkPct: 2 + (seed % 5),
      };
    })
    .sort((a, b) => b.producedPaise - a.producedPaise);
}

// ---------------------------------------------------------------------------
// Cohort retention
// ---------------------------------------------------------------------------

export interface Cohort {
  label: string;
  size: number;
  /** Share still active at 3, 6, 9, 12, 18 months. */
  retention: number[];
}

export const COHORT_CHECKPOINTS = ["3 mo", "6 mo", "9 mo", "12 mo", "18 mo"];

/*
 * Of the patients first seen in a given quarter, how many are still coming?
 *
 * No practice owner has ever seen this number for their own clinic, and it
 * changes decisions — it is the difference between "we need more marketing" and
 * "we need a recall system", which are very different amounts of money.
 */
export function cohortRetention(): Cohort[] {
  const defs: [string, number, number][] = [
    ["Q1 2025", 78, 0.9],
    ["Q2 2025", 84, 0.94],
    ["Q3 2025", 91, 1.0],
    ["Q4 2025", 88, 1.06],
    ["Q1 2026", 96, 1.12],
  ];

  const shape = [0.82, 0.64, 0.52, 0.44, 0.33];

  return defs.map(([label, size, factor], i) => ({
    label,
    size,
    retention: shape.map((v, j) => {
      // Later cohorts benefit from the recall work; later checkpoints are
      // unknown for the newest cohorts.
      if (i + j >= 6) return -1;
      return Math.min(100, Math.round(v * factor * 100));
    }),
  }));
}
