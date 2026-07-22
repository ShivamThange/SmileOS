import { api } from "@/lib/api";
import type { ApiResult } from "@/lib/api";
import type { RecallType as ApiRecallType } from "@/shared/enums";

/*
 * Growth endpoints (spec 4.8 / 4.11) — recalls and reviews. Typed functions map
 * the persisted records into the shapes the growth screens render.
 */

export interface ApiRecall {
  _id: string;
  patient?: { _id: string; firstName?: string; lastName?: string; phone?: string; lastVisit?: string } | null;
  type: ApiRecallType;
  dueDate: string;
  status: string;
}
export function listRecalls(): Promise<ApiResult<ApiRecall[]>> {
  return api.getPage<ApiRecall[]>("/recalls", { query: { limit: 200, status: "pending" } });
}

export interface ApiReview {
  _id: string;
  patient?: { firstName?: string; lastName?: string } | null;
  internalRating?: number;
  internalFeedback?: string;
  routedToPublic?: boolean;
  publicPlatform?: string;
  responseStatus?: string;
  createdAt: string;
}
export function listReviews(): Promise<ApiResult<ApiReview[]>> {
  return api.getPage<ApiReview[]>("/reviews", { query: { limit: 100 } });
}
