import { useMemo } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DataTable, type Column } from "@/components/common/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/hooks/use-ui-store";
import { staff, type Staff } from "./team-data";

/* Team — doctors, staff, rosters and permissions. */

const PERM_TINT: Record<Staff["permission"], string> = {
  Owner: "#EAF1EE", Clinician: "#E8EEF4", Reception: "#FAF3E7", "Read-only": "#F4F3EF",
};

export function StaffScreen() {
  const { showToast } = useUIStore();
  const stats = useMemo(() => ({
    total: staff.length,
    doctors: staff.filter((s) => s.role === "Doctor").length,
    active: staff.filter((s) => s.active).length,
  }), []);

  const columns: Column<Staff>[] = [
    { key: "name", header: "MEMBER", width: "1.6fr", render: (s) => (
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar name={s.name} size={30} />
        <div className="min-w-0"><div className="font-semibold truncate">{s.name}</div><div className="text-[11px] text-muted-2">{s.role}{s.speciality ? ` · ${s.speciality}` : ""}</div></div>
      </div>
    ) },
    { key: "roster", header: "ROSTER", width: "1fr", render: (s) => <span className="text-muted">{s.roster}</span> },
    { key: "permission", header: "PERMISSION", width: "0.9fr", render: (s) => (
      <span className="text-[11px] font-semibold px-2 py-[3px] rounded-[5px] border border-border" style={{ background: PERM_TINT[s.permission] }}>{s.permission}</span>
    ) },
    { key: "status", header: "STATUS", width: "0.7fr", render: (s) => (
      <span className={s.active ? "text-primary text-[12px] font-semibold" : "text-muted-2 text-[12px]"}>{s.active ? "● Active" : "○ Inactive"}</span>
    ) },
    { key: "action", header: "", width: "0.7fr", align: "right", render: (s) => (
      <div onClick={(e) => e.stopPropagation()}><Button size="sm" variant="secondary" onClick={() => showToast(`Edit ${s.name}`)}>Edit</Button></div>
    ) },
  ];

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Team" subtitle={`${staff.length} members`} aside={<Button variant="primary" onClick={() => showToast("Invite member — role & permission form opens")}>＋ Invite member</Button>} />
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <StatCard label="Team members" value={String(stats.total)} sub="all roles" />
        <StatCard label="Doctors" value={String(stats.doctors)} sub="clinicians" />
        <StatCard label="Active" value={String(stats.active)} deltaTone="up" sub="with access" />
      </div>
      <DataTable columns={columns} rows={staff} rowKey={(s) => s.id} onRowClick={(s) => showToast(`${s.name} — profile & permissions open`)}
        footer={`${staff.length} members`} empty={{ icon: "team", title: "No team members", body: "Invite doctors and staff to give them access." }} />
    </div>
  );
}
