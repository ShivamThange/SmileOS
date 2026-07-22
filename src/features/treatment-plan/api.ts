import { api } from "@/lib/api";
import type { ApiResult } from "@/lib/api";
import type { PlanStatus as ApiPlanStatus } from "@/shared/enums";

/*
 * Treatment-plan endpoints (spec 4.7). The list carries batched per-plan totals
 * (gross / accepted / deferred value and item counts) so the worklist can rank
 * plans by money without loading every item. The rich builder/presenter model
 * (phases, per-item options, link engagement) is a reimagined layer wired
 * separately.
 */

export interface PlanTotals {
  grossPaise: number;
  acceptedPaise: number;
  deferredPaise: number;
  itemCount: number;
  acceptedCount: number;
}

export interface ApiPlanListRow {
  _id: string;
  patient?: { _id: string; firstName?: string; lastName?: string } | null;
  doctor?: { name?: string } | null;
  title?: string;
  status: ApiPlanStatus;
  planDate?: string;
  updatedAt?: string;
  presentedAt?: string;
  discountPct?: number;
  totals: PlanTotals;
}

export function listTreatmentPlans(params?: { status?: ApiPlanStatus }): Promise<ApiResult<ApiPlanListRow[]>> {
  return api.getPage<ApiPlanListRow[]>("/treatment-plans", { query: { limit: 100, ...params } });
}
