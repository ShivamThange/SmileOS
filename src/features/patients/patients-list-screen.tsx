import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { Avatar } from "@/components/ui/avatar";
import { MoneyText } from "@/components/common/money-text";
import { Button } from "@/components/ui/button";
import { patients } from "@/lib/mock-data";
import { useUIStore } from "@/hooks/use-ui-store";
import type { Patient } from "@/types";

export function PatientsListScreen() {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return patients.filter(
      (p) =>
        !s ||
        p.name.toLowerCase().includes(s) ||
        p.pno.toLowerCase().includes(s) ||
        p.phone.replace(/\s/g, "").includes(s.replace(/\s/g, "")),
    );
  }, [q]);

  const columns: Column<Patient>[] = [
    {
      key: "name",
      header: "PATIENT",
      width: "1.6fr",
      render: (p) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={p.name} size={30} />
          <div className="min-w-0">
            <div className="font-semibold truncate">{p.name}</div>
            <div className="text-[11px] text-muted-2 font-mono">{p.pno}</div>
          </div>
        </div>
      ),
    },
    { key: "agesex", header: "AGE / SEX", width: "0.7fr", render: (p) => <span className="text-muted">{p.agesex}</span> },
    { key: "phone", header: "PHONE", width: "1fr", render: (p) => <span className="font-mono text-[12px]">{p.phone}</span> },
    {
      key: "alert",
      header: "ALERTS",
      width: "1.4fr",
      render: (p) =>
        p.alert ? (
          <span className="text-[11px] font-semibold text-danger bg-danger-bg border border-danger-border rounded-[5px] px-2 py-0.5">
            ⚠ {p.alert}
          </span>
        ) : (
          <span className="text-muted-2">—</span>
        ),
    },
    { key: "last", header: "LAST VISIT", width: "0.9fr", render: (p) => <span className="text-muted">{p.lastVisit}</span> },
    {
      key: "balance",
      header: "BALANCE",
      width: "0.8fr",
      align: "right",
      render: (p) =>
        p.balancePaise ? (
          <MoneyText paise={p.balancePaise} className="font-semibold text-danger" />
        ) : (
          <span className="text-muted-2">Nil</span>
        ),
    },
  ];

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader
        title="Patients"
        subtitle={`${patients.length} records`}
        aside={<Button variant="primary" onClick={() => showToast("New patient — form opens here")}>＋ New patient</Button>}
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        onRowClick={(p) => navigate(`/app/patients/${p.id}`)}
        toolbar={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, number or phone…"
            className="w-full max-w-[360px] text-[12.5px] px-3 py-1.5 border border-border rounded-md bg-bg-content outline-none focus:border-border-strong"
          />
        }
        footer={`Showing ${rows.length} of ${patients.length}`}
        empty={{ icon: "patients", title: "No patients match", body: "Try a different name, patient number or phone." }}
      />
    </div>
  );
}
