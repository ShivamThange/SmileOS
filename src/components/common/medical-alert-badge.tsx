import { parseMedicalAlert, alertSeverity, alertSummary, alertFullText } from "@/lib/medical-alert";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/*
 * Medical alerts, surfaced.
 *
 * This is a clinical-safety component, not a decorative one. An allergy that
 * exists in the record but is not visible at the moment of prescribing is the
 * same as an allergy nobody recorded. It renders in the danger token, it is
 * never truncated to the point of ambiguity, and it carries the full text as a
 * title attribute so hovering always gives the complete picture.
 *
 * Three sizes, one meaning:
 *   chip   — table rows and dense lists. One line, summarised.
 *   inline — cards and timeline rows. Every item, small.
 *   banner — the patient drawer and record header. Impossible to miss.
 */

type Variant = "chip" | "inline" | "banner";

const TONE = {
  allergy: {
    bg: "var(--danger-bg)",
    border: "var(--danger-border)",
    color: "var(--danger)",
  },
  condition: {
    bg: "var(--warning-bg)",
    border: "var(--warning-border)",
    color: "var(--warning)",
  },
} as const;

export function MedicalAlertBadge({
  alert,
  variant = "chip",
  className,
}: {
  alert: string | undefined | null;
  variant?: Variant;
  className?: string;
}) {
  const items = parseMedicalAlert(alert);
  const severity = alertSeverity(items);
  if (!severity) return null;

  const full = alertFullText(items);

  if (variant === "banner") {
    return (
      <div
        role="status"
        aria-label={`Medical alert. ${full}`}
        className={cn("flex gap-2.5 items-start rounded-[10px] px-3 py-2.5 border", className)}
        style={{ background: TONE[severity].bg, borderColor: TONE[severity].border }}
      >
        <Icon name="alert" size={15} className="mt-px shrink-0" style={{ color: TONE[severity].color }} />
        <div className="min-w-0">
          <div
            className="text-[11px] font-bold tracking-[0.05em]"
            style={{ color: TONE[severity].color }}
          >
            MEDICAL ALERT
          </div>
          <ul className="mt-1 flex flex-col gap-0.5">
            {items.map((it, i) => (
              <li key={i} className="text-[12.5px] text-ink leading-snug">
                {it.kind === "allergy" && (
                  <span className="font-semibold" style={{ color: TONE.allergy.color }}>
                    Allergy:{" "}
                  </span>
                )}
                {it.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
        {items.map((it, i) => (
          <span
            key={i}
            title={it.kind === "allergy" ? `Allergy: ${it.label}` : it.label}
            className="inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-[5px] px-1.5 py-0.5 border"
            style={{
              background: TONE[it.kind].bg,
              borderColor: TONE[it.kind].border,
              color: TONE[it.kind].color,
            }}
          >
            <Icon name="alert" size={10} strokeWidth={1.7} />
            {it.label}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span
      title={full}
      aria-label={`Medical alert. ${full}`}
      className={cn(
        "inline-flex items-center gap-1 text-[10.5px] font-bold rounded-[5px] px-1.5 py-0.5 border max-w-full",
        className,
      )}
      style={{
        background: TONE[severity].bg,
        borderColor: TONE[severity].border,
        color: TONE[severity].color,
      }}
    >
      <Icon name="alert" size={10} strokeWidth={1.8} />
      <span className="truncate">{alertSummary(items)}</span>
    </span>
  );
}

/**
 * A bare dot for the tightest contexts — calendar blocks, avatar corners —
 * where there is no room for words but the presence of an alert must still
 * register. Always paired with a title so it is never a mystery.
 */
export function MedicalAlertDot({ alert, className }: { alert?: string | null; className?: string }) {
  const items = parseMedicalAlert(alert);
  const severity = alertSeverity(items);
  if (!severity) return null;
  return (
    <span
      title={alertFullText(items)}
      aria-label={`Medical alert. ${alertFullText(items)}`}
      className={cn("inline-block w-[7px] h-[7px] rounded-full flex-none", className)}
      style={{ background: TONE[severity].color }}
    />
  );
}
