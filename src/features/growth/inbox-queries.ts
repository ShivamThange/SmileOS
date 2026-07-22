import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listConversations, listMessages, sendMessage, markConversationRead } from "./inbox-api";
import type { Conversation, InboxMsg } from "./growth-data";

/*
 * Inbox hooks (T3.2). Conversations map into the list shape (name, channel,
 * preview); the open thread's messages load on selection; a reply posts and
 * invalidates both the thread and the list so the preview updates.
 */

const CHANNEL_DISPLAY: Record<string, Conversation["channel"]> = {
  whatsapp: "WhatsApp", sms: "SMS", email: "Email",
};

function clock(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations", "list"] as const,
    queryFn: async (): Promise<Conversation[]> => {
      const { data } = await listConversations();
      return data.map((c) => ({
        id: c._id,
        patientId: c.patient?._id ?? "",
        name: c.patient ? [c.patient.firstName, c.patient.lastName].filter(Boolean).join(" ") : c.lead?.name ?? "Unknown",
        channel: CHANNEL_DISPLAY[c.channel] ?? "WhatsApp",
        preview: c.lastMessagePreview || "No messages yet",
        time: clock(c.lastMessageAt),
        unread: c.unread ?? 0,
        phone: c.patient?.phone ?? c.lead?.phone ?? "—",
        tag: c.tags?.[0],
        messages: [],
      }));
    },
    staleTime: 20_000,
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["conversations", conversationId, "messages"] as const,
    queryFn: async (): Promise<InboxMsg[]> => {
      const { data } = await listMessages(conversationId!);
      return data.map((m) => ({
        from: m.direction === "in" ? "them" : "us",
        text: m.content ?? "",
        time: new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      }));
    },
    enabled: !!conversationId,
    staleTime: 10_000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) => sendMessage(conversationId, content),
    onSuccess: (_r, { conversationId }) => {
      qc.invalidateQueries({ queryKey: ["conversations", conversationId, "messages"] });
      qc.invalidateQueries({ queryKey: ["conversations", "list"] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations", "list"] }),
  });
}
