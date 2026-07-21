import type { Findings, ToothCondition, SurfaceCondition, SurfaceKey } from "@/components/domain/odontogram";
import { SURFACE_CONDITIONS, TOOTH_CONDITIONS } from "@/components/domain/odontogram";

/*
 * Charts are versions, not a current state.
 *
 * Most practice software stores one odontogram per patient and overwrites it.
 * That is a strange thing to do with a clinical record — it throws away the
 * only view that answers the question patients actually ask, which is "is my
 * mouth getting better or worse?".
 *
 * Keeping every chart as a version costs almost nothing here (the backend spec
 * already commits to soft deletes and an append-only event log, so the history
 * effectively exists whether or not anyone exposes it) and unlocks two things:
 *
 *   For the dentist — what changed since last time, computed rather than
 *   remembered, which is the single most useful thing to see before picking up
 *   an instrument.
 *
 *   For the patient — their own mouth over three years, as a slider. It is the
 *   most persuasive clinical artefact that exists, and unlike almost every
 *   other health record it is genuinely interesting to look at. It gets
 *   forwarded to a spouse, which is exactly what we want.
 */

export interface ChartVersion {
  id: string;
  patientId: string;
  /** Display date — "12 Jun 2026". */
  date: string;
  /** Sortable. */
  ts: number;
  by: string;
  /** One line on why this chart was taken. */
  note: string;
  findings: Findings;
  /** How this version was captured — matters for trust in the record. */
  source: "examination" | "dictated" | "migrated" | "radiograph";
}

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day).getTime();

/*
 * Ramesh Iyer — four charts across three years. The arc is deliberately the
 * ordinary one: a small cavity that got bigger, a tooth that was saved, a tooth
 * that wasn't, and the consequences arriving in the teeth either side.
 */
