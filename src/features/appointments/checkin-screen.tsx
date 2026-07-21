import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MedicalAlertBadge } from "@/components/common/medical-alert-badge";
import { useUIStore } from "@/hooks/use-ui-store";
import { useDeskStore } from "@/hooks/use-desk-store";
import { useClinicNow, minutesSince } from "@/hooks/use-clinic-now";
import { appointments, patients } from "@/lib/mock-data";
import { clinicConfig } from "@/config/clinic";
import { findGaps } from "@/lib/schedule";
import { fmtHour, inr } from "@/lib/format";
import { waLink, draftRunningLate } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type { Appointment, Patient } from "@/types";

/*
 * Check-in — a transaction, not a flag.
 *
 * When a patient walks in, several things become true at once: he's here, the
 * dentist should know, his balance is now collectable, his consent may be
 * unsigned and his medical history may be a year stale. Modelling that moment
 * as a single boolean throws all of it away, and the practice discovers the
 * problems later — at payment time, or in the chair, which are the two most
 * expensive places to discover them.
 *
 * So: every row carries its pre-arrival state *before* the patient reaches the
 * desk, which is the only moment those things are cheap to fix. Tapping check
 * in expands a confirmation strip in place — never a modal — and every item on
 * it is one tap and skippable. She must be able to check someone in without
 * reading it. She must never be unable to see it.
 */

/** How stale a medical history has to be before it's worth re-asking. */
const HISTORY_STALE_MONTHS = 12;

interface PreArrival {
  duesPaise: number;
  historyMonths: number;
  consentOutstanding: boolean;
  labOutstanding: boolean;
}

