import { useEffect, useMemo, useRef, useState } from "react";
import { useDeskStore } from "@/hooks/use-desk-store";
import { useUIStore } from "@/hooks/use-ui-store";
import { useClinicNow } from "@/hooks/use-clinic-now";
import { patients } from "@/lib/mock-data";
import { clinicConfig } from "@/config/clinic";
import { normalisePhone, draftConfirmation } from "@/lib/whatsapp";
import { formatDuration } from "@/config/procedures";
import {
  parseSlotRequest,
  findSlots,
  dayBook,
  relativeDayLabel,
  type SlotCandidate,
} from "@/lib/schedule";
import { fmtHour, inr } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { MedicalAlertBadge } from "@/components/common/medical-alert-badge";
import { cn } from "@/lib/utils";

/*
 * The Booking Bar.
 *
 * This is the highest-frequency interaction in the product — thirty to sixty
 * times a day, always with a caller on the line — and every design decision
 * here follows from that.
 *
 *   · It is an overlay, never a route. The screen behind it does not move, so
 *     an interruption costs nothing.
 *   · It never asks "is this patient new?". She cannot know that from a phone
 *     number spoken over a bad line. It searches; a match binds the patient, a
 *     miss reveals three fields in place. Same flow, different amount pre-filled.
 *   · The request is typed as a sentence, because the caller speaks in queries
 *     ("any evening next week?") and a grid only answers coordinates.
 *   · Duration is inferred from the procedure. She never does arithmetic with
 *     a patient on the line.
 *   · Confirmation is queued, never sent inline.
 */

const SOURCES = ["Phone", "Walk-in", "Google", "Instagram", "Referral", "Practo"];

