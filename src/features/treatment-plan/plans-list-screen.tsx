import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import {
  treatmentPlans,
  planNet,
  PLAN_STATUS_META,
  type PlanStatus,
  type TreatmentPlan,
} from "./plans-data";

/*
 * Treatment plans (Console) — the staff worklist of plans across every
 * acceptance state. Each row opens the builder and offers "Present to patient",
 * which is the moment a plan turns into accepted revenue. Undesigned in the
 * Claude project, so it's built from the console's own table + panel system.
 */

const FILTERS: { key: PlanStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "presented", label: "Presented" },
  { key: "accepted", label: "Accepted" },
  { key: "partial", label: "Partly accepted" },
  { key: "declined", label: "Declined" },
];

function StatusBadge({ status }: { status: PlanStatus }) {
  const s = PLAN_STATUS_META[status];
  return (
    <span className="text-[10.5px] font-bold px-2 py-[3px] rounded-[5px] border whitespace-nowrap" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {s.label}
    </span>
  );
}

export function PlansListScreen() {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const [filter, setFilter] = useState<PlanStatus | "all">("all");

  const rows = useMemo(
    () => treatmentPlans.filter((p) => filter === "all" || p.status === filter),
    [filter],
  );

  const stats = useMemo(() => {
    const presented = treatmentPlans.filter((p) => p.status === "presented");
    const presentedValue = presented.reduce((s, p) => s + planNet(p), 0);
    const acceptedValue = treatmentPlans.filter((p) => p.status === "accepted").reduce((s, p) => s + planNet(p), 0);
    const decided = treatmentPlans.filter((p) => ["accepted", "partial", "declined"].includes(p.status));
    const won = treatmentPlans.filter((p) => ["accepted", "partial"].includes(p.status));
    const rate = decided.length ? Math.round((won.length / decided.length) * 100) : 0;
    return { awaiting: presented.length, presentedValue, acceptedValue, rate };
  }, []);

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader
        title="Treatment plans"
        subtitle={`${treatmentPlans.length} plans across every acceptance state`}
        aside={<Button variant="primary" onClick={() => showToast("New plan — the builder opens with an empty plan")}>＋ New plan</Button>}
      />

      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <StatTile label="Awaiting decision" value={String(stats.awaiting)} sub={`${inr(stats.presentedValue)} presented`} accent="#8A6B33" />
        <StatTile label="Accepted value" value={inr(stats.acceptedValue)} sub="on the books" accent="#20614E" />
        <StatTile label="Acceptance rate" value={`${stats.rate}%`} sub="of decided plans" accent="#20614E" />
        <StatTile label="In draft" value={String(treatmentPlans.filter((p) => p.status === "draft").length)} sub="not yet presented" accent="#6E6C64" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const sel = filter === f.key;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-md border transition-colors"
              style={{ background: sel ? "#20614E" : "var(--surface)", color: sel ? "#F7F6F3" : "var(--muted-strong)", borderColor: sel ? "#20614E" : "var(--border)" }}>
              {f.label}
            </button>
          );
        })}
      </div>

      <Panel className="overflow-hidden">
        <div className="grid items-center gap-3 px-4 py-2.5 border-b border-border bg-bg-content" style={{ gridTemplateColumns: "1.5fr 2fr 0.9fr 1fr 1.2fr" }}>
          {["PATIENT", "PLAN", "STATUS", "VALUE", ""].map((h) => (
            <MicroLabel key={h} className={h === "VALUE" ? "text-right" : ""}>{h}</MicroLabel>
          ))}
        </div>
        {rows.map((p) => (
          <PlanRow key={p.id} plan={p} onOpen={() => navigate(`/app/treatment-plans/${p.id}`)} onPresent={() => window.open(`/plan/${p.id}`, "_blank")} />
        ))}
        {!rows.length && <div className="px-4 py-10 text-center text-[12.5px] text-muted-2">No plans in this state.</div>}
        <div className="px-4 py-2 text-[11.5px] text-muted-2 border-t border-border-faint">Showing {rows.length} of {treatmentPlans.length}</div>
      </Panel>
    </div>
  );
}

function PlanRow({ plan, onOpen, onPresent }: { plan: TreatmentPlan; onOpen: () => void; onPresent: () => void }) {
  const stageCount = plan.stages.length;
  const itemCount = plan.stages.reduce((s, st) => s + st.items.length, 0);
  return (
    <div
      onClick={onOpen}
      className="grid items-center gap-3 px-4 py-3 border-b border-border-faint cursor-pointer hover:bg-bg-content transition-colors"
      style={{ gridTemplateColumns: "1.5fr 2fr 0.9fr 1fr 1.2fr" }}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-semibold truncate">{plan.patient}</div>
        <div className="text-[11px] text-muted-2 font-mono">{plan.doctor} · {plan.updated}</div>
      </div>
      <div className="min-w-0">
        <div className="text-[12.5px] truncate">{plan.title}</div>
        <div className="text-[11px] text-muted-2">{stageCount} stages · {itemCount} items{plan.discountPct ? ` · ${plan.discountPct}% off` : ""}</div>
      </div>
      <div><StatusBadge status={plan.status} /></div>
      <div className="text-right text-[13px] font-semibold tnum">{inr(planNet(plan))}</div>
      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="secondary" onClick={onOpen}>Open</Button>
        <Button size="sm" variant="tint" onClick={onPresent}>Present ↗</Button>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <Panel className="px-4 py-3">
      <MicroLabel>{label}</MicroLabel>
      <div className="text-[20px] font-bold tnum mt-1 tracking-[-0.02em]" style={{ color: accent }}>{value}</div>
      <div className="text-[11.5px] text-muted mt-0.5">{sub}</div>
    </Panel>
  );
}
