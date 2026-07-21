/*
 * Medical alerts — parsing and severity.
 *
 * `Patient.alert` is a free-text field in the current data contract, written by
 * whoever took the history: "Allergy: Penicillin · Type 2 diabetes". Until the
 * backend models this properly (it should: an allergy is a different clinical
 * object from a chronic condition, and only one of them can kill someone), this
 * module is the single place that decides what the string means. Nothing else
 * in the app should split an alert string by hand.
 */

export type AlertKind = "allergy" | "condition";

export interface MedicalAlertItem {
  kind: AlertKind;
  /** The clinically meaningful part — "Penicillin", "Type 2 diabetes". */
  label: string;
  /** The original fragment, unmodified, for tooltips and the full banner. */
  raw: string;
}

const ALLERGY_PREFIX = /^allerg(?:y|ic to)\s*[:\-—]?\s*/i;

/** Split a raw alert string into typed items. Returns [] for no alert. */
export function parseMedicalAlert(alert: string | undefined | null): MedicalAlertItem[] {
  if (!alert) return [];
  return alert
    .split(/[·;|]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((raw) => {
      const isAllergy = ALLERGY_PREFIX.test(raw);
      return {
        kind: isAllergy ? ("allergy" as const) : ("condition" as const),
        label: isAllergy ? raw.replace(ALLERGY_PREFIX, "").trim() : raw,
        raw,
      };
    });
}

/**
 * Highest severity present. An allergy outranks a condition because it changes
 * what may be prescribed or injected in the next ten minutes; a condition
 * changes how the appointment is planned. Both are shown, but only one sets
 * the colour of a compact chip.
 */
export function alertSeverity(items: MedicalAlertItem[]): AlertKind | null {
  if (items.some((i) => i.kind === "allergy")) return "allergy";
  if (items.length > 0) return "condition";
  return null;
}

/** Short label for a one-chip summary: "Penicillin +1". */
export function alertSummary(items: MedicalAlertItem[]): string {
  if (items.length === 0) return "";
  const lead = items.find((i) => i.kind === "allergy") ?? items[0];
  const rest = items.length - 1;
  return rest > 0 ? `${lead.label} +${rest}` : lead.label;
}

/** Full, unabbreviated text — for tooltips and screen readers. */
export function alertFullText(items: MedicalAlertItem[]): string {
  return items
    .map((i) => (i.kind === "allergy" ? `Allergy: ${i.label}` : i.label))
    .join(" · ");
}
