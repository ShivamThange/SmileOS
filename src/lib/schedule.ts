import { appointments, chairSubs } from "@/lib/mock-data";
import { inferProcedure, inferDurationMinutes, type ProcedureDef } from "@/config/procedures";
import type { Appointment } from "@/types";

/*
 * The scheduling brain.
 *
 * Two jobs, both of which exist because of one observation: the caller on the
 * phone speaks in *queries* ("any evening next week?"), and a calendar grid
 * only answers *coordinates*. So this module turns a sentence into candidate
 * slots, and turns a day's book into the holes in it.
 *
 *   parseSlotRequest()  — sentence → criteria
 *   findSlots()         — criteria → three concrete offers
 *   findGaps()          — a day's book → revenue-recoverable holes
 *
 * The forward book is generated deterministically from a seeded PRNG so the
 * demo is stable across reloads. When the real API lands, only `dayBook()`
 * changes; everything above it is already correct.
 */

export const CLINIC_OPEN = 9;
export const CLINIC_CLOSE = 19.5;
export const LUNCH_START = 13.5;
export const LUNCH_END = 14;
/** Bookings land on a 15-minute grid. */
export const SLOT_GRID = 0.25;

export const CHAIRS = ["Chair 1", "Chair 2", "Chair 3", "Chair 4"];
export const DOCTORS = ["Dr. Meher", "Dr. Kulkarni", "Dr. Patil"];

/** The date the prototype is anchored to — Monday 20 July 2026. */
export const TODAY = new Date(2026, 6, 20);

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Doctors as patients and staff actually refer to them. */
const DOCTOR_ALIASES: Record<string, string[]> = {
  "Dr. Meher": ["meher", "anjali", "dr meher", "dr anjali"],
  "Dr. Kulkarni": ["kulkarni", "rohan", "dr kulkarni", "dr rohan"],
  "Dr. Patil": ["patil", "sneha", "dr patil", "dr sneha"],
};

/** Which doctor normally works a chair. Chair 4 is shared. */
export function doctorForChair(chair: string, fallback?: string): string {
  const sub = chairSubs[chair];
  if (sub && DOCTORS.includes(sub)) return sub;
  return fallback ?? DOCTORS[0];
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export function dateForOffset(offset: number): Date {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offset);
  return d;
}

export function isClosed(d: Date): boolean {
  return d.getDay() === 0; // Sundays
}

/** "Tue 28" */
export function shortDayLabel(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
}

/** "Tue 28 Jul" */
export function dayLabel(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

/** "Today" / "Tomorrow" / "Tue 28 Jul" — how a person would say it. */
export function relativeDayLabel(offset: number): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return dayLabel(dateForOffset(offset));
}

// ---------------------------------------------------------------------------
// The book
// ---------------------------------------------------------------------------

