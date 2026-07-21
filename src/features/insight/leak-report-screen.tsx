import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Meter } from "@/components/common/meter";
import { Icon } from "@/components/ui/icon";
import { appointments, patients, recoveryRows } from "@/lib/mock-data";
import { usePlansStore } from "@/features/treatment-plan/use-plans-store";
import { planDeferredPaise } from "@/features/treatment-plan/plans-data";
import { inferFeePaise } from "@/config/procedures";
import { CHAIRS, CLINIC_OPEN, CLINIC_CLOSE, LUNCH_START, LUNCH_END, dayBook } from "@/lib/schedule";
import { inr } from "@/lib/format";
import { chartGreens } from "@/design/status";
import { cn } from "@/lib/utils";

/*
 * The leak report.
 *
 * Every practice-management system in the category reports what the clinic
 * *earned*. Almost none report the gap between what it earned and what it could
 * have earned with the same chairs, the same staff and the same patients — and
 * that gap is the entire commercial argument for the software.
 *
 * Four components, one figure:
 *
 *   Diagnosed, never scheduled — work the dentist advised and nobody booked.
 *   Chairs sitting idle        — hours that were available and went unsold.
 *   Appointments not kept      — no-shows and late cancellations.
 *   Money never collected      — treatment delivered and not paid for.
 *
 * It is confronting on purpose, and it is correct on purpose. A number that
 * flatters the practice is worth nothing to them; this one is the reason they
 * renew. Every component ends in the screen that fixes it, because a leak you
 * can only look at is just bad news.
 *
 * WORKING DAYS: the monthly figures below extrapolate from one day's book, so
 * they are directional rather than audited. When the API lands these come from
 * the event log, which already records everything needed.
 */

const WORKING_DAYS_PER_MONTH = 26;

interface Leak {
  id: string;
  label: string;
  paise: number;
  /** What this is, in one sentence. */
  what: string;
  /** Why it happens — the honest version, not a scolding. */
  why: string;
  /** What to do about it, and where. */
  action: string;
  to: string;
  colour: string;
  /** Share of this that is realistically recoverable, 0–1. */
  recoverable: number;
}

