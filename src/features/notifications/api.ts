import { api } from "@/lib/api";
import type { ApiResult } from "@/lib/api";

/*
 * Notifications (spec 4.10) — the authenticated user's own feed. Identity comes
 * from the token; no id is passed. Backs the header bell.
 */

export interface ApiNotification {
  _id: string;
  type: string;
  title?: string;
  body?: string;
  link?: string;
  read: boolean;
  priority?: "low" | "normal" | "high";
  createdAt: string;
}

export function listNotifications(): Promise<ApiResult<ApiNotification[]>> {
  return api.getPage<ApiNotification[]>("/notifications", { query: { limit: 20 } });
}

export function markAllNotificationsRead(): Promise<{ read: boolean }> {
  return api.post<{ read: boolean }>("/notifications/read-all");
}
