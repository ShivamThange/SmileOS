import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import type { ProcedureCategory } from "@/shared/enums";
import {
  listProcedures,
  createProcedure,
  updateProcedure,
  deleteProcedure,
  type ProcedureInput,
} from "./procedures-api";

/*
 * Procedure catalogue hooks (T2.1). The price book is read by Settings, the
 * calculator and the plan builder; every write invalidates the list so all
 * three re-read the same source. Prices change rarely, so the list is cached.
 */

export function useProcedures(params?: { category?: ProcedureCategory; publicVisible?: boolean }) {
  return useQuery({
    queryKey: queryKeys.procedures.list(params ?? {}),
    queryFn: () => listProcedures(params),
    staleTime: 5 * 60_000,
  });
}

/**
 * Add a catalogue item.
 * INVALIDATES: queryKeys.procedures.all — every price-book list (Settings,
 * calculator, plan builder) must reflect the new item.
 */
export function useCreateProcedure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProcedureInput) => createProcedure(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.procedures.all }),
  });
}

/**
 * Edit a catalogue item (typically a price).
 * INVALIDATES: queryKeys.procedures.all — the edited price must propagate to
 * every surface that quotes it.
 */
export function useUpdateProcedure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProcedureInput }) => updateProcedure(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.procedures.all }),
  });
}

/**
 * Remove a catalogue item.
 * INVALIDATES: queryKeys.procedures.all.
 */
export function useDeleteProcedure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProcedure(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.procedures.all }),
  });
}
