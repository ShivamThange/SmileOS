import { describe, it, expect } from "vitest";
import { buildQueue, DAILY_QUEUE_SIZE } from "./recovery-queue";
import type { RecoveryRow, Patient } from "@/types";

/*
 * The recovery queue is scored, not sorted-by-date — the whole point is that the
 * top of the list is the most *recoverable* case, and that the order is stable
 * across renders (a queue that reshuffles is a queue nobody trusts). These pin
 * the ordering, the declined-filter and the finite size.
 */

function row(id: string, over: Partial<RecoveryRow> = {}): RecoveryRow {
  return {
    id, patientId: `p${id}`, proc: "Crown", tooth: "16", type: "Restorative",
    valuePaise: 1_000_000, planned: "1 Jul", ago: "20d ago", urgency: "Moderate",
    doctor: "Dr. A", lastContact: "Never", lastSub: "", due: "overdue",
    finding: "caries", reason: "", ...over,
  } as RecoveryRow;
}
function patient(id: string): Patient {
  return { id: `p${id}`, name: `Patient ${id}`, phone: "9800000000", agesex: "", alert: "" } as unknown as Patient;
}

describe("buildQueue", () => {
  const rows = ["a", "b", "c", "d"].map((id) => row(id, { valuePaise: id === "a" ? 5_000_000 : 500_000, urgency: id === "a" ? "High" : "Routine" }));
  const patients = ["a", "b", "c", "d"].map(patient);

  it("is deterministic — same input yields the same order", () => {
    const first = buildQueue(rows, patients).map((s) => s.row.id);
    const second = buildQueue(rows, patients).map((s) => s.row.id);
    expect(first).toEqual(second);
  });

  it("ranks the high-value, high-urgency case above low ones", () => {
    const ordered = buildQueue(rows, patients);
    expect(ordered[0].row.id).toBe("a");
  });

  it("excludes declined rows", () => {
    const withDeclined = [...rows, row("x", { declined: true })];
    const ids = buildQueue(withDeclined, [...patients, patient("x")]).map((s) => s.row.id);
    expect(ids).not.toContain("x");
  });

  it("skips rows whose patient is missing", () => {
    const ids = buildQueue(rows, patients.slice(0, 2)).map((s) => s.row.id);
    expect(ids).toEqual(expect.not.arrayContaining(["c", "d"]));
  });

  it("caps the queue at the requested size", () => {
    const many = Array.from({ length: 20 }, (_, i) => row(`r${i}`));
    const manyPatients = Array.from({ length: 20 }, (_, i) => patient(`r${i}`));
    expect(buildQueue(many, manyPatients, DAILY_QUEUE_SIZE).length).toBe(DAILY_QUEUE_SIZE);
  });

  it("is sorted by score descending", () => {
    const scores = buildQueue(rows, patients).map((s) => s.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });
});