export function BookingBar() {
  const { bookingOpen, booking, patchBooking, closeBooking, parkBooking } = useDeskStore();
  const { showToast } = useUIStore();
  const now = useClinicNow();

  const [cursor, setCursor] = useState(0);
  const phoneRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<HTMLInputElement>(null);

  // --- patient binding -----------------------------------------------------

  const digits = normalisePhone(booking.phone).slice(-10);
  const matched = useMemo(() => {
    if (digits.length < 4) return null;
    return patients.find((p) => normalisePhone(p.phone).endsWith(digits)) ?? null;
  }, [digits]);

  const boundPatient = booking.patientId
    ? patients.find((p) => p.id === booking.patientId) ?? null
    : matched;

  const isKnown = !!boundPatient;
  const needsCapture = !isKnown && digits.length >= 10;

  // --- request parsing -----------------------------------------------------

  const criteria = useMemo(() => parseSlotRequest(booking.request), [booking.request]);
  const found = useMemo(() => findSlots(criteria, 3, now), [criteria, now]);

  /*
   * A slot dragged out on the calendar is pinned to the top and preselected.
   * She drew it; she shouldn't have to find it again in a list.
   */
  const slots = useMemo(() => {
    const held = booking.heldSlot;
    if (!held) return found;
    const candidate: SlotCandidate = {
      id: "held",
      offset: held.offset,
      date: new Date(),
      chair: held.chair,
      doctor: held.doctor,
      start: held.start,
      minutes: held.minutes,
      sentence: `${relativeDayLabel(held.offset)} · ${fmtHour(held.start)} · ${held.doctor} · ${held.chair}`,
    };
    return [candidate, ...found.filter((f) => f.chair !== held.chair || f.start !== held.start).slice(0, 2)];
  }, [booking.heldSlot, found]);
  const selected = slots.find((s) => s.id === booking.selectedSlotId) ?? slots[cursor] ?? null;

  useEffect(() => setCursor(0), [booking.request]);

  useEffect(() => {
    if (bookingOpen) setTimeout(() => phoneRef.current?.focus(), 20);
  }, [bookingOpen]);

  const dirty =
    booking.phone.trim() !== "" || booking.request.trim() !== "" || booking.newName.trim() !== "";

  const patientLabel = boundPatient?.name || booking.newName.trim() || booking.phone.trim() || "New booking";

  const park = () => {
    parkBooking(patientLabel, criteria.procedure?.name ?? booking.request.trim() ?? undefined);
    showToast("Booking parked — pick it up from the shell");
  };

  const dismiss = () => {
    if (dirty) park();
    else closeBooking();
  };

  const canConfirm = (isKnown || booking.newName.trim().length > 1) && !!selected;

  const confirm = () => {
    if (!selected) return;
    const who = boundPatient?.name ?? booking.newName.trim();
    showToast(
      `${who} booked · ${relativeDayLabel(selected.offset)} ${fmtHour(selected.start)} · confirmation queued`,
    );
    closeBooking();
  };

  // --- keyboard ------------------------------------------------------------

  useEffect(() => {
    if (!bookingOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, Math.max(slots.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter" && slots.length > 0 && canConfirm) {
        e.preventDefault();
        confirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!bookingOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex justify-center pt-[10vh] px-4 animate-dc-fade"
      style={{ background: "rgba(33,32,28,0.32)" }}
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-label="Book an appointment"
        className="w-[620px] max-w-full h-fit max-h-[78vh] bg-surface rounded-xl shadow-palette flex flex-col overflow-hidden animate-dc-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-bg-content">
          <Icon name="schedule" size={14} className="text-primary" />
          <span className="text-[12px] font-bold tracking-[0.07em] text-muted">BOOK</span>
          <div className="flex-1" />
          <button
            onClick={park}
            disabled={!dirty}
            className="text-[11.5px] font-semibold text-muted hover:text-ink disabled:opacity-40 px-2 py-1 rounded-[5px] hover:bg-bg"
          >
            Park for later
          </button>
          <button
            onClick={closeBooking}
            aria-label="Close"
            className="w-[24px] h-[24px] grid place-items-center rounded-[6px] text-muted-2 hover:bg-bg"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto">
          {/* Step 1 — who */}
          <div className="px-4 pt-3.5 pb-3 border-b border-border-faint flex flex-col gap-2.5">
            <label className="flex items-center gap-2.5">
              <Icon name="phone" size={14} className="text-muted-2" />
              <input
                ref={phoneRef}
                value={booking.phone}
                onChange={(e) => patchBooking({ phone: e.target.value, patientId: null })}
                placeholder="Phone number — type or paste"
                inputMode="tel"
                className="flex-1 border-none outline-none text-[15px] bg-transparent text-ink placeholder:text-muted-2 font-mono tracking-tight"
              />
              {digits.length > 0 && digits.length < 10 && (
                <span className="text-[11px] text-muted-2 tnum">{digits.length}/10</span>
              )}
            </label>

            {/* A match binds silently — no "existing patient?" question is ever asked. */}
            {boundPatient && (
              <button
                onClick={() => patchBooking({ patientId: boundPatient.id })}
                className="flex items-center gap-2.5 text-left px-2.5 py-2 rounded-md bg-primary-tint border border-primary-tint-border animate-dc-row"
              >
                <Avatar name={boundPatient.name} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold flex items-center gap-1.5">
                    {boundPatient.name}
                    <span className="text-[11px] font-normal text-muted-2 font-mono">
                      {boundPatient.pno} · {boundPatient.agesex}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-muted mt-px">
                    Last seen {boundPatient.lastVisit}
                    {boundPatient.balancePaise > 0 && (
                      <>
                        {" · "}
                        <span className="text-danger font-semibold tnum">
                          {inr(boundPatient.balancePaise)} due
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <MedicalAlertBadge alert={boundPatient.alert} variant="chip" />
              </button>
            )}

            {/* A miss reveals three fields in place — same flow, less pre-filled. */}
            {needsCapture && (
              <div className="flex gap-2 animate-dc-row">
                <input
                  autoFocus
                  value={booking.newName}
                  onChange={(e) => patchBooking({ newName: e.target.value })}
                  placeholder="Name"
                  className="flex-1 text-[13px] px-2.5 py-1.5 border border-border rounded-md bg-bg-content outline-none focus:border-primary"
                />
                <select
                  value={booking.newSource}
                  onChange={(e) => patchBooking({ newSource: e.target.value })}
                  className="text-[12.5px] px-2 py-1.5 border border-border rounded-md bg-bg-content outline-none focus:border-primary"
                >
                  {SOURCES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <span className="self-center text-[11px] text-muted-2 whitespace-nowrap">
                  New — created on confirm
                </span>
              </div>
            )}
          </div>

          {/* Step 2 — what and when */}
          <div className="px-4 pt-3 pb-2.5 flex flex-col gap-2">
            <label className="flex items-center gap-2.5">
              <Icon name="search" size={14} className="text-muted-2" />
              <input
                ref={requestRef}
                value={booking.request}
                onChange={(e) => patchBooking({ request: e.target.value, selectedSlotId: null })}
                placeholder='e.g. "RCT anytime after 6 next week" or "cleaning Tuesday morning Dr Rohan"'
                className="flex-1 border-none outline-none text-[14px] bg-transparent text-ink placeholder:text-muted-2"
              />
            </label>

            {/* What the system believes it heard — always visible, always editable. */}
            <div className="flex flex-wrap items-center gap-1.5 min-h-[20px]">
              {criteria.understood.map((u) => (
                <span
                  key={u}
                  className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-[5px] bg-primary-tint text-primary border border-primary-tint-border"
                >
                  {u}
                </span>
              ))}
              <span className="text-[11px] text-muted-2">
                {formatDuration(criteria.minutes)} in the chair
                {criteria.procedure ? "" : " (default — no procedure recognised)"}
              </span>
            </div>
          </div>

          {/* Offers, as sentences */}
          <div className="px-2 pb-2 flex flex-col gap-0.5">
            {slots.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12.5px] text-muted">
                Nothing free that matches. Try widening the window — or open the
                calendar to move something.
              </div>
            ) : (
              slots.map((s, i) => (
                <SlotRow
                  key={s.id}
                  slot={s}
                  held={s.id === "held"}
                  active={i === cursor}
                  onHover={() => setCursor(i)}
                  onPick={() => {
                    patchBooking({ selectedSlotId: s.id });
                    setCursor(i);
                  }}
                />
              ))
            )}
          </div>

          {/* Ghost preview — sanity-check adjacency without leaving the bar. */}
          {selected && <SlotContext slot={selected} />}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-t border-border bg-bg-content">
          <div className="flex-1 text-[11px] text-muted-2 flex items-center gap-2.5">
            <Key>↑↓</Key> choose
            <Key>↵</Key> confirm
            <Key>esc</Key> park
          </div>
          {selected && (isKnown || booking.newName.trim()) && (
            <span className="text-[11px] text-muted truncate max-w-[210px]" title={confirmationPreview(boundPatient?.name ?? booking.newName, selected)}>
              WhatsApp confirmation queued on confirm
            </span>
          )}
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className="text-[12.5px] font-semibold px-3.5 py-1.5 rounded-md bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm booking
          </button>
        </div>
      </div>
    </div>
  );
}

function confirmationPreview(name: string, slot: SlotCandidate): string {
  return draftConfirmation({
    name: name.split(" ")[0],
    date: relativeDayLabel(slot.offset),
    time: fmtHour(slot.start),
    doctor: slot.doctor,
    clinic: clinicConfig.name,
  });
}

function SlotRow({
  slot,
  active,
  held,
  onHover,
  onPick,
}: {
  slot: SlotCandidate;
  active: boolean;
  held?: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <button
      onMouseEnter={onHover}
      onClick={onPick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
        active ? "bg-primary-tint" : "hover:bg-bg",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-8 rounded-full flex-none",
          active ? "bg-primary" : "bg-transparent",
        )}
      />
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-semibold text-ink">
          {slot.sentence}
          {held && (
            <span className="ml-1.5 text-[9.5px] font-bold px-1.5 py-px rounded-[4px] bg-primary text-on-primary align-middle">
              HELD
            </span>
          )}
        </span>
        <span className="block text-[11.5px] text-muted mt-px">
          {held
            ? `${formatDuration(slot.minutes)} · the slot you drew on the calendar`
            : `${formatDuration(slot.minutes)} · finishes ${fmtHour(slot.start + slot.minutes / 60)}`}
        </span>
      </span>
      {active && <span className="text-[11px] font-semibold text-primary">↵</span>}
    </button>
  );
}

/**
 * The two appointments either side of the proposed slot. Enough to catch
 * "you've put a ninety-minute implant right before the school run" without
 * opening the calendar.
 */
function SlotContext({ slot }: { slot: SlotCandidate }) {
  const book = dayBook(slot.offset)
    .filter((b) => b.chair === slot.chair)
    .sort((a, b) => a.start - b.start);

  const before = [...book].reverse().find((b) => b.start + b.dur <= slot.start + 0.001);
  const after = book.find((b) => b.start >= slot.start + slot.minutes / 60 - 0.001);

  return (
    <div className="mx-4 mb-3 rounded-md border border-border bg-bg-content px-3 py-2 flex flex-col gap-1">
      <div className="text-[10px] font-bold tracking-[0.07em] text-muted-2">
        {slot.chair.toUpperCase()} · {relativeDayLabel(slot.offset).toUpperCase()}
      </div>
      <ContextLine
        time={before ? fmtHour(before.start) : "—"}
        text={before ? `${before.proc}` : "Nothing before"}
        dim
      />
      <ContextLine
        time={fmtHour(slot.start)}
        text={`This booking · ${formatDuration(slot.minutes)}`}
        highlight
      />
      <ContextLine
        time={after ? fmtHour(after.start) : "—"}
        text={after ? `${after.proc}` : "Nothing after"}
        dim
      />
    </div>
  );
}

function ContextLine({
  time,
  text,
  dim,
  highlight,
}: {
  time: string;
  text: string;
  dim?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 text-[11.5px]">
      <span className={cn("font-mono w-[52px] shrink-0", dim ? "text-muted-2" : "text-muted")}>
        {time}
      </span>
      <span
        className={cn(
          "truncate",
          highlight ? "font-semibold text-primary" : dim ? "text-muted-2" : "text-ink",
        )}
      >
        {text}
      </span>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] border border-border rounded-sm px-1 py-px bg-surface text-muted">
      {children}
    </span>
  );
}