export function LeakReportScreen() {
  const navigate = useNavigate();
  const plans = usePlansStore((s) => s.plans);

  const leaks = useMemo<Leak[]>(() => {
    // ---- 1. Diagnosed, never scheduled ------------------------------------
    const unscheduled =
      recoveryRows.filter((r) => !r.declined).reduce((s, r) => s + r.valuePaise, 0) +
      plans.reduce((s, p) => s + planDeferredPaise(p), 0);

    // ---- 2. Idle chair time -----------------------------------------------
    const book = dayBook(0);
    const openHours = CLINIC_CLOSE - CLINIC_OPEN - (LUNCH_END - LUNCH_START);
    const availableHours = openHours * CHAIRS.length;
    const bookedHours = book.reduce((s, b) => s + b.dur, 0);
    const idleHours = Math.max(0, availableHours - bookedHours);

    // What an hour of chair time is actually worth here, from today's own book.
    const bookedValue = book.reduce((s, b) => s + inferFeePaise(b.proc), 0);
    const perChairHour = bookedHours > 0 ? bookedValue / bookedHours : 0;
    const idleMonth = Math.round(idleHours * perChairHour * WORKING_DAYS_PER_MONTH);

    // ---- 3. Appointments not kept -----------------------------------------
    const noShows = appointments.filter((a) => ["no_show", "cancelled"].includes(a.status));
    const noShowValueToday = noShows.reduce((s, a) => s + inferFeePaise(a.proc), 0);
    const noShowMonth = noShowValueToday * WORKING_DAYS_PER_MONTH;

    // ---- 4. Uncollected ----------------------------------------------------
    const uncollected = patients.reduce((s, p) => s + p.balancePaise, 0);

    return [
      {
        id: "unscheduled",
        label: "Diagnosed, never scheduled",
        paise: unscheduled,
        what: "Treatment a dentist here examined, advised and priced — that nobody has booked.",
        why: "Almost never a clinical objection. Patients defer on cost, timing or nerves, say they'll call back, and then life happens. Nobody in the clinic owns the follow-up.",
        action: "Work the recovery queue",
        to: "/app/revenue/unscheduled",
        colour: chartGreens[0],
        recoverable: 0.35,
      },
      {
        id: "idle",
        label: "Chairs sitting idle",
        paise: idleMonth,
        what: `${idleHours.toFixed(1)} chair-hours went unsold today, across ${CHAIRS.length} chairs.`,
        why: "Gaps appear when something cancels or a procedure runs short, and by the time anyone notices, the hour has passed. Nobody can fill a gap they aren't told about.",
        action: "See today's gaps",
        to: "/app",
        colour: chartGreens[1],
        recoverable: 0.3,
      },
      {
        id: "noshow",
        label: "Appointments not kept",
        paise: noShowMonth,
        what: "No-shows and same-day cancellations, at the value of the work that was booked.",
        why: "Overwhelmingly a reminder problem rather than a respect problem. Patients who confirm by WhatsApp turn up; patients who were never asked to confirm often don't.",
        action: "Check today's unconfirmed",
        to: "/app",
        colour: chartGreens[2],
        recoverable: 0.5,
      },
      {
        id: "uncollected",
        label: "Money never collected",
        paise: uncollected,
        what: "Treatment delivered, invoiced and still unpaid.",
        why: "Usually because the balance wasn't visible at the desk while the patient was standing there. Once they've walked out it becomes a phone call, and phone calls about money get postponed.",
        action: "Open the ageing list",
        to: "/app/revenue/pending-payments",
        colour: chartGreens[3],
        recoverable: 0.6,
      },
    ];
  }, [plans]);

  const total = leaks.reduce((s, l) => s + l.paise, 0);
  const recoverable = leaks.reduce((s, l) => s + l.paise * l.recoverable, 0);
  const ranked = useMemo(() => [...leaks].sort((a, b) => b.paise - a.paise), [leaks]);
  const topTwo = ranked[0].paise + (ranked[1]?.paise ?? 0);

  return (
    <div className="max-w-[1000px] mx-auto flex flex-col gap-3.5">
      <PageHeader
        title="The leak report"
        subtitle="The gap between what this practice earned and what the same chairs, staff and patients could have earned."
      />

      {/* The figure */}
      <section
        className="rounded-lg p-5 flex flex-col gap-4"
        style={{ background: "var(--warning-panel)", border: "1px solid var(--warning-border)" }}
      >
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-warning flex-none" />
              <span className="text-[11px] font-bold tracking-[0.09em] text-warning">
                LEAKING, PER MONTH
              </span>
            </div>
            <div className="text-[42px] font-bold tnum tracking-[-0.03em] leading-none">
              {inr(total)}
            </div>
            <div className="text-[13px] text-muted max-w-[520px] leading-relaxed mt-1">
              Not lost to competitors and not a pricing problem. This is work already diagnosed,
              chairs already paid for, and patients already through the door.
            </div>
          </div>

          <div className="flex flex-col gap-1 items-end">
            <span className="text-[11px] font-bold tracking-[0.08em] text-muted-2">
              REALISTICALLY RECOVERABLE
            </span>
            <span className="text-[26px] font-bold tnum tracking-[-0.02em] text-primary">
              {inr(Math.round(recoverable))}
            </span>
            <span className="text-[11.5px] text-muted-2">
              on conservative assumptions, per component
            </span>
          </div>
        </div>

        {/* Proportions — the shape matters as much as the total. */}
        <div className="flex flex-col gap-2">
          <div className="flex h-3 rounded-[5px] overflow-hidden gap-0.5">
            {leaks.map((l) => (
              <div
                key={l.id}
                title={`${l.label} — ${inr(l.paise)}`}
                style={{ width: `${total ? (l.paise / total) * 100 : 0}%`, background: l.colour }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {leaks.map((l) => (
              <span key={l.id} className="flex items-center gap-1.5 text-[11.5px]">
                <span
                  className="w-[9px] h-[9px] rounded-[3px] flex-none"
                  style={{ background: l.colour }}
                />
                <span className="text-muted">{l.label}</span>
                <span className="tnum font-semibold">
                  {total ? Math.round((l.paise / total) * 100) : 0}%
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* The four components */}
      <div className="flex flex-col gap-3">
        {ranked.map((l, i) => (
          <LeakCard key={l.id} leak={l} rank={i + 1} total={total} onGo={() => navigate(l.to)} />
        ))}
      </div>

      {/* The argument, stated plainly */}
      <Panel className="px-5 py-4 flex flex-col gap-2">
        <MicroLabel>What this is for</MicroLabel>
        <p className="m-0 text-[13px] text-muted-strong leading-relaxed max-w-[720px]">
          Every figure above is recoverable without a single new patient, a single rupee of
          advertising, or a change to your prices. Halving the two largest components would be worth{" "}
          <b className="text-ink tnum">
            {inr(Math.round(topTwo / 2))}
          </b>{" "}
          a month — which is the sort of number that changes what a practice can afford to do next.
        </p>
        <p className="m-0 text-[12px] text-muted-2 leading-relaxed max-w-[720px]">
          Monthly figures extrapolate from the current book across{" "}
          {WORKING_DAYS_PER_MONTH} working days, so treat them as directional. The recoverable share
          is a conservative assumption per component, not a forecast.
        </p>
      </Panel>
    </div>
  );
}

/** Rough relative luminance — enough to pick black or white text over a swatch. */
function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

function LeakCard({
  leak,
  rank,
  total,
  onGo,
}: {
  leak: Leak;
  rank: number;
  total: number;
  onGo: () => void;
}) {
  const share = total ? Math.round((leak.paise / total) * 100) : 0;

  return (
    <Panel className="px-5 py-4 flex flex-col gap-3">
      <div className="flex items-start gap-3.5">
        {/* Light swatches need dark digits — contrast, not aesthetics. */}
        <span
          className="w-[26px] h-[26px] rounded-[8px] grid place-items-center text-[12px] font-bold flex-none mt-0.5"
          style={{ background: leak.colour, color: isLight(leak.colour) ? "var(--ink)" : "var(--on-primary)" }}
        >
          {rank}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <span className="text-[15px] font-semibold">{leak.label}</span>
            <span className="text-[22px] font-bold tnum tracking-[-0.02em]">{inr(leak.paise)}</span>
          </div>
          <div className="text-[12.5px] text-muted mt-0.5">{leak.what}</div>
        </div>
      </div>

      <Meter value={share} height={5} />

      <div className="grid grid-cols-[1fr_auto] gap-4 items-end max-md:grid-cols-1">
        <div className="flex flex-col gap-1">
          <span className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">
            WHY IT HAPPENS
          </span>
          <p className="m-0 text-[12.5px] text-muted-strong leading-relaxed max-w-[560px]">
            {leak.why}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[11.5px] text-muted-2">
            <b className="text-primary tnum">{inr(Math.round(leak.paise * leak.recoverable))}</b>{" "}
            recoverable
          </span>
          <button
            onClick={onGo}
            className={cn(
              "inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3.5 py-2 rounded-md",
              "bg-primary text-on-primary hover:bg-primary-hover whitespace-nowrap",
            )}
          >
            {leak.action}
            <Icon name="arrowRight" size={13} />
          </button>
        </div>
      </div>
    </Panel>
  );
}
