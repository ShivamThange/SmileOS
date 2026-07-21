import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { Avatar } from "@/components/ui/avatar";
import { MoneyText } from "@/components/common/money-text";
import { Button } from "@/components/ui/button";
import { MedicalAlertBadge } from "@/components/common/medical-alert-badge";
import { PhoneLink } from "@/components/common/phone-link";
import { patients } from "@/lib/mock-data";
import { useDeskStore } from "@/hooks/use-desk-store";
import { clinicConfig } from "@/config/clinic";
import type { Patient } from "@/types";

export function PatientsListScreen() {
  const navigate = useNavigate();
  const { openBooking } = useDeskStore();
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
    {
      key: "phone",
      header: "PHONE",
      width: "1.2fr",
      render: (p) => (
        <PhoneLink
          phone={p.phone}
          message={`Hello ${p.name}, this is ${clinicConfig.name}.`}
        />
      ),
    },
    {
      key: "alert",
      header: "ALERTS",
      width: "1.4fr",
      render: (p) =>
        p.alert ? (
          <MedicalAlertBadge alert={p.alert} variant="inline" />
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
        aside={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => openBooking()}>
              Book
            </Button>
            <Button variant="primary" onClick={() => navigate("/app/patients/new")}>
              ＋ New patient
            </Button>
          </div>
        }
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
        empty={{
          icon: "patients",
          title: "No patients match",
          body: "Nothing here for that name, number or phone. If they're calling now, book them straight in — the record gets created on confirm.",
          cta: "Book them in",
          onCta: () => openBooking({ phone: /^\d/.test(q.trim()) ? q.trim() : "" }),
        }}
      />
    </div>
  );
}