export const chartVersions: ChartVersion[] = [
  {
    id: "cv_p1_1",
    patientId: "p1",
    date: "14 Mar 2023",
    ts: d(2023, 3, 14),
    by: "Dr. Meher",
    note: "First full examination. Generally sound; some wear on the upper front teeth.",
    source: "examination",
    findings: {
      11: { surfaces: { buccal: "wear" } },
      21: { surfaces: { buccal: "wear" } },
      16: { surfaces: { occlusal: "caries" } },
      38: { tooth: "missing" },
      48: { tooth: "missing" },
    },
  },
  {
    id: "cv_p1_2",
    patientId: "p1",
    date: "8 Feb 2024",
    ts: d(2024, 2, 8),
    by: "Dr. Meher",
    note: "Recall. 16 restored. 36 heavily broken down, root canal attempted elsewhere.",
    source: "examination",
    findings: {
      11: { surfaces: { buccal: "wear" } },
      21: { surfaces: { buccal: "wear" } },
      16: { surfaces: { occlusal: "filled" } },
      36: { surfaces: { occlusal: "caries", mesial: "caries" }, tooth: "rct" },
      38: { tooth: "missing" },
      48: { tooth: "missing" },
    },
  },
  {
    id: "cv_p1_3",
    patientId: "p1",
    date: "21 Nov 2024",
    ts: d(2024, 11, 21),
    by: "Dr. Kulkarni",
    note: "36 fractured below the gum and could not be kept. Extracted. 46 crowned.",
    source: "examination",
    findings: {
      11: { surfaces: { buccal: "wear" } },
      21: { surfaces: { buccal: "wear" } },
      16: { surfaces: { occlusal: "filled" } },
      36: { tooth: "missing" },
      46: { tooth: "crown" },
      47: { tooth: "rct" },
      38: { tooth: "missing" },
      48: { tooth: "missing" },
    },
  },
  {
    id: "cv_p1_4",
    patientId: "p1",
    date: "12 Jun 2026",
    ts: d(2026, 6, 12),
    by: "Dr. Meher",
    note: "The old filling in 16 has cracked. 35 tipping into the 36 space. Implant discussed.",
    source: "dictated",
    findings: {
      11: { surfaces: { buccal: "wear" } },
      21: { surfaces: { buccal: "wear" } },
      16: { surfaces: { occlusal: "caries", mesial: "caries" }, tooth: "plannedTooth" },
      15: { surfaces: { distal: "caries" } },
      36: { tooth: "missing" },
      46: { tooth: "crown" },
      47: { tooth: "rct" },
      38: { tooth: "missing" },
      48: { tooth: "missing" },
    },
  },

  /* Sunita — the upper arch failing over two years. */
  {
    id: "cv_p2_1",
    patientId: "p2",
    date: "10 Jan 2024",
    ts: d(2024, 1, 10),
    by: "Dr. Meher",
    note: "Generalised periodontal disease, upper arch worst affected.",
    source: "examination",
    findings: {
      14: { surfaces: { distal: "caries" } },
      16: { surfaces: { occlusal: "filled" } },
      26: { surfaces: { occlusal: "filled" } },
    },
  },
  {
    id: "cv_p2_2",
    patientId: "p2",
    date: "24 Jun 2026",
    ts: d(2026, 6, 24),
    by: "Dr. Meher",
    note: "14, 15 and 16 now grade III mobile and non-restorable. Full-arch options discussed.",
    source: "examination",
    findings: {
      14: { tooth: "plannedTooth", surfaces: { distal: "caries" } },
      15: { tooth: "plannedTooth" },
      16: { tooth: "plannedTooth", surfaces: { occlusal: "caries" } },
      26: { surfaces: { occlusal: "filled" } },
      36: { tooth: "missing" },
    },
  },

  /* Vikram — one tooth, getting worse. */
  {
    id: "cv_p5_1",
    patientId: "p5",
    date: "2 Aug 2025",
    ts: d(2025, 8, 2),
    by: "Dr. Kulkarni",
    note: "Early occlusal caries on 46. Watch and review.",
    source: "examination",
    findings: { 46: { surfaces: { occlusal: "caries" } } },
  },
  {
    id: "cv_p5_2",
    patientId: "p5",
    date: "30 Jun 2026",
    ts: d(2026, 6, 30),
    by: "Dr. Kulkarni",
    note: "Caries now deep and symptomatic to cold. Root canal advised.",
    source: "radiograph",
    findings: {
      46: { surfaces: { occlusal: "caries", mesial: "caries", distal: "caries" }, tooth: "plannedTooth" },
      47: { surfaces: { occlusal: "wear" } },
    },
  },

  /* Asha — the cracked filling. */
  {
    id: "cv_p6_1",
    patientId: "p6",
    date: "5 Jul 2026",
    ts: d(2026, 7, 5),
    by: "Dr. Meher",
    note: "Cracked amalgam on 16 with craze lines onto the cusp.",
    source: "examination",
    findings: { 16: { surfaces: { occlusal: "filled" }, tooth: "plannedTooth" } },
  },
];

/** Every chart for a patient, oldest first. */
export function versionsFor(patientId: string): ChartVersion[] {
  return chartVersions.filter((v) => v.patientId === patientId).sort((a, b) => a.ts - b.ts);
}

export function latestVersion(patientId: string): ChartVersion | undefined {
  const list = versionsFor(patientId);
  return list[list.length - 1];
}

// ---------------------------------------------------------------------------
// What changed
// ---------------------------------------------------------------------------

export type ChangeKind = "new" | "worse" | "treated" | "lost" | "resolved";

export interface ToothChange {
  tooth: number;
  kind: ChangeKind;
  /** One clause, in clinical language. */
  clinical: string;
  /** The same thing for the patient. */
  plain: string;
}

const SEVERITY: Record<SurfaceCondition, number> = {
  planned: 0,
  wear: 1,
  filled: 2,
  caries: 3,
};

/**
 * Diff two charts.
 *
 * Deliberately coarse — this is a reading aid at the chair, not an audit trail.
 * The audit trail is the event log, which records every write; this answers
 * "what should I look at first" in the four minutes before the patient sits down.
 */
