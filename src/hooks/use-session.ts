import { create } from "zustand";
import type { UserRole } from "@/types/enums";

/*
 * Session — who is signed in, and therefore what the console root shows.
 *
 * In production this comes from GET /auth/me and the role arrives from the
 * server's RBAC claim; the router must never trust a client-side toggle for
 * anything that guards data. Here it is a local store so the four console
 * personas (front desk, dentist, owner, accountant) can each be demonstrated,
 * and so `/app` can resolve to the right root screen without a settings flag.
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

interface SessionState {
  user: SessionUser;
  setUserId: (id: string) => void;
}

export const useSession = create<SessionState>((set) => ({
  user: DEMO_USERS[0],
  setUserId: (id) =>
    set((s) => ({ user: DEMO_USERS.find((u) => u.id === id) ?? s.user })),
}));