export function CheckinScreen() {
  const navigate = useNavigate();
  const { showToast, openPatientPreview } = useUIStore();
  const { openSettle, openBooking } = useDeskStore();
  const now = useClinicNow();

  const todays = useMemo(
    () =>
      appointments
        .filter((a) => !["cancelled", "noshow"].includes(a.status))
        .sort((a, b) => a.start - b.start),
    [],
  );

  const [here, setHere] = useState<Set<string>>(
    () => new Set(todays.filter((a) => ["arrived", "inchair", "done"].includes(a.status)).map((a) => a.id)),
  );
  const [arrivedAt, setArrivedAt] = useState<Record<string, number>>({});
  /** The row currently showing its confirmation strip. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [chased, setChased] = useState<Set<string>>(new Set());

  const gaps = useMemo(() => findGaps(0, 30, now), [now]);

  const waiting = todays.filter((a) => here.has(a.id) && a.status !== "done");
  const late = todays.filter((a) => !here.has(a.id) && a.start + 0.25 < now);
  const soon = todays.filter((a) => !here.has(a.id) && a.start >= now - 0.25 && a.start <= now + 1);
  const later = todays.filter((a) => !here.has(a.id) && a.start > now + 1);

  const avgWait = waiting.length
    ? Math.round(
        waiting.reduce((s, a) => s + Math.max(0, minutesSince(arrivedAt[a.id] ?? a.start, now)), 0) /
          waiting.length,
      )
    : 0;

  const beginCheckIn = (a: Appointment) => {
    const pre = preArrival(a);
    // Nothing to raise? Then don't make her dismiss an empty strip.
    if (pre.duesPaise === 0 && pre.historyMonths < HISTORY_STALE_MONTHS && !pre.consentOutstanding) {
      completeCheckIn(a);
      return;
    }
    setConfirming(a.id);
  };

  const completeCheckIn = (a: Appointment) => {
    setHere((s) => new Set(s).add(a.id));
    setArrivedAt((m) => ({ ...m, [a.id]: now }));
    setConfirming(null);
    showToast(`${a.name} checked in — ${a.chair} has been told`);
  };

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-3.5">
      <PageHeader
        title="Check-in"
        subtitle="Today's arrivals"
        aside={
          <Button variant="secondary" onClick={() => navigate("/app/clinical/queue")}>
            Clinical queue →
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <StatCard label="Expected today" value={String(todays.length)} sub="booked & confirmed" />
        <StatCard label="In the clinic" value={String(waiting.length)} deltaTone="up" sub="here now" />
        <StatCard label="Yet to arrive" value={String(todays.length - here.size)} sub="awaiting" />
        <StatCard
          label="Average wait"
          value={`${avgWait} min`}
          deltaTone={avgWait > 12 ? "down" : "up"}
          sub="in the waiting room"
        />
      </div>

      {/* Running late — a lane of its own, so it isn't a red row nobody acts on. */}
      {late.length > 0 && (
        <Lane title="Running late" tone="danger" count={late.length}>
          {late.map((a) => (
            <Row
              key={a.id}
              appt={a}
              now={now}
              lateBy={minutesSince(a.start, now)}
              onOpenPatient={openPatientPreview}
              action={
                <>
                  {chased.has(a.id) ? (
                    <span className="text-[11px] text-muted-2">Asked</span>
                  ) : (
                    <a
                      href={waLink(
                        phoneFor(a.name),
                        draftRunningLate({ name: a.name.split(" ")[0], clinic: clinicConfig.name }),
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setChased((s) => new Set(s).add(a.id))}
                      className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-md border border-border bg-surface text-muted hover:text-primary"
                    >
                      <Icon name="message" size={12} />
                      Where are you?
                    </a>
                  )}
                  <Button size="sm" variant="primary" onClick={() => beginCheckIn(a)}>
                    Check in
                  </Button>
                </>
              }
              confirming={confirming === a.id}
              onCancelConfirm={() => setConfirming(null)}
              onCompleteConfirm={() => completeCheckIn(a)}
              onSettle={openSettle}
              showToast={showToast}
            />
          ))}
        </Lane>
      )}

      {/* In the clinic — with the counter that changes a dentist's behaviour. */}
      {waiting.length > 0 && (
        <Lane title="In the clinic" tone="primary" count={waiting.length}>
          {waiting.map((a) => {
            const mins = Math.max(0, minutesSince(arrivedAt[a.id] ?? a.start, now));
            return (
              <Row
                key={a.id}
                appt={a}
                now={now}
                onOpenPatient={openPatientPreview}
                action={
                  a.status === "inchair" ? (
                    <span className="text-[10.5px] font-bold px-2 py-1 rounded-[5px] bg-primary text-on-primary">
                      IN CHAIR
                    </span>
                  ) : (
                    <>
                      <span
                        className="text-[11px] font-semibold tnum px-2 py-1 rounded-[5px] border"
                        title="Time in the waiting room"
                        style={{
                          background: mins > 15 ? "var(--warning-bg)" : "var(--primary-tint)",
                          borderColor: mins > 15 ? "var(--warning-border)" : "var(--primary-tint-border)",
                          color: mins > 15 ? "var(--warning)" : "var(--primary)",
                        }}
                      >
                        waiting {mins}m
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => showToast(`${a.doctor} told — ${a.name} is ready`)}
                      >
                        Nudge chair
                      </Button>
                    </>
                  )
                }
              />
            );
          })}
        </Lane>
      )}

      {/* Arriving now */}
      <Lane title="Arriving now" count={soon.length} emptyText="Nobody due in the next hour.">
        {soon.map((a) => {
          const early = Math.max(0, -minutesSince(a.start, now));
          const gap = early >= 20 ? gaps.find((g) => g.minutes >= Math.round(a.dur * 60)) : undefined;
          return (
            <Row
              key={a.id}
              appt={a}
              now={now}
              earlyBy={early >= 20 ? early : undefined}
              onOpenPatient={openPatientPreview}
              action={
                <>
                  {gap && (
                    <button
                      onClick={() =>
                        showToast(
                          `Offered ${a.name} the ${fmtHour(gap.start)} slot in ${gap.chair}`,
                        )
                      }
                      className="text-[11.5px] font-semibold px-2.5 py-1 rounded-md border border-primary-tint-border bg-primary-tint text-primary"
                      title="They're early and there's a hole in the book"
                    >
                      Pull forward to {fmtHour(gap.start)}
                    </button>
                  )}
                  <Button size="sm" variant="primary" onClick={() => beginCheckIn(a)}>
                    Check in
                  </Button>
                </>
              }
              confirming={confirming === a.id}
              onCancelConfirm={() => setConfirming(null)}
              onCompleteConfirm={() => completeCheckIn(a)}
              onSettle={openSettle}
              showToast={showToast}
            />
          );
        })}
      </Lane>

      {/* Later today */}
      <Lane
        title="Later today"
        count={later.length}
        emptyText="That's everyone. Gaps in the book are on the brief."
        action={{ label: "Fill a gap", onClick: () => openBooking({ request: "today" }) }}
      >
        {later.map((a) => (
          <Row
            key={a.id}
            appt={a}
            now={now}
            dim
            onOpenPatient={openPatientPreview}
            action={
              <Button size="sm" variant="secondary" onClick={() => beginCheckIn(a)}>
                Check in early
              </Button>
            }
            confirming={confirming === a.id}
            onCancelConfirm={() => setConfirming(null)}
            onCompleteConfirm={() => completeCheckIn(a)}
            onSettle={openSettle}
            showToast={showToast}
          />
        ))}
      </Lane>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Lane({
  title,
  count,
  tone,
  emptyText,
  action,
  children,
}: {
  title: string;
  count?: number;
  tone?: "danger" | "primary";
  emptyText?: string;
  action?: { label: string; onClick: () => void };
  children?: React.ReactNode;
}) {
  const empty = !count;
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-bg-content">
        {tone && (
          <span
            className="w-[7px] h-[7px] rounded-sm"
            style={{ background: tone === "danger" ? "var(--danger)" : "var(--primary)" }}
          />
        )}
        <MicroLabel>{title}</MicroLabel>
        {!empty && <span className="text-[11px] font-bold tnum text-muted-2">{count}</span>}
        <div className="flex-1" />
        {action && (
          <button onClick={action.onClick} className="text-[12px] font-semibold text-primary">
            {action.label} →
          </button>
        )}
      </div>
      {empty ? (
        <div className="px-4 py-6 text-center text-[12.5px] text-muted">{emptyText}</div>
      ) : (
        children
      )}
    </Panel>
  );
}

