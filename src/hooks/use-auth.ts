import { create } from "zustand";
import type { MeUser } from "@/features/auth/api";
import type { PublicClinic } from "@/features/clinic/api";

/*
 * The real auth session (spec §8.1 / §3.2), populated by AppBoot from
 * /auth/refresh → /auth/me. This is the source of truth the router guards
 * (T1.4) and the permission hook (T1.5) will read from.
 *
 * Distinct from the demo `useSession` persona switcher, which stays until T1.4
 * retires it — so the mock console keeps working while auth is wired underneath.
 */

export type BootStatus = "booting" | "authed" | "guest";

interface AuthState {
  status: BootStatus;
  user: MeUser | null;
  clinic: PublicClinic | null;
  permissions: Set<string>;
  setAuthed: (user: MeUser, clinic: PublicClinic | null) => void;
  setGuest: (clinic?: PublicClinic | null) => void;
  setClinic: (clinic: PublicClinic) => void;
  reset: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: "booting",
  user: null,
  clinic: null,
  permissions: new Set<string>(),
  setAuthed: (user, clinic) =>
    set({ status: "authed", user, clinic: clinic ?? get().clinic, permissions: new Set(user.permissions) }),
  setGuest: (clinic) =>
    set({ status: "guest", user: null, permissions: new Set<string>(), clinic: clinic ?? get().clinic }),
  setClinic: (clinic) => set({ clinic }),
  reset: () => set({ status: "guest", user: null, permissions: new Set<string>() }),
}));

/** Non-reactive permission check for use outside React (guards, api layer). */
export function hasPermission(permission: string): boolean {
  return useAuth.getState().permissions.has(permission);
}
