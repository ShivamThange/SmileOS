import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { listNotifications, type ApiNotification } from "./api";
import { TONE_STYLE, type NotifTone, type Notification } from "./notifications-data";

/*
 * Notifications hook. Maps the backend feed into the panel's display shape,
 * deriving tone/glyph from the notification type + priority. TONE_STYLE and the
 * display shape are shared with the (retired) mock so the panel is unchanged.
 */

export { TONE_STYLE };
export type { NotifTone, Notification };

const GLYPH: Record<string, string> = {
  inventory_alert: "▦",
  review_request: "★",
  appointment_reminder: "◔",
  lead: "◈",
  recall: "↻",
  payment: "₹",
  message: "✉",
};

function toneFor(n: ApiNotification): NotifTone {
  if (n.priority === "high") return "warning";
  if (n.type.includes("payment") || n.type.includes("overdue")) return "warning";
  if (n.type.includes("review") || n.type.includes("reminder")) return "success";
  return "info";
}

function relative(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: async (): Promise<Notification[]> => {
      const { data } = await listNotifications();
      return data.map((n) => ({
        id: n._id,
        tone: toneFor(n),
        glyph: GLYPH[n.type] ?? "•",
        title: n.title ?? n.type.replace(/_/g, " "),
        detail: n.body ?? "",
        time: relative(n.createdAt),
        to: n.link ?? "/app",
      }));
    },
    // The bell is glanceable; refetch on an interval so counts stay live.
    refetchInterval: 60_000,
  });
}
