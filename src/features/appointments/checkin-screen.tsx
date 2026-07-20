import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/hooks/use-ui-store";
import { appointments } from "@/lib/mock-data";
import { fmtHour } from "@/lib/format";

/* Check-in — today's arrivals and one-tap check-in for the front desk. */

export function CheckinScreen() {
  const { showToast } = useUIStore();
  const arrivals = useMemo(
    () => appointments.filter((a) => ["booked", "confirmed", "arrived", "inchair"].includes(a.status)).sort((a, b) => a.start - b.start),
    [],
  );
  const [checked, setChecked] = useState<Set<string>>(new Set(arrivals.filter((a) => ["arrived", "inchair"].includes(a.status)).map((a) => a.id)));

  const doCheckin = (id: string, name: string) => { setChecked((s) => new Set(s).add(id)); showToast(`${name} checked in`); };

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Check-in" subtitle="Today's arrivals" />
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <StatCard label="Expected today" value={String(arrivals.length)} sub="booked & confirmed" />
        <StatCard label="Checked in" value={String(checked.size)} deltaTone="up" sub="here now" />
        <StatCard label="Yet to arrive" value={String(arrivals.length - checked.size)} sub="awaiting" />
      </div>

      <Panel className="overflow-hidden">
        <div className="grid items-center gap-3 px-4 py-2.5 border-b border-border bg-bg-content" style={{ gridTemplateColumns: "0.7fr 1.6fr 1.4fr 1fr" }}>
          {["TIME", "PATIENT", "PROCEDURE", ""].map((h) => <MicroLabel key={h}>{h}</MicroLabel>)}
        </div>
        {arrivals.map((a) => {
          const isIn = checked.has(a.id);
          return (
            <div key={a.id} className="grid items-center gap-3 px-4 py-3 border-b border-border-faint" style={{ gridTemplateColumns: "0.7fr 1.6fr 1.4fr 1fr" }}>
              <div className="text-[12px] font-mono text-muted">{fmtHour(a.start)}</div>
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={a.name} size={30} />
                <div className="min-w-0"><div className="text-[13px] font-semibold truncate">{a.name}</div><div className="text-[11px] text-muted-2">{a.doctor} · {a.chair}</div></div>
              </div>
              <div className="text-[12.5px] truncate">{a.proc}</div>
              <div className="flex justify-end">
                {isIn
                  ? <span className="text-[11px] font-bold px-2 py-[3px] rounded-[5px] border" style={{ background: "#EAF1EE", color: "#20614E", borderColor: "#C7DAD1" }}>✓ Checked in</span>
                  : <Button size="sm" variant="primary" onClick={() => doCheckin(a.id, a.name)}>Check in</Button>}
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
