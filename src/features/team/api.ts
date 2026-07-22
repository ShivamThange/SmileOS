import { api } from "@/lib/api";
import type { ApiResult } from "@/lib/api";
import type { UserRole } from "@/shared/enums";

/*
 * Team / users endpoints (spec 4.3). The users backend returns the RBAC role;
 * these functions map it onto the roster screen's display vocabulary.
 */

export interface ApiUser {
  _id: string;
  name: string;
  role: UserRole;
  active?: boolean;
  doctor?: { speciality?: string; registrationNumber?: string } | null;
}

export function listUsers(): Promise<ApiResult<ApiUser[]>> {
  return api.getPage<ApiUser[]>("/users", { query: { limit: 200 } });
}

export interface ApiAttendance {
  _id: string;
  staff?: { name?: string; role?: UserRole } | null;
  date: string;
  checkIn?: string;
  checkOut?: string;
  hours?: number;
  status: "in" | "out" | "absent" | "leave";
}
export function listAttendance(): Promise<ApiResult<ApiAttendance[]>> {
  return api.getPage<ApiAttendance[]>("/attendance", { query: { limit: 200 } });
}
