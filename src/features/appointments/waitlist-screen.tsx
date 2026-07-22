import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Panel } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/hooks/use-ui-store";
import { EmptyState } from "@/components/common/empty-state";
import { useWaitlist, useSlotInWaitlist, useRemoveWaitlist } from "./waitlist-queries";

/* Waitlist — patients wanting an earlier slot, ready to fill a freed gap. */

const URGENCY_TINT: Record<string, { bg: string; color: string; border: string }> = {
  high: { bg: "#FBEFED", color: "#A8342A", border: "#EFC7C2" },
  moderate: { bg: "#FAF3E7", color: "#8A6B33", border: "#E5D2AC" },
  routine: { bg: "#F4F3EF", color: "#6E6C64", border: "#E6E4DE" },
};

export function WaitlistScreen() {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const { data: waitlist = [], isLoading } = useWaitlist();
  const slotIn = useSlotInWaitlist();
  const remove = useRemoveWaitlist();

  const highCount = waitlist.filter((w) => w.urgency === "high").length;

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Waitlist" subtitle={`${waitlist.length} patients waiting for an earlier slot`}
        aside={<Button variant="primary" onClick={() => showToast("Add to waitlist — patient & preference form opens")}>＋ Add to waitlist</Button>} />
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <StatCard label="Waiting" value={String(waitlist.length)} sub="for an earlier slot" />
        <StatCard label="Urgent" value={String(highCount)} delta={highCount ? "prioritise" : ""} deltaTone="warn" sub="high-urgency requests" />
        <StatCard label="Longest wait" value={waitlist[waitlist.length - 1]?.since ?? "—"} sub="oldest request" />
      </div>

      <Panel className="overflow-hidden">
        {waitlist.length === 0 && !isLoading ? (
          <EmptyState icon="schedule" title="Nobody waiting" body="When a patient wants an earlier slot, add them here and fill freed gaps first." />
        ) : (
          waitlist.map((w, i) => (
            <div key={w.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < waitlist.length - 1 ? "1px solid var(--border-faint)" : "none" }}>
              <Avatar name={w.name} size={34} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{w.name}</span>
                  <span className="text-[10px] font-bold px-1.5 py-px rounded border capitalize" style={URGENCY_TINT[w.urgency] ?? URGENCY_TINT.routine}>{w.urgency}</span>
                </div>
                <div className="text-[12px] text-muted truncate">{w.want || "Any earlier slot"}</div>
              </div>
              <span className="text-[11px] text-muted-2">{w.since}</span>
              <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="secondary" onClick={() => navigate("/app/calendar")}>Find slot</Button>
                <Button size="sm" variant="tint" disabled={slotIn.isPending} onClick={() => { slotIn.mutate(w.id); showToast(`${w.name} slotted into a freed gap — WhatsApp sent`); }}>Slot in</Button>
                <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => { remove.mutate(w.id); showToast(`${w.name} removed from the waitlist`); }}>Remove</Button>
              </div>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
