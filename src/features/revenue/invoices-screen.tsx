import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DataTable, type Column } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/common/money-text";
import { inr } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import { invoiceBalance, INVOICE_STATUS_META, type Invoice, type InvoiceStatus } from "./billing-data";
import { useInvoices } from "./queries";

/* Invoices — the billing worklist: what's raised, what's paid, what's owed. */

const FILTERS: { key: InvoiceStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "partial", label: "Part-paid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
];

export function InvoicesScreen() {
  const { showToast } = useUIStore();
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");
  const { data: invoices = [], isLoading } = useInvoices();

  const rows = useMemo(() => invoices.filter((i) => filter === "all" || i.status === filter), [filter, invoices]);
  const stats = useMemo(() => {
    const collectedToday = invoices.reduce((s, i) => s + i.paidPaise, 0);
    const outstanding = invoices.reduce((s, i) => s + invoiceBalance(i), 0);
    const overdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + invoiceBalance(i), 0);
    const raised = invoices.reduce((s, i) => s + i.totalPaise, 0);
    return { collectedToday, outstanding, overdue, raised };
  }, [invoices]);

  const columns: Column<Invoice>[] = [
    { key: "no", header: "INVOICE", width: "1fr", render: (i) => (
      <div><div className="font-mono text-[12px] font-semibold">{i.no}</div><div className="text-[11px] text-muted-2">{i.date}</div></div>
    ) },
    { key: "patient", header: "PATIENT", width: "1.3fr", render: (i) => (
      <div className="min-w-0"><div className="font-semibold truncate">{i.patient}</div><div className="text-[11px] text-muted-2 truncate">{i.summary}</div></div>
    ) },
    { key: "total", header: "TOTAL", width: "0.8fr", align: "right", render: (i) => <MoneyText paise={i.totalPaise} className="font-medium" /> },
    { key: "balance", header: "BALANCE", width: "0.8fr", align: "right", render: (i) =>
      invoiceBalance(i) ? <MoneyText paise={invoiceBalance(i)} className="font-semibold text-danger" /> : <span className="text-muted-2">Nil</span> },
    { key: "status", header: "STATUS", width: "0.9fr", render: (i) => {
      const m = INVOICE_STATUS_META[i.status];
      return <span className="text-[10.5px] font-bold px-2 py-[3px] rounded-[5px] border" style={{ background: m.bg, color: m.color, borderColor: m.border }}>{m.label}</span>;
    } },
    { key: "action", header: "", width: "0.9fr", align: "right", render: (i) => (
      <div onClick={(e) => e.stopPropagation()}>
        {invoiceBalance(i) > 0
          ? <Button size="sm" variant="tint" onClick={() => showToast(`Collect ${i.no} — payment sheet opens`)}>Collect</Button>
          : <Button size="sm" variant="secondary" onClick={() => showToast(`Receipt for ${i.no} downloaded`)}>Receipt</Button>}
      </div>
    ) },
  ];

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Invoices" subtitle={`${invoices.length} invoices`} aside={<Button variant="primary" onClick={() => showToast("New invoice — the billing sheet opens")}>＋ New invoice</Button>} />
      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <StatCard label="Collected today" value={inr(stats.collectedToday)} deltaTone="up" sub="across all methods" />
        <StatCard label="Outstanding" value={inr(stats.outstanding)} delta="receivable" deltaTone="warn" />
        <StatCard label="Overdue 30d+" value={inr(stats.overdue)} delta="chase" deltaTone="down" />
        <StatCard label="Raised (this list)" value={inr(stats.raised)} sub={`${invoices.length} invoices`} />
      </div>
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const sel = filter === f.key;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)} className="text-[12px] font-semibold px-3 py-1.5 rounded-md border"
              style={{ background: sel ? "#20614E" : "var(--surface)", color: sel ? "#F7F6F3" : "var(--muted-strong)", borderColor: sel ? "#20614E" : "var(--border)" }}>{f.label}</button>
          );
        })}
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(i) => i.id} loading={isLoading} onRowClick={(i) => showToast(`${i.no} — invoice detail opens`)}
        footer={`Showing ${rows.length} of ${invoices.length}`}
        empty={{ icon: "revenue", title: "No invoices here", body: "Nothing matches this filter." }} />
    </div>
  );
}
