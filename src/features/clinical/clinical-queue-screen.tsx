import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/hooks/use-ui-store";
import { appointments } from "@/lib/mock-data";
import { fmtHour } from "@/lib/format";

/*
 * Clinical queue — the chairside worklist: who's checked in, in what order,
 * how long they've waited, and whose notes still need finishing.
 */

const WAITS: Record<string, string> = { arrived: "8 min", confirmed: "—", inchair: "in chair" };

export function ClinicalQueueScreen() {
  const navigate = useNavigate();
  const { showToast } = useUIStore();

  const queue = useMemo(
    () =>
      appointments
        .filter((a) => ["arrived", "inchair", "confirmed"].includes(a.status))
        .sort((a, b) => (a.status === "inchair" ? -1 : b.status === "inchair" ? 1 : a.start - b.start)),
    [],
  );
  const inChair = queue.filter((a) => a.status === "inchair").length;
  const waiting = queue.filter((a) => a.status === "arrived").length;
  const incompleteNotes = appointments.filter((a) => a.status === "done").length - 6; // a couple outstanding

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Clinical queue" subtitle="Today's chairside worklist" aside={<Button variant="primary" onClick={() => showToast("Add walk-in to the queue")}>＋ Add walk-in</Button>} />
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <StatCard label="In the chair" value={String(inChair)} deltaTone="up" sub="being treated now" />
        <StatCard label="Waiting" value={String(waiting)} delta={waiting ? "seat soon" : ""} deltaTone="warn" sub="checked in" />
        <StatCard label="Notes to finish" value={String(Math.max(0, incompleteNotes))} delta="complete today" deltaTone="warn" />
      </div>

      <Panel className="overflow-hidden">
        <div className="grid items-center gap-3 px-4 py-2.5 border-b border-border bg-bg-content" style={{ gridTemplateColumns: "1.6fr 1.4fr 0.8fr 0.8fr 1fr" }}>
          {["PATIENT", "PROCEDURE", "SLOT", "WAITING", ""].map((h) => <MicroLabel key={h}>{h}</MicroLabel>)}
        </div>
        {queue.map((a) => (
          <div key={a.id} className="grid items-center gap-3 px-4 py-3 border-b border-border-faint" style={{ gridTemplateColumns: "1.6fr 1.4fr 0.8fr 0.8fr 1fr" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={a.name} size={30} />
              <div className="min-w-0"><div className="text-[13px] font-semibold truncate">{a.name}</div><div className="text-[11px] text-muted-2">{a.doctor} · {a.chair}</div></div>
            </div>
            <div className="text-[12.5px] truncate">{a.proc}</div>
            <div className="text-[12px] text-muted font-mono">{fmtHour(a.start)}</div>
            <div>
              {a.status === "inchair"
                ? <span className="text-[10.5px] font-bold px-2 py-[3px] rounded-[5px]" style={{ background: "#20614E", color: "#F7F6F3" }}>In chair</span>
                : <span className={a.status === "arrived" ? "text-warning text-[12px] font-semibold" : "text-muted text-[12px]"}>{WAITS[a.status]}</span>}
            </div>
            <div className="flex justify-end gap-1.5">
              {a.status === "inchair"
                ? <Button size="sm" variant="tint" onClick={() => showToast(`Completing ${a.name} — chart & notes open`)}>Complete</Button>
                : a.status === "arrived"
                  ? <Button size="sm" variant="primary" onClick={() => showToast(`Seating ${a.name} in ${a.chair}`)}>Seat</Button>
                  : <Button size="sm" variant="secondary" onClick={() => showToast(`${a.name} not yet arrived`)}>Await</Button>}
              <Button size="sm" variant="ghost" onClick={() => navigate("/app/patients/p1")}>Chart</Button>
            </div>
          </div>
        ))}
        {!queue.length && <div className="px-4 py-10 text-center text-[12.5px] text-muted-2">Queue is clear.</div>}
      </Panel>
    </div>
  );
}
