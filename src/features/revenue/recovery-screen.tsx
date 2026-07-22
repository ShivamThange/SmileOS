import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Panel } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Meter } from "@/components/common/meter";
import { UrgencyBadge } from "@/components/common/status-badge";
import { MedicalAlertBadge } from "@/components/common/medical-alert-badge";
import { EmptyState } from "@/components/common/empty-state";
import { inr, inrFromRupees } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import { useDeskStore } from "@/hooks/use-desk-store";
import { waLink, telLink } from "@/lib/whatsapp";
import { SendGuard, SuppressionDot } from "@/components/common/send-guard";
import { buildQueue, OUTCOMES, DAILY_QUEUE_SIZE, type Outcome, type ScoredRow } from "./recovery-queue";
import { useUnscheduled, useUnscheduledSummary, useRecoveryOutcome } from "./recovery-queries";
import type { UnscheduledSummary } from "./recovery-api";
import { cn } from "@/lib/utils";
import type { RecoveryRow, Patient } from "@/types";

/*
 * Recovery — a finite daily queue, not an infinite backlog.
 *
 * Unscheduled treatment is the largest recoverable revenue pool in any dental
 * practice, and every competitor ships it as a list of three hundred and
 * seventy-two names next to a number with six figures in it. That number
 * induces paralysis; the list gets abandoned in week two.
 *
 * So this screen shows eight calls. It is ordered by recoverability rather
 * than recency, every card carries the context and the opening line already
 * written, every outcome is one tap, and the queue empties. Emptying is the
 * whole feature — it is the only thing on this screen that changes behaviour.
 *
 * The full list still exists behind a lens, because Kavita reconciling on a
 * Friday genuinely does want all of it.
 */

const GRID = "1.55fr 1.5fr 0.85fr 0.95fr 0.85fr 1.35fr 1fr 150px";

