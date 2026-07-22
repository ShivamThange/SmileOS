import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { getRevenueAtRisk, getDashboardSummary } from "./api";

/*
 * Dashboard hooks (T2.9). The revenue-at-risk and summary queries feed the
 * owner's headline numbers. Cached briefly — these are read constantly but move
 * slowly through a day.
 */

export function useRevenueAtRisk() {
  return useQuery({
    queryKey: queryKeys.analytics.revenueAtRisk(),
    queryFn: getRevenueAtRisk,
    staleTime: 60_000,
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(),
    queryFn: getDashboardSummary,
    staleTime: 60_000,
  });
}
