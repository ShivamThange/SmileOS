import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Panel } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/hooks/use-ui-store";
import { waitlist, appointments } from "@/lib/mock-data";

/* Waitlist — patients wanting an earlier slot, ready to fill a freed gap. */

export function WaitlistScreen() {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const freedGaps = appointments.filter((a) => a.status === "cancelled" || a.status === "noshow").length;

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Waitlist" subtitle={`${waitlist.length} patients waiting for an earlier slot`}
        aside={<Button variant="primary" onClick={() => showToast("Add to waitlist — patient & preference form opens")}>＋ Add to waitlist</Button>} />
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <StatCard label="Waiting" value={String(waitlist.length)} sub="for an earlier slot" />
        <StatCard label="Freed gaps today" value={String(freedGaps)} delta={freedGaps ? "fill them" : ""} deltaTone="up" sub="cancellations / no-shows" />
        <StatCard label="Longest wait" value="4 days" sub="prioritise first" />
      </div>

      <Panel className="overflow-hidden">
        {waitlist.map((w, i) => (
          <div key={w.name} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < waitlist.length - 1 ? "1px solid var(--border-faint)" : "none" }}>
            <Avatar name={w.name} size={34} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold">{w.name}</div>
              <div className="text-[12px] text-muted truncate">{w.want}</div>
            </div>
            <span className="text-[11px] text-muted-2">{w.since}</span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => navigate("/app/calendar")}>Find slot</Button>
              <Button size="sm" variant="tint" onClick={() => showToast(`${w.name} slotted into a freed gap — WhatsApp sent`)}>Slot in</Button>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}
