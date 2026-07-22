import { useMemo } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DataTable, type Column } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/common/money-text";
import { inr } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import { invoiceBalance, type Invoice } from "./billing-data";
import { usePendingPayments } from "./queries";

/* Pending payments — receivables, oldest first, with aging buckets to chase. */

export function PendingPaymentsScreen() {
  const { showToast } = useUIStore();
  const { data: aging = { under30: 0, over30: 0, total: 0, count: 0, outstanding: [] }, isLoading } = usePendingPayments();
  const rows = useMemo(() => [...aging.outstanding].sort((a, b) => b.ageDays - a.ageDays), [aging]);

  const columns: Column<Invoice>[] = [
    { key: "patient", header: "PATIENT", width: "1.4fr", render: (i) => (
      <div className="min-w-0"><div className="font-semibold truncate">{i.patient}</div><div className="text-[11px] text-muted-2 truncate">{i.no} · {i.summary}</div></div>
    ) },
    { key: "age", header: "AGE", width: "0.8fr", render: (i) => (
      <span className="text-[11px] font-bold px-2 py-[3px] rounded-[5px] border"
        style={i.ageDays >= 30 ? { background: "#FBEFED", color: "#A8342A", borderColor: "#EFC7C2" } : { background: "#FAF3E7", color: "#8A6B33", borderColor: "#E5D2AC" }}>
        {i.ageDays}d
      </span>
    ) },
    { key: "total", header: "INVOICE", width: "0.8fr", align: "right", render: (i) => <MoneyText paise={i.totalPaise} className="text-muted" /> },
    { key: "balance", header: "BALANCE", width: "0.9fr", align: "right", render: (i) => <MoneyText paise={invoiceBalance(i)} className="font-semibold text-danger" /> },
    { key: "action", header: "", width: "1.4fr", align: "right", render: (i) => (
      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="secondary" onClick={() => showToast(`Reminder sent to ${i.patient} on WhatsApp`)}>Remind</Button>
        <Button size="sm" variant="tint" onClick={() => showToast(`Collect ${i.no} — payment sheet opens`)}>Collect</Button>
      </div>
    ) },
  ];

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Pending payments" subtitle={`${aging.count} invoices with a balance`}
        aside={<Button variant="primary" onClick={() => showToast("Bulk reminder queued for all overdue balances")}>Remind all overdue</Button>} />
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <StatCard label="Under 30 days" value={inr(aging.under30)} deltaTone="warn" sub="recent, low-risk" />
        <StatCard label="30 days & older" value={inr(aging.over30)} delta="chase now" deltaTone="down" />
        <StatCard label="Total receivable" value={inr(aging.total)} sub={`${aging.count} open invoices`} />
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(i) => i.id} loading={isLoading} onRowClick={(i) => showToast(`${i.no} — invoice detail opens`)}
        footer={`${rows.length} outstanding · oldest first`}
        empty={{ icon: "revenue", title: "Nothing outstanding", body: "Every invoice is settled. Nice." }} />
    </div>
  );
}
