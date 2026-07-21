import { useMemo } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DataTable, type Column } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/common/money-text";
import { inr } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import { payments, type Payment, type PayMethod } from "./billing-data";

/* Payments — a chronological ledger of money received, for the day's close. */

const METHOD_TINT: Record<PayMethod, string> = {
  UPI: "#EAF1EE", Card: "#EDE3F0", Cash: "#FAF3E7", "Net-banking": "#E8EEF4",
};

export function PaymentsScreen() {
  const { showToast } = useUIStore();
  const stats = useMemo(() => {
    const today = payments.filter((p) => p.date === "20 Jul");
    const todayTotal = today.reduce((s, p) => s + p.amountPaise, 0);
    const byUpi = payments.filter((p) => p.method === "UPI").reduce((s, p) => s + p.amountPaise, 0);
    const total = payments.reduce((s, p) => s + p.amountPaise, 0);
    return { todayTotal, todayCount: today.length, byUpi, total };
  }, []);

  const columns: Column<Payment>[] = [
    { key: "when", header: "WHEN", width: "0.8fr", render: (p) => (
      <div><div className="text-[12.5px] font-medium">{p.date}</div><div className="text-[11px] text-muted-2 font-mono">{p.time}</div></div>
    ) },
    { key: "patient", header: "PATIENT", width: "1.4fr", render: (p) => <span className="font-semibold">{p.patient}</span> },
    { key: "method", header: "METHOD", width: "0.9fr", render: (p) => (
      <span className="text-[11px] font-semibold px-2 py-[3px] rounded-[5px] border border-border" style={{ background: METHOD_TINT[p.method] }}>{p.method}</span>
    ) },
    { key: "against", header: "AGAINST", width: "0.9fr", render: (p) => <span className="font-mono text-[12px] text-muted">{p.against}</span> },
    { key: "amount", header: "AMOUNT", width: "0.9fr", align: "right", render: (p) => <MoneyText paise={p.amountPaise} className="font-semibold text-primary" /> },
  ];

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Payments" subtitle="Money received" aside={<Button variant="primary" onClick={() => showToast("Close of day — reconciliation summary opens")}>Close of day</Button>} />
      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <StatCard label="Collected today" value={inr(stats.todayTotal)} deltaTone="up" sub={`${stats.todayCount} payments`} />
        <StatCard label="Via UPI" value={inr(stats.byUpi)} sub="most-used method" />
        <StatCard label="Payments (list)" value={String(payments.length)} sub="recent receipts" />
        <StatCard label="Total shown" value={inr(stats.total)} sub="across the ledger" />
      </div>
      <DataTable columns={columns} rows={payments} rowKey={(p) => p.id} onRowClick={(p) => showToast(`Receipt ${p.against} — ${inr(p.amountPaise)} from ${p.patient}`)}
        footer={`${payments.length} payments`} empty={{ icon: "revenue", title: "No payments yet", body: "Received payments will appear here." }} />
    </div>
  );
}
