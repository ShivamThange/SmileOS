import { create } from "zustand";
import { chartVersions, type ChartVersion } from "./chart-data";
import type { Findings } from "@/components/domain/odontogram";

/*
 * Charts, held as an append-only list.
 *
 * Saving a chart never overwrites the previous one — it adds a version. That is
 * the whole basis of the time scrubber, and it is also simply the correct way
 * to treat a clinical record: what was true in 2024 is still true about 2024,
 * whatever has happened since.
 *
 * The backend already commits to soft deletes and an append-only event log, so
 * this maps onto it directly rather than needing a new concept.
 */

let seq = 0;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function todayLabel(): string {
  const d = new Date();
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

interface ChartsState {
  versions: ChartVersion[];
  versionsFor: (patientId: string) => ChartVersion[];
  latestFor: (patientId: string) => ChartVersion | undefined;
  saveVersion: (
    patientId: string,
    findings: Findings,
    by: string,
    note: string,
    source?: ChartVersion["source"],
  ) => ChartVersion;
}

export const useChartsStore = create<ChartsState>((set, get) => ({
  versions: chartVersions,

  versionsFor: (patientId) =>
    get()
      .versions.filter((v) => v.patientId === patientId)
      .sort((a, b) => a.ts - b.ts),

  latestFor: (patientId) => {
    const list = get().versionsFor(patientId);
    return list[list.length - 1];
  },

  saveVersion: (patientId, findings, by, note, source = "examination") => {
    const version: ChartVersion = {
      id: `cv_${Date.now().toString(36)}_${seq++}`,
      patientId,
      date: todayLabel(),
      ts: Date.now(),
      by,
      note,
      findings: JSON.parse(JSON.stringify(findings)) as Findings,
      source,
    };
    set((s) => ({ versions: [...s.versions, version] }));
    return version;
  },
}));
