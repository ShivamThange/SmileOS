import { describe, it, expect } from "vitest";
import { parseMedicalAlert, alertSeverity, alertSummary, alertFullText } from "./medical-alert";

/*
 * Medical alerts are safety-critical: an allergy must outrank a condition and
 * never be silently dropped, because it changes what may be prescribed or
 * injected in the next ten minutes. These tests pin that behaviour.
 */

describe("parseMedicalAlert", () => {
  it("splits on the separators and classifies allergy vs condition", () => {
    const items = parseMedicalAlert("Allergy: Penicillin · Type 2 diabetes");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ kind: "allergy", label: "Penicillin" });
    expect(items[1]).toMatchObject({ kind: "condition", label: "Type 2 diabetes" });
  });
  it("returns [] for empty / nullish input", () => {
    expect(parseMedicalAlert("")).toEqual([]);
    expect(parseMedicalAlert(null)).toEqual([]);
    expect(parseMedicalAlert(undefined)).toEqual([]);
  });
  it("trims and drops blank segments", () => {
    expect(parseMedicalAlert("  Hypertension ;; ")).toEqual([
      { kind: "condition", label: "Hypertension", raw: "Hypertension" },
    ]);
  });
});

describe("alertSeverity — allergy outranks condition", () => {
  it("returns 'allergy' when any allergy is present", () => {
    expect(alertSeverity(parseMedicalAlert("Type 2 diabetes · Allergy: Latex"))).toBe("allergy");
  });
  it("returns 'condition' when only conditions are present", () => {
    expect(alertSeverity(parseMedicalAlert("Hypertension"))).toBe("condition");
  });
  it("returns null for no alerts", () => {
    expect(alertSeverity([])).toBeNull();
  });
});

describe("alertSummary / alertFullText", () => {
  it("leads with the allergy and counts the rest", () => {
    expect(alertSummary(parseMedicalAlert("Diabetes · Allergy: Penicillin · Asthma"))).toBe("Penicillin +2");
  });
  it("shows a single label without a +count", () => {
    expect(alertSummary(parseMedicalAlert("Hypertension"))).toBe("Hypertension");
  });
  it("re-labels allergies in the full text", () => {
    expect(alertFullText(parseMedicalAlert("Allergy: Penicillin · Diabetes"))).toBe("Allergy: Penicillin · Diabetes");
  });
});
