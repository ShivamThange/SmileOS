import type { IconName } from "@/components/ui/icon";
import type { Permission } from "@/shared/rbac";

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  to: string;
  /** Match this path prefix for active state (defaults to `to`). */
  match?: string;
  count?: number;
  /**
   * Permission required to see this item (spec §6.4). Omitted → always visible
   * (e.g. Today is the role-aware root; Settings is the gateway to a user's own
   * profile). The check is a courtesy — the server still refuses the underlying
   * routes for a user who forges the URL.
   */
  perm?: Permission;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Console navigation — structure and counts ported from the design. */
export const navGroups: NavGroup[] = [
  {
    label: "",
    items: [
      { id: "today", label: "Today", icon: "dashboard", to: "/app", match: "/app$" },
      { id: "schedule", label: "Schedule", icon: "schedule", to: "/app/calendar", match: "/app/calendar", perm: "appointment:read" },
      { id: "patients", label: "Patients", icon: "patients", to: "/app/patients", match: "/app/patients", perm: "patient:read" },
      { id: "clinical", label: "Clinical", icon: "clinical", to: "/app/clinical/queue", match: "/app/clinical", perm: "chart:read" },
    ],
  },
  {
    label: "BUSINESS",
    items: [
      { id: "revenue", label: "Revenue", icon: "revenue", to: "/app/invoices", match: "/app/(invoices|payments|revenue|expenses)", count: 3, perm: "invoice:read" },
      { id: "growth", label: "Growth", icon: "growth", to: "/app/leads", match: "/app/(leads|recalls|campaigns|reviews|inbox)", count: 5, perm: "lead:read" },
    ],
  },
  {
    label: "CLINIC",
    items: [
      { id: "operations", label: "Operations", icon: "operations", to: "/app/lab", match: "/app/(lab|inventory|suppliers)", count: 2, perm: "lab_case:read" },
      { id: "team", label: "Team", icon: "team", to: "/app/staff", match: "/app/(staff|attendance|doctor-performance)", perm: "staff:read" },
      { id: "insight", label: "Insight", icon: "insight", to: "/app/insight", match: "/app/insight", perm: "analytics:read" },
      { id: "settings", label: "Settings", icon: "settings", to: "/app/settings/profile", match: "/app/settings" },
    ],
  },
];

/**
 * Filter the nav to what a user may see. An item with no `perm` is always
 * shown; a group with no visible items is dropped so the sidebar never renders
 * an empty section header.
 */
export function visibleNavGroups(can: (perm: Permission) => boolean): NavGroup[] {
  return navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.perm || can(item.perm)) }))
    .filter((group) => group.items.length > 0);
}
