import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/common/meter";
import { Icon } from "@/components/ui/icon";
import { inr } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import { useSession } from "@/hooks/use-session";
import { usePlansStore } from "@/features/treatment-plan/use-plans-store";
import {
  buildNarrative,
  utilisationHeatmap,
  doctorPerformance,
  cohortRetention,
  WEEKDAYS,
  HEAT_HOURS,
  COHORT_CHECKPOINTS,
  type Fragment,
  type Insight,
  type Tone,
} from "./narrative";
import { cn } from "@/lib/utils";

/*
 * Insight.
 *
 * Five sentences, then the three views that actually change decisions — where
 * the week is empty, which doctor is producing and converting, and whether
 * patients come back. Everything else is detail, and detail lives below the
 * fold behind a report picker.
 *
 * An associate sees only their own row in the doctor table. Associates who can
 * see their own numbers behave differently and revenue-share settlements stop
 * being contentious; associates who can see everyone's numbers start comparing,
 * which is a different and worse dynamic.
 */

const TONE_COLOUR: Record<Tone, string> = {
  good: "var(--primary)",
  watch: "var(--warning)",
  bad: "var(--danger)",
  neutral: "var(--ink)",
};

export function AnalyticsScreen() {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const { user } = useSession();
  const plans = usePlansStore((s) => s.plans);

  const narrative = useMemo(() => buildNarrative(plans), [plans]);
  const heat = useMemo(() => utilisationHeatmap(), []);
  const doctors = useMemo(() => doctorPerformance(plans), [plans]);
  const cohorts = useMemo(() => cohortRetention(), []);

  const isOwner = user.role === "owner" || user.role === "admin";
  const visibleDoctors = isOwner
    ? doctors
    : doctors.filter((d) => d.name === user.doctorName);

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-3.5">
      <PageHeader
        title="Insight"
        subtitle="Where the practice stands, and what to do about it on Monday."
        aside={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/app/insight/dashboard")}>
              Charts
            </Button>
            <Button variant="secondary" onClick={() => navigate("/app/insight/leak")}>
              The leak report →
            </Button>
          </div>
        }
      />

      {/* ---------------------------------------------------------------- */}
      {/* Five sentences                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Panel className="px-5 py-4 flex flex-col">
        <MicroLabel className="mb-3">This month, in five lines</MicroLabel>
        {narrative.map((insight, i) => (
          <InsightLine
            key={insight.id}
            insight={insight}
            last={i === narrative.length - 1}
            onGo={() => navigate(insight.action.to)}
          />
        ))}
      </Panel>

      {/* ---------------------------------------------------------------- */}
      {/* Chair utilisation heatmap                                         */}
      {/* ---------------------------------------------------------------- */}
      <Panel className="px-5 py-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <MicroLabel>Chair utilisation</MicroLabel>
            <div className="text-[12px] text-muted mt-0.5">
              The shape of the week. Darker is busier.
            </div>
          </div>
          <button
            onClick={() =>
              showToast("Targeted recall drafted for patients who historically book Tuesdays")
            }
            className="text-[12px] font-semibold text-primary"
          >
            Run a recall for the empty window →
          </button>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[520px]">
            {/* Hour axis */}
            <div className="flex gap-[3px] pl-[42px] mb-1">
              {HEAT_HOURS.map((h) => (
                <div key={h} className="flex-1 text-center text-[9.5px] font-mono text-muted-2">
                  {h > 12 ? h - 12 : h}
                </div>
              ))}
            </div>

            {WEEKDAYS.map((day, di) => (
              <div key={day} className="flex items-center gap-[3px] mb-[3px]">
                <div className="w-[38px] text-[11px] font-semibold text-muted text-right pr-1 flex-none">
                  {day}
                </div>
                {heat[di].map((v, hi) => (
                  <div
                    key={hi}
                    title={`${day} ${HEAT_HOURS[hi]}:00 — ${v === 0 ? "closed" : `${v}% booked`}`}
                    className="flex-1 h-[26px] rounded-[3px] grid place-items-center"
                    style={{ background: heatColour(v) }}
                  >
                    {v > 0 && v < 40 && (
                      <span className="text-[8.5px] font-bold text-warning">{v}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10.5px] text-muted-2">
          <span>Empty</span>
          {[10, 30, 50, 70, 90].map((v) => (
            <span
              key={v}
              className="w-5 h-3 rounded-[2px]"
              style={{ background: heatColour(v) }}
            />
          ))}
          <span>Full</span>
          <span className="ml-2">· lunch is closed and shown white</span>
        </div>
      </Panel>

      {/* ---------------------------------------------------------------- */}
      {/* Doctors                                                           */}
      {/* ---------------------------------------------------------------- */}
      <Panel className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-bg-content flex items-baseline justify-between gap-3">
          <div>
            <MicroLabel>Per doctor</MicroLabel>
            <div className="text-[12px] text-muted mt-0.5">
              {isOwner
                ? "Production, conversion and rework. Visible to you; each associate sees only their own row."
                : "Your own numbers. The owner sees the full table."}
            </div>
          </div>
          <span className="text-[11px] text-muted-2">Monthly, estimated from the current book</span>
        </div>

        <div
          className="grid gap-3 px-5 py-2.5 border-b border-border text-[10.5px] font-bold tracking-[0.06em] text-muted-2"
          style={{ gridTemplateColumns: "1.4fr 1fr 0.8fr 1.1fr 0.9fr" }}
        >
          <span>DOCTOR</span>
          <span className="text-right">PRODUCTION</span>
          <span className="text-right">VISITS</span>
          <span>ACCEPTANCE</span>
          <span className="text-right">REWORK</span>
        </div>

        {visibleDoctors.map((d) => (
          <div
            key={d.name}
            className="grid gap-3 items-center px-5 py-3 border-b border-border-faint text-[12.5px]"
            style={{ gridTemplateColumns: "1.4fr 1fr 0.8fr 1.1fr 0.9fr" }}
          >
            <span className="font-semibold">{d.name}</span>
            <span className="text-right font-semibold tnum">{inr(d.producedPaise)}</span>
            <span className="text-right text-muted tnum">{d.visits}</span>
            <span className="flex items-center gap-2">
              <Meter value={d.acceptancePct} height={5} className="flex-1" />
              <span className="tnum text-[11.5px] w-[34px] text-right">{d.acceptancePct}%</span>
            </span>
            <span
              className="text-right tnum font-semibold"
              style={{ color: d.reworkPct > 4 ? "var(--warning)" : "var(--muted)" }}
            >
              {d.reworkPct}%
            </span>
          </div>
        ))}

        {visibleDoctors.length === 0 && (
          <div className="px-5 py-6 text-center text-[12.5px] text-muted">
            You don't have a chair list yet, so there's nothing to report here.
          </div>
        )}
      </Panel>

      {/* ---------------------------------------------------------------- */}
      {/* Cohort retention                                                  */}
      {/* ---------------------------------------------------------------- */}
      <Panel className="px-5 py-4 flex flex-col gap-3">
        <div>
          <MicroLabel>Do they come back?</MicroLabel>
          <div className="text-[12px] text-muted mt-0.5 max-w-[640px] leading-relaxed">
            Of the patients first seen in each quarter, how many are still active. Most owners have
            never seen this number for their own practice — and it's the difference between "we need
            more advertising" and "we need a recall system", which cost very different amounts.
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[520px]">
            <div
              className="grid gap-2 mb-1.5 text-[10px] font-bold tracking-[0.05em] text-muted-2"
              style={{ gridTemplateColumns: `88px 56px repeat(${COHORT_CHECKPOINTS.length}, 1fr)` }}
            >
              <span>COHORT</span>
              <span className="text-right">SIZE</span>
              {COHORT_CHECKPOINTS.map((c) => (
                <span key={c} className="text-center">
                  {c.toUpperCase()}
                </span>
              ))}
            </div>

            {cohorts.map((c) => (
              <div
                key={c.label}
                className="grid gap-2 items-center mb-1"
                style={{ gridTemplateColumns: `88px 56px repeat(${COHORT_CHECKPOINTS.length}, 1fr)` }}
              >
                <span className="text-[12px] font-semibold">{c.label}</span>
                <span className="text-[11.5px] text-muted tnum text-right">{c.size}</span>
                {c.retention.map((v, i) => (
                  <div
                    key={i}
                    className="h-[26px] rounded-[3px] grid place-items-center text-[10.5px] font-semibold tnum"
                    style={{
                      background: v < 0 ? "var(--track)" : retentionColour(v),
                      color: v < 0 ? "var(--muted-3)" : v > 55 ? "var(--on-primary)" : "var(--ink)",
                    }}
                  >
                    {v < 0 ? "—" : `${v}%`}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="text-[11.5px] text-muted leading-relaxed">
          Retention at twelve months has improved from{" "}
          <b className="text-ink tnum">{cohorts[0].retention[3]}%</b> to{" "}
          <b className="text-primary tnum">{cohorts[2].retention[3]}%</b> across the year. Blank
          cells are cohorts too new to have reached that checkpoint.
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------

function InsightLine({
  insight,
  last,
  onGo,
}: {
  insight: Insight;
  last: boolean;
  onGo: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("py-3", !last && "border-b border-border-faint")}>
      <div className="flex items-start gap-3">
        <span
          className="w-[7px] h-[7px] rounded-full mt-[7px] flex-none"
          style={{ background: TONE_COLOUR[insight.tone] }}
        />

        <div className="min-w-0 flex-1">
          <button onClick={() => setOpen((o) => !o)} className="text-left">
            <p className="m-0 text-[15px] leading-relaxed text-ink">
              {insight.fragments.map((f, i) => renderFragment(f, i))}
            </p>
          </button>

          {open && (
            <div className="text-[12px] text-muted leading-relaxed mt-1.5 animate-dc-row max-w-[620px]">
              {insight.detail}
            </div>
          )}
        </div>

        {/* Every number ends in an action. */}
        <button
          onClick={onGo}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary whitespace-nowrap shrink-0 mt-0.5 hover:text-primary-hover"
        >
          {insight.action.label}
          <Icon name="arrowRight" size={12} />
        </button>
      </div>
    </div>
  );
}

function renderFragment(f: Fragment, key: number) {
  if (typeof f === "string") return <span key={key}>{f}</span>;
  return (
    <b key={key} className="font-semibold tnum" style={{ color: TONE_COLOUR[f.tone ?? "neutral"] }}>
      {f.value}
    </b>
  );
}

/** Warm paper → clinical green. Empty cells read amber so they draw the eye. */
function heatColour(v: number): string {
  if (v === 0) return "#FFFFFF";
  if (v < 25) return "#FAF3E7";
  if (v < 40) return "#F3EEDF";
  if (v < 55) return "#DCE7E1";
  if (v < 70) return "#B9D0C6";
  if (v < 85) return "#7FAA99";
  return "#20614E";
}

function retentionColour(v: number): string {
  if (v >= 75) return "#20614E";
  if (v >= 55) return "#4E8A75";
  if (v >= 40) return "#8FB5A6";
  if (v >= 25) return "#CBDDD5";
  return "#F0EBE0";
}
