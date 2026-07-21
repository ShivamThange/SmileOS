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
