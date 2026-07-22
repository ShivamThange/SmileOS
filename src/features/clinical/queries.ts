import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  getChart, updateTooth, getChartHistory,
  getNotes, createNote, amendNote, signNote,
  getPrescriptions, createPrescription,
  type ToothRecord, type ClinicalNote, type RxMedication,
} from "./api";

/*
 * Clinical hooks (T2.4). Chart edits invalidate the chart + its history so the
 * odontogram and the chart-history rail stay in step; note and prescription
 * writes invalidate their patient-scoped lists.
 */

export function useChart(patientId: string | undefined) {
  return useQuery({ queryKey: queryKeys.clinical.chart(patientId ?? ""), queryFn: () => getChart(patientId!), enabled: !!patientId });
}
export function useChartHistory(patientId: string | undefined) {
  return useQuery({ queryKey: queryKeys.clinical.chartHistory(patientId ?? ""), queryFn: () => getChartHistory(patientId!), enabled: !!patientId });
}
export function useUpdateTooth(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ toothNumber, body }: { toothNumber: number; body: Partial<ToothRecord> }) => updateTooth(patientId, toothNumber, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.chart(patientId) });
      qc.invalidateQueries({ queryKey: queryKeys.clinical.chartHistory(patientId) });
    },
  });
}

export function useNotes(patientId: string | undefined) {
  return useQuery({ queryKey: queryKeys.clinical.notes(patientId ?? ""), queryFn: () => getNotes(patientId!), enabled: !!patientId });
}
export function useCreateNote(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ClinicalNote>) => createNote(patientId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clinical.notes(patientId) }),
  });
}
export function useAmendNote(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => amendNote(id, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clinical.notes(patientId) }),
  });
}
export function useSignNote(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => signNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clinical.notes(patientId) }),
  });
}

export function usePrescriptions(patientId: string | undefined) {
  return useQuery({ queryKey: queryKeys.clinical.prescriptions(patientId ?? ""), queryFn: () => getPrescriptions(patientId!), enabled: !!patientId });
}
export function useCreatePrescription(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { medications: RxMedication[]; advice?: string }) => createPrescription(patientId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clinical.prescriptions(patientId) }),
  });
}
