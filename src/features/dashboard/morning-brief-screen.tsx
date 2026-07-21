import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Panel } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { MedicalAlertBadge } from "@/components/common/medical-alert-badge";
import { useSession } from "@/hooks/use-session";
import { useUIStore } from "@/hooks/use-ui-store";
import { useDeskStore } from "@/hooks/use-desk-store";
import { useClinicNow, minutesSince } from "@/hooks/use-clinic-now";
import { appointments, patients, leads, waitlist } from "@/lib/mock-data";
import { clinicConfig, TODAY_LABEL } from "@/config/clinic";
import { findGaps, expectedCollectionPaise } from "@/lib/schedule";
import { inr, fmtHour } from "@/lib/format";
import { draftConfirmation, draftRunningLate, waLink } from "@/lib/whatsapp";
import { flagLabel } from "@/design/status";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types";

/*
 * The Morning Brief — what `/app` is for the person who opens it most.
 *
 * The financial dashboard answers "how are we doing", which is the owner's
 * question, asked twice a week. This screen answers "what do I do in the next
 * twenty minutes", which is the receptionist's question, asked at 9:15 every
 * working day of the year. It reads top to bottom like a briefing note, and
 * every block on it is designed to empty.
 *
 * Order is deliberate: unconfirmed appointments come first, because they are
 * the only thing on the screen where acting now changes the outcome of the day.
 */

