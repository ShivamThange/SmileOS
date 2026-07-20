import { useMemo } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DataTable, type Column } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/hooks/use-ui-store";
import { labCases, LAB_STATUS_META, type LabCase } from "./operations-data";

/* Lab tracking — work in transit, so nothing surprises the chair. */

export function LabScreen() {
  const { showToast } = useUIStore();
  const stats = useMemo(() => ({
    inTransit: labCases.filter((c) => ["sent", "in-lab", "returning"].includes(c.status)).length,
    ready: labCases.filter((c) => c.status === "ready").length,
    overdue: labCases.filter((c) => c.status === "overdue").length,
  }), []);

  const columns: Column<LabCase>[] = [
    { key: "patient", header: "PATIENT", width: "1.2fr", render: (c) => (
      <div className="min-w-0"><div className="font-semibold truncate">{c.patient}</div><div className="text-[11px] text-muted-2 truncate">{c.work}</div></div>
    ) },
    { key: "lab", header: "LAB", width: "1.2fr", render: (c) => <span className="text-muted">{c.lab}</span> },
    { key: "sent", header: "SENT", width: "0.7fr", render: (c) => <span className="text-muted">{c.sent}</span> },
    { key: "due", header: "DUE", width: "0.7fr", render: (c) => <span className={c.status === "overdue" ? "text-danger font-semibold" : ""}>{c.due}</span> },
    { key: "status", header: "STATUS", width: "1fr", render: (c) => {
      const m = LAB_STATUS_META[c.status];
      return <span className="text-[10.5px] font-bold px-2 py-[3px] rounded-[5px] border" style={{ background: m.bg, color: m.color, borderColor: m.border }}>{m.label}</span>;
    } },
    { key: "action", header: "", width: "0.9fr", align: "right", render: (c) => (
      <div onClick={(e) => e.stopPropagation()}>
        {c.status === "ready" ? <Button size="sm" variant="tint" onClick={() => showToast(`${c.patient} — appointment to fit booked`)}>Book fitting</Button>
          : c.status === "overdue" ? <Button size="sm" variant="danger" onClick={() => showToast(`Chased ${c.lab} on ${c.work}`)}>Chase lab</Button>
          : <Button size="sm" variant="secondary" onClick={() => showToast(`Tracking ${c.work}`)}>Track</Button>}
      </div>
    ) },
  ];

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Lab tracking" subtitle={`${labCases.length} cases`} aside={<Button variant="primary" onClick={() => showToast("New lab case — work order opens")}>＋ New case</Button>} />
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <StatCard label="In transit" value={String(stats.inTransit)} sub="sent / in lab / returning" />
        <StatCard label="Ready to fit" value={String(stats.ready)} deltaTone="up" sub="book the patient" />
        <StatCard label="Overdue" value={String(stats.overdue)} delta="chase the lab" deltaTone="down" />
      </div>
      <DataTable columns={columns} rows={labCases} rowKey={(c) => c.id} onRowClick={(c) => showToast(`${c.work} — case detail opens`)}
        footer={`${labCases.length} cases`} empty={{ icon: "operations", title: "No lab work out", body: "Cases sent to the lab appear here." }} />
    </div>
  );
}
