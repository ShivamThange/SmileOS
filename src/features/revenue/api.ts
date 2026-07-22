import { api } from "@/lib/api";
import type { ApiResult } from "@/lib/api";
import type { InvoiceStatus, PaymentMode } from "@/shared/enums";

/*
 * Billing endpoints (spec 4.6) — invoices and payments. Typed functions map the
 * persisted records into the shapes the revenue screens render.
 */

export interface ApiInvoice {
  _id: string;
  invoiceNumber: string;
  patient?: { _id: string; firstName?: string; lastName?: string } | null;
  date: string;
  dueDate?: string;
  description?: string;
  lines?: { description?: string }[];
  totalPaise: number;
  status: InvoiceStatus;
}
export function listInvoices(params?: { status?: InvoiceStatus }): Promise<ApiResult<ApiInvoice[]>> {
  return api.getPage<ApiInvoice[]>("/invoices", { query: { limit: 100, ...params } });
}

export interface ApiPayment {
  _id: string;
  date?: string;
  createdAt: string;
  patient?: { firstName?: string; lastName?: string } | null;
  mode?: PaymentMode;
  amountPaise: number;
  invoice?: { invoiceNumber?: string } | null;
}
export function listPayments(): Promise<ApiResult<ApiPayment[]>> {
  return api.getPage<ApiPayment[]>("/payments", { query: { limit: 100 } });
}
