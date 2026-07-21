import { useEffect, useRef, type ReactNode } from "react";
import { session } from "@/lib/api";
import { applyBranding } from "@/lib/branding";
import { getPublicClinic, getClinicFeatures } from "@/features/clinic/api";
import { getMe, refreshSession } from "@/features/auth/api";
import { useAuth } from "@/hooks/use-auth";

/*
 * §8.1 boot sequence. Before the app is usable we resolve *who you are* and
 * *which clinic*:
 *   1. apply cached branding synchronously (done in main.tsx, pre-paint)
 *   2. fetch the public clinic profile → apply fresh brand tokens
 *   3. silent /auth/refresh; on success fetch /auth/me → hydrate the session
 *   4. render
 *
 * A refresh failure is normal (a guest, or an expired session) — we fall
 * through to guest state and let the router (T1.4) decide Site vs login. The
 * clinic fetch and the auth attempt run in parallel; branding applies the moment
 * the clinic resolves, so there's no wait on auth to paint a branded shell.
 */
async function runBoot(): Promise<void> {
  const auth = useAuth.getState();

  const clinicPromise = getPublicClinic()
    .then((clinic) => {
      applyBranding(clinic.branding);
      auth.setClinic(clinic);
      return clinic;
    })
    .catch(() => null);

  const sessionPromise = (async () => {
    const refreshed = await refreshSession();
    if (!refreshed) return null;
    session.setAccessToken(refreshed.accessToken);
    try {
      return await getMe();
    } catch {
      session.clear();
      return null;
    }
  })();

  const [clinic, user] = await Promise.all([clinicPromise, sessionPromise]);
  if (user) {
    auth.setAuthed(user, clinic);
    // Feature flags gate which console sections exist; fetch them once the
    // staff session is confirmed. A failure leaves flags empty, which reads as
    // "all enabled" so a transient error never hides a core surface.
    try {
      auth.setFeatures(await getClinicFeatures());
    } catch {
      /* non-fatal — nav falls back to all-enabled */
    }
  } else {
    auth.setGuest(clinic);
  }
}

function BootSplash() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "var(--canvas, #f4f3ef)",
      }}
      aria-busy="true"
      aria-label="Loading"
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          border: "2.5px solid var(--primary-tint, #eaf1ee)",
          borderTopColor: "var(--primary, #20614e)",
          animation: "dentalos-spin 0.7s linear infinite",
        }}
      />
      <style>{"@keyframes dentalos-spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

export function AppBoot({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // guard StrictMode's double-invoke
    started.current = true;
    // On an auth failure anywhere in the app, drop to guest (T1.4 adds redirect).
    session.setOnUnauthorized(() => useAuth.getState().setGuest());
    void runBoot();
  }, []);

  if (status === "booting") return <BootSplash />;
  return <>{children}</>;
}
