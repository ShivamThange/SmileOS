import { useMemo } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DataTable, type Column } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/common/money-text";
import { inr } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import { type Supplier } from "./operations-data";
import { useSuppliers } from "./queries";

/* Suppliers — labs, consumables and equipment vendors with terms and ratings. */

export function SuppliersScreen() {
  const { showToast } = useUIStore();
  const { data: suppliers = [], isLoading } = useSuppliers();
  const stats = useMemo(() => ({
    count: suppliers.length,
    outstanding: suppliers.reduce((s, v) => s + v.outstandingPaise, 0),
    labs: suppliers.filter((v) => v.kind.includes("lab")).length,
  }), [suppliers]);

  const columns: Column<Supplier>[] = [
    { key: "name", header: "SUPPLIER", width: "1.6fr", render: (v) => (
      <div className="min-w-0"><div className="font-semibold truncate">{v.name}</div><div className="text-[11px] text-muted-2">{v.kind}</div></div>
    ) },
    { key: "terms", header: "TERMS", width: "0.8fr", render: (v) => <span className="text-[11px] font-semibold px-2 py-[3px] rounded-[5px] border border-border bg-bg">{v.terms}</span> },
    { key: "rating", header: "RATING", width: "0.9fr", render: (v) => <span className="text-[#D9A93B] text-[12px]">★ <span className="text-ink font-semibold">{v.rating.toFixed(1)}</span></span> },
    { key: "outstanding", header: "OUTSTANDING", width: "0.9fr", align: "right", render: (v) => v.outstandingPaise ? <MoneyText paise={v.outstandingPaise} className="font-semibold text-warning" /> : <span className="text-muted-2">Settled</span> },
    { key: "action", header: "", width: "0.8fr", align: "right", render: (v) => (
      <div onClick={(e) => e.stopPropagation()}><Button size="sm" variant="secondary" onClick={() => showToast(`New order to ${v.name}`)}>Order</Button></div>
    ) },
  ];

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Suppliers" subtitle={`${suppliers.length} vendors`} aside={<Button variant="primary" onClick={() => showToast("Add supplier — vendor form opens")}>＋ Add supplier</Button>} />
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <StatCard label="Suppliers" value={String(stats.count)} sub={`${stats.labs} labs`} />
        <StatCard label="Outstanding payable" value={inr(stats.outstanding)} deltaTone="warn" sub="across vendors" />
        <StatCard label="Avg rating" value={(suppliers.reduce((s, v) => s + v.rating, 0) / suppliers.length).toFixed(1)} sub="quality & reliability" />
      </div>
      <DataTable columns={columns} rows={suppliers} rowKey={(v) => v.id} loading={isLoading} onRowClick={(v) => showToast(`${v.name} — order history opens`)}
        footer={`${suppliers.length} suppliers`} empty={{ icon: "operations", title: "No suppliers", body: "Add vendors to track terms and orders." }} />
    </div>
  );
}
