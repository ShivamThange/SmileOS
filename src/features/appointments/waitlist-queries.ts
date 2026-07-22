import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listWaitlist, scheduleWaitlist, removeWaitlist, type ApiWaitlistEntry } from "./waitlist-api";

/*
 * Waitlist hooks (T2.3). Reads the ordered waiting list; slotting-in or removing
 * an entry invalidates it so the list reflects the server.
 */

const KEY = ["waitlist", "list"] as const;

function relativeSince(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export interface WaitlistRow {
  id: string;
  name: string;
  phone: string | null;
  want: string;
  since: string;
  urgency: ApiWaitlistEntry["urgency"];
}

export function useWaitlist() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<WaitlistRow[]> => {
      const rows = await listWaitlist();
      return rows.map((w) => ({
        id: w.id,
        name: w.name,
        phone: w.phone,
        want: [w.desiredTreatment, w.preferredDoctor ? `· ${w.preferredDoctor}` : "", w.timeOfDay !== "any" ? `· ${w.timeOfDay}` : ""].filter(Boolean).join(" "),
        since: relativeSince(w.createdAt),
        urgency: w.urgency,
      }));
    },
    staleTime: 30_000,
  });
}

export function useSlotInWaitlist() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => scheduleWaitlist(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export function useRemoveWaitlist() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => removeWaitlist(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
