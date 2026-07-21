import { useMemo } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DataTable, type Column } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/common/money-text";
import { inr } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import { campaigns, type Campaign, type CampaignStatus } from "./growth-data";

/* Campaigns — recall/reactivation/recovery sends with attributed revenue. */

const STATUS_META: Record<CampaignStatus, { label: string; bg: string; color: string; border: string }> = {
  active: { label: "Active", bg: "#EAF1EE", color: "#20614E", border: "#C7DAD1" },
  scheduled: { label: "Scheduled", bg: "#FAF3E7", color: "#8A6B33", border: "#E5D2AC" },
  done: { label: "Completed", bg: "#F4F3EF", color: "#6E6C64", border: "#E6E4DE" },
};

export function CampaignsScreen() {
  const { showToast } = useUIStore();
  const stats = useMemo(() => {
    const revenue = campaigns.reduce((s, c) => s + c.revenuePaise, 0);
    const booked = campaigns.reduce((s, c) => s + c.booked, 0);
    const sent = campaigns.reduce((s, c) => s + c.sent, 0);
    return { revenue, booked, sent, active: campaigns.filter((c) => c.status === "active").length };
  }, []);

  const columns: Column<Campaign>[] = [
    { key: "name", header: "CAMPAIGN", width: "1.6fr", render: (c) => (
      <div className="min-w-0"><div className="font-semibold truncate">{c.name}</div><div className="text-[11px] text-muted-2">{c.kind}</div></div>
    ) },
    { key: "status", header: "STATUS", width: "0.8fr", render: (c) => {
      const m = STATUS_META[c.status];
      return <span className="text-[10.5px] font-bold px-2 py-[3px] rounded-[5px] border" style={{ background: m.bg, color: m.color, borderColor: m.border }}>{m.label}</span>;
    } },
    { key: "sent", header: "SENT", width: "0.6fr", align: "right", render: (c) => <span className="tnum">{c.sent}</span> },
    { key: "booked", header: "BOOKED", width: "0.7fr", align: "right", render: (c) => <span className="tnum font-semibold">{c.booked}</span> },
    { key: "revenue", header: "REVENUE", width: "0.9fr", align: "right", render: (c) => c.revenuePaise ? <MoneyText paise={c.revenuePaise} className="font-semibold text-primary" /> : <span className="text-muted-2">—</span> },
  ];

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Campaigns" subtitle={`${campaigns.length} campaigns`} aside={<Button variant="primary" onClick={() => showToast("New campaign — audience and message builder opens")}>＋ New campaign</Button>} />
      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <StatCard label="Attributed revenue" value={inr(stats.revenue)} deltaTone="up" sub="across campaigns" />
        <StatCard label="Appointments booked" value={String(stats.booked)} sub="from sends" />
        <StatCard label="Messages sent" value={String(stats.sent)} sub="total reach" />
        <StatCard label="Active now" value={String(stats.active)} sub="running" />
      </div>
      <DataTable columns={columns} rows={campaigns} rowKey={(c) => c.id} onRowClick={(c) => showToast(`${c.name} — per-recipient outcomes open`)}
        footer={`${campaigns.length} campaigns`} empty={{ icon: "growth", title: "No campaigns yet", body: "Create one to reach patients at scale." }} />
    </div>
  );
}
