/*
 * Client-side auth session state (spec §3.2 / §6.2).
 *
 * The access token lives in memory ONLY — never localStorage — so an XSS payload
 * can't read a long-lived credential. The refresh token is an httpOnly cookie the
 * server sets; the browser sends it automatically on `/auth/refresh`. This module
 * is framework-agnostic (no React) so the api client can read it without a hook.
 */

let accessToken: string | null = null;

/** The clinic slug sent as X-Clinic-Slug on public/unauthenticated calls. */
let clinicSlug: string = (import.meta.env.VITE_CLINIC_SLUG as string | undefined) ?? "meher-dental-care";

/** Invoked when a request fails auth and cannot be silently refreshed. The app
 * boot / router registers this to route to the correct login surface. */
let onUnauthorized: (() => void) | null = null;

export const session = {
  getAccessToken: (): string | null => accessToken,
  setAccessToken: (token: string | null): void => {
    accessToken = token;
  },
  clear: (): void => {
    accessToken = null;
  },

  getClinicSlug: (): string => clinicSlug,
  setClinicSlug: (slug: string): void => {
    clinicSlug = slug;
  },

  setOnUnauthorized: (fn: (() => void) | null): void => {
    onUnauthorized = fn;
  },
  /** Called by the client after a refresh attempt has definitively failed. */
  handleUnauthorized: (): void => {
    accessToken = null;
    if (onUnauthorized) onUnauthorized();
    else if (typeof window !== "undefined") window.location.assign("/login");
  },
};
