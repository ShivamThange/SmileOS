import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { session, isApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { usePatientSession } from "@/hooks/use-patient-session";
import { requestPatientOtp, verifyPatientOtp } from "@/features/auth/api";

/*
 * Patient portal login (spec T1.3). Email-OTP only — no password for patients,
 * and the verify issues a PATIENT-audience token so it can never address a
 * Console endpoint. On success we land in the Portal.
 */
function portalError(err: unknown): string {
  if (!isApiError(err)) return "Something went wrong. Please try again.";
  switch (err.code) {
    case "AUTH_OTP_INVALID":
      return "That code isn't right. Check it and try again.";
    case "AUTH_OTP_EXPIRED":
      return "That code has expired or wasn't found — request a new one.";
    case "NOT_FOUND":
      return "We couldn't find a patient record for that email. Please check with your clinic.";
    case "RATE_LIMIT":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "We couldn't sign you in. Please try again.";
  }
}

export function PortalLogin() {
  const navigate = useNavigate();
  const clinic = useAuth((s) => s.clinic);

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (step === "email") {
        await requestPatientOtp(email.trim());
        setStep("code");
      } else {
        const result = await verifyPatientOtp(email.trim(), code.trim());
        session.setAccessToken(result.accessToken);
        usePatientSession.getState().setPatient(result.patient);
        navigate("/portal", { replace: true });
      }
    } catch (err) {
      setError(portalError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="mx-auto mb-3 h-11 w-11 rounded-xl bg-primary text-on-primary grid place-items-center text-lg font-semibold">
            {(clinic?.name ?? "D").slice(0, 1)}
          </div>
          <h1 className="text-lg font-semibold text-ink">{clinic?.name ?? "DentalOS"}</h1>
          <p className="text-sm text-muted mt-0.5">
            {step === "email" ? "Sign in to your patient portal" : "Enter your code"}
          </p>
        </div>

        <form onSubmit={submit} className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
          {step === "email" ? (
            <label className="block">
              <span className="text-[12.5px] font-medium text-muted-strong">Email</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </label>
          ) : (
            <>
              <p className="text-[13px] text-muted-strong bg-primary-tint border border-primary-tint-border rounded-lg px-3 py-2">
                We've sent a 6-digit code to {email.trim()}.
              </p>
              <label className="block">
                <span className="text-[12.5px] font-medium text-muted-strong">6-digit code</span>
                <input
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-lg tracking-[0.4em] text-center text-ink outline-none focus:border-primary"
                />
              </label>
            </>
          )}

          {error && (
            <p role="alert" className="text-[13px] text-danger bg-danger-bg border border-danger-border rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary text-on-primary text-sm font-semibold py-2.5 hover:bg-primary-hover disabled:opacity-60 transition-colors"
          >
            {busy ? "Please wait…" : step === "email" ? "Send code" : "Verify & sign in"}
          </button>

          {step === "code" && (
            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); setError(null); }}
              className="w-full text-[13px] text-muted hover:text-ink"
            >
              ← Use a different email
            </button>
          )}
        </form>

        <p className="text-center text-[12px] text-muted-2 mt-6">
          New here? Your clinic sets up your portal access after your first visit.
        </p>
      </div>
    </div>
  );
}
