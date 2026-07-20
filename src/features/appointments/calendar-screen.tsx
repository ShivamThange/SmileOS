import { useState } from "react";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Drawer, DrawerCloseButton } from "@/components/common/drawer";
import { AppointmentStatusBadge, FlagChips } from "@/components/common/status-badge";
import { Icon } from "@/components/ui/icon";
import { fmtHour, fmtHourRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/hooks/use-ui-store";
import { appointmentStatusStyle, flagLabel } from "@/design/status";
import { appointments as seed, waitlist, chairSubs, doctorSubs } from "@/lib/mock-data";
import type { Appointment } from "@/types";
import type { AppointmentStatus } from "@/types/enums";

const HOUR_H = 64;
const START = 9;
const END = 20;
const DAY_H = (END - START) * HOUR_H;
const NOW = 11.83;

type View = "day" | "3day" | "week" | "list";
type GroupBy = "chair" | "doctor";

/** Status-transition action lists per current status (ported from the design). */
function actionsFor(a: Appointment): { label: string; primary: boolean; next?: AppointmentStatus; msg: string }[] {
  const map: Record<AppointmentStatus, { label: string; primary: boolean; next?: AppointmentStatus; msg: string }[]> = {
    booked: [
      { label: "Confirm appointment", primary: true, next: "confirmed", msg: `Confirmed — confirmation sent to ${a.name}` },
      { label: "Check in", primary: false, next: "arrived", msg: `${a.name} checked in — ${a.doctor} notified` },
      { label: "Reschedule", primary: false, msg: "Drag the block to a new slot, or pick a time" },
      { label: "Cancel", primary: false, next: "cancelled", msg: "Cancelled — the slot was offered to the waitlist" },
      { label: "Mark no-show", primary: false, next: "noshow", msg: "Marked as no-show — a follow-up task was created" },
    ],
    confirmed: [
      { label: "Check in", primary: true, next: "arrived", msg: `${a.name} checked in — ${a.doctor} notified` },
      { label: "Reschedule", primary: false, msg: "Drag the block to a new slot, or pick a time" },
      { label: "Cancel", primary: false, next: "cancelled", msg: "Cancelled — the slot was offered to the waitlist" },
      { label: "Mark no-show", primary: false, next: "noshow", msg: "Marked as no-show — a follow-up task was created" },
    ],
    arrived: [
      { label: "Start treatment", primary: true, next: "inchair", msg: `${a.name} is in the chair` },
      { label: "Take payment", primary: false, msg: `Payment screen opens for ${a.name}` },
    ],
    inchair: [
      { label: "Complete visit", primary: true, next: "done", msg: "Visit completed — a draft invoice was created" },
      { label: "Take payment", primary: false, msg: `Payment screen opens for ${a.name}` },
    ],
    done: [
      { label: "Take payment", primary: true, msg: `Payment screen opens for ${a.name}` },
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

export function CalendarScreen() {
  const { showToast } = useUIStore();
  const [view, setView] = useState<View>("day");
  const [groupBy, setGroupBy] = useState<GroupBy>("chair");
  const [appts, setAppts] = useState<Appointment[]>(seed);
  const [apptId, setApptId] = useState<string | null>(null);

  const cols =
    groupBy === "chair"
      ? ["Chair 1", "Chair 2", "Chair 3", "Chair 4"].map((c) => ({ key: c, name: c, sub: chairSubs[c], field: "chair" as const }))
      : ["Dr. Meher", "Dr. Kulkarni", "Dr. Patil"].map((d) => ({ key: d, name: d, sub: doctorSubs[d], field: "doctor" as const }));

  const active = apptId ? appts.find((a) => a.id === apptId) ?? null : null;

  const setStatus = (id: string, next: AppointmentStatus, msg: string) => {
    setAppts((as) => as.map((a) => (a.id === id ? { ...a, status: next } : a)));
    showToast(msg);
  };

  const hours = [];
  for (let h = START; h <= END - 1; h++) {
    hours.push({ top: (h - START) * HOUR_H, label: h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm` });
  }

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-3">
      {/* Control bar */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <Segmented
          options={[["day", "Day"], ["3day", "3-day"], ["week", "Week"], ["list", "List"]]}
          value={view}
          onChange={(v) => {
            if (v === "3day" || v === "week")
              showToast("Day and list views are built in this prototype — 3-day and week repeat the same grid");
            else setView(v as View);
          }}
        />
        <div className="flex items-center gap-0.5 border border-border rounded-md bg-surface p-0.5">
          <button onClick={() => showToast("This prototype carries one day of data — Mon, 20 Jul")} className="w-[26px] h-[26px] grid place-items-center rounded-[6px] text-muted hover:bg-bg">‹</button>
          <button onClick={() => showToast("Already on today")} className="px-2.5 py-1 text-xs font-semibold rounded-[6px] hover:bg-bg">Today</button>
          <button onClick={() => showToast("This prototype carries one day of data — Mon, 20 Jul")} className="w-[26px] h-[26px] grid place-items-center rounded-[6px] text-muted hover:bg-bg">›</button>
        </div>
        <span className="text-[13px] font-semibold">Mon, 20 Jul 2026</span>
        <Segmented
          options={[["chair", "By chair"], ["doctor", "By doctor"]]}
          value={groupBy}
          onChange={(v) => setGroupBy(v as GroupBy)}
        />
        <div className="flex-1" />
        <button
          onClick={() => showToast("Click any empty slot to start a booking there")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-on-primary text-[12.5px] font-semibold hover:bg-primary-hover"
        >
          <Icon name="plus" size={13} strokeWidth={1.6} /> New appointment
        </button>
      </div>

      <div className="grid grid-cols-[1fr_250px] gap-3.5 items-start max-lg:grid-cols-1">
        <Panel className="overflow-hidden">
          {view !== "list" ? (
            <>
              {/* Column heads */}
              <div className="flex border-b border-border bg-bg-content">
                <div className="w-14 flex-none" />
                {cols.map((c) => (
                  <div key={c.key} className="flex-1 px-2.5 py-2 border-l border-border-faint">
                    <div className="text-[12.5px] font-semibold">{c.name}</div>
                    <div className="text-[11px] text-muted-2">{c.sub}</div>
                  </div>
                ))}
              </div>
              {/* Grid */}
              <div className="flex relative">
                <div className="w-14 flex-none relative" style={{ height: DAY_H }}>
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
                {cols.map((c) => (
                  <div
                    key={c.key}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const t = START + Math.floor(((e.clientY - rect.top) / HOUR_H) * 4) / 4;
                      if (t >= 13 && t < 14) return showToast("Lunch — the clinic is closed 1:00–2:00");
                      showToast(`New appointment — ${c.name}, ${fmtHour(t)} · booking form opens here`);
                    }}
                    className="flex-1 relative border-l border-border-faint cursor-copy"
                    style={{
                      height: DAY_H,
                      backgroundImage: "repeating-linear-gradient(to bottom,#F0EEE8 0 1px,transparent 1px 64px)",
                    }}
                  >
                    {/* Lunch */}
                    <div
                      className="absolute left-0 right-0 hatch-lunch grid place-items-center pointer-events-none"
                      style={{ top: (13 - START) * HOUR_H, height: HOUR_H }}
                    >
                      <span className="text-[10px] font-semibold tracking-[0.06em] text-muted-3">LUNCH</span>
                    </div>
                    {appts
                      .filter((a) => a[c.field] === c.key)
                      .map((a) => {
                        const st = appointmentStatusStyle[a.status];
                        return (
                          <button
                            key={a.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setApptId(a.id);
                            }}
                            className={cn(
                              "absolute left-1 right-1 rounded-md px-2 py-[3px] overflow-hidden text-left flex flex-col gap-px hover:shadow-card-hover",
                              st.hatch && "hatch-cancelled",
                            )}
                            style={{
                              top: (a.start - START) * HOUR_H + 1,
                              height: a.dur * HOUR_H - 4,
                              background: st.hatch ? undefined : st.bg,
                              border: `1px solid ${st.border}`,
                              color: st.color,
                            }}
                          >
                            <div className="flex justify-between gap-1.5 text-[9.5px] leading-tight">
                              <span className="font-mono" style={{ color: st.sub }}>
                                {fmtHour(a.start)}
                              </span>
                              <span className="font-bold tracking-[0.03em] whitespace-nowrap" style={{ color: st.labelColor }}>
                                {st.label}
                              </span>
                            </div>
                            <div className="text-[11.5px] font-semibold leading-tight truncate" style={{ color: st.color }}>
                              {a.name} <span className="font-normal" style={{ color: st.sub }}>{a.agesex}</span>
                            </div>
                            {a.dur >= 0.75 && (
                              <>
                                <div className="text-[10.5px] leading-tight truncate" style={{ color: st.sub }}>
                                  {a.proc} · {groupBy === "chair" ? a.doctor : a.chair}
                                </div>
                                {a.flags.length > 0 && (
                                  <div className="flex gap-1 mt-auto pb-0.5 flex-wrap">
                                    {a.flags.map((f) => (
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
                          </button>
                        );
                      })}
                  </div>
                ))}
                {/* Now line */}
                <div
                  className="absolute left-14 right-0 h-0.5 bg-danger pointer-events-none z-[5]"
                  style={{ top: Math.round((NOW - START) * HOUR_H) }}
                >
                  <div className="absolute -left-[5px] -top-[3px] w-2 h-2 rounded-full bg-danger" />
                </div>
              </div>
            </>
          ) : (
            <ListView appts={appts} onOpen={setApptId} />
          )}
        </Panel>

        {/* Waitlist rail */}
        <Panel className="p-4 flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <MicroLabel>WAITLIST</MicroLabel>
            <span className="text-[11px] text-muted-2">3 waiting</span>
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
                onClick={() => showToast(`Gap offered to ${w.name} — message drafted`)}
                className="mt-1 text-[11.5px] font-semibold py-1.5 rounded-[7px] border border-primary-tint-border bg-primary-tint text-primary hover:bg-primary-tint-border"
              >
                Offer a slot
              </button>
            </div>
          ))}
          <div className="text-[11px] text-muted-2 leading-relaxed">
            The 6:00 pm cancellation on Chair 3 is open — Rahul Khare wants the earliest slot.
          </div>
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
                  {active.name} <span className="font-normal text-muted-2 text-[12.5px]">{active.agesex}</span>
                </div>
                <div className="text-[12.5px] text-muted mt-0.5">{active.proc}</div>
                <div className="text-[11.5px] text-muted-2 mt-0.5">{active.chair} · {active.doctor}</div>
              </div>
              <DrawerCloseButton onClose={() => setApptId(null)} />
            </div>
            <div className="flex-1 overflow-y-auto px-[18px] py-3.5 flex flex-col gap-3.5">
              <div className="flex items-center gap-2 flex-wrap">
                <AppointmentStatusBadge status={active.status} />
                <FlagChips flags={active.flags} />
              </div>
              <div className="flex flex-col gap-[7px]">
                <MicroLabel className="text-[11px]">ACTIONS</MicroLabel>
                {actionsFor(active).map((ac) => (
                  <button
                    key={ac.label}
                    onClick={() =>
                      ac.next ? setStatus(active.id, ac.next, ac.msg) : showToast(ac.msg)
                    }
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
              </div>
            </div>
            <div className="flex gap-2 px-[18px] py-3.5 border-t border-border">
              <button onClick={() => showToast(`Opening record — ${active.name}`)} className="flex-1 text-center text-[12.5px] font-semibold py-2.5 rounded-md border border-border bg-surface hover:bg-bg">Open record</button>
              <button onClick={() => showToast(`Message thread opened — ${active.name}`)} className="flex-1 text-center text-[12.5px] font-semibold py-2.5 rounded-md border border-border bg-surface hover:bg-bg">Message</button>
            </div>
          </>
        )}
      </Drawer>
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
      <div className="grid gap-2.5 px-3.5 py-[9px] border-b border-border bg-bg-content text-[10.5px] font-bold tracking-[0.06em] text-muted-2" style={{ gridTemplateColumns: GRID }}>
        <span>TIME</span><span>PATIENT</span><span>PROCEDURE</span><span>DOCTOR</span><span>CHAIR</span><span>STATUS</span>
      </div>
      {rows.map((a) => (
        <button
          key={a.id}
          onClick={() => onOpen(a.id)}
          className="grid gap-2.5 items-center px-3.5 py-2.5 border-b border-border-faint text-[12.5px] hover:bg-bg-content text-left w-full"
          style={{ gridTemplateColumns: GRID }}
        >
          <span className="font-mono text-[11.5px]">{fmtHourRange(a.start, a.dur)}</span>
          <span className="font-semibold">{a.name} <span className="font-normal text-muted-2">{a.agesex}</span></span>
          <span>{a.proc}</span>
          <span className="text-muted">{a.doctor}</span>
          <span className="text-muted">{a.chair}</span>
          <span><AppointmentStatusBadge status={a.status} /></span>
        </button>
      ))}
    </>
  );
}
