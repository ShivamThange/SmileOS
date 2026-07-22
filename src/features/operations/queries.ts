import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { listInventory, listLabCases, listSuppliers } from "./api";
import { fmtDate } from "@/lib/format";
import type { InventoryItem, LabCase, Supplier, LabStatus } from "./operations-data";

/*
 * Operations hooks (T3.3). Each query maps the persisted record into the shape
 * its screen already renders, so the UI is untouched while the data becomes
 * real. Stock/lab/supplier data changes slowly, so the lists are cached.
 */

/** Earliest batch expiry — a formatted label plus days-until, for the flags. */
function earliestExpiry(batches?: { expiry?: string }[]): { label: string; days: number } {
  const dates = (batches ?? []).map((b) => b.expiry).filter(Boolean).sort() as string[];
  if (!dates.length) return { label: "—", days: 999 };
  const days = Math.round((new Date(dates[0]).getTime() - Date.now()) / 86_400_000);
  return { label: fmtDate(dates[0]), days };
}

export function useInventory() {
  return useQuery({
    queryKey: queryKeys.operations.inventory(),
    queryFn: async (): Promise<InventoryItem[]> => {
      const { data } = await listInventory();
      return data.map((i) => {
        const exp = earliestExpiry(i.batches);
        return {
          id: i._id,
          name: i.name,
          category: i.category ?? "—",
          stock: i.stock,
          unit: i.unit ?? "unit",
          reorderAt: i.reorderLevel ?? 0,
          expiry: exp.label,
          expiryDays: exp.days,
          valuePaise: Math.round((i.stock ?? 0) * (i.unitCostPaise ?? 0)),
        };
      });
    },
    staleTime: 60_000,
  });
}

/** Map the backend lifecycle status onto the screen's display grouping, with
 *  overdue derived from a passed expected-return date. */
function labDisplayStatus(status: string, expectedReturn?: string): LabStatus {
  const done = status === "received" || status === "fitted";
  if (!done && status !== "cancelled" && expectedReturn && new Date(expectedReturn).getTime() < Date.now()) return "overdue";
  switch (status) {
    case "received": case "fitted": return "ready";
    case "trial": return "returning";
    case "in_progress": case "remake": return "in-lab";
    default: return "sent";
  }
}

export function useLabCases() {
  return useQuery({
    queryKey: queryKeys.operations.labCases(),
    queryFn: async (): Promise<LabCase[]> => {
      const { data } = await listLabCases();
      return data.map((c) => ({
        id: c._id,
        patient: c.patient ? [c.patient.firstName, c.patient.lastName].filter(Boolean).join(" ") : "—",
        work: c.workType ?? "Lab work",
        lab: c.lab?.name ?? c.labName ?? "—",
        sent: c.sentDate ? fmtDate(c.sentDate) : "—",
        due: c.expectedReturn ? fmtDate(c.expectedReturn) : "—",
        status: labDisplayStatus(c.status, c.expectedReturn),
      }));
    },
    staleTime: 60_000,
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: queryKeys.operations.suppliers(),
    queryFn: async (): Promise<Supplier[]> => {
      const { data } = await listSuppliers();
      return data.map((s) => ({
        id: s._id,
        name: s.name,
        kind: s.type ?? "supplies",
        terms: s.paymentTerms ?? "—",
        rating: s.rating ?? 0,
        outstandingPaise: s.outstandingPaise ?? 0,
      }));
    },
    staleTime: 60_000,
  });
}
