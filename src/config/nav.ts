import type { IconName } from "@/components/ui/icon";

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  to: string;
  /** Match this path prefix for active state (defaults to `to`). */
  match?: string;
  count?: number;
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
      { id: "schedule", label: "Schedule", icon: "schedule", to: "/app/calendar", match: "/app/calendar" },
      { id: "patients", label: "Patients", icon: "patients", to: "/app/patients", match: "/app/patients" },
      { id: "clinical", label: "Clinical", icon: "clinical", to: "/app/clinical/queue", match: "/app/clinical" },
    ],
  },
  {
    label: "BUSINESS",
    items: [
      { id: "revenue", label: "Revenue", icon: "revenue", to: "/app/invoices", match: "/app/(invoices|payments|revenue|expenses)", count: 3 },
      { id: "growth", label: "Growth", icon: "growth", to: "/app/leads", match: "/app/(leads|recalls|campaigns|reviews|inbox)", count: 5 },
    ],
  },
  {
    label: "CLINIC",
    items: [
      { id: "operations", label: "Operations", icon: "operations", to: "/app/lab", match: "/app/(lab|inventory|suppliers)", count: 2 },
      { id: "team", label: "Team", icon: "team", to: "/app/staff", match: "/app/(staff|attendance|doctor-performance)" },
      { id: "insight", label: "Insight", icon: "insight", to: "/app/insight", match: "/app/insight" },
      { id: "settings", label: "Settings", icon: "settings", to: "/app/settings/profile", match: "/app/settings" },
    ],
  },
];