export function MorningBriefScreen() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { showToast, openPatientPreview } = useUIStore();
  const { openBooking, openSettle } = useDeskStore();
  const now = useClinicNow();

  /*
   * Local optimistic state. A confirmation or a check-in renders the instant
   * it is tapped and reconciles behind — the desk never waits on a round trip
   * to find out whether a button worked.
   */
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [arrived, setArrived] = useState<Set<string>>(
    () => new Set(appointments.filter((a) => ["checked_in", "in_progress", "completed"].includes(a.status)).map((a) => a.id)),
  );
  const [chased, setChased] = useState<Set<string>>(new Set());
  const [overnightOpen, setOvernightOpen] = useState(false);

  const today = useMemo(
    () => appointments.filter((a) => a.status !== "cancelled").sort((a, b) => a.start - b.start),
    [],
  );

  const unconfirmed = today.filter((a) => a.status === "scheduled" && !confirmed.has(a.id));
  const gaps = useMemo(() => findGaps(0, 30, now).slice(0, 3), [now]);
  const expected = expectedCollectionPaise(0);

  const runningLate = today.filter(
    (a) => !arrived.has(a.id) && a.status !== "no_show" && a.start + 0.25 < now && a.start > now - 2,
  );

  const freshLeads = leads.filter((l) => l.age.includes("h ago"));

  const confirmOne = (a: Appointment) => {
    setConfirmed((s) => new Set(s).add(a.id));
    showToast(`Confirmation queued — ${a.name}`);
  };

  const confirmAll = () => {
    setConfirmed(new Set(today.map((a) => a.id)));
    showToast(`${unconfirmed.length} confirmations queued`);
  };

  const checkIn = (a: Appointment) => {
    setArrived((s) => new Set(s).add(a.id));
    showToast(`${a.name} checked in — the chair has been told`);
  };

  return (
    <div className="max-w-[720px] mx-auto flex flex-col gap-4">
      {/* Greeting and the day in one sentence */}
      <header className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="m-0 text-lg font-semibold tracking-[-0.01em]">
            Good morning, {user.shortName}
          </h1>
          <span className="text-[11.5px] text-muted-2">{TODAY_LABEL}</span>
        </div>
        <p className="m-0 text-[13.5px] text-muted-strong leading-relaxed">
          <b className="text-ink tnum">{today.length}</b> booked
          {unconfirmed.length > 0 ? (
            <>
              , <b className="text-warning tnum">{unconfirmed.length}</b> still unconfirmed
            </>
          ) : (
            <>, all confirmed</>
          )}
          {gaps.length > 0 && (
            <>
              , <b className="text-ink tnum">{gaps.length}</b> gap{gaps.length > 1 ? "s" : ""} from{" "}
              <b className="text-ink">{fmtHour(gaps[0].start)}</b>
            </>
          )}
          , <b className="text-ink tnum">{inr(expected)}</b> expected in.
        </p>
      </header>

      {/* 1 — Unconfirmed. First, because acting now changes the day. */}
      <Section
        title="Unconfirmed"
        count={unconfirmed.length}
        tone="warning"
        action={
          unconfirmed.length > 0 ? { label: "Confirm all", onClick: confirmAll } : undefined
        }
        emptyTitle="Everyone's confirmed"
        emptyBody="Nothing to chase before the first chair. Next thing worth doing is filling the gaps below."
      >
        {unconfirmed.map((a) => (
          <Row key={a.id}>
            <Time>{fmtHour(a.start)}</Time>
            <Who appt={a} onOpen={openPatientPreview} />
            <span className="text-[12px] text-muted truncate hidden sm:block">{a.proc}</span>
            <RowActions>
              <Ghost
                href={waLink(
                  patientPhone(a.name),
                  draftConfirmation({
                    name: a.name.split(" ")[0],
                    date: "today",
                    time: fmtHour(a.start),
                    doctor: a.doctor,
                    clinic: clinicConfig.name,
                  }),
                )}
                icon="message"
                label="Open WhatsApp"
              />
              <Primary onClick={() => confirmOne(a)}>Confirm</Primary>
            </RowActions>
          </Row>
        ))}
      </Section>

      {/* 2 — Running late. A distinct lane, not a red row in the main list. */}
      {runningLate.length > 0 && (
        <Section title="Running late" count={runningLate.length} tone="danger">
          {runningLate.map((a) => (
            <Row key={a.id}>
              <Time className="text-danger">{fmtHour(a.start)}</Time>
              <Who appt={a} onOpen={openPatientPreview} />
              <span className="text-[12px] text-danger-text">
                {minutesSince(a.start, now)} min late
              </span>
              <RowActions>
                {chased.has(a.id) ? (
                  <span className="text-[11px] text-muted-2">Asked</span>
                ) : (
                  <Ghost
                    href={waLink(
                      patientPhone(a.name),
                      draftRunningLate({ name: a.name.split(" ")[0], clinic: clinicConfig.name }),
                    )}
                    icon="message"
                    label="Ask where they are"
                    onClick={() => setChased((s) => new Set(s).add(a.id))}
                  />
                )}
                <Primary onClick={() => checkIn(a)}>They're here</Primary>
              </RowActions>
            </Row>
          ))}
        </Section>
      )}

      {/* 3 — The arrivals rail, with a now marker that moves. */}
      <Section
        title="Today"
        count={today.length}
        action={{ label: "Open calendar", onClick: () => navigate("/app/calendar") }}
      >
        <ArrivalsRail
          appointments={today}
          now={now}
          arrived={arrived}
          onCheckIn={checkIn}
          onOpenPatient={openPatientPreview}
          onSettle={openSettle}
        />
      </Section>

      {/* 4 — Gaps as opportunity objects, not empty space. */}
      <Section
        title="Gaps worth filling"
        count={gaps.length}
        emptyTitle="The book is tight"
        emptyBody="No holes over half an hour left today. Good day to catch up on recovery calls."
        action={
          gaps.length > 0
            ? { label: "Open waitlist", onClick: () => navigate("/app/waitlist") }
            : { label: "Recovery worklist", onClick: () => navigate("/app/revenue/unscheduled") }
        }
      >
        {gaps.map((g) => {
          const fits = waitlist.length;
          return (
            <Row key={g.id}>
              <Time>{fmtHour(g.start)}</Time>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">
                  {g.minutes} minutes free
                  <span className="font-normal text-muted-2"> · {g.chair}</span>
                </div>
                <div className="text-[11.5px] text-muted-2">
                  {g.doctor} · {fits} on the waitlist could take it
                </div>
              </div>
              <span />
              <RowActions>
                <Primary onClick={() => navigate("/app/waitlist")}>Fill from waitlist</Primary>
                <Ghost
                  onClick={() => openBooking({ request: `${g.minutes} min today` })}
                  icon="plus"
                  label="Book into this gap"
                />
              </RowActions>
            </Row>
          );
        })}
      </Section>

      {/* 5 — Overnight, collapsed to one line. */}
      <Panel className="px-4 py-3">
        <button
          onClick={() => setOvernightOpen((o) => !o)}
          className="w-full flex items-center gap-2.5 text-left"
        >
          <Icon
            name={overnightOpen ? "chevronDown" : "chevronRight"}
            size={13}
            className="text-muted-2"
          />
          <span className="text-[13px] font-semibold">Overnight</span>
          <span className="text-[12.5px] text-muted flex-1">
            {freshLeads.length} new enquir{freshLeads.length === 1 ? "y" : "ies"} · 4 unread
            WhatsApp
          </span>
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-[5px] bg-warning-bg text-warning border border-warning-border">
            {freshLeads.length + 4}
          </span>
        </button>

        {overnightOpen && (
          <div className="mt-2.5 pt-2.5 border-t border-border-faint flex flex-col gap-1.5 animate-dc-row">
            {freshLeads.map((l) => (
              <div key={l.id} className="flex items-center gap-2.5 text-[12.5px]">
                <span className="w-[6px] h-[6px] rounded-full bg-warning flex-none" />
                <span className="font-semibold">{l.name}</span>
                <span className="text-muted-2 flex-1 truncate">
                  {l.interest} · {l.source}
                </span>
                <span className="text-muted-2 text-[11px]">{l.age}</span>
                <a
                  href={waLink(l.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11.5px] font-semibold text-primary"
                >
                  Reply
                </a>
              </div>
            ))}
            <button
              onClick={() => navigate("/app/inbox")}
              className="text-[12px] font-semibold text-primary self-start mt-1"
            >
              Open inbox →
            </button>
          </div>
        )}
      </Panel>

      <footer className="text-[11.5px] text-muted-2 text-center pt-1 pb-4">
        How the practice is doing lives at{" "}
        <button onClick={() => navigate("/app/insight")} className="font-semibold text-primary">
          Insight
        </button>
        . This page is for the next twenty minutes.
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Arrivals rail
// ---------------------------------------------------------------------------

function ArrivalsRail({
  appointments: list,
  now,
  arrived,
  onCheckIn,
  onOpenPatient,
  onSettle,
}: {
  appointments: Appointment[];
  now: number;
  arrived: Set<string>;
  onCheckIn: (a: Appointment) => void;
  onOpenPatient: (id: string) => void;
  onSettle: (patientId: string) => void;
}) {
  const nowIndex = list.findIndex((a) => a.start > now);
  const markerAt = nowIndex === -1 ? list.length : nowIndex;

  return (
    <div className="flex flex-col">
      {list.map((a, i) => (
        <div key={a.id}>
          {i === markerAt && <NowMarker now={now} />}
          <ArrivalRow
            appt={a}
            now={now}
            isHere={arrived.has(a.id)}
            onCheckIn={() => onCheckIn(a)}
            onOpenPatient={onOpenPatient}
            onSettle={onSettle}
          />
        </div>
      ))}
      {markerAt === list.length && <NowMarker now={now} />}
    </div>
  );
}

function NowMarker({ now }: { now: number }) {
  return (
    <div className="flex items-center gap-2 py-1.5" aria-hidden>
      <span className="font-mono text-[10.5px] font-bold text-primary w-[46px] text-right shrink-0">
        {fmtHour(now)}
      </span>
      <span className="w-[7px] h-[7px] rounded-full bg-primary flex-none animate-dc-pulse-ring" />
      <span className="flex-1 h-px" style={{ background: "var(--primary-tint-border)" }} />
      <span className="text-[10px] font-bold tracking-[0.08em] text-primary">NOW</span>
    </div>
  );
}

function ArrivalRow({
  appt,
  now,
  isHere,
  onCheckIn,
  onOpenPatient,
  onSettle,
}: {
  appt: Appointment;
  now: number;
  isHere: boolean;
  onCheckIn: () => void;
  onOpenPatient: (id: string) => void;
  onSettle: (patientId: string) => void;
}) {
  const patient = patients.find((p) => p.name === appt.name) ?? null;
  const past = appt.start + appt.dur < now;
  const waitingMins = isHere && appt.status !== "completed" ? minutesSince(appt.start, now) : null;

  return (
    <div
      data-row
      tabIndex={0}
      className={cn(
        "grid items-center gap-2.5 py-2 rounded-md outline-none",
        "grid-cols-[46px_minmax(0,1.5fr)_minmax(0,1fr)_auto]",
        past && !isHere && "opacity-55",
      )}
    >
      <span className="font-mono text-[11.5px] text-muted text-right">{fmtHour(appt.start)}</span>

      <button
        onClick={() => patient && onOpenPatient(patient.id)}
        className="flex items-center gap-2 min-w-0 text-left"
      >
        <Avatar name={appt.name} size={26} />
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold truncate">{appt.name}</span>
          <span className="block text-[11px] text-muted-2 truncate">
            {appt.doctor} · {appt.chair}
          </span>
        </span>
      </button>

      <span className="min-w-0 flex flex-col gap-0.5">
        <span className="text-[12px] text-muted truncate">{appt.proc}</span>
        <span className="flex flex-wrap items-center gap-1">
          <MedicalAlertBadge alert={patient?.alert} variant="chip" />
          {appt.flags
            .filter((f) => f === "due" || f === "consent" || f === "new")
            .map((f) => (
              <span
                key={f}
                className={cn(
                  "text-[9.5px] font-bold px-1 py-px rounded-[4px] border",
                  f === "due"
                    ? "bg-danger-bg text-danger border-danger-border"
                    : f === "consent"
                      ? "bg-warning-bg text-warning border-warning-border"
                      : "bg-primary-tint text-primary border-primary-tint-border",
                )}
              >
                {flagLabel[f]}
              </span>
            ))}
        </span>
      </span>

      <span className="flex items-center gap-1.5 justify-end">
        {waitingMins !== null && waitingMins >= 0 && appt.status !== "in_progress" && (
          <span
            className="text-[10.5px] font-semibold tnum px-1.5 py-0.5 rounded-[5px] border"
            style={{
              background: waitingMins > 10 ? "var(--warning-bg)" : "var(--primary-tint)",
              borderColor: waitingMins > 10 ? "var(--warning-border)" : "var(--primary-tint-border)",
              color: waitingMins > 10 ? "var(--warning)" : "var(--primary)",
            }}
            title="Time in the waiting room"
          >
            waiting {waitingMins}m
          </span>
        )}
        {appt.status === "in_progress" ? (
          <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-[5px] bg-primary text-on-primary">
            IN CHAIR
          </span>
        ) : appt.status === "completed" ? (
          patient && patient.balancePaise > 0 ? (
            <Primary onClick={() => onSettle(patient.id)}>Settle</Primary>
          ) : (
            <span className="text-[10.5px] font-semibold text-muted-2">Done</span>
          )
        ) : isHere ? (
          <span className="text-[10.5px] font-semibold text-primary">✓ Here</span>
        ) : (
          <Primary onClick={onCheckIn}>Check in</Primary>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function Section({
  title,
  count,
  tone,
  action,
  emptyTitle,
  emptyBody,
  children,
}: {
  title: string;
  count: number;
  tone?: "warning" | "danger";
  action?: { label: string; onClick: () => void };
  emptyTitle?: string;
  emptyBody?: string;
  children: React.ReactNode;
}) {
  const empty = count === 0;

  return (
    <Panel className="px-4 py-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {tone && !empty && (
          <span
            className="w-[7px] h-[7px] rounded-sm flex-none"
            style={{ background: tone === "danger" ? "var(--danger)" : "var(--warning)" }}
          />
        )}
        <span className="text-[13px] font-semibold">{title}</span>
        {!empty && (
          <span className="text-[11px] font-bold tnum text-muted-2">{count}</span>
        )}
        <div className="flex-1" />
        {action && (
          <button onClick={action.onClick} className="text-[12px] font-semibold text-primary">
            {action.label} →
          </button>
        )}
      </div>

      {empty ? (
        <div className="py-3 flex flex-col gap-0.5">
          <div className="text-[12.5px] font-semibold text-primary">
            ✓ {emptyTitle ?? "Nothing here"}
          </div>
          {emptyBody && (
            <div className="text-[12px] text-muted leading-relaxed max-w-[440px]">{emptyBody}</div>
          )}
        </div>
      ) : (
        <div className="flex flex-col">{children}</div>
      )}
    </Panel>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-row
      tabIndex={0}
      className="grid items-center gap-2.5 py-2 border-b border-border-faint last:border-b-0 outline-none grid-cols-[46px_minmax(0,1.4fr)_minmax(0,1fr)_auto]"
    >
      {children}
    </div>
  );
}

function Time({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[11.5px] text-muted text-right", className)}>{children}</span>
  );
}

function Who({ appt, onOpen }: { appt: Appointment; onOpen: (id: string) => void }) {
  const patient = patients.find((p) => p.name === appt.name) ?? null;
  return (
    <button
      onClick={() => patient && onOpen(patient.id)}
      className="flex items-center gap-2 min-w-0 text-left"
    >
      <Avatar name={appt.name} size={26} />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold truncate">{appt.name}</span>
        <span className="block text-[11px] text-muted-2 truncate">{appt.agesex} · {appt.doctor}</span>
      </span>
    </button>
  );
}

function RowActions({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-1.5 justify-end">{children}</span>;
}

function Primary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[11.5px] font-semibold px-2.5 py-1 rounded-md bg-primary text-on-primary hover:bg-primary-hover"
    >
      {children}
    </button>
  );
}

function Ghost({
  href,
  onClick,
  icon,
  label,
}: {
  href?: string;
  onClick?: () => void;
  icon: "message" | "phone" | "plus";
  label: string;
}) {
  const cls =
    "w-[26px] h-[26px] grid place-items-center rounded-md border border-border bg-surface text-muted hover:text-primary hover:bg-bg";
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={label}
        aria-label={label}
        onClick={onClick}
        className={cls}
      >
        <Icon name={icon} size={13} />
      </a>
    );
  }
  return (
    <button onClick={onClick} title={label} aria-label={label} className={cls}>
      <Icon name={icon} size={13} />
    </button>
  );
}

/** Appointment records carry a name but not a number; look one up where we can. */
function patientPhone(name: string): string {
  return patients.find((p) => p.name === name)?.phone ?? "";
}
