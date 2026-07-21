import { api } from "@/lib/api";
import type { UserRole } from "@/types/enums";

/*
 * Auth endpoints (spec §4.1 / §8.1). Login/OTP surfaces arrive in T1.2/T1.3;
 * this file carries the boot-critical calls (refresh, me) plus logout.
 */

/** The authenticated principal, from GET /auth/me (serialiseUser on the server). */
export interface MeUser {
  id: string;
  clinicId: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  doctor: { slug?: string; registrationNumber?: string; publicProfile?: boolean } | null;
  permissions: string[];
}

/** What a successful login returns — the access token (kept in memory) plus the
 * principal. The refresh token is set by the server as an httpOnly cookie. */
export interface LoginResult {
  accessToken: string;
  user: MeUser;
}

/** Request a 6-digit email OTP for staff login. Clinic is resolved from the
 * X-Clinic-Slug header the client attaches. */
export function requestStaffOtp(email: string): Promise<{ sent: boolean }> {
  return api.post<{ sent: boolean }>("/auth/otp/request", { email, purpose: "login" }, { skipAuth: true });
}

/** Verify the OTP → issues a staff-audience session. */
export function verifyStaffOtp(email: string, code: string): Promise<LoginResult> {
  return api.post<LoginResult>("/auth/otp/verify", { email, purpose: "login", code }, { skipAuth: true });
}

/** Password login (staff fallback) → issues a staff-audience session. */
export function passwordLogin(email: string, password: string): Promise<LoginResult> {
  return api.post<LoginResult>("/auth/login", { email, password }, { skipAuth: true });
}

/* ── Patient portal login (OTP only; patient token audience) ──────────────── */

export interface PortalPatient {
  id: string;
  clinicId: string;
  patientNumber: string;
  name: string;
  email: string | null;
  phone: string;
}
export interface PatientLoginResult {
  accessToken: string;
  patient: PortalPatient;
}

/** Request a login code for a patient email (same endpoint as staff — it only
 * sends a code; the verify step decides the audience). */
export function requestPatientOtp(email: string): Promise<{ sent: boolean }> {
  return api.post<{ sent: boolean }>("/auth/otp/request", { email, purpose: "login" }, { skipAuth: true });
}

/** Verify the patient OTP → issues a patient-audience session. */
export function verifyPatientOtp(email: string, code: string): Promise<PatientLoginResult> {
  return api.post<PatientLoginResult>("/auth/portal/otp/verify", { email, purpose: "login", code }, { skipAuth: true });
}

/** Silent refresh — exchanges the httpOnly refresh cookie for a new access
 * token. Returns null if there is no valid session (a fresh/guest visitor). */
export async function refreshSession(): Promise<{ accessToken: string } | null> {
  try {
    return await api.post<{ accessToken: string }>("/auth/refresh", undefined, { skipAuth: true });
  } catch {
    return null;
  }
}

/** The current principal. Requires a valid access token in the session. */
export function getMe(): Promise<MeUser> {
  return api.get<MeUser>("/auth/me");
}

/** End the session server-side (clears the refresh cookie). */
export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout", undefined, { skipAuth: true });
  } catch {
    /* best-effort — local session is cleared regardless */
  }
}