export function diffCharts(before: Findings, after: Findings): ToothChange[] {
  const teeth = new Set<number>([
    ...Object.keys(before).map(Number),
    ...Object.keys(after).map(Number),
  ]);
  const out: ToothChange[] = [];

  for (const tooth of Array.from(teeth).sort((a, b) => a - b)) {
    const b = before[tooth] ?? {};
    const a = after[tooth] ?? {};

    // Whole-tooth state first — it outranks anything happening on a surface.
    if (b.tooth !== a.tooth) {
      if (a.tooth === "missing") {
        out.push({
          tooth,
          kind: "lost",
          clinical: `${tooth} extracted or lost`,
          plain: `You lost tooth ${tooth}.`,
        });
        continue;
      }
      if (a.tooth && !b.tooth) {
        out.push({
          tooth,
          kind: a.tooth === "plannedTooth" ? "new" : "treated",
          clinical: `${tooth} — ${label(a.tooth)}`,
          plain:
            a.tooth === "plannedTooth"
              ? `Tooth ${tooth} was marked for treatment.`
              : `Tooth ${tooth} had ${labelPlain(a.tooth)}.`,
        });
        continue;
      }
      if (b.tooth && a.tooth) {
        out.push({
          tooth,
          kind: "treated",
          clinical: `${tooth} — ${label(b.tooth)} → ${label(a.tooth)}`,
          plain: `Tooth ${tooth} went from ${labelPlain(b.tooth)} to ${labelPlain(a.tooth)}.`,
        });
        continue;
      }
    }

    // Surfaces.
    const keys = new Set<SurfaceKey>([
      ...(Object.keys(b.surfaces ?? {}) as SurfaceKey[]),
      ...(Object.keys(a.surfaces ?? {}) as SurfaceKey[]),
    ]);

    for (const k of keys) {
      const bs = b.surfaces?.[k];
      const as = a.surfaces?.[k];
      if (bs === as) continue;

      if (!bs && as) {
        out.push({
          tooth,
          kind: as === "caries" ? "new" : "treated",
          clinical: `${tooth} ${k} — ${SURFACE_CONDITIONS[as].label.toLowerCase()} appeared`,
          plain:
            as === "caries"
              ? `A new cavity appeared on tooth ${tooth}.`
              : `Tooth ${tooth} was treated.`,
        });
      } else if (bs === "caries" && as === "filled") {
        out.push({
          tooth,
          kind: "resolved",
          clinical: `${tooth} ${k} — caries restored`,
          plain: `The cavity on tooth ${tooth} was filled.`,
        });
      } else if (bs && as && SEVERITY[as] > SEVERITY[bs]) {
        out.push({
          tooth,
          kind: "worse",
          clinical: `${tooth} ${k} — ${SURFACE_CONDITIONS[bs].label.toLowerCase()} → ${SURFACE_CONDITIONS[as].label.toLowerCase()}`,
          plain: `Tooth ${tooth} got worse.`,
        });
      }
    }
  }

  return out;
}

/** A one-sentence summary of the whole diff, for the top of the scrubber. */
export function summariseChanges(changes: ToothChange[]): string {
  if (changes.length === 0) return "Nothing changed between these two visits.";

  const counts = changes.reduce<Record<ChangeKind, number>>(
    (acc, c) => ({ ...acc, [c.kind]: (acc[c.kind] ?? 0) + 1 }),
    {} as Record<ChangeKind, number>,
  );

  const parts: string[] = [];
  if (counts.new) parts.push(`${counts.new} new finding${counts.new > 1 ? "s" : ""}`);
  if (counts.worse) parts.push(`${counts.worse} got worse`);
  if (counts.lost) parts.push(`${counts.lost} tooth lost`);
  if (counts.treated) parts.push(`${counts.treated} treated`);
  if (counts.resolved) parts.push(`${counts.resolved} resolved`);

  return parts.join(" · ");
}

function label(t: ToothCondition): string {
  return TOOTH_CONDITIONS[t].label;
}

function labelPlain(t: ToothCondition): string {
  switch (t) {
    case "crown":
      return "a cap";
    case "rct":
      return "a root canal";
    case "implant":
      return "an implant";
    case "missing":
      return "nothing there";
    case "plannedTooth":
      return "planned treatment";
  }
  // Exhaustive over ToothCondition above; this line is unreachable but keeps
  // the function total if a new condition is ever added to the union.
  return TOOTH_CONDITIONS[t as ToothCondition].label.toLowerCase();
}

/** Count of teeth with anything recorded — used for the "health over time" line. */
export function concernCount(findings: Findings): number {
  return Object.values(findings).filter(
    (f) => f.tooth === "plannedTooth" || Object.values(f.surfaces ?? {}).includes("caries"),
  ).length;
}
