import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/hooks/use-ui-store";
import { type Recall, type RecallType } from "./growth-data";
import { useRecalls } from "./queries";

/* Recalls — patients due or overdue for care, segmentable, with bulk WhatsApp. */

const TYPES: (RecallType | "All")[] = ["All", "Hygiene", "Implant review", "Ortho", "Post-op"];

export function RecallsScreen() {
  const { showToast } = useUIStore();
  const [type, setType] = useState<RecallType | "All">("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: recalls = [] } = useRecalls();

  const rows = useMemo(() => recalls.filter((r) => type === "All" || r.type === type), [type, recalls]);
  const stats = useMemo(() => ({
    due: recalls.length,
    overdue: recalls.filter((r) => r.overdueDays > 0).length,
    critical: recalls.filter((r) => r.overdueDays >= 30).length,
  }), [recalls]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Recalls" subtitle={`${recalls.length} patients due or overdue`}
        aside={<Button variant="primary" onClick={() => showToast("Recall campaign — segment builder opens")}>New campaign</Button>} />
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <StatCard label="Due for recall" value={String(stats.due)} sub="across all types" />
        <StatCard label="Overdue" value={String(stats.overdue)} delta="follow up" deltaTone="warn" />
        <StatCard label="30 days+ overdue" value={String(stats.critical)} delta="at risk of loss" deltaTone="down" />
      </div>
      <div className="flex gap-2 flex-wrap">
        {TYPES.map((t) => {
          const sel = type === t;
          return <button key={t} onClick={() => setType(t)} className="text-[12px] font-semibold px-3 py-1.5 rounded-md border"
            style={{ background: sel ? "#20614E" : "var(--surface)", color: sel ? "#F7F6F3" : "var(--muted-strong)", borderColor: sel ? "#20614E" : "var(--border)" }}>{t}</button>;
        })}
      </div>

      <Panel className="overflow-hidden">
        <div className="grid items-center gap-3 px-4 py-2.5 border-b border-border bg-bg-content" style={{ gridTemplateColumns: "28px 1.5fr 1fr 0.9fr 1fr" }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-primary" />
          {["PATIENT", "TYPE", "DUE", "LAST VISIT"].map((h) => <MicroLabel key={h}>{h}</MicroLabel>)}
        </div>
        {rows.map((r) => (
          <RecallRow key={r.id} recall={r} checked={selected.has(r.id)} onToggle={() => toggle(r.id)} onCall={() => showToast(`Calling ${r.patient} — ${r.phone}`)} />
        ))}
        {!rows.length && <div className="px-4 py-10 text-center text-[12.5px] text-muted-2">No recalls of this type.</div>}
      </Panel>

      {selected.size > 0 && (
        <div className="sticky bottom-4 flex items-center gap-3 bg-ink text-on-primary rounded-lg px-4 py-3 shadow-toast animate-dc-fade-up">
          <span className="text-[12.5px] font-semibold">{selected.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="tint" onClick={() => { showToast(`WhatsApp recall sent to ${selected.size} patients`); setSelected(new Set()); }}>Send WhatsApp recall</Button>
          <Button size="sm" variant="ghost" className="text-on-primary hover:bg-white/10" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}
    </div>
  );
}

function RecallRow({ recall, checked, onToggle, onCall }: { recall: Recall; checked: boolean; onToggle: () => void; onCall: () => void }) {
  return (
    <div className="grid items-center gap-3 px-4 py-3 border-b border-border-faint" style={{ gridTemplateColumns: "28px 1.5fr 1fr 0.9fr 1fr" }}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="accent-primary" />
      <div className="min-w-0"><div className="text-[13px] font-semibold truncate">{recall.patient}</div><div className="text-[11px] text-muted-2 font-mono">{recall.phone}</div></div>
      <div className="text-[12.5px]">{recall.type}</div>
      <div>
        {recall.overdueDays > 0
          ? <span className="text-[11px] font-bold px-2 py-[3px] rounded-[5px] border" style={recall.overdueDays >= 30 ? { background: "#FBEFED", color: "#A8342A", borderColor: "#EFC7C2" } : { background: "#FAF3E7", color: "#8A6B33", borderColor: "#E5D2AC" }}>{recall.overdueDays}d overdue</span>
          : <span className="text-[12px] text-muted">Due {recall.due}</span>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-muted">{recall.lastVisit}</span>
        <Button size="sm" variant="secondary" onClick={onCall}>Call</Button>
      </div>
    </div>
  );
}
