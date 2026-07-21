import { create } from "zustand";
import type { UserRole } from "@/types/enums";
import type { MeUser } from "@/features/auth/api";
import { useAuth } from "@/hooks/use-auth";

/*
 * Session — who is signed in, and therefore what the console root shows.
 *
 * The real identity comes from GET /auth/me (the server's RBAC claim), held in
 * `useAuth`. `useSession()` maps that principal onto the shape the console UI
 * consumes. The DEMO_USERS persona switcher survives ONLY as a dev-only override
 * (behind import.meta.env.DEV) so the reimagined screens can still be exercised
 * per-role without seeding five logins — it never drives production access.
 */

export interface SessionUser {
  id: string;
  name: string;
  /** Short form used in the greeting line — "Priya", "Dr. Meher". */
  shortName: string;
  initials: string;
  role: UserRole;
  roleLabel: string;
  /**
   * For clinical roles, the name this user appears under in the appointment
   * book. Matches `Appointment.doctor` exactly.
   */
  doctorName?: string;
}

export const DEMO_USERS: SessionUser[] = [
  {
    id: "u_priya",
    name: "Priya Sawant",
    shortName: "Priya",
    initials: "PS",
    role: "receptionist",
    roleLabel: "Front desk",
  },
  {
    id: "u_anjali",
    name: "Dr. Anjali Meher",
    shortName: "Dr. Meher",
    initials: "AM",
    role: "owner",
    roleLabel: "Owner · Prosthodontist",
    doctorName: "Dr. Meher",
  },
  {
    id: "u_rohan",
    name: "Dr. Rohan Kulkarni",
    shortName: "Dr. Kulkarni",
    initials: "RK",
    role: "doctor",
    roleLabel: "Associate · Endodontist",
    doctorName: "Dr. Kulkarni",
  },
  {
    id: "u_sunita",
    name: "Sunita Rane",
    shortName: "Sunita",
    initials: "SR",
    role: "assistant",
    roleLabel: "Chairside assistant",
  },
  {
    id: "u_kavita",
    name: "Kavita Bhagat",
    shortName: "Kavita",
    initials: "KB",
    role: "accountant",
    roleLabel: "Accounts · Fridays",
  },
];

/**
 * Which root screen `/app` resolves to for a given role.
 *
 * The person who opens the console most often is the receptionist, so she gets
 * the briefing. The owner's financial dashboard is a destination she visits
 * twice a week, not the front door — it lives at /app/insight.
 */
export type ConsoleRoot = "brief" | "clinical" | "dashboard";

export function rootForRole(role: UserRole): ConsoleRoot {
  switch (role) {
    case "doctor":
    case "owner":
      return "clinical";
    case "accountant":
      return "dashboard";
    default:
      return "brief";
  }
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  doctor: "Doctor",
  receptionist: "Front desk",
  assistant: "Chairside assistant",
  accountant: "Accounts",
  lab_technician: "Lab",
};

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function shortNameOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (/^dr\.?$/i.test(parts[0] ?? "")) return `Dr. ${parts[parts.length - 1]}`;
  return parts[0] ?? name;
}

/** Map the real /auth/me principal onto the console's SessionUser shape. */
export function mapAuthUserToSession(me: MeUser): SessionUser {
  const clinical = me.role === "doctor" || me.role === "owner";
  return {
    id: me.id,
    name: me.name,
    shortName: shortNameOf(me.name),
    initials: initialsOf(me.name),
    role: me.role,
    roleLabel: ROLE_LABELS[me.role] ?? me.role,
    doctorName: clinical ? shortNameOf(me.name) : undefined,
  };
}

/*
 * Dev-only persona override. Lets a developer preview any role's console
 * without five seeded logins. Compiled in only under import.meta.env.DEV; in a
 * production build `overrideId` is always null and the real user always wins.
 */
interface OverrideState {
  overrideId: string | null;
  setUserId: (id: string | null) => void;
}
const useOverride = create<OverrideState>((set) => ({
  overrideId: null,
  setUserId: (id) => set({ overrideId: id }),
}));

export interface Session {
  user: SessionUser;
  /** Dev-only: switch the previewed persona. No-op in production. */
  setUserId: (id: string | null) => void;
  /** True when a dev override is masking the real signed-in user. */
  isOverride: boolean;
}

/**
 * The console's view of who is signed in. Real user from `useAuth`, with an
 * optional dev-only persona override on top.
 */
export function useSession(): Session {
  const authUser = useAuth((s) => s.user);
  const overrideId = useOverride((s) => s.overrideId);
  const setUserId = useOverride((s) => s.setUserId);

  const override = import.meta.env.DEV && overrideId ? DEMO_USERS.find((u) => u.id === overrideId) : undefined;
  const user = override ?? (authUser ? mapAuthUserToSession(authUser) : DEMO_USERS[0]);

  return { user, setUserId, isOverride: !!override };
}
