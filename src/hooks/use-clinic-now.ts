import { useEffect, useState } from "react";
import { CLINIC_OPEN, CLINIC_CLOSE } from "@/lib/schedule";

/*
 * The clinic clock, as a decimal hour.
 *
 * Two things it must get right. First, it ticks — a "now" marker that doesn't
 * move is worse than no marker, because it quietly lies. Second, the seeded
 * demo data describes a working day, so when the real clock is outside clinic
 * hours the marker parks at a mid-morning position rather than pinning the
 * whole schedule to "closed". Remove the clamp the day real data arrives.
 */

const DEMO_HOUR = 11.6; // 11:36 — mid-morning, two chairs occupied in the seed

export function useClinicNow(tickMs = 30_000): number {
  const [now, setNow] = useState(() => currentHour());

  useEffect(() => {
    const t = setInterval(() => setNow(currentHour()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);

  return now;
}

function currentHour(): number {
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < CLINIC_OPEN || h > CLINIC_CLOSE) return DEMO_HOUR;
  return h;
}

/** True while the given block is running. */
export function isRunningNow(start: number, dur: number, now: number): boolean {
  return now >= start && now < start + dur;
}

/** Whole minutes elapsed since a decimal hour. Negative if still in the future. */
export function minutesSince(hour: number, now: number): number {
  return Math.round((now - hour) * 60);
}
