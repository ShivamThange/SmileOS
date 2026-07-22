import { api } from "@/lib/api";
import type { ApiResult } from "@/lib/api";

/*
 * Operations endpoints (spec 4.10) — inventory, lab cases and suppliers. Backends
 * built alongside; these typed functions map the persisted records into the
 * shapes the operations screens render.
 */

/* ---------------------------------------------------------------- Inventory */

export interface ApiInventoryItem {
  _id: string;
  name: string;
  category?: string;
  unit?: string;
  stock: number;
  reorderLevel?: number;
  unitCostPaise?: number;
  batches?: { batchNumber?: string; expiry?: string; quantity?: number }[];
}
export function listInventory(): Promise<ApiResult<ApiInventoryItem[]>> {
  return api.getPage<ApiInventoryItem[]>("/inventory", { query: { limit: 200 } });
}

/* --------------------------------------------------------------- Lab cases */

export interface ApiLabCase {
  _id: string;
  patient?: { firstName?: string; lastName?: string } | null;
  labName?: string;
  lab?: { name?: string } | null;
  workType?: string;
  sentDate?: string;
  expectedReturn?: string;
  status: string;
}
export function listLabCases(): Promise<ApiResult<ApiLabCase[]>> {
  return api.getPage<ApiLabCase[]>("/lab-cases", { query: { limit: 200 } });
}

/* --------------------------------------------------------------- Suppliers */

export interface ApiSupplier {
  _id: string;
  name: string;
  type?: string;
  paymentTerms?: string;
  rating?: number;
  outstandingPaise?: number;
}
export function listSuppliers(): Promise<ApiResult<ApiSupplier[]>> {
  return api.getPage<ApiSupplier[]>("/suppliers", { query: { limit: 200 } });
}
