import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { getClinic, getClinicFeatures, getPublicClinic, updateClinicBranding, type ClinicBranding } from "./api";

/*
 * Clinic query hooks — the REFERENCE example for the T0.4 conventions
 * (spec §6.1). Every feature follows this shape: typed endpoint fns in api.ts,
 * hooks here keyed via `queryKeys`, and each mutation documenting the exact keys
 * it invalidates.
 */

/** Public clinic profile (Site / Booking) — no auth. */
export function usePublicClinic() {
  return useQuery({
    queryKey: queryKeys.clinic.public(),
    queryFn: getPublicClinic,
    staleTime: 5 * 60_000, // clinic profile changes rarely
  });
}

/** Authenticated clinic config (Console). */
export function useClinic() {
  return useQuery({
    queryKey: queryKeys.clinic.current(),
    queryFn: getClinic,
    staleTime: 5 * 60_000,
  });
}

/** Clinic feature flags — cached aggressively; nav/routes read from it. */
export function useClinicFeatures() {
  return useQuery({
    queryKey: queryKeys.clinic.features(),
    queryFn: getClinicFeatures,
    staleTime: 5 * 60_000,
  });
}

/**
 * Reference mutation. Editing branding changes the clinic record, so on success
 * we invalidate every clinic-shaped query.
 *
 * INVALIDATES:
 *   • queryKeys.clinic.current()  — the Console config the theme reads from
 *   • queryKeys.clinic.public()   — the Site profile (same branding)
 * (Both are covered by invalidating the `queryKeys.clinic.all` prefix, but we
 * list them explicitly so the intent is auditable — the convention is that a
 * mutation names what it invalidates, not that it invalidates broadly by luck.)
 */
export function useUpdateClinicBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branding: Partial<ClinicBranding>) => updateClinicBranding(branding),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinic.current() });
      qc.invalidateQueries({ queryKey: queryKeys.clinic.public() });
    },
  });
}