/** Deterministic PRNG so a given day always generates the same book. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BookedBlock {
  chair: string;
  doctor: string;
  start: number;
  dur: number;
  proc: string;
  name: string;
}

const FORWARD_PROCS = [
  "Scaling & polish",
  "RCT 46 · visit 1",
  "Crown prep 17",
  "Composite 24",
  "Braces adjustment",
  "Implant review 36",
  "Denture trial",
  "Extraction 38",
  "Aligner check",
  "Consultation",
];

const forwardBookCache = new Map<number, BookedBlock[]>();

/** Today's real book, or a stable generated book for any future day. */
export function dayBook(offset: number): BookedBlock[] {
  if (offset === 0) {
    return appointments
      .filter((a) => a.status !== "cancelled")
      .map((a: Appointment) => ({
        chair: a.chair,
        doctor: a.doctor,
        start: a.start,
        dur: a.dur,
        proc: a.proc,
        name: a.name,
      }));
  }

  const cached = forwardBookCache.get(offset);
  if (cached) return cached;

  const d = dateForOffset(offset);
  if (isClosed(d)) {
    forwardBookCache.set(offset, []);
    return [];
  }

  const rnd = mulberry32(20260720 + offset * 7919);
  const blocks: BookedBlock[] = [];

  for (const chair of CHAIRS) {
    const doctor = doctorForChair(chair);
    // Chairs fill up more the closer the day is — the far end of the book is
    // genuinely emptier, which is what makes "next week" easy to offer.
    const density = Math.max(0.25, 0.85 - offset * 0.06);
    let cursor = CLINIC_OPEN + Math.floor(rnd() * 4) * SLOT_GRID;

    while (cursor < CLINIC_CLOSE - 0.5) {
      if (rnd() < density) {
        const dur = [0.5, 0.75, 1, 1][Math.floor(rnd() * 4)];
        if (cursor + dur <= CLINIC_CLOSE && !(cursor < LUNCH_END && cursor + dur > LUNCH_START)) {
          blocks.push({
            chair,
            doctor,
            start: cursor,
            dur,
            proc: FORWARD_PROCS[Math.floor(rnd() * FORWARD_PROCS.length)],
            name: "Booked",
          });
          cursor += dur;
          continue;
        }
      }
      cursor += SLOT_GRID * (1 + Math.floor(rnd() * 4));
    }
  }

  forwardBookCache.set(offset, blocks);
  return blocks;
}

// ---------------------------------------------------------------------------
// Free-time maths
// ---------------------------------------------------------------------------

export interface Interval {
  start: number;
  end: number;
}

