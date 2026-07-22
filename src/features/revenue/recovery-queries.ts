import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import type { RecoveryRow, Patient } from "@/types";
import type { Urgency } from "@/types/enums";
import {
  getUnscheduled,
  getUnscheduledSummary,
  logRecoveryContact,
  snoozeRecovery,
  declineRecovery,
  type ApiUnscheduledItem,
} from "./recovery-api";

/*
 * Recovery worklist hooks (T2.6). The server returns the aged, unscheduled
 * backlog; we map each item into the row shape the client-side scorer ranks
 * (engagement is still derived from the id — a reimagined signal not yet
 * tracked server-side). Outcomes post back and invalidate the queue.
 */

const PRIORITY_URGENCY: Record<string, Urgency> = { urgent: "High", recommended: "Moderate", elective: "Routine" };

function relativeAgo(days?: number | null): string {
  if (days == null) return "—";
  if (days <= 0) return "today";
  if (days < 30) return `${days}d ago`;
  if (days < 60) return "1mo ago";
  return `${Math.floor(days / 30)}mo ago`;
}

/** Backend item → the worklist row + a minimal patient the scorer/card need. */
export function mapUnscheduled(item: ApiUnscheduledItem): { row: RecoveryRow; patient: Patient } {
  const patientId = item.patient?._id ?? "";
  const name = item.patient ? [item.patient.firstName, item.patient.lastName].filter(Boolean).join(" ") : "Patient";
  const lastContact = item.followUp?.lastContactDate
    ? `${relativeAgo(item.followUp.lastContactDate ? Math.floor((Date.now() - new Date(item.followUp.lastContactDate).getTime()) / 86_400_000) : null)}`
    : "Never contacted";
  const row: RecoveryRow = {
    id: item.id,
    patientId,
    proc: item.name ?? "Recommended treatment",
    tooth: (item.teeth ?? []).join(", "),
    type: item.plan?.title ?? "Treatment",
    valuePaise: item.lineTotalPaise,
    planned: item.plan?.planDate ? new Date(item.plan.planDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—",
    ago: relativeAgo(item.daysSincePlanned),
    urgency: PRIORITY_URGENCY[item.priority ?? "recommended"] ?? "Moderate",
    doctor: "—",
    lastContact,
    lastSub: item.followUp?.lastContactOutcome ?? "",
    due: (item.daysSincePlanned ?? 0) > 30 ? "overdue" : "today",
    finding: item.justification ?? item.name ?? "",
    reason: "",
    declined: item.status === "declined",
  };
  // The scorer/card only read id, name, phone, agesex and alert.
  const patient = { id: patientId, name, phone: item.patient?.phone ?? "", agesex: "", alert: "" } as unknown as Patient;
  return { row, patient };
}

export function useUnscheduled() {
  return useQuery({
    queryKey: queryKeys.revenue.unscheduled(),
    queryFn: async () => {
      const items = await getUnscheduled();
      const mapped = items.map(mapUnscheduled);
      return { rows: mapped.map((m) => m.row), patients: mapped.map((m) => m.patient) };
    },
    staleTime: 30_000,
  });
}

export function useUnscheduledSummary() {
  return useQuery({
    queryKey: queryKeys.revenue.unscheduledSummary(),
    queryFn: getUnscheduledSummary,
    staleTime: 30_000,
  });
}

/** Outcome mutations. Each invalidates the worklist so the queue re-reads. */
export function useRecoveryOutcome() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.revenue.all });
  return useMutation({
    mutationFn: async ({ itemId, kind, outcome }: { itemId: string; kind: "contact" | "snooze" | "decline"; outcome?: string }) => {
      if (kind === "decline") return declineRecovery(itemId, "Not now — patient asked to be contacted later");
      if (kind === "snooze") return snoozeRecovery(itemId, new Date(Date.now() + 182 * 86_400_000).toISOString());
      return logRecoveryContact(itemId, outcome ?? "contacted");
    },
    onSuccess: invalidate,
  });
}
