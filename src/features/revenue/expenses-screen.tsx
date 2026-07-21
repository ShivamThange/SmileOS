import { useMemo } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DataTable, type Column } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/common/money-text";
import { inr } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import { expenses, type Expense } from "./billing-data";

/* Expenses — outgoings, so profitability reports tell the whole story. */

const CATEGORY_TINT: Record<string, string> = {
  Lab: "#EDE3F0", Consumables: "#EAF1EE", Rent: "#FAF3E7", Salaries: "#E8EEF4", Equipment: "#F4F3EF", Marketing: "#FBEFED",
};

export function ExpensesScreen() {
  const { showToast } = useUIStore();
  const stats = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amountPaise, 0);
    const byCat = expenses.reduce<Record<string, number>>((m, e) => ({ ...m, [e.category]: (m[e.category] ?? 0) + e.amountPaise }), {});
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    return { total, top, catCount: Object.keys(byCat).length };
  }, []);

  const columns: Column<Expense>[] = [
    { key: "date", header: "DATE", width: "0.7fr", render: (e) => <span className="text-[12.5px] font-medium">{e.date}</span> },
    { key: "category", header: "CATEGORY", width: "0.9fr", render: (e) => (
      <span className="text-[11px] font-semibold px-2 py-[3px] rounded-[5px] border border-border" style={{ background: CATEGORY_TINT[e.category] ?? "#F4F3EF" }}>{e.category}</span>
    ) },
    { key: "vendor", header: "VENDOR", width: "1.4fr", render: (e) => (
      <div className="min-w-0"><div className="font-semibold truncate">{e.vendor}</div><div className="text-[11px] text-muted-2 truncate">{e.note}</div></div>
    ) },
    { key: "amount", header: "AMOUNT", width: "0.9fr", align: "right", render: (e) => <MoneyText paise={e.amountPaise} className="font-semibold" /> },
  ];

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Expenses" subtitle="This month's outgoings" aside={<Button variant="primary" onClick={() => showToast("Record expense — the entry sheet opens")}>＋ Record expense</Button>} />
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <StatCard label="Total this month" value={inr(stats.total)} deltaTone="warn" sub={`${expenses.length} entries`} />
        <StatCard label="Biggest category" value={stats.top ? stats.top[0] : "—"} sub={stats.top ? inr(stats.top[1]) : ""} />
        <StatCard label="Categories" value={String(stats.catCount)} sub="tracked" />
      </div>
      <DataTable columns={columns} rows={expenses} rowKey={(e) => e.id} onRowClick={(e) => showToast(`${e.vendor} — ${inr(e.amountPaise)}`)}
        footer={`${expenses.length} expenses`} empty={{ icon: "revenue", title: "No expenses logged", body: "Record outgoings to see true profitability." }} />
    </div>
  );
}
