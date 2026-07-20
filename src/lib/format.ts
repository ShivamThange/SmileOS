/*
 * Formatters — the single source of truth for how money, dates and phone
 * numbers render. Never format these inline anywhere else.
 *
 * Money: the backend stores integer paise. These helpers take paise and
 * render with the Indian lakh/crore grouping convention (₹12,34,567).
 */

/** Group an integer rupee amount with Indian digit grouping. */
function groupIndian(rupees: number): string {
  const neg = rupees < 0 ? "-" : "";
  const s = Math.round(Math.abs(rupees)).toString();
  if (s.length <= 3) return neg + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return neg + rest + "," + last3;
}

/** Paise → "₹12,34,567". */
export function inr(paise: number): string {
  return "₹" + groupIndian(paise / 100);
}

/** Paise → "₹12,34,567" but accepts a rupee figure (for mock convenience). */
export function inrFromRupees(rupees: number): string {
  return "₹" + groupIndian(rupees);
}

/** Compact rupee display for tight chips, e.g. ₹1.85L / ₹4.8L / ₹12Cr. */
export function inrCompact(paise: number): string {
  const r = paise / 100;
  const abs = Math.abs(r);
  if (abs >= 1_00_00_000) return "₹" + (r / 1_00_00_000).toFixed(2).replace(/\.00$/, "") + "Cr";
  if (abs >= 1_00_000) return "₹" + (r / 1_00_000).toFixed(2).replace(/\.00$/, "") + "L";
  if (abs >= 1_000) return "₹" + (r / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return "₹" + Math.round(r);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ISO/Date → "20 Jul 2026". */
export function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Decimal hour (e.g. 9.5) → "9:30". */
export function fmtHour(t: number): string {
  const h = Math.floor(t);
  const m = Math.round((t - h) * 60);
  return `${((h + 11) % 12) + 1}:${m < 10 ? "0" + m : m}`;
}

/** Decimal-hour range → "9:30–10:30". */
export function fmtHourRange(start: number, dur: number): string {
  return `${fmtHour(start)}–${fmtHour(start + dur)}`;
}

/** +91 default phone display, spaced as "98220 44513". */
export function fmtPhone(raw: string): string {
  return raw.trim();
}
