import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUIStore } from "@/hooks/use-ui-store";
import { Icon, type IconName } from "@/components/ui/icon";
import { patients } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import { initials } from "@/lib/utils";

const SCREENS: { label: string; icon: IconName; to: string }[] = [
  { label: "Dashboard", icon: "dashboard", to: "/app" },
  { label: "Schedule", icon: "schedule", to: "/app/calendar" },
  { label: "Recovery worklist", icon: "growth", to: "/app/revenue/unscheduled" },
  { label: "Patients", icon: "patients", to: "/app/patients" },
  { label: "Leads", icon: "growth", to: "/app/leads" },
  { label: "Revenue", icon: "revenue", to: "/app/invoices" },
  { label: "Settings", icon: "settings", to: "/app/settings" },
];

/** Global ⌘K command palette — searches patients and navigation targets. */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, openPatientPreview } = useUIStore();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setPaletteOpen(true);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen]);

  const q = query.trim().toLowerCase();
  const matchedPatients = useMemo(
    () =>
      patients
        .filter(
          (p) =>
            !q ||
            p.name.toLowerCase().includes(q) ||
            p.pno.toLowerCase().includes(q) ||
            p.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")),
        )
        .slice(0, 5),
    [q],
  );
  const matchedScreens = SCREENS.filter((s) => !q || s.label.toLowerCase().includes(q));

  if (!paletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-center pt-[12vh] animate-dc-fade"
      style={{ background: "rgba(33,32,28,0.32)" }}
      onClick={() => setPaletteOpen(false)}
    >
      <div
        className="w-[560px] max-w-[90vw] h-fit max-h-[60vh] bg-surface rounded-xl shadow-palette flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border">
          <Icon name="search" size={15} className="text-muted-2" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients, screens, actions…"
            className="flex-1 border-none outline-none text-sm bg-transparent text-ink placeholder:text-muted-2"
          />
          <span className="font-mono text-[10.5px] border border-border rounded px-1.5 py-px text-muted-2">
            esc
          </span>
        </div>

        <div className="overflow-y-auto p-2">
          {matchedPatients.length > 0 && (
            <>
              <div className="text-[10.5px] font-bold tracking-[0.07em] text-muted-2 px-2.5 pt-1.5 pb-1">
                PATIENTS
              </div>
              {matchedPatients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPaletteOpen(false);
                    openPatientPreview(p.id);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-bg text-left"
                >
                  <div className="w-[26px] h-[26px] rounded-full bg-primary-tint text-primary grid place-items-center text-[10.5px] font-bold shrink-0">
                    {initials(p.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">{p.name}</div>
                    <div className="text-[11px] text-muted-2 font-mono">
                      {p.pno} · {p.phone}
                    </div>
                  </div>
                  {p.alert && (
                    <span className="text-[10px] font-bold text-danger border border-danger-border bg-danger-bg rounded-[5px] px-1.5 py-0.5">
                      ⚠ {p.alert.split("·")[0].replace("Allergy:", "").trim()}
                    </span>
                  )}
                  {p.balancePaise > 0 && (
                    <span className="text-[11.5px] text-muted tnum">
                      {inr(p.balancePaise)} due
                    </span>
                  )}
                </button>
              ))}
            </>
          )}

          <div className="text-[10.5px] font-bold tracking-[0.07em] text-muted-2 px-2.5 pt-2.5 pb-1">
            GO TO
          </div>
          {matchedScreens.map((s) => (
            <button
              key={s.to + s.label}
              onClick={() => {
                setPaletteOpen(false);
                navigate(s.to);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-bg text-[13px] text-left"
            >
              <Icon name={s.icon} size={14} className="text-muted" />
              <span className="font-medium">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
