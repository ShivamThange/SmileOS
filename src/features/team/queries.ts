import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import type { UserRole } from "@/shared/enums";
import { listUsers, type ApiUser } from "./api";
import type { Staff, StaffRole } from "./team-data";

/*
 * Team hooks (T3.1). The users backend speaks RBAC roles; the roster screen
 * speaks job titles and permission tiers, so each user is mapped across.
 */

const ROLE_DISPLAY: Record<UserRole, StaffRole> = {
  owner: "Doctor",
  doctor: "Doctor",
  admin: "Manager",
  receptionist: "Front desk",
  assistant: "Assistant",
  accountant: "Manager",
  lab_technician: "Assistant",
};

const PERMISSION_TIER: Record<UserRole, Staff["permission"]> = {
  owner: "Owner",
  admin: "Owner",
  doctor: "Clinician",
  receptionist: "Reception",
  accountant: "Reception",
  assistant: "Read-only",
  lab_technician: "Read-only",
};

function toStaff(u: ApiUser): Staff {
  return {
    id: u._id,
    name: u.name,
    role: ROLE_DISPLAY[u.role] ?? "Assistant",
    speciality: u.doctor?.speciality,
    roster: "—",
    permission: PERMISSION_TIER[u.role] ?? "Read-only",
    active: u.active !== false,
  };
}

export function useStaff() {
  return useQuery({
    queryKey: queryKeys.team.users(),
    queryFn: async (): Promise<Staff[]> => {
      const { data } = await listUsers();
      return data.map(toStaff);
    },
    staleTime: 60_000,
  });
}
