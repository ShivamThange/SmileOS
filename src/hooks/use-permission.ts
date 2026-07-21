import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSession } from "@/hooks/use-session";
import { ROLE_PERMISSIONS, type Permission } from "@/shared/rbac";
import { USER_ROLES, type UserRole } from "@/shared/enums";

/*
 * usePermission — the single answer to "can this user do X" (spec §6.4).
 *
 * In production the effective permission set comes from the server's RBAC claim
 * (GET /auth/me), held in `useAuth`. That set already folds in a user's explicit
 * per-account grants and denials, so it is authoritative — the UI never
 * recomputes it. Gating in the UI is a courtesy (don't offer what will 403);
 * every gated action is still refused server-side.
 *
 * Under the DEV-only persona override (`useSession`), there is no server claim
 * for the previewed role, so we derive the role's base grants from the mirrored
 * RBAC matrix. This lets a developer see the receptionist's nav without seeding
 * five logins. Compiled-in only in DEV; in production the real set always wins.
 */

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  doctor: "Doctor",
  receptionist: "Front desk",
  assistant: "Assistant",
  accountant: "Accounts",
  lab_technician: "Lab",
};

export interface Permissions {
  /** True if the user holds every one of the given permissions. */
  can: (...perms: Permission[]) => boolean;
  /** True if the user holds at least one of the given permissions. */
  canAny: (...perms: Permission[]) => boolean;
  /** The effective role driving these permissions. */
  role: UserRole;
  /**
   * Human-readable list of the roles that hold a permission — for a tooltip
   * that tells a blocked user who *can* do the thing ("Requires Accounts or
   * Owner"). Ordered from most-specialised to broadest so the answer reads
   * naturally.
   */
  rolesFor: (perm: Permission) => string;
}

/** Which roles' base grants include a permission (for "requires…" tooltips). */
function rolesWith(perm: Permission): UserRole[] {
  return USER_ROLES.filter((r) => ROLE_PERMISSIONS[r].has(perm));
}

/** Format a role list as "A, B or C"; owner/admin are implied, not spelled out. */
function describeRoles(roles: UserRole[]): string {
  // Owner and admin can do essentially everything; naming them in every tooltip
  // is noise. Name the specialised roles, and fall back to a generic line only
  // when a permission truly belongs to no specialised role.
  const specialised = roles.filter((r) => r !== "owner" && r !== "admin");
  const shown = specialised.length ? specialised : roles;
  const labels = [...new Set(shown.map((r) => ROLE_LABEL[r]))];
  if (labels.length === 0) return "a role with the required permission";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

export function usePermission(): Permissions {
  const authPerms = useAuth((s) => s.permissions);
  const { user, isOverride } = useSession();
  const role = user.role;

  return useMemo<Permissions>(() => {
    // DEV persona preview: derive from the previewed role's base grants.
    // Otherwise: the authoritative server-computed set.
    const effective: ReadonlySet<string> =
      import.meta.env.DEV && isOverride ? ROLE_PERMISSIONS[role] : authPerms;

    return {
      role,
      can: (...perms) => perms.every((p) => effective.has(p)),
      canAny: (...perms) => perms.some((p) => effective.has(p)),
      rolesFor: (perm) => describeRoles(rolesWith(perm)),
    };
  }, [authPerms, isOverride, role]);
}
