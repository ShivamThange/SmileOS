import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { session, isApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { passwordLogin, requestStaffOtp, verifyStaffOtp, type LoginResult } from "./api";

/*
 * Login-context error copy. The generic client messages are session-oriented
 * ("your session expired"), which reads wrong on a fresh sign-in — so the login
 * surface maps the auth codes to sign-in-appropriate wording.
 */
function loginError(err: unknown): string {
  if (!isApiError(err)) return "Something went wrong. Please try again.";
  switch (err.code) {
    case "AUTH_INVALID":
      return "Incorrect email or password.";
    case "AUTH_OTP_INVALID":
      return "That code isn't right. Check it and try again.";
    case "AUTH_OTP_EXPIRED":
      return "That code has expired or wasn't found — request a new one.";
    case "AUTH_LOCKED":
      return "Too many attempts. This account is locked for a short while.";
    case "AUTH_AUDIENCE":
      return "This account can't access the staff console.";
    case "NOT_FOUND":
      return "No staff account found for that email. Access is invite-only.";
    case "RATE_LIMIT":
      return "Too many attempts. Please wait a moment and try again.";
    case "VALIDATION_FAILED":
      return "Please check the details and try again.";
    default:
      return "We couldn't sign you in. Please try again.";
  }
}

/*
 * Staff login (spec T1.2). Email-OTP is the primary path; password is a
 * fallback for accounts that have one (e.g. the owner). Google is listed in the
 * spec but not yet implemented server-side, so it's shown disabled rather than
 * as a dead button. On success the access token goes to memory and the refresh
 * token is the httpOnly cookie the server set; we hydrate the session and land
 * in the Console (role-aware landing is refined in T1.4).
 */

type Mode = "otp-email" | "otp-code" | "password";

export function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const clinic = useAuth((s) => s.clinic);

  const [mode, setMode] = useState<Mode>("otp-email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function land(result: LoginResult) {
    session.setAccessToken(result.accessToken);
    useAuth.getState().setAuthed(result.user, useAuth.getState().clinic);
    // Return to the guarded path they were headed to, else the role-aware root.
    navigate(from && from.startsWith("/app") ? from : "/app", { replace: true });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "otp-email") {
        await requestStaffOtp(email.trim());
        setNotice(`We've sent a 6-digit code to ${email.trim()}.`);
        setMode("otp-code");
      } else if (mode === "otp-code") {
        land(await verifyStaffOtp(email.trim(), code.trim()));
      } else {
        land(await passwordLogin(email.trim(), password));
      }
    } catch (err) {
      // Field-level validation detail is surfaced generically here; forms get
      // per-field mapping in T6.2. Never show a parsed/raw string.
      setError(loginError(err));
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "otp-code" ? "Enter your code" : "Sign in to your clinic";
  const cta = mode === "otp-email" ? "Send code" : mode === "otp-code" ? "Verify & sign in" : "Sign in";

  return (
    <div className="min-h-screen grid place-items-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="mx-auto mb-3 h-11 w-11 rounded-xl bg-primary text-on-primary grid place-items-center text-lg font-semibold">
            {(clinic?.name ?? "D").slice(0, 1)}
          </div>
          <h1 className="text-lg font-semibold text-ink">{clinic?.name ?? "DentalOS"}</h1>
          <p className="text-sm text-muted mt-0.5">{title}</p>
        </div>

        <form onSubmit={submit} className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
          {notice && mode === "otp-code" && (
            <p className="text-[13px] text-muted-strong bg-primary-tint border border-primary-tint-border rounded-lg px-3 py-2">
              {notice}
            </p>
          )}

          {mode !== "otp-code" && (
            <label className="block">
              <span className="text-[12.5px] font-medium text-muted-strong">Work email</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.in"
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </label>
          )}

          {mode === "otp-code" && (
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
          )}

          {mode === "password" && (
            <label className="block">
              <span className="text-[12.5px] font-medium text-muted-strong">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </label>
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
            {busy ? "Please wait…" : cta}
          </button>

          {mode === "otp-code" && (
            <button
              type="button"
              onClick={() => { setMode("otp-email"); setCode(""); setError(null); setNotice(null); }}
              className="w-full text-[13px] text-muted hover:text-ink"
            >
              ← Use a different email
            </button>
          )}
        </form>

        {/* Alternate methods */}
        <div className="mt-4 space-y-2">
          {mode !== "otp-code" && (
            <button
              type="button"
              onClick={() => { setMode(mode === "password" ? "otp-email" : "password"); setError(null); }}
              className="w-full text-[13px] text-muted hover:text-ink"
            >
              {mode === "password" ? "Sign in with an email code instead" : "Sign in with a password instead"}
            </button>
          )}
          <button
            type="button"
            disabled
            title="Google sign-in is coming soon"
            className="w-full rounded-lg border border-border bg-surface text-sm text-muted py-2.5 disabled:opacity-60 cursor-not-allowed"
          >
            Continue with Google (coming soon)
          </button>
        </div>

        <p className="text-center text-[12px] text-muted-2 mt-6">
          Staff access is invite-only. Ask your clinic admin for an invitation.
        </p>
      </div>
    </div>
  );
}
