import { api } from "@/lib/api";
import type { ProcedureCategory, PriceTier } from "@/shared/enums";

/*
 * Procedure catalogue (price book) endpoints (spec 2.5 / 4.2). The single place
 * procedure URLs are written. Feeds the Settings fee schedule, the cost
 * calculator and the treatment-plan builder — all money surfaces read the same
 * catalogue so a price is defined exactly once.
 */

export interface Procedure {
  _id: string;
  code: string;
  name: string;
  friendlyName?: string;
  category: ProcedureCategory;
  description?: string;
  defaultDurationMinutes: number;
  defaultPricePaise: number;
  tierPrices?: Partial<Record<PriceTier, number>>;
  taxApplicable?: boolean;
  taxRate?: number;
  toothSpecific?: boolean;
  surfaceSpecific?: boolean;
  typicalSittings?: number;
  requiresConsent?: boolean;
  requiresLab?: boolean;
  publicVisible?: boolean;
  displayOrder?: number;
}

/** Fields a create/update accepts — the persisted subset the UI can edit. */
export type ProcedureInput = Partial<Omit<Procedure, "_id">> & { name?: string; category?: ProcedureCategory };

/** GET /procedures — the whole price book (any authenticated staff may read). */
export function listProcedures(params?: { category?: ProcedureCategory; publicVisible?: boolean }): Promise<Procedure[]> {
  return api.get<Procedure[]>("/procedures", { query: params });
}

/** POST /procedures — add a catalogue item (settings:update). */
export function createProcedure(input: ProcedureInput): Promise<Procedure> {
  return api.post<Procedure>("/procedures", input);
}

/** PATCH /procedures/:id — edit an item, e.g. a price (settings:update). */
export function updateProcedure(id: string, input: ProcedureInput): Promise<Procedure> {
  return api.patch<Procedure>(`/procedures/${id}`, input);
}

/** DELETE /procedures/:id — soft-remove an item (settings:update). */
export function deleteProcedure(id: string): Promise<{ id: string }> {
  return api.delete<{ id: string }>(`/procedures/${id}`);
}
