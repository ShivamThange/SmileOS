import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fmtDate } from "@/lib/format";
import type { PlanStatus as ApiPlanStatus } from "@/shared/enums";
import { listTreatmentPlans } from "./api";
import type { PlanStatus } from "./plans-data";

/*
 * Treatment-plan list hook (T2.5). Maps backend plans + their batched totals
 * into a lean worklist row. Link engagement (opens/dwell) is a reimagined layer
 * not yet tracked server-side, so it's absent here.
 */

export interface PlanListEntry {
  id: string;
  patientId: string;
  patient: string;
  title: string;
  doctor: string;
  status: PlanStatus;
  netPaise: number;
  takenPaise: number;
  deferredPaise: number;
  itemCount: number;
  acceptedCount: number;
  presentedOn?: string;
  updated: string;
}

/** Collapse the backend's fuller plan status onto the worklist's five states. */
function displayStatus(s: ApiPlanStatus): PlanStatus {
  switch (s) {
    case "accepted": case "completed": return "accepted";
    case "partially_accepted": return "partial";
    case "declined": case "expired": return "declined";
    case "presented": return "presented";
    default: return "draft";
  }
}

export function useTreatmentPlans() {
  return useQuery({
    queryKey: queryKeys.treatmentPlans.list(),
    queryFn: async (): Promise<PlanListEntry[]> => {
      const { data } = await listTreatmentPlans();
      return data.map((p) => ({
        id: p._id,
        patientId: p.patient?._id ?? "",
        patient: p.patient ? [p.patient.firstName, p.patient.lastName].filter(Boolean).join(" ") : "—",
        title: p.title || "Treatment plan",
        doctor: p.doctor?.name ?? "—",
        status: displayStatus(p.status),
        netPaise: p.totals.grossPaise,
        takenPaise: p.totals.acceptedPaise,
        deferredPaise: p.totals.deferredPaise,
        itemCount: p.totals.itemCount,
        acceptedCount: p.totals.acceptedCount,
        presentedOn: p.presentedAt ? fmtDate(p.presentedAt) : undefined,
        updated: fmtDate(p.updatedAt ?? p.planDate ?? new Date().toISOString()),
      }));
    },
    staleTime: 30_000,
  });
}
