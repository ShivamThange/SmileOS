import { api } from "@/lib/api";

/*
 * Unscheduled-treatment recovery (spec 2.5 / 4.7). Diagnosed work the patient
 * hasn't booked — the practice's largest recoverable asset. The server scores
 * and ages the backlog; outcomes (contacted / snoozed / declined) post back so
 * the queue reflects reality.
 */

export interface ApiUnscheduledItem {
  id: string;
  name?: string;
  teeth?: number[];
  lineTotalPaise: number;
  priority?: "urgent" | "recommended" | "elective";
  status: string;
  justification?: string;
  daysSincePlanned?: number | null;
  patient?: { _id: string; firstName?: string; lastName?: string; phone?: string } | null;
  plan?: { planDate?: string; title?: string } | null;
  followUp?: { lastContactDate?: string; contactAttempts?: number; lastContactOutcome?: string } | null;
}

export function getUnscheduled(): Promise<ApiUnscheduledItem[]> {
  return api.get<ApiUnscheduledItem[]>("/revenue/unscheduled", { query: { limit: 80 } });
}

export interface UnscheduledSummary {
  totalValuePaise: number;
  patientCount: number;
  recoverablePaise: number;
  itemCount: number;
  ageing?: { under30: number; under90: number; over90: number };
}
export function getUnscheduledSummary(): Promise<UnscheduledSummary> {
  return api.get<UnscheduledSummary>("/revenue/unscheduled/summary");
}

export function logRecoveryContact(itemId: string, outcome: string): Promise<unknown> {
  return api.post(`/revenue/unscheduled/${itemId}/contact`, { outcome });
}
export function snoozeRecovery(itemId: string, until: string): Promise<unknown> {
  return api.post(`/revenue/unscheduled/${itemId}/snooze`, { until });
}
export function declineRecovery(itemId: string, reason: string): Promise<unknown> {
  return api.post(`/revenue/unscheduled/${itemId}/decline`, { reason });
}
