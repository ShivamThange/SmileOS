import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/page-header";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import { usePermission } from "@/hooks/use-permission";
import { REPORT_TYPES, getReport, downloadReportCsv, type ReportType, type GroupBy } from "./reports-api";

/*
 * Report library (T3.6). Pick a report and a window; see the totals, the
 * period-over-period movement, and the series; export to CSV. The heavy lifting
 * (aggregation, comparison) is server-side — this screen just frames it.
 */

const RANGES: { key: string; label: string; days: number; groupBy: GroupBy }[] = [
  { key: "7d", label: "Last 7 days", days: 7, groupBy: "day" },
  { key: "30d", label: "Last 30 days", days: 30, groupBy: "day" },
  { key: "90d", label: "Last 90 days", days: 90, groupBy: "week" },
  { key: "12m", label: "Last 12 months", days: 365, groupBy: "month" },
];

/** Metrics stored in paise render as currency; percentages get a %; else plain. */
function fmtMetric(key: string, value: number): string {
  if (key.endsWith("Paise")) return inr(value);
  if (key.endsWith("Pct")) return `${value}%`;
  return value.toLocaleString("en-IN");
}
function metricLabel(key: string): string {
  return key.replace(/Paise$/, "").replace(/Pct$/, " %").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

export function ReportsScreen() {
  const { showToast } = useUIStore();
  const { can } = usePermission();
  const canExport = can("analytics:export");
  const [type, setType] = useState<ReportType>("revenue");
  const [rangeKey, setRangeKey] = useState("30d");
  const [compare, setCompare] = useState(true);
  const [exporting, setExporting] = useState(false);

  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];
  const params = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - range.days * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString(), groupBy: range.groupBy, compare };
  }, [range, compare]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "report", type, params] as const,
    queryFn: () => getReport(type, params),
    staleTime: 60_000,
  });

  const totalKeys = data ? Object.keys(data.totals) : [];

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadReportCsv(type, params);
    } catch {
      showToast("Couldn't export the report. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto flex flex-col gap-3.5">
      <PageHeader
        title="Reports"
        subtitle="Revenue, collections, acceptance and more — over any window, with period-over-period movement."
        aside={
          <Button variant="secondary" onClick={exportCsv} disabled={!canExport || exporting || !data} title={canExport ? "Download CSV" : "Exports are available to Accounts and Owner"}>
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        }
      />

      <div className="flex gap-3.5 items-start max-lg:flex-col">
        {/* Report picker */}
        <Panel className="p-1.5 flex flex-col gap-0.5 w-[220px] flex-none max-lg:w-full max-lg:flex-row max-lg:flex-wrap">
          {REPORT_TYPES.map((r) => {
            const sel = r.type === type;
            return (
              <button key={r.type} onClick={() => setType(r.type)} className="text-left text-[12.5px] font-semibold px-3 py-2 rounded-md transition-colors"
                style={{ background: sel ? "var(--surface)" : "transparent", color: sel ? "var(--primary)" : "var(--muted-strong)", boxShadow: sel ? "inset 0 0 0 1px var(--primary-tint-border)" : "none" }}>
                {r.label}
              </button>
            );
          })}
        </Panel>

        <div className="flex-1 min-w-0 flex flex-col gap-3.5">
          {/* Range controls */}
          <div className="flex gap-2 flex-wrap items-center">
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRangeKey(r.key)} className="text-[12px] font-semibold px-3 py-1.5 rounded-md border transition-colors"
                style={rangeKey === r.key ? { background: "#20614E", color: "#F7F6F3", borderColor: "#20614E" } : { background: "var(--surface)", color: "var(--muted-strong)", borderColor: "var(--border)" }}>
                {r.label}
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-[12px] text-muted-strong ml-1 cursor-pointer">
              <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
              Compare to previous period
            </label>
          </div>

          {/* Totals */}
          {isLoading ? (
            <Panel className="px-5 py-10 text-center text-[12.5px] text-muted-2">Running the report…</Panel>
          ) : isError ? (
            <Panel className="px-5 py-10 text-center text-[12.5px] text-danger">Couldn't run this report.</Panel>
          ) : data ? (
            <>
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(totalKeys.length, 4)}, minmax(0,1fr))` }}>
                {totalKeys.map((k) => {
                  const delta = data.comparison?.deltaPct?.[k];
                  return (
                    <Panel key={k} className="px-4 py-3">
                      <MicroLabel>{metricLabel(k)}</MicroLabel>
                      <div className="text-[20px] font-bold tnum mt-1 tracking-[-0.02em]">{fmtMetric(k, data.totals[k])}</div>
                      {delta != null && Number.isFinite(delta) && (
                        <div className="text-[11.5px] font-semibold mt-0.5" style={{ color: delta >= 0 ? "var(--primary)" : "var(--danger)" }}>
                          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs previous
                        </div>
                      )}
                    </Panel>
                  );
                })}
              </div>

              {/* Series table */}
              <Panel className="overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-bg-content"><MicroLabel>Breakdown · {data.series.length} rows</MicroLabel></div>
                <div className="max-h-[420px] overflow-y-auto">
                  {data.series.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[12.5px] text-muted-2">No data in this window.</div>
                  ) : (
                    <SeriesTable series={data.series} />
                  )}
                </div>
              </Panel>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SeriesTable({ series }: { series: Record<string, unknown>[] }) {
  const columns = Object.keys(series[0]);
  return (
    <table className="w-full text-[12.5px]">
      <thead>
        <tr className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2 bg-bg-content">
          {columns.map((c) => <th key={c} className="text-left font-bold px-4 py-2 border-b border-border">{metricLabel(c)}</th>)}
        </tr>
      </thead>
      <tbody>
        {series.map((row, i) => (
          <tr key={i} className="border-b border-border-faint">
            {columns.map((c) => {
              const v = row[c];
              const display = typeof v === "number" ? fmtMetric(c, v) : String(v ?? "—");
              return <td key={c} className="px-4 py-2 tnum">{display}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
