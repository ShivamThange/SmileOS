import { useMemo } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DataTable, type Column } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/common/money-text";
import { inr } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import { inventory, inventoryFlags, type InventoryItem } from "./operations-data";

/* Inventory — stock, reorder levels, expiry and value with alerts. */

export function InventoryScreen() {
  const { showToast } = useUIStore();
  const stats = useMemo(() => {
    const low = inventory.filter((i) => inventoryFlags(i).low).length;
    const nearExpiry = inventory.filter((i) => inventoryFlags(i).nearExpiry).length;
    const value = inventory.reduce((s, i) => s + i.valuePaise, 0);
    return { low, nearExpiry, value };
  }, []);

  const columns: Column<InventoryItem>[] = [
    { key: "name", header: "ITEM", width: "1.6fr", render: (i) => (
      <div className="min-w-0"><div className="font-semibold truncate">{i.name}</div><div className="text-[11px] text-muted-2">{i.category}</div></div>
    ) },
    { key: "stock", header: "STOCK", width: "1fr", render: (i) => {
      const f = inventoryFlags(i);
      return <span className={f.low ? "font-semibold text-danger" : "font-medium"}>{i.stock} {i.unit}{f.low && <span className="text-[10px] font-bold ml-1.5 px-1.5 py-px rounded bg-danger-bg text-danger border border-danger-border">LOW</span>}</span>;
    } },
    { key: "reorder", header: "REORDER AT", width: "0.8fr", render: (i) => <span className="text-muted">{i.reorderAt} {i.unit}</span> },
    { key: "expiry", header: "EXPIRY", width: "1fr", render: (i) => {
      const f = inventoryFlags(i);
      return <span className={f.nearExpiry ? "text-warning font-semibold" : "text-muted"}>{i.expiry}{f.nearExpiry && i.expiry !== "—" && <span className="text-[10px] font-bold ml-1.5 px-1.5 py-px rounded bg-warning-bg text-warning border border-warning-border">SOON</span>}</span>;
    } },
    { key: "value", header: "VALUE", width: "0.8fr", align: "right", render: (i) => <MoneyText paise={i.valuePaise} className="font-medium" /> },
    { key: "action", header: "", width: "0.8fr", align: "right", render: (i) => (
      <div onClick={(e) => e.stopPropagation()}>{inventoryFlags(i).low && <Button size="sm" variant="tint" onClick={() => showToast(`Reorder ${i.name} — PO drafted`)}>Reorder</Button>}</div>
    ) },
  ];

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Inventory" subtitle={`${inventory.length} tracked items`} aside={<Button variant="primary" onClick={() => showToast("Add item — stock entry opens")}>＋ Add item</Button>} />
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <StatCard label="Below reorder point" value={String(stats.low)} delta="reorder now" deltaTone="down" />
        <StatCard label="Near expiry (45d)" value={String(stats.nearExpiry)} delta="use or return" deltaTone="warn" />
        <StatCard label="Stock value" value={inr(stats.value)} sub="at cost" />
      </div>
      <DataTable columns={columns} rows={inventory} rowKey={(i) => i.id} onRowClick={(i) => showToast(`${i.name} — stock history opens`)}
        footer={`${inventory.length} items`} empty={{ icon: "operations", title: "No stock tracked", body: "Add items to monitor levels and expiry." }} />
    </div>
  );
}
