import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useMessageLog } from "@/hooks/use-message-log";
import { waLink } from "@/lib/whatsapp";
import type { MessageKind } from "@/lib/messaging";
import { cn } from "@/lib/utils";

/*
 * SendGuard — the suppression layer, made visible.
 *
 * The rule is enforced, but never silently. A receptionist who taps send and
 * sees nothing happen will tap it again, then complain the product is broken.
 * So a held message says exactly why it is held, in a sentence she'd say out
 * loud, and offers her a way through — because she is standing in the room and
 * sometimes she knows something the rules don't.
 *
 * The override is deliberate and it is logged. A rule with no override gets
 * worked around with a personal phone, and then the clinic has no record at all.
 */

export function SendGuard({
  patientId,
  kind,
  phone,
  message,
  label = "Send on WhatsApp",
  compact,
  className,
  onSent,
}: {
  patientId: string;
  kind: MessageKind;
  phone: string;
  message: string;
  label?: string;
  compact?: boolean;
  className?: string;
  onSent?: () => void;
}) {
  const { check, record } = useMessageLog();
  const [overridden, setOverridden] = useState(false);
  const [sent, setSent] = useState(false);

  const verdict = check(patientId, kind);
  const held = verdict.severity === "block" && !overridden;

  const send = () => {
    record(patientId, kind);
    setSent(true);
    onSent?.();
    window.open(waLink(phone, message), "_blank", "noopener");
  };

  if (sent) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary", className)}>
        <Icon name="check" size={12} />
        Sent · logged
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={send}
          disabled={held}
          title={held ? verdict.reason : undefined}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 font-semibold rounded-md transition-colors",
            compact ? "text-[11.5px] px-2.5 py-1" : "text-[12.5px] px-3 py-1.5",
            held
              ? "bg-bg text-muted-3 border border-border cursor-not-allowed"
              : "bg-primary text-on-primary hover:bg-primary-hover",
          )}
        >
          <Icon name="message" size={12} />
          {held ? "Held" : label}
        </button>

        {held && (
          <button
            onClick={() => setOverridden(true)}
            className="text-[11.5px] font-semibold text-muted hover:text-ink underline decoration-dotted underline-offset-2"
          >
            Send anyway
          </button>
        )}
      </div>

      {verdict.reason && (
        <div
          className={cn(
            "text-[11.5px] leading-snug flex items-start gap-1.5 max-w-[460px]",
            verdict.severity === "block" ? "text-muted" : "text-warning-text",
          )}
        >
          <Icon
            name={verdict.severity === "block" ? "clock" : "alert"}
            size={11}
            className="mt-0.5 shrink-0"
          />
          <span>
            {verdict.reason}
            {overridden && verdict.severity === "block" && (
              <b className="text-danger"> Overridden — this will be recorded.</b>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * A bare indicator for dense rows, where there's no space for the explanation
 * but the state still has to be legible.
 */
export function SuppressionDot({ patientId, kind }: { patientId: string; kind: MessageKind }) {
  /*
   * Select the function, then call it — selecting the *result* would hand
   * React a fresh object on every render and send useSyncExternalStore into a
   * loop.
   */
  const check = useMessageLog((s) => s.check);
  const verdict = check(patientId, kind);
  if (verdict.severity === "ok") return null;

  return (
    <span
      title={verdict.reason}
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-px rounded-[4px] border"
      style={{
        background: verdict.severity === "block" ? "var(--track)" : "var(--warning-bg)",
        borderColor: verdict.severity === "block" ? "var(--border)" : "var(--warning-border)",
        color: verdict.severity === "block" ? "var(--muted-2)" : "var(--warning)",
      }}
    >
      {verdict.severity === "block" ? "HELD" : "CAUTION"}
    </span>
  );
}
