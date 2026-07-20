import { useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { inr } from "@/lib/format";
import { leads as seed } from "@/lib/mock-data";
import { leadStages } from "@/design/status";
import { useUIStore } from "@/hooks/use-ui-store";
import type { Lead } from "@/types";
import type { LeadStage } from "@/types/enums";

export function LeadsScreen() {
  const { showToast } = useUIStore();
  const [leads, setLeads] = useState<Lead[]>(seed);
  const [dragId, setDragId] = useState<string | null>(null);

  const openPipeline = leads
    .filter((l) => l.stage !== "won" && l.stage !== "lost")
    .reduce((a, l) => a + l.valuePaise, 0);

  const moveTo = (stage: LeadStage) => {
    if (!dragId) return;
    const label = leadStages.find((s) => s.id === stage)?.label ?? stage;
    setLeads((ls) => ls.map((l) => (l.id === dragId ? { ...l, stage } : l)));
    setDragId(null);
    showToast(`Moved to ${label}`);
  };

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-3.5">
      <PageHeader
        title="Leads"
        subtitle="Drag a card between stages as an enquiry moves along."
        aside={
          <div className="flex gap-[22px]">
            <Metric label="OPEN PIPELINE" value={inr(openPipeline)} />
            <Metric label="CONVERSION" value="38%" />
            <Metric label="AVG RESPONSE" value="1h 40m" />
          </div>
        }
      />

      <div className="grid grid-cols-5 gap-3 items-start max-lg:grid-cols-2 max-sm:grid-cols-1">
        {leadStages.map((sd) => {
          const items = leads.filter((l) => l.stage === sd.id);
          const value = items.reduce((a, l) => a + l.valuePaise, 0);
          return (
            <div
              key={sd.id}
              onDrop={(e) => {
                e.preventDefault();
                moveTo(sd.id);
              }}
              onDragOver={(e) => e.preventDefault()}
              className="bg-bg border border-border rounded-lg p-2.5 flex flex-col gap-2.5 min-h-[120px]"
            >
              <div className="flex items-center gap-1.5 px-1 py-0.5">
                <span className="w-2 h-2 rounded-sm flex-none" style={{ background: sd.accent }} />
                <span className="text-xs font-semibold flex-1">{sd.label}</span>
                <span className="text-[11px] text-muted-2 font-mono">{items.length}</span>
              </div>
              <div className="text-[11px] text-muted-2 px-1 -mt-1">{inr(value)}</div>
              {items.map((l) => (
                <div
                  key={l.id}
                  draggable
                  onDragStart={() => setDragId(l.id)}
                  className="bg-surface border border-border rounded-[10px] px-3 py-[11px] cursor-grab flex flex-col gap-1.5 hover:border-border-strong hover:shadow-card-hover active:cursor-grabbing"
                >
                  <div className="flex justify-between items-baseline gap-1.5">
                    <span className="text-[13px] font-semibold">{l.name}</span>
                    <span className="text-[12.5px] font-bold tnum">{inr(l.valuePaise)}</span>
                  </div>
                  <div className="text-[11.5px] text-muted">{l.interest}</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9.5px] font-semibold tracking-[0.03em] px-1.5 py-0.5 rounded-[5px] bg-bg text-muted border border-border">
                      {l.source}
                    </span>
                    <span className="text-[11px] text-muted-2">{l.age}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 mt-0.5 pt-[7px] border-t border-border-faint">
                    <span className="text-[11px] text-warning font-medium">{l.followUp}</span>
                    <button
                      onClick={() => showToast(`Calling ${l.name} — ${l.phone}`)}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      Call
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">{label}</div>
      <div className="text-[17px] font-bold tnum">{value}</div>
    </div>
  );
}
