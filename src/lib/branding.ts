import type { ClinicBranding } from "@/features/clinic/api";

/*
 * Branding application (spec §8.1). Clinic brand tokens come from the server and
 * are written to CSS custom properties on <html> so the whole app themes from
 * clinic config, not hardcoded hex. A rebrand is then a data change.
 *
 * The last-applied branding is cached in localStorage and re-applied
 * synchronously at the very top of boot, BEFORE the first fetch resolves — so a
 * returning user never sees a flash of the default palette (spec: "no flash of
 * unbranded content").
 */

const CACHE_KEY = "dentalos:branding";

/** Lighten a hex colour toward white by `amt` (0–1). Used to derive tints. */
function lighten(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `#${((1 << 24) + (mix(r) << 16) + (mix(g) << 8) + mix(b)).toString(16).slice(1)}`;
}

export function applyBranding(branding: ClinicBranding): void {
  const root = document.documentElement.style;
  root.setProperty("--primary", branding.primary);
  root.setProperty("--primary-hover", branding.primaryHover);
  root.setProperty("--primary-lift", lighten(branding.primary, 0.12));
  root.setProperty("--primary-tint", lighten(branding.primary, 0.86));
  root.setProperty("--primary-tint-border", lighten(branding.primary, 0.72));
  if (branding.canvas) {
    root.setProperty("--bg", branding.canvas); // the page background var used in tokens.css
    root.setProperty("--canvas", branding.canvas); // splash fallback
  }
  if (branding.fontSans) root.setProperty("--font-sans", `"${branding.fontSans}", ui-sans-serif, system-ui, sans-serif`);
  if (branding.fontSerif) root.setProperty("--font-serif", `"${branding.fontSerif}", ui-serif, Georgia, serif`);

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(branding));
  } catch {
    /* private mode / quota — non-fatal, we just lose the no-flash cache */
  }
}

/** Re-apply the last-known branding synchronously (call before first paint). */
export function applyCachedBranding(): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) applyBranding(JSON.parse(raw) as ClinicBranding);
  } catch {
    /* ignore */
  }
}