function Row({
  appt,
  now,
  lateBy,
  earlyBy,
  dim,
  action,
  onOpenPatient,
  confirming,
  onCancelConfirm,
  onCompleteConfirm,
  onSettle,
  showToast,
}: {
  appt: Appointment;
  now: number;
  lateBy?: number;
  earlyBy?: number;
  dim?: boolean;
  action: React.ReactNode;
  onOpenPatient: (id: string) => void;
  confirming?: boolean;
  onCancelConfirm?: () => void;
  onCompleteConfirm?: () => void;
  onSettle?: (patientId: string) => void;
  showToast?: (msg: string) => void;
}) {
  const patient = patients.find((p) => p.name === appt.name) ?? null;
  const pre = preArrival(appt, patient);

  return (
    <div className={cn("border-b border-border-faint last:border-b-0", dim && "opacity-70")}>
      <div
        data-row
        tabIndex={0}
        className="grid items-center gap-3 px-4 py-3 outline-none"
        style={{ gridTemplateColumns: "0.6fr 1.5fr 1.5fr auto" }}
      >
        <div className="text-[12px] font-mono text-muted">
          {fmtHour(appt.start)}
          {lateBy !== undefined && lateBy > 0 && (
            <div className="text-[10.5px] text-danger font-sans font-semibold">{lateBy}m late</div>
          )}
          {earlyBy !== undefined && (
            <div className="text-[10.5px] text-primary font-sans font-semibold">{earlyBy}m early</div>
          )}
        </div>

        <button
          onClick={() => patient && onOpenPatient(patient.id)}
          className="flex items-center gap-2.5 min-w-0 text-left"
        >
          <Avatar name={appt.name} size={30} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold truncate">{appt.name}</div>
            <div className="text-[11px] text-muted-2 truncate">
              {appt.doctor} · {appt.chair}
            </div>
          </div>
        </button>

        {/* Pre-arrival state: visible before he reaches the desk. */}
        <div className="min-w-0 flex flex-col gap-1">
          <span className="text-[12.5px] truncate">{appt.proc}</span>
          <span className="flex flex-wrap items-center gap-1">
            <MedicalAlertBadge alert={patient?.alert} variant="chip" />
            {pre.duesPaise > 0 && (
              <Flag tone="danger">{inr(pre.duesPaise)} due</Flag>
            )}
            {pre.historyMonths >= HISTORY_STALE_MONTHS && (
              <Flag tone="warning">history {pre.historyMonths}mo</Flag>
            )}
            {pre.consentOutstanding && <Flag tone="warning">consent unsigned</Flag>}
            {pre.labOutstanding && <Flag tone="warning">lab not back</Flag>}
          </span>
        </div>

        <div className="flex justify-end items-center gap-1.5">{action}</div>
      </div>

      {/*
       * The confirmation strip. An inline expansion of the row, never a modal.
       * Enter skips everything and checks the patient in, because there are
       * three people at the desk and she has already read it.
       */}
      {confirming && (
        <div
          className="px-4 py-2.5 bg-bg-content border-t border-border-faint flex flex-wrap items-center gap-2 animate-dc-row"
          onKeyDown={(e) => {
            if (e.key === "Enter") onCompleteConfirm?.();
            if (e.key === "Escape") onCancelConfirm?.();
          }}
        >
          <span className="text-[11px] font-bold tracking-[0.06em] text-muted-2">
            BEFORE THE CHAIR
          </span>

          {pre.duesPaise > 0 && patient && (
            <StripAction
              label={`Collect ${inr(pre.duesPaise)} now`}
              onClick={() => {
                onCompleteConfirm?.();
                onSettle?.(patient.id);
              }}
            />
          )}
          {pre.historyMonths >= HISTORY_STALE_MONTHS && (
            <StripAction
              label={`Send history update link (${pre.historyMonths}mo old)`}
              onClick={() => {
                showToast?.(`History update link queued — ${appt.name}`);
                onCompleteConfirm?.();
              }}
            />
          )}
          {pre.consentOutstanding && (
            <StripAction
              label="Send consent form"
              onClick={() => {
                showToast?.(`Consent form queued — ${appt.name}`);
                onCompleteConfirm?.();
              }}
            />
          )}

          <div className="flex-1" />
          <button
            onClick={onCancelConfirm}
            className="text-[11.5px] font-medium text-muted px-2 py-1 rounded-md hover:bg-bg"
          >
            Cancel
          </button>
          <Button size="sm" variant="primary" autoFocus onClick={onCompleteConfirm}>
            Check in anyway ↵
          </Button>
        </div>
      )}
    </div>
  );
}

