import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { inr } from "@/lib/format";
import { usePlansStore } from "./use-plans-store";
import {
  PLAN_STATUS_META,
  allItems,
  deriveStatus,
  planNetPaise,
  planSelectedPaise,
  planDeferredPaise,
  type PlanStatus,
  type TreatmentPlan,
} from "./plans-data";

/*
 * The plans worklist.
 *
 * Two columns here do work the old version couldn't: **decided** shows how much
 * of each plan the patient actually took, and **engagement** shows what they did
 * with the link. Between them they answer the only question this screen exists
 * to answer — which of these is worth a phone call this afternoon.
 */

const FILTERS: { key: PlanStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "presented", label: "Awaiting a decision" },
  { key: "accepted", label: "Accepted" },
  { key: "partial", label: "Partly accepted" },
  { key: "declined", label: "Declined" },
];

const GRID = "1.3fr 1.8fr 0.9fr 1.15fr 1.3fr 1fr";

export function PlansListScreen() {
  const navigate = useNavigate();
  const plans = usePlansStore((s) => s.plans);
  const [filter, setFilter] = useState<PlanStatus | "all">("all");

  const rows = useMemo(
    () => plans.filter((p) => filter === "all" || deriveStatus(p) === filter),
    [plans, filter],
  );

  const stats = useMemo(() => {
    const awaiting = plans.filter((p) => deriveStatus(p) === "presented");
    const awaitingValue = awaiting.reduce((s, p) => s + planNetPaise(p), 0);
    const acceptedValue = plans
      .filter((p) => ["accepted", "partial"].includes(deriveStatus(p)))
      .reduce((s, p) => s + planSelectedPaise(p), 0);
    const deferredValue = plans.reduce((s, p) => s + planDeferredPaise(p), 0);

    /*
     * Acceptance by *value*, not by count — a practice that accepts nine ₹2,000
     * fillings and declines one ₹2L rehab has a 90% acceptance rate and a
     * problem.
     */
    const decided = plans.filter((p) => ["accepted", "partial", "declined"].includes(deriveStatus(p)));
    const decidedTotal = decided.reduce((s, p) => s + planNetPaise(p), 0);
    const decidedWon = decided.reduce((s, p) => s + planSelectedPaise(p), 0);
    const rate = decidedTotal ? Math.round((decidedWon / decidedTotal) * 100) : 0;

    return { awaiting: awaiting.length, awaitingValue, acceptedValue, deferredValue, rate };
  }, [plans]);

  return (
    <div className="max-w-[1320px] mx-auto flex flex-col gap-3.5">
      <PageHeader
        title="Treatment plans"
        subtitle={`${plans.length} plans · ${inr(stats.deferredValue)} sitting deferred`}
        aside={
          <Button variant="primary" onClick={() => navigate("/app/treatment-plans/tp3")}>
            ＋ New plan
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <StatTile
          label="Awaiting a decision"
          value={String(stats.awaiting)}
          sub={`${inr(stats.awaitingValue)} presented`}
          accent="#8A6B33"
        />
        <StatTile label="Accepted value" value={inr(stats.acceptedValue)} sub="on the books" accent="#20614E" />
        <StatTile
          label="Acceptance by value"
          value={`${stats.rate}%`}
          sub="not by count — count flatters"
          accent="#20614E"
        />
        <StatTile
          label="Deferred"
          value={inr(stats.deferredValue)}
          sub="feeds the recovery queue"
          accent="#8A6B33"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const sel = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-md border transition-colors"
              style={{
                background: sel ? "#20614E" : "var(--surface)",
                color: sel ? "#F7F6F3" : "var(--muted-strong)",
                borderColor: sel ? "#20614E" : "var(--border)",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <Panel className="overflow-hidden">
        <div
          className="grid items-center gap-3 px-4 py-2.5 border-b border-border bg-bg-content"
          style={{ gridTemplateColumns: GRID }}
        >
          {["PATIENT", "PLAN", "STATUS", "DECIDED", "ENGAGEMENT", ""].map((h) => (
            <MicroLabel key={h}>{h}</MicroLabel>
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No plans in this state"
            body="Nothing here right now. The plans awaiting a decision are the ones worth a call."
            cta="Show all plans"
            onCta={() => setFilter("all")}
          />
        ) : (
          rows.map((p) => (
            <PlanRow
              key={p.id}
              plan={p}
              onOpen={() => navigate(`/app/treatment-plans/${p.id}`)}
              onPresent={() => window.open(`/plan/${p.id}`, "_blank")}
            />
          ))
        )}

        <div className="px-4 py-2 text-[11.5px] text-muted-2 border-t border-border-faint">
          Showing {rows.length} of {plans.length}
        </div>
      </Panel>
    </div>
  );
}

function PlanRow({
  plan,
  onOpen,
  onPresent,
}: {
  plan: TreatmentPlan;
  onOpen: () => void;
  onPresent: () => void;
}) {
  const status = deriveStatus(plan);
  const meta = PLAN_STATUS_META[status];
  const items = allItems(plan);
  const deferred = items.filter((i) => i.decision === "deferred").length;
  const net = planNetPaise(plan);
  const taken = planSelectedPaise(plan);
  const e = plan.engagement;

  return (
    <div
      data-row
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(ev) => {
        if (ev.key === "Enter") onOpen();
      }}
      className="grid items-center gap-3 px-4 py-3 border-b border-border-faint cursor-pointer hover:bg-bg-content transition-colors outline-none"
      style={{ gridTemplateColumns: GRID }}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-semibold truncate">{plan.patient}</div>
        <div className="text-[11px] text-muted-2 font-mono">
          {plan.doctor} · {plan.updated}
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-[12.5px] truncate">{plan.title}</div>
        <div className="text-[11px] text-muted-2">
          {plan.phases.length} phases · {items.length} items
          {plan.discountPct ? ` · ${plan.discountPct}% off` : ""}
        </div>
      </div>

      <div>
        <span
          className="text-[10.5px] font-bold px-2 py-[3px] rounded-[5px] border whitespace-nowrap"
          style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
        >
          {meta.label}
        </span>
      </div>

      <div className="min-w-0">
        <div className="text-[13px] font-semibold tnum">{inr(taken)}</div>
        {deferred > 0 ? (
          <div className="text-[11px] text-warning tnum">
            {deferred} of {items.length} deferred · {inr(net - taken)}
          </div>
        ) : (
          <div className="text-[11px] text-muted-2 tnum">of {inr(net)}</div>
        )}
      </div>

      {/* What the link told us — the reason to call, or not to. */}
      <div className="min-w-0">
        {!e.sentOn ? (
          <span className="text-[11.5px] text-muted-2">Not sent</span>
        ) : e.opens === 0 ? (
          <span className="text-[11.5px] text-danger-text">Sent, never opened</span>
        ) : (
          <>
            <div className="text-[11.5px]">
              Opened <b className="tnum">{e.opens}×</b>
              {e.forwarded && <span className="text-primary"> · forwarded</span>}
            </div>
            <div className="text-[11px] text-muted-2 truncate">last {e.lastOpenedOn}</div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-1.5" onClick={(ev) => ev.stopPropagation()}>
        <Button size="sm" variant="secondary" onClick={onOpen}>
          Open
        </Button>
        <Button size="sm" variant="tint" onClick={onPresent}>
          View ↗
        </Button>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <Panel className="px-4 py-3">
      <MicroLabel>{label}</MicroLabel>
      <div className="text-[20px] font-bold tnum mt-1 tracking-[-0.02em]" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-[11.5px] text-muted mt-0.5">{sub}</div>
    </Panel>
  );
}
