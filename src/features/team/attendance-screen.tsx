import { useMemo } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DataTable, type Column } from "@/components/common/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/hooks/use-ui-store";
import { ATTENDANCE_META, type Attendance } from "./team-data";
import { useAttendance } from "./queries";
import { TODAY_LABEL } from "@/config/clinic";

/* Attendance — today's check-in / check-out log and hours. */

export function AttendanceScreen() {
  const { showToast } = useUIStore();
  const { data: attendance = [], isLoading } = useAttendance();
  const stats = useMemo(() => ({
    present: attendance.filter((a) => a.state === "in").length,
    left: attendance.filter((a) => a.state === "out").length,
    off: attendance.filter((a) => a.state === "leave" || a.state === "absent").length,
  }), [attendance]);

  const columns: Column<Attendance>[] = [
    { key: "name", header: "MEMBER", width: "1.6fr", render: (a) => (
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar name={a.name} size={30} />
        <div className="min-w-0"><div className="font-semibold truncate">{a.name}</div><div className="text-[11px] text-muted-2">{a.role}</div></div>
      </div>
    ) },
    { key: "in", header: "IN", width: "0.7fr", render: (a) => <span className="font-mono text-[12px]">{a.inTime}</span> },
    { key: "out", header: "OUT", width: "0.7fr", render: (a) => <span className="font-mono text-[12px]">{a.outTime}</span> },
    { key: "hours", header: "HOURS", width: "0.8fr", render: (a) => <span className="tnum">{a.hours}</span> },
    { key: "state", header: "STATUS", width: "0.9fr", render: (a) => {
      const m = ATTENDANCE_META[a.state];
      return <span className="text-[10.5px] font-bold px-2 py-[3px] rounded-[5px] border" style={{ background: m.bg, color: m.color, borderColor: m.border }}>{m.label}</span>;
    } },
  ];

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Attendance" subtitle={TODAY_LABEL} aside={<Button variant="primary" onClick={() => showToast("Export timesheet — CSV downloaded")}>Export timesheet</Button>} />
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <StatCard label="Present now" value={String(stats.present)} deltaTone="up" sub="checked in" />
        <StatCard label="Left for the day" value={String(stats.left)} sub="checked out" />
        <StatCard label="Off / leave" value={String(stats.off)} sub="not working today" />
      </div>
      <DataTable columns={columns} rows={attendance} rowKey={(a) => a.id} loading={isLoading} onRowClick={(a) => showToast(`${a.name} — attendance history opens`)}
        footer={`${attendance.length} logged today`} empty={{ icon: "team", title: "No attendance yet", body: "Check-ins appear here through the day." }} />
    </div>
  );
}