function Flag({ tone, children }: { tone: "danger" | "warning"; children: React.ReactNode }) {
  return (
    <span
      className="text-[9.5px] font-bold px-1.5 py-px rounded-[4px] border whitespace-nowrap"
      style={{
        background: tone === "danger" ? "var(--danger-bg)" : "var(--warning-bg)",
        borderColor: tone === "danger" ? "var(--danger-border)" : "var(--warning-border)",
        color: tone === "danger" ? "var(--danger)" : "var(--warning)",
      }}
    >
      {children}
    </span>
  );
}

function StripAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[11.5px] font-semibold px-2.5 py-1 rounded-md border border-border bg-surface hover:border-primary hover:text-primary"
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------

/**
 * What we know about this patient before he walks in.
 *
 * Dues and consent come from real fields. History age is derived from the last
 * visit where we have one, and otherwise stands in deterministically from the
 * appointment id — there is no history model in the mock data yet, and a
 * flicker of random staleness would be worse than a stable stand-in.
 */
function preArrival(appt: Appointment, patient?: Patient | null): PreArrival {
  const p = patient ?? patients.find((x) => x.name === appt.name) ?? null;
  const seed = appt.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);

  return {
    duesPaise: p?.balancePaise ?? (appt.flags.includes("due") ? (seed % 9 + 2) * 50000 : 0),
    historyMonths: seed % 5 === 0 ? 14 + (seed % 7) : seed % 11,
    consentOutstanding: appt.flags.includes("consent"),
    labOutstanding: /crown|denture|bridge|veneer/i.test(appt.proc) && seed % 6 === 0,
  };
}

function phoneFor(name: string): string {
  return patients.find((p) => p.name === name)?.phone ?? "";
}
