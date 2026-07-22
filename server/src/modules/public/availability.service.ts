import { ClinicModel } from "../../models/clinic.model";
import { AppointmentModel } from "../../models/appointment.model";
import { UserModel } from "../../models/user.model";
import { SCHEDULING } from "../../config/constants";

/*
 * Public availability (spec 5.3). Slots come from true capacity — working hours
 * minus breaks, minus existing appointments (plus buffer), minus lead time —
 * never a naive grid. "Offering unavailable slots destroys trust on day one."
 * The core computation is a pure function so it can be unit-tested without a DB.
 */

export interface Interval {
  startMin: number;
  endMin: number;
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + (m || 0);
}
function toHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/**
 * Open slot starts ("HH:MM") for one day. A slot is valid when it fits inside
 * open hours, doesn't overlap a break or a busy interval (busy padded by the
 * buffer on both sides), and starts no earlier than `earliestStartMin`.
 */
export function computeDaySlots(params: {
  open: string;
  close: string;
  breaks?: { start: string; end: string }[];
  busy?: Interval[];
  durationMin: number;
  granularityMin: number;
  bufferMin: number;
  earliestStartMin: number;
}): string[] {
  const openMin = toMin(params.open);
  const closeMin = toMin(params.close);
  const blocked: Interval[] = [
    ...(params.breaks ?? []).map((b) => ({ startMin: toMin(b.start), endMin: toMin(b.end) })),
    ...(params.busy ?? []).map((b) => ({ startMin: b.startMin - params.bufferMin, endMin: b.endMin + params.bufferMin })),
  ];

  const slots: string[] = [];
  const first = ceilTo(Math.max(openMin, params.earliestStartMin), params.granularityMin);
  for (let t = first; t + params.durationMin <= closeMin; t += params.granularityMin) {
    const end = t + params.durationMin;
    const conflicts = blocked.some((b) => t < b.endMin && end > b.startMin);
    if (!conflicts) slots.push(toHHMM(t));
  }
  return slots;
}

/** Bucket slot strings into the wizard's morning / afternoon / evening groups. */
export function groupByPartOfDay(slots: string[]): { morning: string[]; afternoon: string[]; evening: string[] } {
  const out = { morning: [] as string[], afternoon: [] as string[], evening: [] as string[] };
  for (const s of slots) {
    const h = parseInt(s.slice(0, 2), 10);
    if (h < 12) out.morning.push(s);
    else if (h < 17) out.afternoon.push(s);
    else out.evening.push(s);
  }
  return out;
}

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Availability for the next `days` days for a clinic (optionally one doctor).
 * Loads working hours + booked appointments once, then derives each day's open
 * slots. Returns per-day grouped slots the booking wizard renders directly.
 */
export async function publicAvailability(
  clinicId: string,
  opts: { doctorId?: string; durationMin?: number; days?: number } = {},
): Promise<{ date: string; weekday: number; slots: ReturnType<typeof groupByPartOfDay>; count: number }[]> {
  const days = Math.min(60, Math.max(1, opts.days ?? 30));
  const clinic = await ClinicModel.findById(clinicId).select("workingHours scheduling").lean();
  const scheduling = { ...SCHEDULING, ...(clinic?.scheduling ?? {}) };
  const durationMin = opts.durationMin ?? scheduling.defaultDurationMinutes;

  // Resolve the doctor set to size capacity (any-doctor books against the union).
  const doctorFilter: Record<string, unknown> = { clinicId, role: "doctor", active: true };
  if (opts.doctorId) doctorFilter._id = opts.doctorId;
  const doctors = await UserModel.find(doctorFilter).select("_id").lean();
  const doctorCount = Math.max(1, doctors.length);

  const now = new Date();
  const windowStart = dayStart(now);
  const windowEnd = new Date(windowStart.getTime() + days * 86_400_000);

  const apptFilter: Record<string, unknown> = {
    clinicId,
    status: { $nin: ["cancelled", "no_show"] },
    start: { $gte: windowStart, $lt: windowEnd },
  };
  if (opts.doctorId) apptFilter.doctor = opts.doctorId;
  const appts = await AppointmentModel.find(apptFilter).select("start end doctor").lean();

  const workingByWeekday = new Map<number, { isOpen: boolean; open: string; close: string; breaks?: { start: string; end: string }[] }>();
  for (const wd of clinic?.workingHours ?? []) workingByWeekday.set(wd.weekday, wd as never);

  const out: { date: string; weekday: number; slots: ReturnType<typeof groupByPartOfDay>; count: number }[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(windowStart.getTime() + i * 86_400_000);
    const weekday = date.getDay();
    const wh = workingByWeekday.get(weekday);
    if (!wh || !wh.isOpen) {
      out.push({ date: date.toISOString().slice(0, 10), weekday, slots: groupByPartOfDay([]), count: 0 });
      continue;
    }

    // Busy intervals for this day, in minutes from midnight, capped by capacity.
    const dayEnd = new Date(date.getTime() + 86_400_000);
    const dayAppts = appts.filter((a) => new Date(a.start) >= date && new Date(a.start) < dayEnd);
    // Count concurrent bookings per minute-window: when all doctors are busy the
    // slot is unavailable. Model each appointment as a busy interval; only treat
    // the slot as blocked when concurrent count reaches doctorCount.
    const intervals = dayAppts.map((a) => ({
      startMin: minutesFromMidnight(new Date(a.start)),
      endMin: minutesFromMidnight(new Date(a.end)),
    }));
    const busy = opts.doctorId ? intervals : saturatedIntervals(intervals, doctorCount);

    const earliest =
      date.getTime() === windowStart.getTime()
        ? minutesFromMidnight(now) + (scheduling.onlineBookingMinLeadMinutes ?? 0)
        : 0;

    const slots = computeDaySlots({
      open: wh.open,
      close: wh.close,
      breaks: wh.breaks,
      busy,
      durationMin,
      granularityMin: scheduling.slotGranularityMinutes,
      bufferMin: scheduling.bufferMinutes,
      earliestStartMin: earliest,
    });
    const grouped = groupByPartOfDay(slots);
    out.push({ date: date.toISOString().slice(0, 10), weekday, slots: grouped, count: slots.length });
  }

  return out;
}

function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Given many appointment intervals and N doctors, return the sub-intervals
 * where all N are busy (a sweep over start/end events). Only those windows
 * actually block a new any-doctor booking.
 */
export function saturatedIntervals(intervals: Interval[], capacity: number): Interval[] {
  const events: { at: number; delta: number }[] = [];
  for (const iv of intervals) {
    events.push({ at: iv.startMin, delta: 1 });
    events.push({ at: iv.endMin, delta: -1 });
  }
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);

  const out: Interval[] = [];
  let concurrent = 0;
  let satStart: number | null = null;
  for (const e of events) {
    const before = concurrent;
    concurrent += e.delta;
    if (before < capacity && concurrent >= capacity) satStart = e.at;
    else if (before >= capacity && concurrent < capacity && satStart !== null) {
      out.push({ startMin: satStart, endMin: e.at });
      satStart = null;
    }
  }
  return out;
}