/** Free intervals for one chair on one day, lunch and existing work removed. */
export function freeIntervals(
  book: BookedBlock[],
  chair: string,
  fromHour = CLINIC_OPEN,
): Interval[] {
  const busy: Interval[] = book
    .filter((b) => b.chair === chair)
    .map((b) => ({ start: b.start, end: b.start + b.dur }))
    .concat([{ start: LUNCH_START, end: LUNCH_END }])
    .sort((a, b) => a.start - b.start);

  const free: Interval[] = [];
  let cursor = Math.max(CLINIC_OPEN, fromHour);

  for (const b of busy) {
    if (b.end <= cursor) continue;
    if (b.start > cursor) free.push({ start: cursor, end: Math.min(b.start, CLINIC_CLOSE) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= CLINIC_CLOSE) break;
  }
  if (cursor < CLINIC_CLOSE) free.push({ start: cursor, end: CLINIC_CLOSE });

  return free.filter((f) => f.end - f.start > 0.001);
}

export interface Gap {
  id: string;
  chair: string;
  doctor: string;
  start: number;
  minutes: number;
}

/**
 * Holes in today's book worth filling. A 45-minute gap at 11:40 is not empty
 * time — it is an unsold appointment with a deadline, and surfacing it is
 * worth more than most of the Growth section.
 */
export function findGaps(offset = 0, minMinutes = 30, afterHour = CLINIC_OPEN): Gap[] {
  const book = dayBook(offset);
  const gaps: Gap[] = [];

  for (const chair of CHAIRS) {
    for (const f of freeIntervals(book, chair, afterHour)) {
      const minutes = Math.round((f.end - f.start) * 60);
      // A hole that runs to closing time is the end of the day, not a gap.
      if (f.end >= CLINIC_CLOSE - 0.001) continue;
      if (minutes >= minMinutes) {
        gaps.push({
          id: `${offset}-${chair}-${f.start}`,
          chair,
          doctor: doctorForChair(chair),
          start: f.start,
          minutes,
        });
      }
    }
  }

  return gaps.sort((a, b) => a.start - b.start || b.minutes - a.minutes);
}

// ---------------------------------------------------------------------------
// Sentence → criteria
// ---------------------------------------------------------------------------

export interface SlotCriteria {
  procedure: ProcedureDef | null;
  minutes: number;
  doctor: string | null;
  /** 0=Sun … 6=Sat, or null for any day. */
  weekday: number | null;
  /** Earliest acceptable start, decimal hour. */
  earliest: number;
  /** Latest acceptable start, decimal hour. */
  latest: number;
  /** First day offset to consider. */
  fromOffset: number;
  /** How many days forward to search. */
  windowDays: number;
  /** Human-readable echo of what was understood, for the UI. */
  understood: string[];
}

const WEEKDAY_WORDS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

/**
 * Turn "RCT 45 min anytime after 6 next week" into something bookable.
 * Everything is optional; an empty string yields "the next thing available",
 * which is the right default for a caller who says "whenever you can fit me".
 */
export function parseSlotRequest(text: string): SlotCriteria {
  const t = (text ?? "").toLowerCase();
  const understood: string[] = [];

  const procedure = inferProcedure(t);
  if (procedure) understood.push(procedure.name);

  // Explicit duration ("45 min", "1 hour") overrides the catalogue default.
  let minutes = procedure ? procedure.minutes : inferDurationMinutes(t);
  const explicitMin = t.match(/(\d{2,3})\s*(?:min|mins|minutes)\b/);
  const explicitHr = t.match(/(\d(?:\.\d)?)\s*(?:hr|hrs|hour|hours)\b/);
  if (explicitMin) {
    minutes = parseInt(explicitMin[1], 10);
    understood.push(`${minutes} min`);
  } else if (explicitHr) {
    minutes = Math.round(parseFloat(explicitHr[1]) * 60);
    understood.push(`${minutes} min`);
  }

  let doctor: string | null = null;
  for (const [name, aliases] of Object.entries(DOCTOR_ALIASES)) {
    if (aliases.some((a) => t.includes(a))) {
      doctor = name;
      understood.push(name);
      break;
    }
  }

  let weekday: number | null = null;
  for (const [word, dow] of Object.entries(WEEKDAY_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) {
      weekday = dow;
      understood.push(word.charAt(0).toUpperCase() + word.slice(1));
      break;
    }
  }

  let earliest = CLINIC_OPEN;
  let latest = CLINIC_CLOSE;

  if (/\bmorning\b/.test(t)) { earliest = CLINIC_OPEN; latest = 12; understood.push("morning"); }
  else if (/\bafternoon\b/.test(t)) { earliest = 12; latest = 16; understood.push("afternoon"); }
  else if (/\bevening\b/.test(t)) { earliest = 16; latest = CLINIC_CLOSE; understood.push("evening"); }
  else if (/\blate\b/.test(t)) { earliest = 17; understood.push("late"); }

  // "after 6", "after 6pm", "after 6:30"
  const after = t.match(/after\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (after) {
    let h = parseInt(after[1], 10);
    const m = after[2] ? parseInt(after[2], 10) / 60 : 0;
    const mer = after[3];
    if (mer === "pm" && h < 12) h += 12;
    // "after 6" with no meridiem, in a clinic open till 7:30pm, means 6pm.
    if (!mer && h <= 8) h += 12;
    earliest = Math.max(earliest, h + m);
    understood.push(`after ${((h + 11) % 12) + 1}${m ? ":30" : ""}${h >= 12 ? "pm" : "am"}`);
  }

  const before = t.match(/before\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (before) {
    let h = parseInt(before[1], 10);
    const m = before[2] ? parseInt(before[2], 10) / 60 : 0;
    if (before[3] === "pm" && h < 12) h += 12;
    if (!before[3] && h <= 8) h += 12;
    latest = Math.min(latest, h + m);
  }

  let fromOffset = 0;
  let windowDays = 21;

  if (/\btoday\b/.test(t)) { fromOffset = 0; windowDays = 1; understood.push("today"); }
  else if (/\btomorrow\b/.test(t)) { fromOffset = 1; windowDays = 1; understood.push("tomorrow"); }
  else if (/\bnext week\b/.test(t)) {
    // Next week starts on the coming Monday.
    const dow = TODAY.getDay();
    fromOffset = ((8 - dow) % 7) || 7;
    windowDays = 7;
    understood.push("next week");
  } else if (/\bthis week\b/.test(t)) {
    fromOffset = 0;
    windowDays = 7 - TODAY.getDay();
    understood.push("this week");
  }

  return { procedure, minutes, doctor, weekday, earliest, latest, fromOffset, windowDays, understood };
}

// ---------------------------------------------------------------------------
// Criteria → offers
// ---------------------------------------------------------------------------

export interface SlotCandidate {
  id: string;
  offset: number;
  date: Date;
  chair: string;
  doctor: string;
  start: number;
  minutes: number;
  /** "Tue 28 · 6:30pm · Dr. Kulkarni · Chair 2" */
  sentence: string;
}

function hourSentence(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  const display = ((whole + 11) % 12) + 1;
  const mer = whole >= 12 ? "pm" : "am";
  return `${display}:${mins < 10 ? "0" + mins : mins}${mer}`;
}

/**
 * Three concrete offers, phrased as sentences rather than plotted on a grid.
 * The caller is having a conversation; give her something she can read aloud.
 */
export function findSlots(criteria: SlotCriteria, limit = 3, nowHour?: number): SlotCandidate[] {
  const need = criteria.minutes / 60;
  const out: SlotCandidate[] = [];

  for (let i = 0; i < criteria.windowDays && out.length < limit * 4; i++) {
    const offset = criteria.fromOffset + i;
    const date = dateForOffset(offset);
    if (isClosed(date)) continue;
    if (criteria.weekday !== null && date.getDay() !== criteria.weekday) continue;

    const book = dayBook(offset);
    // Never offer a slot in the past.
    const dayFloor = offset === 0 && nowHour !== undefined ? Math.max(CLINIC_OPEN, nowHour + 0.25) : CLINIC_OPEN;

    const chairs = criteria.doctor
      ? CHAIRS.filter((c) => doctorForChair(c) === criteria.doctor || chairSubs[c]?.includes("Shared"))
      : CHAIRS;

    for (const chair of chairs) {
      const doctor = criteria.doctor ?? doctorForChair(chair);
      for (const f of freeIntervals(book, chair, dayFloor)) {
        // Walk the grid inside this free interval for the first fitting start.
        const from = Math.max(f.start, criteria.earliest, dayFloor);
        const gridStart = Math.ceil(from / SLOT_GRID) * SLOT_GRID;
        for (let s = gridStart; s + need <= f.end + 0.001 && s <= criteria.latest; s += SLOT_GRID) {
          out.push({
            id: `${offset}-${chair}-${s}`,
            offset,
            date,
            chair,
            doctor,
            start: s,
            minutes: criteria.minutes,
            sentence: `${relativeDayLabel(offset)} · ${hourSentence(s)} · ${doctor} · ${chair}`,
          });
          break; // one offer per free interval — three near-identical times help nobody
        }
      }
    }
  }

  // Earliest first, and spread across days so the three offers are real choices
  // rather than the same afternoon three times.
  out.sort((a, b) => a.offset - b.offset || a.start - b.start);

  const picked: SlotCandidate[] = [];
  const seenDays = new Set<number>();
  for (const c of out) {
    if (picked.length >= limit) break;
    if (seenDays.has(c.offset) && picked.length < limit - 1) continue;
    seenDays.add(c.offset);
    picked.push(c);
  }
  for (const c of out) {
    if (picked.length >= limit) break;
    if (!picked.includes(c)) picked.push(c);
  }

  return picked.slice(0, limit);
}

/** Expected collection for a day's book, in paise. */
export function expectedCollectionPaise(offset = 0): number {
  return dayBook(offset).reduce((sum, b) => {
    const proc = inferProcedure(b.proc);
    return sum + (proc?.feePaise ?? 0);
  }, 0);
}
