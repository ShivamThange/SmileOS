import { api, API_BASE, session } from "@/lib/api";

/*
 * Analytics report library (spec 4.12 / T3.6). A small set of parameterised
 * reports over a date range, each with totals, an optional previous-period
 * comparison, and a CSV export for the accountant.
 */

export const REPORT_TYPES = [
  { type: "revenue", label: "Revenue", metric: "valuePaise", money: true },
  { type: "collections", label: "Collections", metric: "collectedPaise", money: true },
  { type: "appointments", label: "Appointments", metric: "total", money: false },
  { type: "patients", label: "New patients", metric: "newPatients", money: false },
  { type: "leads", label: "Leads & conversion", metric: "total", money: false },
  { type: "case-acceptance", label: "Case acceptance", metric: "acceptancePct", money: false },
  { type: "treatments", label: "Treatments", metric: "count", money: false },
  { type: "doctors", label: "Doctor performance", metric: "producedPaise", money: true },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]["type"];
export type GroupBy = "day" | "week" | "month";

export interface ReportResult {
  range: { from: string; to: string; groupBy: GroupBy };
  series: Record<string, unknown>[];
  totals: Record<string, number>;
  comparison?: { previous: { from: string; to: string }; totals: Record<string, number>; deltaPct: Record<string, number> };
}

export interface ReportParams {
  from?: string;
  to?: string;
  groupBy?: GroupBy;
  compare?: boolean;
}

export function getReport(type: ReportType, params: ReportParams): Promise<ReportResult> {
  return api.get<ReportResult>(`/analytics/reports/${type}`, { query: { ...params } });
}

/**
 * Download a report as CSV. The export endpoint streams a file, so we fetch it
 * with the session's auth + clinic headers (not a plain link, which wouldn't
 * carry the in-memory token) and trigger a browser download from the blob.
 */
export async function downloadReportCsv(type: ReportType, params: ReportParams): Promise<void> {
  const qs = new URLSearchParams({ type, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])) });
  const token = session.getAccessToken();
  const res = await fetch(`${API_BASE}/analytics/export?${qs.toString()}`, {
    headers: { "X-Clinic-Slug": session.getClinicSlug(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}-report.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
