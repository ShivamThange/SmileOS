import { useAuth } from "@/hooks/use-auth";
import type { ClinicFeatures } from "@/config/clinic";

/** A clinic feature-flag key (spec 4.2). */
export type FeatureKey = keyof ClinicFeatures;

/*
 * Feature flags (spec 4.2 / §6.4). The clinic's purchased/enabled modules,
 * resolved from GET /clinic/features and held in `useAuth`. They decide which
 * console sections and routes *exist* — distinct from permissions, which decide
 * what a given user may do within the sections that exist.
 *
 * An unset flag reads as ENABLED: the server only lists flags it has an opinion
 * on, so a brand-new flag the backend hasn't shipped yet must not silently hide
 * a core surface. A flag the clinic has explicitly turned off is `false` and
 * hides its section.
 */

/** Reactive check for a single feature. */
export function useFeature(key: FeatureKey): boolean {
  return useAuth((s) => s.features[key] !== false);
}

/** Reactive predicate — pass one or more keys, true if ANY is enabled. */
export function useFeatureEnabled(): (keys: FeatureKey | FeatureKey[]) => boolean {
  const features = useAuth((s) => s.features);
  return (keys) => (Array.isArray(keys) ? keys : [keys]).some((k) => features[k] !== false);
}

/** Non-reactive check for use outside React (guards, loaders). */
export function isFeatureEnabled(key: FeatureKey): boolean {
  return useAuth.getState().features[key] !== false;
}
