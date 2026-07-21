/*
 * Money (spec Part 0, rule 3). All currency is an integer count of paise.
 * Never floating point. Rupees appear only for display/parsing at the edges.
 */

/** Rupees (may be fractional) → integer paise. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Integer paise → rupees number (for JSON that must show rupees; prefer sending paise). */
export function toRupees(paise: number): number {
  return paise / 100;
}

/** Sum a list of paise amounts safely. */
export function sumPaise(amounts: number[]): number {
  return amounts.reduce((s, n) => s + Math.round(n), 0);
}

/** Apply a percentage discount to a paise amount, returning integer paise removed. */
export function pctPaise(paise: number, pct: number): number {
  return Math.round((paise * pct) / 100);
}

/** Format paise as an Indian-grouped rupee string (server-side, e.g. for PDFs). */
export function formatInr(paise: number): string {
  const neg = paise < 0 ? "-" : "";
  const r = Math.round(Math.abs(paise) / 100).toString();
  if (r.length <= 3) return `${neg}₹${r}`;
  const last3 = r.slice(-3);
  const rest = r.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${neg}₹${rest},${last3}`;
}
