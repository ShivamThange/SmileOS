import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Panel } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Meter } from "@/components/common/meter";
import { MedicalAlertBadge } from "@/components/common/medical-alert-badge";
import { useSession } from "@/hooks/use-session";
import { useUIStore } from "@/hooks/use-ui-store";
import { useClinicNow, minutesSince, isRunningNow } from "@/hooks/use-clinic-now";
import { appointments, patients, recoveryRows } from "@/lib/mock-data";
import { TODAY_LABEL } from "@/config/clinic";
import { inferFeePaise } from "@/config/procedures";
import { fmtHour, inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types";

/*
 * The clinician's root.
 *
 * A dentist has between four and eleven minutes between chairs, and in that
 * window she wants three things: who is next, what is still unwritten, and
 * whether the practice is growing. Nothing else earns the space.
 *
 * The owner sees the same screen with one extra line — a link to the financial
 * dashboard, which is a destination she visits twice a week rather than the
 * door she comes through every morning.
 */

export function ClinicalDayScreen() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { openPatientPreview } = useUIStore();
  const now = useClinicNow();

  const mine = useMemo(() => {
    const list = appointments
      .filter((a) => a.status !== "cancelled")
      .filter((a) => (user.doctorName ? a.doctor === user.doctorName : true))
      .sort((a, b) => a.start - b.start);
    return list;
  }, [user.doctorName]);

  const inChair = mine.find((a) => a.status === "in_progress" || isRunningNow(a.start, a.dur, now));
  const next = mine.find((a) => a.start > now && a.status !== "completed");
  const doneToday = mine.filter((a) => a.status === "completed");
  const remaining = mine.filter((a) => a.status !== "completed" && a.id !== inChair?.id);

  const producedPaise = doneToday.reduce((s, a) => s + inferFeePaise(a.proc), 0);
  const scheduledPaise = mine.reduce((s, a) => s + inferFeePaise(a.proc), 0);

  /*
   * Notes outstanding — a finished appointment with nothing written against it.
   * The mock data has no notes model yet, so this stands in with a stable rule:
   * anything finished more than half an hour ago is assumed unwritten.
   */
  const notesOutstanding = doneToday.filter((a) => minutesSince(a.start + a.dur, now) > 30);

  /* This doctor's deferred treatment — the cases that didn't get accepted. */
  const myDeferred = recoveryRows.filter((r) => (user.doctorName ? r.doctor === user.doctorName : true));
  const deferredPaise = myDeferred.reduce((s, r) => s + r.valuePaise, 0);

  const acceptancePct = 61; // placeholder until plans carry accept/defer state

  return (
    <div className="max-w-[860px] mx-auto flex flex-col gap-3.5">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="m-0 text-lg font-semibold tracking-[-0.01em]">
            {greeting(now)}, {user.shortName}
          </h1>
          <div className="text-[12.5px] text-muted mt-0.5">
            {mine.length} in your chair today · {doneToday.length} done
          </div>
        </div>
        <span className="text-[11.5px] text-muted-2">{TODAY_LABEL}</span>
      </header>

      {/* Now and next — the only two patients that matter in this minute. */}
      <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
        <FocusCard
          label="IN THE CHAIR"
          appt={inChair}
          now={now}
          tone="primary"
          emptyText="Chair's empty."
          onOpen={openPatientPreview}
        />
        <FocusCard
          label="NEXT"
          appt={next}
          now={now}
          tone="plain"
          emptyText="Nothing more booked today."
          onOpen={openPatientPreview}
        />
      </div>

      {/* Notes outstanding — surfaced before the day ends, not after. */}
      <Panel className="px-4 py-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold">Clinical notes outstanding</span>
          <span className="text-[11px] font-bold tnum text-muted-2">{notesOutstanding.length}</span>
          <div className="flex-1" />
          <button
            onClick={() => navigate("/app/clinical/queue")}
            className="text-[12px] font-semibold text-primary"
          >
            Clinical queue →
          </button>
        </div>

        {notesOutstanding.length === 0 ? (
          <div className="py-2 text-[12.5px] font-semibold text-primary">
            ✓ Everything's written up
          </div>
        ) : (
          notesOutstanding.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate("/app/clinical/queue")}
              className="grid items-center gap-2.5 py-1.5 text-left border-b border-border-faint last:border-b-0 grid-cols-[46px_minmax(0,1fr)_auto]"
            >
              <span className="font-mono text-[11.5px] text-muted text-right">
                {fmtHour(a.start)}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold truncate">{a.name}</span>
                <span className="block text-[11.5px] text-muted-2 truncate">{a.proc}</span>
              </span>
              <span className="text-[11.5px] font-semibold text-warning">Write up →</span>
            </button>
          ))
        )}
      </Panel>

      {/* The rest of the day */}
      <Panel className="px-4 py-3 flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[13px] font-semibold">Rest of the day</span>
          <span className="text-[11px] font-bold tnum text-muted-2">{remaining.length}</span>
          <div className="flex-1" />
          <button
            onClick={() => navigate("/app/calendar")}
            className="text-[12px] font-semibold text-primary"
          >
            Open calendar →
          </button>
        </div>

        {remaining.length === 0 ? (
          <div className="py-2 text-[12.5px] text-muted">The book's clear from here.</div>
        ) : (
          remaining.map((a) => {
            const patient = patients.find((p) => p.name === a.name) ?? null;
            return (
              <div
                key={a.id}
                data-row
                tabIndex={0}
                className="grid items-center gap-2.5 py-1.5 outline-none grid-cols-[46px_minmax(0,1.3fr)_minmax(0,1fr)_auto]"
              >
                <span className="font-mono text-[11.5px] text-muted text-right">
                  {fmtHour(a.start)}
                </span>
                <button
                  onClick={() => patient && openPatientPreview(patient.id)}
                  className="flex items-center gap-2 min-w-0 text-left"
                >
                  <Avatar name={a.name} size={24} />
                  <span className="text-[12.5px] font-semibold truncate">{a.name}</span>
                </button>
                <span className="text-[12px] text-muted truncate">{a.proc}</span>
                <span className="flex items-center gap-1.5 justify-end">
                  <MedicalAlertBadge alert={patient?.alert} variant="chip" />
                  <span className="text-[11px] text-muted-2">{a.chair}</span>
                </span>
              </div>
            );
          })
        )}
      </Panel>

      {/* The three numbers a clinician actually asks about */}
      <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <Panel className="p-4 flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[0.08em] text-muted-2">
            PRODUCED TODAY
          </span>
          <span className="text-[22px] font-bold tnum tracking-[-0.02em]">{inr(producedPaise)}</span>
          <Meter value={scheduledPaise ? Math.round((producedPaise / scheduledPaise) * 100) : 0} />
          <span className="text-[11.5px] text-muted">
            of {inr(scheduledPaise)} scheduled
          </span>
        </Panel>

        <Panel className="p-4 flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[0.08em] text-muted-2">
            CASE ACCEPTANCE
          </span>
          <span className="text-[22px] font-bold tnum tracking-[-0.02em]">{acceptancePct}%</span>
          <Meter value={acceptancePct} />
          <span className="text-[11.5px] text-muted">
            this month · by value, not by count
          </span>
        </Panel>

        <button
          onClick={() => navigate("/app/revenue/unscheduled")}
          className="text-left rounded-lg p-4 flex flex-col gap-2 border transition-colors hover:border-warning"
          style={{ background: "var(--warning-panel)", borderColor: "var(--warning-border)" }}
        >
          <span className="text-[11px] font-bold tracking-[0.08em] text-warning">
            YOUR CASES, DEFERRED
          </span>
          <span className="text-[22px] font-bold tnum tracking-[-0.02em]">
            {inr(deferredPaise)}
          </span>
          <span className="text-[11.5px] text-muted">
            {myDeferred.length} patients said "not yet" · open the recovery worklist →
          </span>
        </button>
      </div>

      {user.role === "owner" && (
        <footer className="text-[11.5px] text-muted-2 text-center pt-1 pb-4">
          Collections, chair utilisation, retention and the leak report are at{" "}
          <button onClick={() => navigate("/app/insight")} className="font-semibold text-primary">
            Insight
          </button>
          .
        </footer>
      )}
    </div>
  );
}

