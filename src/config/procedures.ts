/*
 * Procedure catalogue — duration and fee, configured once per clinic.
 *
 * The point of this file is a single rule from the flow work: the receptionist
 * must never do arithmetic with a patient on the line. She types "RCT" and the
 * system knows it is sixty minutes and roughly ₹9,000. Duration is a property
 * of the procedure, not something a human types into a booking form.
 *
 * In production this is GET /procedures, seeded from an Indian default library
 * so a new clinic edits fees rather than inventing a catalogue, and the
 * durations drift toward each doctor's observed actuals over time.
 */

const R = (rupees: number) => rupees * 100;

export type ProcedureCategory =
  | "Preventive"
  | "Endo"
  | "Prostho"
  | "Surgery"
  | "Implants"
  | "Ortho"
  | "Cosmetic"
  | "Diagnostic";

export interface ProcedureDef {
  id: string;
  name: string;
  category: ProcedureCategory;
  /** Chair time in minutes. */
  minutes: number;
  feePaise: number;
  /** Lowercase substrings that identify this procedure in free text. */
  keywords: string[];
}

export const procedureCatalogue: ProcedureDef[] = [
  { id: "consult", name: "Consultation", category: "Diagnostic", minutes: 15, feePaise: R(300), keywords: ["consult", "opinion", "check up", "checkup"] },
  { id: "opg", name: "OPG / radiograph", category: "Diagnostic", minutes: 10, feePaise: R(800), keywords: ["opg", "iopa", "x-ray", "xray", "radiograph", "cbct"] },
  { id: "scaling", name: "Scaling & polish", category: "Preventive", minutes: 30, feePaise: R(1800), keywords: ["scaling", "polish", "cleaning", "prophylaxis", "hygiene"] },
  { id: "fluoride", name: "Fluoride application", category: "Preventive", minutes: 15, feePaise: R(900), keywords: ["fluoride"] },
  { id: "composite", name: "Composite restoration", category: "Endo", minutes: 30, feePaise: R(2200), keywords: ["composite", "filling", "restoration"] },
  { id: "rct", name: "Root canal treatment", category: "Endo", minutes: 60, feePaise: R(9000), keywords: ["rct", "root canal", "endo"] },
  { id: "pulpectomy", name: "Pulpectomy", category: "Endo", minutes: 45, feePaise: R(4500), keywords: ["pulpectomy", "pulpotomy"] },
  { id: "crown-prep", name: "Crown preparation", category: "Prostho", minutes: 60, feePaise: R(11000), keywords: ["crown prep", "prep", "abutment prep"] },
  { id: "crown-cement", name: "Crown cementation", category: "Prostho", minutes: 30, feePaise: R(2000), keywords: ["crown cement", "cementation", "crown fit"] },
  { id: "crown", name: "Crown", category: "Prostho", minutes: 45, feePaise: R(14500), keywords: ["crown", "zirconia", "pfm"] },
  { id: "bridge", name: "Bridge", category: "Prostho", minutes: 75, feePaise: R(32000), keywords: ["bridge"] },
  { id: "denture-trial", name: "Denture trial", category: "Prostho", minutes: 45, feePaise: R(2500), keywords: ["denture trial", "try in", "try-in"] },
  { id: "denture-adjust", name: "Denture adjustment", category: "Prostho", minutes: 30, feePaise: R(600), keywords: ["denture adjust", "denture relief"] },
  { id: "denture", name: "Complete denture", category: "Prostho", minutes: 60, feePaise: R(24000), keywords: ["denture", "prosthesis"] },
  { id: "extraction", name: "Extraction", category: "Surgery", minutes: 45, feePaise: R(2500), keywords: ["extraction", "extract", "exo"] },
  { id: "surgical-extraction", name: "Surgical extraction", category: "Surgery", minutes: 60, feePaise: R(8500), keywords: ["surgical extraction", "impaction", "wisdom", "third molar"] },
  { id: "implant-place", name: "Implant placement", category: "Implants", minutes: 90, feePaise: R(42000), keywords: ["implant placement", "implant place", "fixture"] },
  { id: "implant-review", name: "Implant review", category: "Implants", minutes: 20, feePaise: 0, keywords: ["implant review", "implant check", "osseo"] },
  { id: "braces-adjust", name: "Braces adjustment", category: "Ortho", minutes: 30, feePaise: R(1500), keywords: ["braces adjust", "wire change", "adjustment"] },
  { id: "aligner-scan", name: "Aligner scan", category: "Ortho", minutes: 30, feePaise: R(3000), keywords: ["aligner scan", "intraoral scan", "scan"] },
  { id: "aligner-check", name: "Aligner check", category: "Ortho", minutes: 20, feePaise: 0, keywords: ["aligner check", "aligner review"] },
  { id: "braces", name: "Braces — start of treatment", category: "Ortho", minutes: 90, feePaise: R(55000), keywords: ["braces", "bonding"] },
  { id: "whitening", name: "Whitening", category: "Cosmetic", minutes: 45, feePaise: R(12000), keywords: ["whitening", "bleaching"] },
  { id: "veneer", name: "Veneer", category: "Cosmetic", minutes: 60, feePaise: R(12000), keywords: ["veneer", "laminate"] },
];

/** Anything unrecognised gets a half-hour slot — never zero, never an error. */
export const DEFAULT_PROCEDURE_MINUTES = 30;

/**
 * Match free text ("RCT 46 · visit 1", "crown prep 17") to a catalogue entry.
 * Longer keywords win, so "crown prep" beats "crown" and "surgical extraction"
 * beats "extraction".
 */
export function inferProcedure(text: string): ProcedureDef | null {
  const t = (text ?? "").toLowerCase();
  if (!t) return null;

  let best: ProcedureDef | null = null;
  let bestLen = 0;
  for (const proc of procedureCatalogue) {
    for (const kw of proc.keywords) {
      if (t.includes(kw) && kw.length > bestLen) {
        best = proc;
        bestLen = kw.length;
      }
    }
  }
  return best;
}

/** Chair time in minutes for a free-text procedure description. */
export function inferDurationMinutes(text: string): number {
  return inferProcedure(text)?.minutes ?? DEFAULT_PROCEDURE_MINUTES;
}

/** Chair time as a decimal hour, matching `Appointment.dur`. */
export function inferDurationHours(text: string): number {
  return inferDurationMinutes(text) / 60;
}

/** Expected fee in paise. Zero for review visits that are not charged. */
export function inferFeePaise(text: string): number {
  return inferProcedure(text)?.feePaise ?? 0;
}

/** "45 min" / "1 hr 30 min" — for slot candidates and booking previews. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
