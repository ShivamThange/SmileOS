import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys, type QueryParams } from "@/lib/query";
import {
  listPatients,
  createPatient,
  getPatient,
  getPatientSummary,
  type PatientListParams,
  type CreatePatientInput,
} from "./api";

/*
 * Patient query hooks (T2.2). The list is server-driven, so its key carries the
 * exact params (page/sort/search/filter) — a different query is a different
 * cache entry, and paging keeps the previous page on screen while the next
 * loads. The summary is its own query so the header bar can show medical alerts
 * the instant they arrive, without waiting on the full record.
 */

export function usePatientsList(params: PatientListParams) {
  return useQuery({
    queryKey: queryKeys.patients.list(params as QueryParams),
    queryFn: () => listPatients(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.patients.detail(id ?? ""),
    queryFn: () => getPatient(id!),
    enabled: !!id,
  });
}

export function usePatientSummary(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.patients.summary(id ?? ""),
    queryFn: () => getPatientSummary(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Create a patient.
 * INVALIDATES: queryKeys.patients.lists() — every list must show the new record.
 * (Detail caches stay warm; the new record has no cached detail yet.)
 */
export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePatientInput) => createPatient(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.patients.lists() }),
  });
}
