import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Drawer, DrawerCloseButton } from "@/components/common/drawer";
import { AppointmentStatusBadge, FlagChips } from "@/components/common/status-badge";
import { MedicalAlertBadge } from "@/components/common/medical-alert-badge";
import { Icon } from "@/components/ui/icon";
import { fmtHour, fmtHourRange, inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/hooks/use-ui-store";
import { useDeskStore } from "@/hooks/use-desk-store";
import { useClinicNow } from "@/hooks/use-clinic-now";
import { appointmentStatusStyle, flagLabel } from "@/design/status";
import { appointments as seed, waitlist, chairSubs, doctorSubs, patients } from "@/lib/mock-data";
import { inferFeePaise, formatDuration } from "@/config/procedures";
import type { Appointment } from "@/types";
import type { AppointmentStatus } from "@/types/enums";

/*
 * The appointment book.
 *
 * The previous version rendered the day correctly and did nothing when you
 * touched it — every interaction produced a toast describing what would happen
 * in a real product. This one does the things.
 *
 *   Drag on empty space to create. The block you draw is *held*, and the
 *   booking bar opens with it pinned at the top — the calendar and the booking
 *   bar are one flow, not two features, and she shouldn't have to describe back
 *   to the system the thing she just drew.
 *
 *   Drag a block to move it, between times and between chairs. Drag its bottom
 *   edge to change how long it is. Both snap to fifteen minutes, because that
 *   is the grid a practice actually books on.
 *
 *   Conflicts are refused while you're still holding the mouse, not after you
 *   let go. The ghost turns red and says why.
 *
 *   Density is adjustable. A four-chair practice at full tilt needs to see the
 *   whole day at once; a quiet Tuesday wants the detail. One control, three
 *   steps, and it changes one number.
 *
 *   Gaps are drawn as objects rather than as absence — "45 min free, fill from
 *   waitlist" sitting in the hole. A hole nobody can see is a hole nobody fills.
 */

const START = 9;
const END = 20;
const LUNCH_START = 13;
const LUNCH_END = 14;
const SNAP = 0.25;
const GUTTER = 56;
const MIN_DUR = 0.25;
/** A hole worth surfacing. */
const GAP_MIN_MINUTES = 30;

const DENSITIES = [
  { id: "compact", label: "Compact", hourH: 42 },
  { id: "normal", label: "Normal", hourH: 64 },
  { id: "roomy", label: "Roomy", hourH: 92 },
] as const;
type DensityId = (typeof DENSITIES)[number]["id"];

type View = "day" | "list";
type GroupBy = "chair" | "doctor";

type Drag =
  | { mode: "create"; col: number; anchor: number; to: number; moved: boolean }
  | { mode: "move"; id: string; col: number; start: number; dur: number; grab: number; moved: boolean }
  | { mode: "resize"; id: string; col: number; start: number; dur: number; moved: boolean }
  | null;

// ---------------------------------------------------------------------------

function snap(t: number): number {
  return Math.round(t / SNAP) * SNAP;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Status-transition action lists per current status. */
function actionsFor(a: Appointment): { label: string; primary: boolean; next?: AppointmentStatus; msg: string }[] {
  const map: Record<AppointmentStatus, { label: string; primary: boolean; next?: AppointmentStatus; msg: string }[]> = {
    booked: [
      { label: "Confirm appointment", primary: true, next: "confirmed", msg: `Confirmed — confirmation queued to ${a.name}` },
      { label: "Check in", primary: false, next: "arrived", msg: `${a.name} checked in — ${a.doctor} notified` },
      { label: "Cancel", primary: false, next: "cancelled", msg: "Cancelled — the slot was offered to the waitlist" },
      { label: "Mark no-show", primary: false, next: "noshow", msg: "Marked as no-show — a follow-up task was created" },
    ],
    confirmed: [
      { label: "Check in", primary: true, next: "arrived", msg: `${a.name} checked in — ${a.doctor} notified` },
      { label: "Cancel", primary: false, next: "cancelled", msg: "Cancelled — the slot was offered to the waitlist" },
      { label: "Mark no-show", primary: false, next: "noshow", msg: "Marked as no-show — a follow-up task was created" },
    ],
    arrived: [
      { label: "Start treatment", primary: true, next: "inchair", msg: `${a.name} is in the chair` },
    ],
    inchair: [
      { label: "Complete visit", primary: true, next: "done", msg: "Visit completed — a draft invoice was created" },
    ],
    done: [
      { label: "Book next visit", primary: false, msg: `Booking form opens with ${a.name}'s details` },
    ],
    cancelled: [
      { label: "Rebook", primary: true, msg: `Booking form opens with ${a.name}'s details` },
      { label: "Offer slot to waitlist", primary: false, msg: "This slot was offered to the waitlist" },
    ],
    noshow: [
      { label: "Call patient", primary: true, msg: `Calling ${a.name}` },
      { label: "Rebook", primary: false, msg: `Booking form opens with ${a.name}'s details` },
    ],
  };
  return map[a.status];
}

// ---------------------------------------------------------------------------

export function CalendarScreen() {
  const { showToast, openPatientPreview } = useUIStore();
  const { openBooking, openSettle } = useDeskStore();
  const now = useClinicNow();

  const [view, setView] = useState<View>("day");
  const [groupBy, setGroupBy] = useState<GroupBy>("chair");
  const [density, setDensity] = useState<DensityId>("normal");
  const [appts, setAppts] = useState<Appointment[]>(seed);
  const [apptId, setApptId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const hourH = DENSITIES.find((d) => d.id === density)!.hourH;
  const dayH = (END - START) * hourH;

  const cols = useMemo(
    () =>
      groupBy === "chair"
        ? ["Chair 1", "Chair 2", "Chair 3", "Chair 4"].map((c) => ({
            key: c,
            name: c,
            sub: chairSubs[c],
            field: "chair" as const,
          }))
        : ["Dr. Meher", "Dr. Kulkarni", "Dr. Patil"].map((d) => ({
            key: d,
            name: d,
            sub: doctorSubs[d],
            field: "doctor" as const,
          })),
    [groupBy],
  );

  const active = apptId ? appts.find((a) => a.id === apptId) ?? null : null;

  const setStatus = (id: string, next: AppointmentStatus, msg: string) => {
    setAppts((as) => as.map((a) => (a.id === id ? { ...a, status: next } : a)));
    showToast(msg);
  };

  // --- coordinate maths ----------------------------------------------------

  const pointToSlot = useCallback(
    (clientX: number, clientY: number) => {
      const el = gridRef.current;
      if (!el) return { t: START, col: 0 };
      const rect = el.getBoundingClientRect();
      const t = clamp(START + (clientY - rect.top) / hourH, START, END);
      const colW = (rect.width - GUTTER) / cols.length;
      const col = clamp(Math.floor((clientX - rect.left - GUTTER) / colW), 0, cols.length - 1);
      return { t, col };
    },
    [cols.length, hourH],
  );

  /**
   * Would this land on top of something?
   *
   * Checked continuously while dragging rather than on drop, because being told
   * "that doesn't fit" after you've let go is being told too late.
   */
  const conflictAt = useCallback(
    (colIndex: number, start: number, dur: number, ignoreId?: string): string | null => {
      if (start < START) return "Before the clinic opens";
      if (start + dur > END) return "After the clinic closes";
      if (start < LUNCH_END && start + dur > LUNCH_START) return "Runs across lunch";

      const field = cols[colIndex].field;
      const key = cols[colIndex].key;
      const clash = appts.find(
        (a) =>
          a.id !== ignoreId &&
          a[field] === key &&
          a.status !== "cancelled" &&
          start < a.start + a.dur &&
          start + dur > a.start,
      );
      return clash ? `Overlaps ${clash.name}` : null;
    },
    [appts, cols],
  );

  /**
   * Hand a drawn slot to the booking bar.
   *
   * Declared before the drag effect that calls it — legal either way, but a
   * reader shouldn't have to reason about temporal dead zones to follow a drop
   * handler.
   */
  const holdSlot = useCallback(
    (colIndex: number, start: number, dur: number) => {
      const c = cols[colIndex];
      const chair = c.field === "chair" ? c.key : "Chair 1";
      const doctor = c.field === "doctor" ? c.key : chairSubs[c.key] ?? "Dr. Meher";
      openBooking({
        heldSlot: { chair, doctor, offset: 0, start, minutes: Math.round(dur * 60) },
        request: `${Math.round(dur * 60)} min today`,
      });
    },
    [cols, openBooking],
  );

  // --- dragging ------------------------------------------------------------

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const { t, col } = pointToSlot(e.clientX, e.clientY);

      setDrag((d) => {
        if (!d) return d;

        if (d.mode === "create") {
          const to = clamp(t, START, END);
          return { ...d, to, col, moved: d.moved || Math.abs(to - d.anchor) > 0.1 };
        }
        if (d.mode === "move") {
          const start = clamp(snap(t - d.grab), START, END - d.dur);
          return { ...d, col, start, moved: true };
        }
        // resize
        const dur = Math.max(MIN_DUR, snap(t - d.start));
        return { ...d, dur, moved: true };
      });
    };

    /*
     * The drop. Side effects live here rather than inside a state updater —
     * React may call an updater twice, and booking someone in twice because of
     * StrictMode is exactly the class of bug this product cannot have.
     */
    const onUp = () => {
      const d = drag;
      setDrag(null);
      setConflict(null);
      if (!d) return;

      if (d.mode === "create") {
        const from = snap(Math.min(d.anchor, d.to));
        const to = snap(Math.max(d.anchor, d.to));
        const dur = Math.max(MIN_DUR, to - from || 0.5);
        const why = conflictAt(d.col, from, dur);
        if (why) showToast(`Can't book there — ${why.toLowerCase()}`);
        else holdSlot(d.col, from, dur);
        return;
      }

      const appt = appts.find((a) => a.id === d.id);
      if (!appt || !d.moved) return;

      if (d.mode === "move") {
        const why = conflictAt(d.col, d.start, d.dur, d.id);
        if (why) return showToast(`Can't move there — ${why.toLowerCase()}`);
        // Written out rather than using a computed key, so the result stays a
        // plain Appointment rather than widening to an index signature.
        const target = cols[d.col];
        setAppts((as) =>
          as.map((a) => {
            if (a.id !== d.id) return a;
            return target.field === "chair"
              ? { ...a, start: d.start, chair: target.key }
              : { ...a, start: d.start, doctor: target.key };
          }),
        );
        showToast(
          `${appt.name} moved to ${fmtHour(d.start)} · ${cols[d.col].key} — confirmation queued`,
        );
        return;
      }

      const why = conflictAt(d.col, d.start, d.dur, d.id);
      if (why) return showToast(`Can't extend there — ${why.toLowerCase()}`);
      setAppts((as) => as.map((a) => (a.id === d.id ? { ...a, dur: d.dur } : a)));
      showToast(`${appt.name} — now ${formatDuration(Math.round(d.dur * 60))}`);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, pointToSlot, conflictAt, holdSlot, appts, cols, showToast]);

  /* Live conflict feedback while the pointer is still down. */
  useEffect(() => {
    if (!drag) {
      setConflict(null);
      return;
    }
    if (drag.mode === "create") {
      const from = snap(Math.min(drag.anchor, drag.to));
      const to = snap(Math.max(drag.anchor, drag.to));
      setConflict(conflictAt(drag.col, from, Math.max(MIN_DUR, to - from)));
    } else {
      setConflict(conflictAt(drag.col, drag.start, drag.dur, drag.id));
    }
  }, [drag, conflictAt]);

  // --- gaps ----------------------------------------------------------------

  const gapsByCol = useMemo(() => {
    return cols.map((c) => {
      const busy = appts
        .filter((a) => a[c.field] === c.key && a.status !== "cancelled")
        .map((a) => ({ s: a.start, e: a.start + a.dur }))
        .concat([{ s: LUNCH_START, e: LUNCH_END }])
        .sort((x, y) => x.s - y.s);

      const out: { start: number; minutes: number }[] = [];
      let cursor = Math.max(START, now);
      for (const b of busy) {
        if (b.e <= cursor) continue;
        if (b.s > cursor) {
          const minutes = Math.round((Math.min(b.s, END) - cursor) * 60);
          if (minutes >= GAP_MIN_MINUTES) out.push({ start: cursor, minutes });
        }
        cursor = Math.max(cursor, b.e);
      }
      return out;
    });
  }, [appts, cols, now]);

  const idleMinutes = gapsByCol.flat().reduce((s, g) => s + g.minutes, 0);

  // --- render --------------------------------------------------------------

  const hours: { top: number; label: string }[] = [];
  for (let h = START; h <= END - 1; h++) {
    hours.push({
      top: (h - START) * hourH,
      label: h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`,
    });
  }

  const dragBlock = drag
    ? drag.mode === "create"
      ? {
          col: drag.col,
          start: snap(Math.min(drag.anchor, drag.to)),
          dur: Math.max(MIN_DUR, snap(Math.abs(drag.to - drag.anchor)) || 0.5),
        }
      : { col: drag.col, start: drag.start, dur: drag.dur }
    : null;

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-3">
      {/* Control bar */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <Segmented
          options={[["day", "Day"], ["list", "List"]]}
          value={view}
          onChange={(v) => setView(v as View)}
        />

        <div className="flex items-center gap-0.5 border border-border rounded-md bg-surface p-0.5">
          <button
            onClick={() => showToast("This prototype carries one day of data — Mon, 20 Jul")}
            className="w-[26px] h-[26px] grid place-items-center rounded-[6px] text-muted hover:bg-bg"
          >
            ‹
          </button>
          <button
            onClick={() => showToast("Already on today")}
            className="px-2.5 py-1 text-xs font-semibold rounded-[6px] hover:bg-bg"
          >
            Today
          </button>
          <button
            onClick={() => showToast("This prototype carries one day of data — Mon, 20 Jul")}
            className="w-[26px] h-[26px] grid place-items-center rounded-[6px] text-muted hover:bg-bg"
          >
            ›
          </button>
        </div>

        <span className="text-[13px] font-semibold">Mon, 20 Jul 2026</span>

        <Segmented
          options={[["chair", "By chair"], ["doctor", "By doctor"]]}
          value={groupBy}
          onChange={(v) => setGroupBy(v as GroupBy)}
        />

        {/* Density — compress the axis when the day is full. */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-2 max-md:hidden">Density</span>
          <Segmented
            options={DENSITIES.map((d) => [d.id, d.label] as [string, string])}
            value={density}
            onChange={(v) => setDensity(v as DensityId)}
          />
        </div>

        <div className="flex-1" />

        {idleMinutes > 0 && (
          <span className="text-[11.5px] text-warning font-semibold tnum">
            {formatDuration(idleMinutes)} unsold today
          </span>
        )}

        <button
          onClick={() => openBooking()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-on-primary text-[12.5px] font-semibold hover:bg-primary-hover"
        >
          <Icon name="plus" size={13} strokeWidth={1.6} /> New appointment
        </button>
      </div>

      <div className="grid grid-cols-[1fr_250px] gap-3.5 items-start max-lg:grid-cols-1">
        <Panel className="overflow-hidden">
          {view === "list" ? (
            <ListView appts={appts} onOpen={setApptId} />
          ) : (
            <>
              {/* Column heads */}
              <div className="flex border-b border-border bg-bg-content">
                <div style={{ width: GUTTER }} className="flex-none" />
                {cols.map((c, i) => (
                  <div key={c.key} className="flex-1 px-2.5 py-2 border-l border-border-faint">
                    <div className="text-[12.5px] font-semibold">{c.name}</div>
                    <div className="text-[11px] text-muted-2 flex items-center gap-1.5">
                      {c.sub}
                      {gapsByCol[i].length > 0 && (
                        <span className="text-warning font-semibold">
                          · {formatDuration(gapsByCol[i].reduce((s, g) => s + g.minutes, 0))} free
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div ref={gridRef} className="flex relative select-none" style={{ height: dayH }}>
                <div className="flex-none relative" style={{ width: GUTTER, height: dayH }}>
                  {hours.map((h) => (
                    <div
                      key={h.label}
                      className="absolute right-2 text-[10px] text-muted-2 font-mono -translate-y-1/2"
                      style={{ top: h.top }}
                    >
                      {h.label}
                    </div>
                  ))}
                </div>

                {cols.map((c, ci) => (
                  <div
                    key={c.key}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      const { t } = pointToSlot(e.clientX, e.clientY);
                      setDrag({
                        mode: "create",
                        col: ci,
                        anchor: snap(t),
                        to: snap(t) + 0.5,
                        moved: false,
                      });
                    }}
                    className="flex-1 relative border-l border-border-faint cursor-copy"
                    style={{
                      height: dayH,
                      backgroundImage: `repeating-linear-gradient(to bottom,#F0EEE8 0 1px,transparent 1px ${hourH}px)`,
                    }}
                  >
                    {/* Lunch */}
                    <div
                      className="absolute left-0 right-0 hatch-lunch grid place-items-center pointer-events-none"
                      style={{
                        top: (LUNCH_START - START) * hourH,
                        height: (LUNCH_END - LUNCH_START) * hourH,
                      }}
                    >
                      <span className="text-[10px] font-semibold tracking-[0.06em] text-muted-3">
                        LUNCH
                      </span>
                    </div>

                    {/* Gaps, drawn as objects rather than as absence. */}
                    {gapsByCol[ci].map((g) => (
                      <GapBlock
                        key={`${c.key}-${g.start}`}
                        top={(g.start - START) * hourH + 2}
                        height={(g.minutes / 60) * hourH - 4}
                        minutes={g.minutes}
                        onFill={(e) => {
                          e.stopPropagation();
                          holdSlot(ci, g.start, g.minutes / 60);
                        }}
                      />
                    ))}

                    {/* Appointments */}
                    {appts
                      .filter((a) => a[c.field] === c.key)
                      .map((a) => (
                        <ApptBlock
                          key={a.id}
                          appt={a}
                          hourH={hourH}
                          groupBy={groupBy}
                          dragging={drag !== null && drag.mode !== "create" && drag.id === a.id}
                          onOpen={() => setApptId(a.id)}
                          onGrab={(e, grab) => {
                            setDrag({
                              mode: "move",
                              id: a.id,
                              col: ci,
                              start: a.start,
                              dur: a.dur,
                              grab,
                              moved: false,
                            });
                            e.stopPropagation();
                          }}
                          onResize={(e) => {
                            setDrag({
                              mode: "resize",
                              id: a.id,
                              col: ci,
                              start: a.start,
                              dur: a.dur,
                              moved: false,
                            });
                            e.stopPropagation();
                          }}
                        />
                      ))}
                  </div>
                ))}

                {/* Drag ghost */}
                {dragBlock && (
                  <DragGhost
                    colIndex={dragBlock.col}
                    colCount={cols.length}
                    top={(dragBlock.start - START) * hourH}
                    height={dragBlock.dur * hourH}
                    label={`${fmtHour(dragBlock.start)}–${fmtHour(dragBlock.start + dragBlock.dur)} · ${formatDuration(Math.round(dragBlock.dur * 60))}`}
                    conflict={conflict}
                  />
                )}

                {/* Now line */}
                {now > START && now < END && (
                  <div
                    className="absolute right-0 h-0.5 bg-danger pointer-events-none z-[6]"
                    style={{ left: GUTTER, top: Math.round((now - START) * hourH) }}
                  >
                    <div className="absolute -left-[5px] -top-[3px] w-2 h-2 rounded-full bg-danger" />
                    <span className="absolute -left-[46px] -top-[7px] text-[9.5px] font-bold font-mono text-danger">
                      {fmtHour(now)}
                    </span>
                  </div>
                )}
              </div>

              <div className="px-3.5 py-2 border-t border-border bg-bg-content text-[11px] text-muted-2">
                Drag on empty space to hold a slot · drag a block to move it · drag its bottom edge
                to change the length
              </div>
            </>
          )}
        </Panel>

        {/* Waitlist rail */}
        <Panel className="p-4 flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <MicroLabel>WAITLIST</MicroLabel>
            <span className="text-[11px] text-muted-2">{waitlist.length} waiting</span>
          </div>
          <div className="text-[11.5px] text-muted leading-relaxed">
            Patients who want an earlier slot. When something cancels, offer them the gap.
          </div>

          {waitlist.map((w) => (
            <div key={w.name} className="border border-border rounded-[10px] px-3 py-2.5 flex flex-col gap-1">
              <div className="flex justify-between gap-1.5">
                <span className="text-[12.5px] font-semibold">{w.name}</span>
                <span className="text-[10.5px] text-muted-2 whitespace-nowrap">{w.since}</span>
              </div>
              <div className="text-[11.5px] text-muted leading-snug">{w.want}</div>
              <button
                onClick={() => {
                  const firstGap = gapsByCol.flatMap((gs, ci) => gs.map((g) => ({ ...g, ci })))[0];
                  if (!firstGap) return showToast("No gaps left today to offer");
                  holdSlot(firstGap.ci, firstGap.start, Math.min(1, firstGap.minutes / 60));
                }}
                className="mt-1 text-[11.5px] font-semibold py-1.5 rounded-[7px] border border-primary-tint-border bg-primary-tint text-primary hover:bg-primary-tint-border"
              >
                Offer the next gap
              </button>
            </div>
          ))}

          {idleMinutes > 0 && (
            <div
              className="rounded-[10px] px-3 py-2.5 text-[11.5px] leading-snug"
              style={{ background: "var(--warning-bg)", border: "1px solid var(--warning-border)" }}
            >
              <b className="text-warning">{formatDuration(idleMinutes)}</b> of chair time is still
              unsold today. At this practice's average that's roughly{" "}
              <b className="tnum">{inr(Math.round((idleMinutes / 60) * averageHourlyPaise(appts)))}</b>.
            </div>
          )}
        </Panel>
      </div>

      {/* Appointment detail drawer */}
      <Drawer open={!!active} onClose={() => setApptId(null)} width={360}>
        {active && (
          <>
            <div className="flex items-start gap-3 px-[18px] pt-[18px] pb-3.5 border-b border-border">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-muted-2 font-mono">
                  Today · {fmtHourRange(active.start, active.dur)}
                </div>
                <div className="text-[15px] font-semibold tracking-[-0.01em] mt-0.5">
                  {active.name}{" "}
                  <span className="font-normal text-muted-2 text-[12.5px]">{active.agesex}</span>
                </div>
                <div className="text-[12.5px] text-muted mt-0.5">{active.proc}</div>
                <div className="text-[11.5px] text-muted-2 mt-0.5">
                  {active.chair} · {active.doctor}
                </div>
              </div>
              <DrawerCloseButton onClose={() => setApptId(null)} />
            </div>

            <div className="flex-1 overflow-y-auto px-[18px] py-3.5 flex flex-col gap-3.5">
              <div className="flex items-center gap-2 flex-wrap">
                <AppointmentStatusBadge status={active.status} />
                <MedicalAlertBadge alert={patientFor(active.name)?.alert} variant="chip" />
                <FlagChips flags={active.flags} />
              </div>

              <div className="text-[11.5px] text-muted">
                {formatDuration(Math.round(active.dur * 60))} in the chair · about{" "}
                <b className="tnum text-ink">{inr(inferFeePaise(active.proc))}</b> expected
              </div>

              <div className="flex flex-col gap-[7px]">
                <MicroLabel className="text-[11px]">ACTIONS</MicroLabel>
                {actionsFor(active).map((ac) => (
                  <button
                    key={ac.label}
                    onClick={() => (ac.next ? setStatus(active.id, ac.next, ac.msg) : showToast(ac.msg))}
                    className="text-[12.5px] font-semibold py-2.5 rounded-md border hover:opacity-85"
                    style={{
                      background: ac.primary ? "var(--primary)" : "var(--surface)",
                      color: ac.primary
                        ? "var(--on-primary)"
                        : ac.label === "Cancel" || ac.label === "Mark no-show"
                          ? "var(--danger)"
                          : "var(--ink)",
                      borderColor: ac.primary ? "var(--primary)" : "var(--border)",
                    }}
                  >
                    {ac.label}
                  </button>
                ))}
                <div className="text-[11px] text-muted-2 mt-0.5">
                  To reschedule, drag the block. To change how long it runs, drag its bottom edge.
                </div>
              </div>
            </div>

            <div className="flex gap-2 px-[18px] py-3.5 border-t border-border">
              <button
                onClick={() => {
                  const p = patientFor(active.name);
                  if (p) openPatientPreview(p.id);
                  else showToast(`${active.name} has no record yet`);
                }}
                className="flex-1 text-center text-[12.5px] font-semibold py-2.5 rounded-md border border-border bg-surface hover:bg-bg"
              >
                Open record
              </button>
              <button
                onClick={() => {
                  const p = patientFor(active.name);
                  if (p) openSettle(p.id);
                  else showToast("No account to settle against yet");
                }}
                className="flex-1 text-center text-[12.5px] font-semibold py-2.5 rounded-md border border-border bg-surface hover:bg-bg"
              >
                Settle
              </button>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ApptBlock({
  appt,
  hourH,
  groupBy,
  dragging,
  onOpen,
  onGrab,
  onResize,
}: {
  appt: Appointment;
  hourH: number;
  groupBy: GroupBy;
  dragging: boolean;
  onOpen: () => void;
  onGrab: (e: React.PointerEvent, grabOffsetHours: number) => void;
  onResize: (e: React.PointerEvent) => void;
}) {
  const st = appointmentStatusStyle[appt.status];
  const movedRef = useRef(false);
  const alert = patientFor(appt.name)?.alert;

  const height = appt.dur * hourH - 4;
  const roomy = height > 52;

  return (
    <div
      onPointerDown={(e) => {
        movedRef.current = false;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onGrab(e, (e.clientY - rect.top) / hourH);
      }}
      onPointerMove={(e) => {
        // Only a move *with the button held* counts — otherwise hovering a
        // block before clicking it would swallow the click.
        if (e.buttons > 0) movedRef.current = true;
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!movedRef.current) onOpen();
      }}
      className={cn(
        "absolute left-1 right-1 rounded-md px-2 py-[3px] overflow-hidden flex flex-col gap-px",
        "cursor-grab active:cursor-grabbing hover:shadow-card-hover",
        st.hatch && "hatch-cancelled",
        dragging && "opacity-40",
      )}
      style={{
        top: (appt.start - START) * hourH + 1,
        height,
        background: st.hatch ? undefined : st.bg,
        border: `1px solid ${st.border}`,
        color: st.color,
        zIndex: dragging ? 1 : 2,
      }}
    >
      <div className="flex justify-between gap-1.5 text-[9.5px] leading-tight">
        <span className="font-mono" style={{ color: st.sub }}>
          {fmtHour(appt.start)}
        </span>
        <span className="flex items-center gap-1">
          {alert && <span className="w-[5px] h-[5px] rounded-full bg-danger" title={alert} />}
          <span
            className="font-bold tracking-[0.03em] whitespace-nowrap"
            style={{ color: st.labelColor }}
          >
            {st.label}
          </span>
        </span>
      </div>

      <div className="text-[11.5px] font-semibold leading-tight truncate" style={{ color: st.color }}>
        {appt.name}{" "}
        <span className="font-normal" style={{ color: st.sub }}>
          {appt.agesex}
        </span>
      </div>

      {roomy && (
        <>
          <div className="text-[10.5px] leading-tight truncate" style={{ color: st.sub }}>
            {appt.proc} · {groupBy === "chair" ? appt.doctor : appt.chair}
          </div>
          {appt.flags.length > 0 && (
            <div className="flex gap-1 mt-auto pb-0.5 flex-wrap">
              {appt.flags.map((f) => (
                <span
                  key={f}
                  className="text-[8.5px] font-bold tracking-[0.04em] px-1.5 py-px rounded-sm"
                  style={{ background: "rgba(33,32,28,0.07)", color: st.sub }}
                >
                  {flagLabel[f]}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* Resize handle — the affordance appears on hover, the target is always there. */}
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          onResize(e);
        }}
        className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize group/resize grid place-items-end"
      >
        <span className="w-6 h-[3px] rounded-full bg-current opacity-0 hover:opacity-30 mb-px" />
      </div>
    </div>
  );
}

function GapBlock({
  top,
  height,
  minutes,
  onFill,
}: {
  top: number;
  height: number;
  minutes: number;
  onFill: (e: React.MouseEvent) => void;
}) {
  const tight = height < 34;

  return (
    <div
      className="absolute left-1 right-1 rounded-md border border-dashed flex items-center justify-center gap-1.5 pointer-events-none"
      style={{
        top,
        height: Math.max(18, height),
        borderColor: "var(--warning-border)",
        background: "rgba(250,243,231,0.55)",
      }}
    >
      <span className="text-[10px] font-semibold text-warning-text whitespace-nowrap">
        {formatDuration(minutes)} free
      </span>
      {!tight && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onFill}
          className="pointer-events-auto text-[10px] font-bold px-1.5 py-0.5 rounded-[5px] bg-warning text-on-primary hover:opacity-90"
        >
          FILL
        </button>
      )}
    </div>
  );
}

function DragGhost({
  colIndex,
  colCount,
  top,
  height,
  label,
  conflict,
}: {
  colIndex: number;
  colCount: number;
  top: number;
  height: number;
  label: string;
  conflict: string | null;
}) {
  const pct = 100 / colCount;

  return (
    <div
      className="absolute pointer-events-none z-[7] rounded-md border-2 flex flex-col justify-center px-2"
      style={{
        left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${colIndex / colCount})`,
        width: `calc((100% - ${GUTTER}px) * ${pct / 100})`,
        top,
        height: Math.max(20, height),
        borderColor: conflict ? "var(--danger)" : "var(--primary)",
        background: conflict ? "rgba(168,52,42,0.12)" : "rgba(32,97,78,0.12)",
      }}
    >
      <span
        className="text-[10.5px] font-bold leading-tight"
        style={{ color: conflict ? "var(--danger)" : "var(--primary)" }}
      >
        {conflict ?? label}
      </span>
      {!conflict && height > 34 && (
        <span className="text-[10px] leading-tight" style={{ color: "var(--primary)" }}>
          Release to hold this slot
        </span>
      )}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex border border-border rounded-md overflow-hidden bg-surface">
      {options.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className="px-3 py-1.5 text-xs font-semibold hover:opacity-85"
          style={{
            background: value === id ? "var(--primary)" : "var(--surface)",
            color: value === id ? "var(--on-primary)" : "var(--muted)",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ListView({ appts, onOpen }: { appts: Appointment[]; onOpen: (id: string) => void }) {
  const rows = appts.slice().sort((a, b) => a.start - b.start);
  const GRID = "110px 1.4fr 1.6fr 1fr 0.8fr 110px";
  return (
    <>
      <div
        className="grid gap-2.5 px-3.5 py-[9px] border-b border-border bg-bg-content text-[10.5px] font-bold tracking-[0.06em] text-muted-2"
        style={{ gridTemplateColumns: GRID }}
      >
        <span>TIME</span>
        <span>PATIENT</span>
        <span>PROCEDURE</span>
        <span>DOCTOR</span>
        <span>CHAIR</span>
        <span>STATUS</span>
      </div>
      {rows.map((a) => (
        <button
          key={a.id}
          onClick={() => onOpen(a.id)}
          className="grid gap-2.5 items-center px-3.5 py-2.5 border-b border-border-faint text-[12.5px] hover:bg-bg-content text-left w-full"
          style={{ gridTemplateColumns: GRID }}
        >
          <span className="font-mono text-[11.5px]">{fmtHourRange(a.start, a.dur)}</span>
          <span className="font-semibold">
            {a.name} <span className="font-normal text-muted-2">{a.agesex}</span>
          </span>
          <span>{a.proc}</span>
          <span className="text-muted">{a.doctor}</span>
          <span className="text-muted">{a.chair}</span>
          <span>
            <AppointmentStatusBadge status={a.status} />
          </span>
        </button>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------

function patientFor(name: string) {
  return patients.find((p) => p.name === name);
}

/** What an hour of chair time is worth here, from this day's own book. */
function averageHourlyPaise(appts: Appointment[]): number {
  const booked = appts.filter((a) => a.status !== "cancelled");
  const hours = booked.reduce((s, a) => s + a.dur, 0);
  if (hours === 0) return 0;
  return booked.reduce((s, a) => s + inferFeePaise(a.proc), 0) / hours;
}