export function RecoveryScreen() {
  const { showToast, openPatientPreview } = useUIStore();
  const { openBooking } = useDeskStore();

  const { data: worklist } = useUnscheduled();
  const summaryQ = useUnscheduledSummary();
  const outcomeMut = useRecoveryOutcome();

  const [lens, setLens] = useState<"queue" | "all">("queue");
  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [worked, setWorked] = useState<Record<string, Outcome>>({});
  const [recoveredPaise, setRecoveredPaise] = useState(0);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Editable local copy of the backlog, synced from the server (initial load +
  // after an outcome invalidates). A local decline hides the row immediately.
  const patients = worklist?.patients ?? [];
  useEffect(() => { if (worklist) setRows(worklist.rows); }, [worklist]);

  const queue = useMemo(() => buildQueue(rows, patients, DAILY_QUEUE_SIZE), [rows, patients]);
  const remaining = queue.filter((s) => !worked[s.row.id]);
  const doneCount = queue.length - remaining.length;
  const inReachPaise = remaining.reduce((sum, s) => sum + s.row.valuePaise, 0);

  const record = (s: ScoredRow, outcome: Outcome) => {
    setWorked((w) => ({ ...w, [s.row.id]: outcome }));
    setOpenCard(null);

    if (outcome === "booked") {
      setRecoveredPaise((v) => v + s.row.valuePaise);
      outcomeMut.mutate({ itemId: s.row.id, kind: "contact", outcome: "booked" });
      showToast(`${s.patient.name} booked — ${inr(s.row.valuePaise)} recovered`);
    } else if (outcome === "not-interested") {
      /*
       * Suppressed for six months, never deleted. Nobody should fall out of the
       * system because of one bad day.
       */
      setRows((rs) =>
        rs.map((r) => (r.id === s.row.id ? { ...r, declined: true, lastSub: "Not now — ask again in 6 months" } : r)),
      );
      outcomeMut.mutate({ itemId: s.row.id, kind: "decline" });
      showToast(`${s.patient.name} suppressed for six months — not deleted`);
    } else {
      outcomeMut.mutate({ itemId: s.row.id, kind: "contact", outcome });
      showToast(`Logged: ${OUTCOMES.find((o) => o.id === outcome)?.label} — ${s.patient.name}`);
    }
  };

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader
        title="Recovery"
        subtitle="Advised care that never got scheduled. Work the queue top to bottom — it ends."
        aside={
          <div className="flex gap-1 p-0.5 rounded-md border border-border bg-bg-content">
            <LensButton active={lens === "queue"} onClick={() => setLens("queue")}>
              Today's queue
            </LensButton>
            <LensButton active={lens === "all"} onClick={() => setLens("all")}>
              Everything
            </LensButton>
          </div>
        }
      />

      {lens === "queue" ? (
        <>
          {/* The finite headline. Not "₹8.4L across 372 patients". */}
          <Panel className="p-4 flex items-center gap-5 max-md:flex-col max-md:items-start">
            <div className="flex flex-col gap-1">
              <div className="text-[26px] font-bold tracking-[-0.025em]">
                {remaining.length === 0 ? (
                  <span className="text-primary">Queue's clear.</span>
                ) : (
                  <>
                    <span className="tnum">{remaining.length}</span> call
                    {remaining.length === 1 ? "" : "s"} today.
                  </>
                )}
              </div>
              <div className="text-[13px] text-muted">
                {remaining.length === 0
                  ? `You've worked all ${queue.length} today. Nothing more is worth chasing until tomorrow's diagnoses.`
                  : `${inr(inReachPaise)} in reach. Ordered by what's actually recoverable, not by date.`}
              </div>
            </div>

            <div className="flex-1" />

            <div className="flex flex-col gap-1.5 min-w-[190px]">
              <div className="flex justify-between text-[11.5px]">
                <span className="text-muted">Worked today</span>
                <span className="font-semibold tnum">
                  {doneCount} of {queue.length}
                </span>
              </div>
              <Meter value={queue.length ? (doneCount / queue.length) * 100 : 100} height={6} />
              <div className="flex justify-between text-[11.5px] pt-1">
                <span className="text-muted">Recovered this week</span>
                <span className="font-bold tnum text-primary">{inr(recoveredPaise)}</span>
              </div>
            </div>
          </Panel>

          {/* The cards */}
          {remaining.length === 0 ? (
            <Panel>
              <EmptyState
                icon="check"
                title="That's the lot"
                body={`${inr(recoveredPaise)} recovered this week. The queue refills as new plans are deferred — come back tomorrow.`}
                cta="See everything anyway"
                onCta={() => setLens("all")}
              />
            </Panel>
          ) : (
            <div className="flex flex-col gap-2.5">
              {remaining.map((s, i) => (
                <ContactCard
                  key={s.row.id}
                  scored={s}
                  rank={i + 1}
                  open={openCard === s.row.id}
                  draft={drafts[s.row.id] ?? s.draft}
                  onDraftChange={(v) => setDrafts((d) => ({ ...d, [s.row.id]: v }))}
                  onToggle={() => setOpenCard((c) => (c === s.row.id ? null : s.row.id))}
                  onOpenPatient={() => openPatientPreview(s.patient.id)}
                  onBook={() => openBooking({ phone: s.patient.phone, patientId: s.patient.id, request: s.row.proc })}
                  onOutcome={(o) => record(s, o)}
                />
              ))}
            </div>
          )}

          {/* Worked list — visible so the day's effort is legible. */}
          {doneCount > 0 && (
            <Panel className="px-4 py-3 flex flex-col gap-1.5">
              <div className="text-[11px] font-bold tracking-[0.07em] text-muted-2">
                WORKED TODAY
              </div>
              {queue
                .filter((s) => worked[s.row.id])
                .map((s) => (
                  <div key={s.row.id} className="flex items-center gap-2.5 text-[12.5px]">
                    <Icon name="check" size={12} className="text-primary" />
                    <span className="font-semibold">{s.patient.name}</span>
                    <span className="text-muted-2 flex-1 truncate">{s.row.proc}</span>
                    <span className="text-muted">
                      {OUTCOMES.find((o) => o.id === worked[s.row.id])?.label}
                    </span>
                    <button
                      onClick={() =>
                        setWorked((w) => {
                          const next = { ...w };
                          delete next[s.row.id];
                          return next;
                        })
                      }
                      className="text-[11px] text-muted-2 hover:text-ink"
                    >
                      Undo
                    </button>
                  </div>
                ))}
            </Panel>
          )}
        </>
      ) : (
        <EverythingLens rows={rows} patients={patients} summaryData={summaryQ.data} onOpenPatient={openPatientPreview} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A person, not a row
// ---------------------------------------------------------------------------

function ContactCard({
  scored,
  rank,
  open,
  draft,
  onDraftChange,
  onToggle,
  onOpenPatient,
  onBook,
  onOutcome,
}: {
  scored: ScoredRow;
  rank: number;
  open: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onToggle: () => void;
  onOpenPatient: () => void;
  onBook: () => void;
  onOutcome: (o: Outcome) => void;
}) {
  const { row, patient, engagement, reason } = scored;

  return (
    <Panel className={cn("overflow-hidden transition-colors", open && "border-border-strong")}>
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className="w-[22px] text-[12px] font-bold tnum text-muted-3 pt-1.5 text-right shrink-0">
          {rank}
        </span>

        <button onClick={onOpenPatient} className="shrink-0">
          <Avatar name={patient.name} size={38} />
        </button>

        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <button onClick={onOpenPatient} className="text-[14px] font-semibold">
              {patient.name}
            </button>
            <span className="text-[11.5px] text-muted-2 font-mono">{patient.agesex}</span>
            <MedicalAlertBadge alert={patient.alert} variant="chip" />
            <UrgencyBadge urgency={row.urgency} />
            <SuppressionDot patientId={patient.id} kind="recovery" />
          </div>

          <div className="text-[13px]">
            <span className="font-semibold">{row.proc}</span>
            <span className="text-muted-2"> · {row.tooth}</span>
            <span className="text-muted"> · advised {row.planned}, {row.ago}</span>
          </div>

          {/* Why this one is at the top. */}
          <div className="text-[12px] text-muted-strong leading-snug">{reason}</div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Signal
              icon="clock"
              label={
                engagement.daysSinceContact >= 99
                  ? "Never contacted"
                  : `Last contact ${engagement.daysSinceContact}d ago`
              }
            />
            <Signal
              icon="spark"
              label={
                engagement.planViews === 0
                  ? "Plan never opened"
                  : `Plan opened ${engagement.planViews}×`
              }
              hot={engagement.planViews >= 3}
            />
            <Signal
              icon="message"
              label={engagement.everReplied ? "Replies to messages" : "Has never replied"}
            />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-[19px] font-bold tnum tracking-[-0.02em]">{inr(row.valuePaise)}</div>
          <div className="flex gap-1.5">
            <a
              href={telLink(patient.phone)}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1.5 rounded-md border border-primary-tint-border bg-primary-tint text-primary hover:bg-primary-tint-border"
            >
              <Icon name="phone" size={12} />
              Call
            </a>
            <button
              onClick={onToggle}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1.5 rounded-md border border-border bg-surface hover:bg-bg"
            >
              <Icon name="message" size={12} />
              Message
            </button>
            <Button size="sm" variant="secondary" onClick={onBook}>
              Book
            </Button>
          </div>
        </div>
      </div>

      {/* The message, already written. She edits three words and sends. */}
      {open && (
        <div className="px-4 pb-3.5 pt-1 flex flex-col gap-2 animate-dc-row">
          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <Detail label={`CLINICAL FINDING · ${row.doctor}`}>{row.finding}</Detail>
            <Detail label="WHY THEY HELD OFF" italic>
              "{row.reason}"
            </Detail>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">
              DRAFT — EDIT BEFORE SENDING
            </div>
            <textarea
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              rows={3}
              className="text-[12.5px] leading-relaxed px-3 py-2 border border-border rounded-md bg-bg-content outline-none focus:border-primary resize-y"
            />
            {/*
             * Sending goes through the suppression layer, which knows what the
             * recall engine and the plan follow-up have already sent today.
             */}
            <SendGuard
              patientId={patient.id}
              kind="recovery"
              phone={patient.phone}
              message={draft}
            />
          </div>
        </div>
      )}

      {/* One tap, and it leaves the queue. */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-t border-border-faint bg-bg-content flex-wrap">
        <span className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2 mr-1">
          OUTCOME
        </span>
        {OUTCOMES.map((o) => (
          <button
            key={o.id}
            onClick={() => onOutcome(o.id)}
            className={cn(
              "text-[11.5px] font-semibold px-2.5 py-1 rounded-md border transition-colors",
              o.tone === "primary"
                ? "border-primary bg-primary text-on-primary hover:bg-primary-hover"
                : o.tone === "muted"
                  ? "border-border bg-surface text-muted-2 hover:text-danger hover:border-danger-border"
                  : "border-border bg-surface text-ink hover:border-border-strong",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function Signal({
  icon,
  label,
  hot,
}: {
  icon: "clock" | "spark" | "message";
  label: string;
  hot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-[5px] border",
        hot
          ? "bg-warning-bg border-warning-border text-warning font-semibold"
          : "bg-bg-content border-border text-muted",
      )}
    >
      <Icon name={icon} size={10} strokeWidth={1.6} />
      {label}
    </span>
  );
}

function Detail({
  label,
  italic,
  children,
}: {
  label: string;
  italic?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">{label}</div>
      <div className={cn("text-[12.5px] leading-snug text-ink", italic && "italic")}>{children}</div>
    </div>
  );
}

function LensButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-[12px] font-semibold px-3 py-1.5 rounded-[6px] transition-colors",
        active ? "bg-surface text-ink shadow-card-hover" : "text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// The full list — for the Friday reconciliation, not the daily work
// ---------------------------------------------------------------------------

function EverythingLens({
  rows,
  patients,
  summaryData,
  onOpenPatient,
}: {
  rows: RecoveryRow[];
  patients: Patient[];
  summaryData?: UnscheduledSummary;
  onOpenPatient: (id: string) => void;
}) {
  const [urg, setUrg] = useState("All");
  const [type, setType] = useState("All");

  // The headline figure is real: the whole unscheduled backlog and how many
  // patients it spans. The rate/completion tiles remain illustrative.
  const summary = [
    { label: "Advised care unscheduled", value: inr(summaryData?.totalValuePaise ?? 0), sub: `Across ${summaryData?.patientCount ?? 0} patients` },
    { label: "Recoverable now", value: inr(summaryData?.recoverablePaise ?? 0), sub: "Within the recovery window" },
    { label: "Recovery rate", value: "31%", sub: "Of value followed up" },
    { label: "Queue completion", value: "78%", sub: "Calls made of calls queued" },
  ];

  const visible = useMemo(
    () =>
      rows
        .filter((r) => (urg === "All" || r.urgency === urg) && (type === "All" || r.type === type))
        .slice()
        .sort((a, b) => b.valuePaise - a.valuePaise),
    [rows, urg, type],
  );

  return (
    <>
      <div className="grid grid-cols-4 gap-3.5 max-md:grid-cols-2">
        {summary.map((s) => (
          <Panel key={s.label} className="p-3.5 flex flex-col gap-1">
            <div className="text-[11.5px] font-semibold text-muted">{s.label}</div>
            <div className="text-xl font-bold tnum tracking-[-0.02em]">{s.value}</div>
            <div className="text-[11.5px] text-muted-2">{s.sub}</div>
          </Panel>
        ))}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <select
          value={urg}
          onChange={(e) => setUrg(e.target.value)}
          className="text-[12.5px] px-2.5 py-1.5 border border-border rounded-md bg-surface text-ink cursor-pointer"
        >
          <option value="All">Urgency · all</option>
          <option value="High">High only</option>
          <option value="Moderate">Moderate</option>
          <option value="Routine">Routine</option>
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="text-[12.5px] px-2.5 py-1.5 border border-border rounded-md bg-surface text-ink cursor-pointer"
        >
          <option value="All">Treatment · all</option>
          <option value="Implants">Implants</option>
          <option value="Endo">Root canal &amp; crowns</option>
          <option value="Prostho">Dentures &amp; rehab</option>
          <option value="Cosmetic">Cosmetic</option>
          <option value="Surgery">Surgery</option>
        </select>
        <div className="flex-1" />
        <div className="text-xs text-muted">
          <span className="font-semibold text-ink">{visible.length} plans</span> · this is the
          reconciliation view, not the day's work
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div
          className="grid gap-2.5 items-center px-3.5 py-[9px] border-b border-border bg-bg-content text-[10.5px] font-bold tracking-[0.06em] text-muted-2"
          style={{ gridTemplateColumns: GRID }}
        >
          <span>PATIENT</span>
          <span>RECOMMENDED</span>
          <span className="text-right">VALUE</span>
          <span>PLANNED</span>
          <span>URGENCY</span>
          <span>LAST CONTACT</span>
          <span>FOLLOW-UP</span>
          <span />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="Nothing matches these filters"
            body="Widen the filters, or go back to today's queue — that's where the work is."
          />
        ) : (
          visible.map((r) => {
            const p = patients.find((x) => x.id === r.patientId)!;
            const overdue = r.due === "overdue";
            const today = r.due === "today";
            return (
              <div
                key={r.id}
                data-row
                tabIndex={0}
                className="grid gap-2.5 items-center px-3.5 py-[11px] text-[12.5px] hover:bg-bg-content outline-none border-b border-border-faint"
                style={{ gridTemplateColumns: GRID, opacity: r.declined ? 0.45 : 1 }}
              >
                <button className="text-left min-w-0" onClick={() => onOpenPatient(r.patientId)}>
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-2 font-mono">{p.phone}</div>
                </button>
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.proc}</div>
                  <div className="text-[11px] text-muted-2">{r.tooth}</div>
                </div>
                <div className="text-right font-bold tnum">{inr(r.valuePaise)}</div>
                <div>
                  <div className="text-xs">{r.planned}</div>
                  <div className="text-[11px] text-muted-2">{r.ago}</div>
                </div>
                <div>
                  <UrgencyBadge urgency={r.urgency} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs truncate">{r.lastContact}</div>
                  <div className="text-[11px] text-muted-2 truncate">{r.lastSub || "—"}</div>
                </div>
                <div
                  className="text-xs"
                  style={{
                    fontWeight: overdue || today ? 700 : 500,
                    color: r.declined
                      ? "var(--muted-2)"
                      : overdue
                        ? "var(--danger)"
                        : today
                          ? "var(--warning)"
                          : "var(--muted)",
                  }}
                >
                  {r.declined
                    ? "Suppressed"
                    : overdue
                      ? r.dueText || "Overdue"
                      : today
                        ? "Due today"
                        : r.due}
                </div>
                <div className="flex gap-1.5 justify-end">
                  <a
                    href={telLink(p.phone)}
                    className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-[7px] border border-primary-tint-border bg-primary-tint text-primary"
                  >
                    Call
                  </a>
                  <a
                    href={waLink(p.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-[7px] border border-border bg-surface hover:bg-bg"
                  >
                    Msg
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
