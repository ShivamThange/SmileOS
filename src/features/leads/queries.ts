import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fmtDate } from "@/lib/format";
import type { LeadStage } from "@/shared/enums";
import { listLeads, updateLeadStage, type ApiLead } from "./api";
import type { Lead } from "@/types";

/*
 * Leads hooks (T2.8). The pipeline reads mapped leads; a card dropped on a new
 * stage posts to /leads/:id/stage and invalidates the list so the board reflects
 * the server, which may also fire the automation the stage change triggers.
 */

function relativeAge(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function toLead(l: ApiLead): Lead {
  return {
    id: l.id,
    name: l.name,
    phone: l.phone ?? "",
    source: l.source,
    interest: l.interest ?? "—",
    valuePaise: l.estimatedValuePaise ?? 0,
    age: relativeAge(l.createdAt),
    stage: l.stage,
    followUp: l.nextFollowUp ? fmtDate(l.nextFollowUp) : "—",
  };
}

export function useLeads() {
  return useQuery({
    queryKey: queryKeys.leads.list(),
    queryFn: async (): Promise<Lead[]> => {
      const { data } = await listLeads();
      return data.map(toLead);
    },
    staleTime: 30_000,
  });
}

export function useUpdateLeadStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: LeadStage }) => updateLeadStage(id, stage),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.leads.all }),
  });
}
