/*
 * Pure-logic checks (spec Part 7 — T6.10). Unlike verify:modules, this needs no
 * database or Redis, so it runs anywhere — including CI without egress. It
 * covers the logic where bugs are most expensive: invoice/payment arithmetic,
 * the WhatsApp session-window rule, campaign-segment safety, CSV export, and
 * the NoSQL sanitiser.
 */
import { computeBalance } from "../models/billing.model";
import { withinSessionWindow } from "../modules/communication/communication.service";
import { segmentToFilter } from "../modules/reputation/reputation.service";
import { toCsv } from "../modules/analytics/reports.service";
import { mongoSanitize } from "../middleware/mongo-sanitize";
import { computeDaySlots, groupByPartOfDay, saturatedIntervals } from "../modules/public/availability.service";

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures += 1;
    console.log(`  ✗ ${label}`, detail ?? "");
  }
}
function eq(label: string, actual: unknown, expected: unknown): void {
  check(label, JSON.stringify(actual) === JSON.stringify(expected), `got ${JSON.stringify(actual)}`);
}

/* ---- Invoice / payment arithmetic (money in paise) ---------------------- */
console.log("\n=== billing arithmetic ===");
eq("no payments → full balance", computeBalance(500000, []), 500000);
eq("single success payment reduces balance", computeBalance(500000, [{ amountPaise: 200000, status: "success" }]), 300000);
eq("failed/pending payments do not count", computeBalance(500000, [
  { amountPaise: 200000, status: "success" },
  { amountPaise: 100000, status: "failed" },
  { amountPaise: 50000, status: "pending" },
]), 300000);
eq("overpayment yields a negative balance (credit)", computeBalance(100000, [{ amountPaise: 150000, status: "success" }]), -50000);
eq("fully paid → zero", computeBalance(100000, [{ amountPaise: 100000, status: "success" }]), 0);

/* ---- WhatsApp session-window rule --------------------------------------- */
console.log("\n=== session window ===");
check("open window is within", withinSessionWindow({ channel: "whatsapp", sessionWindowExpiresAt: new Date(Date.now() + 3600_000) }) === true);
check("expired window is outside", withinSessionWindow({ channel: "whatsapp", sessionWindowExpiresAt: new Date(Date.now() - 1000) }) === false);
check("missing window is outside", withinSessionWindow({ channel: "whatsapp" }) === false);
check("non-whatsapp channels are always open", withinSessionWindow({ channel: "email" }) === true);

/* ---- Campaign segment safety (allow-list only) -------------------------- */
console.log("\n=== segment safety ===");
const f1 = segmentToFilter("c1", { status: "active", tags: ["implant"], hasBalance: true, channelConsent: "whatsapp" });
check("status mapped", f1.status === "active");
eq("tags become an $in", f1.tags, { $in: ["implant"] });
eq("hasBalance becomes a positive filter", f1.balancePaise, { $gt: 0 });
check("channel consent mapped to nested path", f1["marketingConsent.whatsapp"] === true);
const f2 = segmentToFilter("c1", { lastVisitBeforeDays: 180 } as never);
check("lastVisitBeforeDays becomes a $lt date", Boolean((f2.lastVisit as { $lt?: Date })?.$lt));
const f3 = segmentToFilter("c1", { $where: "1==1" } as never);
check("unknown/operator keys are ignored", !("$where" in f3) && Object.keys(f3).join() === "clinicId");

/* ---- CSV export --------------------------------------------------------- */
console.log("\n=== csv export ===");
const csv = toCsv({ range: { from: new Date(), to: new Date(), groupBy: "month" }, series: [{ period: "2026-07", valuePaise: 500000 }], totals: {} });
check("csv has a header row", csv.split("\n")[0] === "period,valuePaise");
check("csv has the data row", csv.split("\n")[1] === '"2026-07",500000');
eq("empty series → empty string", toCsv({ range: { from: new Date(), to: new Date(), groupBy: "day" }, series: [], totals: {} }), "");

/* ---- NoSQL sanitiser ---------------------------------------------------- */
console.log("\n=== nosql sanitiser ===");
function sanitize(body: unknown, query: Record<string, unknown> = {}): { body: unknown; query: unknown } {
  const req = { body, query, params: {} } as never as { body: unknown; query: unknown };
  mongoSanitize(req as never, {} as never, () => {});
  return { body: req.body, query: req.query };
}
eq("strips a top-level operator key", sanitize({ email: "x", $gt: "" }).body, { email: "x" });
eq("strips a nested operator, keeps siblings", sanitize({ a: { $ne: null, keep: 1 } }).body, { a: { keep: 1 } });
eq("strips dotted keys", sanitize({ "a.b": 1, ok: 2 }).body, { ok: 2 });
eq("scrubs inside arrays", sanitize({ list: [{ $gt: 1 }, 2] }).body, { list: [{}, 2] });
eq("leaves clean data intact", sanitize({ n: 1, s: "t", b: true, arr: [1, 2] }).body, { n: 1, s: "t", b: true, arr: [1, 2] });
eq("sanitises query params too", sanitize({}, { $where: "x", page: "1" }).query, { page: "1" });

/* ---- Public booking availability (slot computation) --------------------- */
console.log("\n=== booking availability ===");
const baseSlots = computeDaySlots({ open: "09:00", close: "11:00", durationMin: 30, granularityMin: 30, bufferMin: 0, earliestStartMin: 0 });
eq("open 09-11, 30min slots → 4 starts", baseSlots, ["09:00", "09:30", "10:00", "10:30"]);
const withBusy = computeDaySlots({ open: "09:00", close: "11:00", durationMin: 30, granularityMin: 30, bufferMin: 0, busy: [{ startMin: 9 * 60 + 30, endMin: 10 * 60 }], earliestStartMin: 0 });
check("a booked 09:30 slot is removed", !withBusy.includes("09:30") && withBusy.includes("09:00"), withBusy);
const withBuffer = computeDaySlots({ open: "09:00", close: "11:00", durationMin: 30, granularityMin: 30, bufferMin: 5, busy: [{ startMin: 10 * 60, endMin: 10 * 60 + 30 }], earliestStartMin: 0 });
check("buffer blocks the abutting 09:30 slot", !withBuffer.includes("09:30"), withBuffer);
const withBreak = computeDaySlots({ open: "09:00", close: "12:00", durationMin: 30, granularityMin: 30, bufferMin: 0, breaks: [{ start: "10:00", end: "10:30" }], earliestStartMin: 0 });
check("lunch break removes its slot", !withBreak.includes("10:00") && withBreak.includes("10:30"), withBreak);
const withLead = computeDaySlots({ open: "09:00", close: "11:00", durationMin: 30, granularityMin: 30, bufferMin: 0, earliestStartMin: 9 * 60 + 40 });
eq("lead time pushes first slot to 10:00", withLead[0], "10:00");
eq("part-of-day grouping", groupByPartOfDay(["09:00", "13:00", "18:00"]), { morning: ["09:00"], afternoon: ["13:00"], evening: ["18:00"] });
eq("any-doctor: 1 of 2 busy leaves the slot open", saturatedIntervals([{ startMin: 540, endMin: 570 }], 2), []);
eq("any-doctor: both busy saturates the window", saturatedIntervals([{ startMin: 540, endMin: 570 }, { startMin: 540, endMin: 570 }], 2), [{ startMin: 540, endMin: 570 }]);

console.log(`\n${failures === 0 ? "ALL LOGIC CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
