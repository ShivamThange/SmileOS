import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";

/*
 * Insight — reports on one consistent frame: a report picker, a range filter,
 * one chart, the table behind it, and an export. Deliberately uniform so every
 * report reads the same way (spec: "one chart, the table, an export").
 */

interface Datum { label: string; value: number; sub?: string }
interface Report { id: string; name: string; unit: "money" | "count"; data: Datum[]; insight: string; }

const RANGES = ["7 days", "30 days", "Quarter", "Year"];

const REPORTS: Report[] = [
  {
    id: "revenue", name: "Revenue by treatment", unit: "money", insight: "Implants drive 46% of revenue on 12% of visits.",
    data: [
      { label: "Implants", value: 4200000, sub: "18 cases" },
      { label: "Orthodontics", value: 2650000, sub: "9 cases" },
      { label: "Crowns & bridges", value: 1850000, sub: "24 cases" },
      { label: "Root canals", value: 940000, sub: "31 cases" },
      { label: "Hygiene", value: 480000, sub: "112 visits" },
    ],
  },
  {
    id: "doctor", name: "Production per doctor", unit: "money", insight: "Dr. Meher leads on implant production this month.",
    data: [
      { label: "Dr. Meher", value: 5200000, sub: "prostho" },
      { label: "Dr. Kulkarni", value: 1900000, sub: "endo" },
      { label: "Dr. Patil", value: 2400000, sub: "ortho" },
    ],
  },
  {
    id: "leads", name: "Lead sources", unit: "count", insight: "Google and referrals convert best; Instagram fills the top.",
    data: [
      { label: "Google", value: 42, sub: "31% convert" },
      { label: "Referral", value: 28, sub: "44% convert" },
      { label: "Instagram", value: 36, sub: "12% convert" },
      { label: "Walk-in", value: 19, sub: "38% convert" },
    ],
  },
  {
    id: "retention", name: "New vs returning", unit: "count", insight: "Returning patients are 64% of visits — recalls are working.",
    data: [
      { label: "Returning", value: 288, sub: "64%" },
      { label: "New", value: 162, sub: "36%" },
    ],
  },
];

const RAMP = ["#20614E", "#4E8A75", "#8FB5A6", "#CBDDD5", "#D4E0DA"];

export function AnalyticsScreen() {
  const { showToast } = useUIStore();
  const [reportId, setReportId] = useState(REPORTS[0].id);
  const [range, setRange] = useState("30 days");
  const report = REPORTS.find((r) => r.id === reportId)!;
  const max = useMemo(() => Math.max(...report.data.map((d) => d.value)), [report]);
  const fmt = (v: number) => (report.unit === "money" ? inr(v) : String(v));

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Insight" subtitle="Reports on one consistent frame" aside={<Button variant="primary" onClick={() => showToast(`${report.name} exported as CSV`)}>Export CSV</Button>} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {REPORTS.map((r) => {
            const sel = reportId === r.id;
            return <button key={r.id} onClick={() => setReportId(r.id)} className="text-[12px] font-semibold px-3 py-1.5 rounded-md border"
              style={{ background: sel ? "#20614E" : "var(--surface)", color: sel ? "#F7F6F3" : "var(--muted-strong)", borderColor: sel ? "#20614E" : "var(--border)" }}>{r.name}</button>;
          })}
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => {
            const sel = range === r;
            return <button key={r} onClick={() => setRange(r)} className="text-[11.5px] font-semibold px-2.5 py-1 rounded-md border"
              style={{ background: sel ? "var(--primary-tint)" : "var(--surface)", color: sel ? "var(--primary)" : "var(--muted)", borderColor: sel ? "var(--primary-tint-border)" : "var(--border)" }}>{r}</button>;
          })}
        </div>
      </div>

      {/* Chart */}
      <Panel className="px-5 py-4">
        <div className="flex items-baseline justify-between">
          <MicroLabel>{report.name} · last {range}</MicroLabel>
          <span className="text-[11.5px] text-muted">{report.insight}</span>
        </div>
        <div className="flex flex-col gap-2.5 mt-4">
          {report.data.map((d, i) => (
            <div key={d.label} className="flex items-center gap-3">
              <div className="w-[130px] text-[12px] text-muted-strong truncate flex-none">{d.label}</div>
              <div className="flex-1 h-6 bg-track rounded-md overflow-hidden">
                <div className="h-full rounded-md transition-all" style={{ width: `${(d.value / max) * 100}%`, background: RAMP[i % RAMP.length] }} />
              </div>
              <div className="w-[110px] text-right text-[12px] font-semibold tnum flex-none">{fmt(d.value)}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Table behind it */}
      <Panel className="overflow-hidden">
        <div className="grid items-center gap-3 px-4 py-2.5 border-b border-border bg-bg-content" style={{ gridTemplateColumns: "1.5fr 1fr 1fr" }}>
          {["SEGMENT", "DETAIL", report.unit === "money" ? "VALUE" : "COUNT"].map((h, i) => (
            <MicroLabel key={h} className={i === 2 ? "text-right" : ""}>{h}</MicroLabel>
          ))}
        </div>
        {report.data.map((d) => (
          <div key={d.label} className="grid items-center gap-3 px-4 py-2.5 border-b border-border-faint text-[12.5px]" style={{ gridTemplateColumns: "1.5fr 1fr 1fr" }}>
            <span className="font-semibold">{d.label}</span>
            <span className="text-muted">{d.sub ?? "—"}</span>
            <span className="text-right font-semibold tnum">{fmt(d.value)}</span>
          </div>
        ))}
        <div className="px-4 py-2 text-[11.5px] text-muted-2">{report.data.length} rows · {range}</div>
      </Panel>
    </div>
  );
}
