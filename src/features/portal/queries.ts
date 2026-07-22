import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { getPortalMe, getPortalDashboard, listPortalAppointments, getPortalPlan, submitPortalDecisions, type PortalDecision } from "./api";

/*
 * Portal hooks (T4.3). One query per portal endpoint, keyed under `portal`.
 * Everything is scoped to the patient token on the server, so no id is passed
 * (except the plan id, whose ownership the server re-checks against the token).
 */

export function usePortalMe() {
  return useQuery({ queryKey: queryKeys.portal.me(), queryFn: getPortalMe });
}

export function usePortalDashboard() {
  return useQuery({ queryKey: queryKeys.portal.dashboard(), queryFn: getPortalDashboard });
}

export function usePortalAppointments() {
  return useQuery({ queryKey: queryKeys.portal.appointments(), queryFn: listPortalAppointments });
}

export function usePortalPlan(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.portal.plan(id ?? ""), queryFn: () => getPortalPlan(id!), enabled: Boolean(id) });
}

/** Submit the patient's per-item decisions; refreshes the plan + dashboard. */
export function useSubmitPortalDecisions(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (decisions: PortalDecision[]) => submitPortalDecisions(id, decisions),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.portal.plan(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.portal.dashboard() });
    },
  });
}
