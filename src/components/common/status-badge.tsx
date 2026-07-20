import { appointmentStatusStyle, urgencyStyle, flagLabel } from "@/design/status";
import type { AppointmentStatus, ApptFlag, Urgency } from "@/types/enums";

/**
 * Clinical status is never communicated by colour alone (spec §6.6) — every
 * badge carries a text label as well as its colour.
 */
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const s = appointmentStatusStyle[status];
  const filled = status === "inchair";
  return (
    <span
      className="text-[10.5px] font-bold px-2 py-[3px] rounded-[5px] border whitespace-nowrap"
      style={{
        background: filled ? "#20614E" : s.bg,
        color: filled ? "#F7F6F3" : s.labelColor,
        borderColor: s.border,
      }}
    >
      {s.label}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const s = urgencyStyle(urgency);
  return (
    <span
      className="text-[10.5px] font-bold tracking-[0.04em] px-2 py-[3px] rounded-[5px] border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
    >
      {urgency.toUpperCase()}
    </span>
  );
}

export function FlagChips({ flags }: { flags: ApptFlag[] }) {
  if (!flags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <span
          key={f}
          className="text-[8.5px] font-bold tracking-[0.04em] px-1.5 py-px rounded bg-bg text-muted border border-border"
        >
          {flagLabel[f]}
        </span>
      ))}
    </div>
  );
}
