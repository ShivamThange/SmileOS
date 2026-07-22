import { api } from "@/lib/api";

/*
 * Analytics endpoints (spec 4.12). The revenue-at-risk panel is the dashboard's
 * headline — money the practice has already earned or diagnosed but not yet
 * collected or scheduled.
 */

export interface RevenueAtRisk {
  atRiskPaise: number;
  unscheduled: { totalValuePaise: number; patientCount: number; itemCount?: number };
  receivables: { totalPaise: number; under30Paise: number; over30Paise: number; count: number };
  recalls: { count?: number; overdueCount?: number; valuePaise?: number };
}
export function getRevenueAtRisk(): Promise<RevenueAtRisk> {
  return api.get<RevenueAtRisk>("/analytics/revenue-at-risk");
}

export interface DashboardSummary {
  today: { appointments: number };
  patients: { active: number };
  collectionsToday: { totalPaise?: number; count?: number };
  caseAcceptance: { acceptanceRate?: number };
  revenueAtRisk: { unscheduledValuePaise: number; patientCount: number };
}
export function getDashboardSummary(): Promise<DashboardSummary> {
  return api.get<DashboardSummary>("/analytics/dashboard");
}