function FocusCard({
  label,
  appt,
  now,
  tone,
  emptyText,
  onOpen,
}: {
  label: string;
  appt: Appointment | undefined;
  now: number;
  tone: "primary" | "plain";
  emptyText: string;
  onOpen: (id: string) => void;
}) {
  const patient = appt ? patients.find((p) => p.name === appt.name) ?? null : null;
  const isPrimary = tone === "primary" && !!appt;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 flex flex-col gap-2 min-h-[132px]",
        isPrimary ? "border-transparent" : "bg-surface border-border",
      )}
      style={isPrimary ? { background: "var(--primary)", color: "var(--on-primary)" } : undefined}
    >
      <span
        className="text-[11px] font-bold tracking-[0.08em]"
        style={{ color: isPrimary ? "#CBDDD5" : "var(--muted-2)" }}
      >
        {label}
      </span>

      {!appt ? (
        <span className="text-[13px] text-muted mt-1">{emptyText}</span>
      ) : (
        <>
          <button
            onClick={() => patient && onOpen(patient.id)}
            className="flex items-center gap-2.5 text-left"
          >
            <Avatar name={appt.name} size={34} />
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold truncate">{appt.name}</span>
              <span
                className="block text-[11.5px] truncate"
                style={{ color: isPrimary ? "#BFD5CC" : "var(--muted-2)" }}
              >
                {appt.agesex} · {appt.chair}
              </span>
            </span>
          </button>

          <span className="text-[12.5px]" style={{ color: isPrimary ? "#E4EEEA" : "var(--muted)" }}>
            {appt.proc}
          </span>

          <span className="flex items-center gap-2 mt-auto">
            <span
              className="font-mono text-[11.5px]"
              style={{ color: isPrimary ? "#BFD5CC" : "var(--muted-2)" }}
            >
              {fmtHour(appt.start)}–{fmtHour(appt.start + appt.dur)}
            </span>
            {tone === "primary" && (
              <span className="text-[11.5px] tnum" style={{ color: "#CBDDD5" }}>
                · {Math.max(0, minutesSince(appt.start, now))} min in
              </span>
            )}
            {tone === "plain" && appt.start > now && (
              <span className="text-[11.5px] tnum text-muted">
                · in {Math.max(0, -minutesSince(appt.start, now))} min
              </span>
            )}
          </span>

          {!isPrimary && <MedicalAlertBadge alert={patient?.alert} variant="chip" className="self-start" />}
        </>
      )}
    </div>
  );
}

function greeting(now: number): string {
  if (now < 12) return "Good morning";
  if (now < 16) return "Good afternoon";
  return "Good evening";
}
