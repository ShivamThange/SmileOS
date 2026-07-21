import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { usePatientSession } from "@/hooks/use-patient-session";
import { useFeatureEnabled, type FeatureKey } from "@/hooks/use-features";

/*
 * Route guards (spec T1.4). Each app surface is gated to its own audience:
 *   • /app/*    → staff session (useAuth authed)   → else /login
 *   • /portal/* → patient session                  → else /portal/login
 * The intended path is preserved in navigation state so login can return there.
 * Boot is already resolved by AppBoot before these render, so `booting` here is
 * only a transient guard.
 */

export function RequireStaff({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const location = useLocation();
  if (status === "booting") return null;
  if (status !== "authed") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

/*
 * Feature gate. A route for a module the clinic hasn't enabled must not exist —
 * not merely be hidden in the nav — so a forged or bookmarked URL lands on the
 * console 404 rather than a half-working screen. `any` of the given flags
 * enabled is enough (Operations, say, is present if either lab or inventory is).
 */
export function RequireFeature({ feature, children }: { feature: FeatureKey | FeatureKey[]; children: ReactNode }) {
  const featureOn = useFeatureEnabled();
  if (!featureOn(feature)) return <Navigate to="/app/404" replace />;
  return <>{children}</>;
}

export function RequirePatient({ children }: { children: ReactNode }) {
  const patient = usePatientSession((s) => s.patient);
  const location = useLocation();
  if (!patient) {
    return <Navigate to="/portal/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}
