import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fmtDate } from "@/lib/format";
import { listInvoices, listPayments, getPendingPayments, listExpenses } from "./api";
import type { Invoice, InvoiceStatus, Payment, PayMethod, Expense } from "./billing-data";

/*
 * Billing hooks (T2.7). Invoices and payments mapped from their backends into
 * the shapes the revenue screens render. The list can't cheaply compute each
 * invoice's exact paid amount, so paid is inferred from status here (paid → in
 * full, otherwise nil) — the precise balance shows on the invoice detail.
 */

function inferPaid(status: string, total: number): number {
  return status === "paid" || status === "refunded" ? total : 0;
}

/** Collapse the backend's fuller status set onto the board's display statuses. */
function displayStatus(status: string): InvoiceStatus {
  switch (status) {
    case "paid": case "refunded": return "paid";
    case "partial": return "partial";
    case "overdue": return "overdue";
    default: return "unpaid"; // unpaid, draft, cancelled
  }
}

export function useInvoices() {
  return useQuery({
    queryKey: queryKeys.billing.invoices(),
    queryFn: async (): Promise<Invoice[]> => {
      const { data } = await listInvoices();
      return data.map((i) => ({
        id: i._id,
        no: i.invoiceNumber,
        patientId: i.patient?._id ?? "",
        patient: i.patient ? [i.patient.firstName, i.patient.lastName].filter(Boolean).join(" ") : "—",
        date: fmtDate(i.date),
        ageDays: Math.max(0, Math.floor((Date.now() - new Date(i.date).getTime()) / 86_400_000)),
        summary: i.description ?? i.lines?.[0]?.description ?? `${i.lines?.length ?? 0} item(s)`,
        totalPaise: i.totalPaise,
        paidPaise: inferPaid(i.status, i.totalPaise),
        status: displayStatus(i.status),
      }));
    },
    staleTime: 30_000,
  });
}

/**
 * Receivables aging, server-computed. Mapped into the shape the pending-payments
 * screen renders (an outstanding-invoice list where the balance is the amount
 * still owed). `paidPaise` is set so `invoiceBalance` returns the real balance.
 */
export function usePendingPayments() {
  return useQuery({
    queryKey: [...queryKeys.billing.all, "pending"] as const,
    queryFn: async () => {
      const p = await getPendingPayments();
      const outstanding: Invoice[] = p.rows.map((r) => ({
        id: r.id,
        no: r.invoiceNumber,
        patientId: "",
        patient: r.patient ? [r.patient.firstName, r.patient.lastName].filter(Boolean).join(" ") : "—",
        date: fmtDate(r.date),
        ageDays: r.ageDays,
        summary: "Outstanding balance",
        totalPaise: r.totalPaise,
        paidPaise: r.totalPaise - r.balancePaise,
        status: r.ageDays >= 30 ? "overdue" : "partial",
      }));
      return { under30: p.under30Paise, over30: p.over30Paise, total: p.totalPaise, count: p.count, outstanding };
    },
    staleTime: 30_000,
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: [...queryKeys.billing.all, "expenses"] as const,
    queryFn: async (): Promise<Expense[]> => {
      const { data } = await listExpenses();
      return data.map((e) => ({
        id: e._id,
        date: fmtDate(e.date),
        category: e.category,
        vendor: e.vendor ?? "—",
        note: e.description ?? "",
        amountPaise: e.amountPaise,
      }));
    },
    staleTime: 60_000,
  });
}

const MODE_LABEL: Record<string, PayMethod> = {
  upi: "UPI", card: "Card", cash: "Cash", netbanking: "Net-banking", net_banking: "Net-banking", bank_transfer: "Net-banking",
};

export function usePayments() {
  return useQuery({
    queryKey: queryKeys.billing.payments(),
    queryFn: async (): Promise<Payment[]> => {
      const { data } = await listPayments();
      return data.map((p) => {
        const when = new Date(p.date ?? p.createdAt);
        return {
          id: p._id,
          date: fmtDate(when.toISOString()),
          time: when.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          patient: p.patient ? [p.patient.firstName, p.patient.lastName].filter(Boolean).join(" ") : "—",
          method: MODE_LABEL[p.mode ?? ""] ?? "Cash",
          amountPaise: p.amountPaise,
          against: p.invoice?.invoiceNumber ?? "—",
        };
      });
    },
    staleTime: 30_000,
  });
}
