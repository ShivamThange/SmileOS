import { api } from "@/lib/api";
import type { ApiResult } from "@/lib/api";

/*
 * Communication endpoints (spec 4.10). The inbox reads conversations (each with
 * a batched last-message preview) and, for the open thread, its messages; a
 * reply posts back into the conversation.
 */

export interface ApiConversation {
  _id: string;
  patient?: { _id: string; firstName?: string; lastName?: string; phone?: string } | null;
  lead?: { name?: string; phone?: string } | null;
  channel: string;
  status: string;
  lastMessageAt?: string;
  unread?: number;
  tags?: string[];
  lastMessagePreview?: string;
  lastMessageDirection?: string | null;
}
export function listConversations(): Promise<ApiResult<ApiConversation[]>> {
  return api.getPage<ApiConversation[]>("/conversations", { query: { limit: 100 } });
}

export interface ApiMessage {
  _id: string;
  direction: "in" | "out";
  content?: string;
  createdAt: string;
  status?: string;
}
export function listMessages(conversationId: string): Promise<ApiResult<ApiMessage[]>> {
  return api.getPage<ApiMessage[]>(`/conversations/${conversationId}/messages`, { query: { limit: 200 } });
}

export function sendMessage(conversationId: string, content: string): Promise<unknown> {
  return api.post(`/conversations/${conversationId}/messages`, { content });
}

export function markConversationRead(conversationId: string): Promise<unknown> {
  return api.post(`/conversations/${conversationId}/read`);
}
