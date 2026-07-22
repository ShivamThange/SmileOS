import { api } from "@/lib/api";
import type { ApiResult } from "@/lib/api";
import type { LeadStage, LeadSource } from "@/shared/enums";

/*
 * Leads endpoints (spec 4.8). The pipeline reads /leads and moves cards through
 * the server so a stage change is durable, not just a local drag.
 */

export interface ApiLead {
  id: string;
  name: string;
  phone?: string;
  source: LeadSource;
  interest?: string;
  estimatedValuePaise?: number;
  stage: LeadStage;
  nextFollowUp?: string;
  createdAt: string;
}

export function listLeads(): Promise<ApiResult<ApiLead[]>> {
  return api.getPage<ApiLead[]>("/leads", { query: { limit: 200 } });
}

export function updateLeadStage(id: string, stage: LeadStage): Promise<ApiLead> {
  return api.post<ApiLead>(`/leads/${id}/stage`, { stage });
}
