import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { buildNotifications, TONE_STYLE } from "./notifications-data";

/*
 * Notifications dropdown — the header bell's panel. Renders live alerts derived
 * from across the app, each deep-linking to the screen that resolves it.
 */
export function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const items = useMemo(buildNotifications, []);
  if (!open) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-10 z-[60] w-[340px] bg-surface border border-border rounded-lg shadow-dropdown overflow-hidden animate-dc-fade"
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <span className="text-[12.5px] font-semibold">Notifications</span>
        <span className="text-[10.5px] font-bold text-primary bg-primary-tint border border-primary-tint-border rounded-full px-2 py-px font-mono">{items.length}</span>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {items.map((n) => {
          const t = TONE_STYLE[n.tone];
          return (
            <button
              key={n.id}
              onClick={() => { onClose(); navigate(n.to); }}
              className="w-full flex gap-2.5 px-3.5 py-2.5 border-b border-border-faint text-left hover:bg-bg-content"
            >
              <span className="w-7 h-7 flex-none rounded-md grid place-items-center text-[13px] font-bold border" style={{ background: t.bg, color: t.color, borderColor: t.border }}>{n.glyph}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-semibold truncate">{n.title}</span>
                  <span className="text-[10px] text-muted-2 flex-none">{n.time}</span>
                </div>
                <div className="text-[11.5px] text-muted leading-snug truncate">{n.detail}</div>
              </div>
            </button>
          );
        })}
      </div>
      <button onClick={() => { onClose(); navigate("/app"); }} className="w-full text-center text-[11.5px] font-semibold text-primary py-2 hover:bg-bg-content">
        View all on the dashboard
      </button>
    </div>
  );
}
