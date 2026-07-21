import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUIStore } from "@/hooks/use-ui-store";
import { useDeskStore } from "@/hooks/use-desk-store";
import { Icon, type IconName } from "@/components/ui/icon";
import { MedicalAlertBadge } from "@/components/common/medical-alert-badge";
import { patients } from "@/lib/mock-data";
import { clinicConfig } from "@/config/clinic";
import { inr } from "@/lib/format";
import { initials } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types";

/*
 * The command palette — now a verb surface, not just a map.
 *
 * Searching screens is the least of what a receptionist needs from ⌘K. What
 * she needs is to *do* something: book, settle, message, chart. Verbs that
 * need a patient ask for one in a second step rather than making her find the
 * patient first and hunt for the action afterwards.
 *
 * The palette is never the only path to anything. Every verb here has a
 * visible button somewhere too, because a shortcut must not be load-bearing on
 * someone's first day.
 */

const SCREENS: { label: string; icon: IconName; to: string }[] = [
  { label: "Today's brief", icon: "dashboard", to: "/app" },
  { label: "Schedule", icon: "schedule", to: "/app/calendar" },
  { label: "Check-in", icon: "patients", to: "/app/check-in" },
  { label: "Waitlist", icon: "schedule", to: "/app/waitlist" },
  { label: "Recovery worklist", icon: "growth", to: "/app/revenue/unscheduled" },
  { label: "Patients", icon: "patients", to: "/app/patients" },
  { label: "Clinical queue", icon: "clinical", to: "/app/clinical/queue" },
  { label: "The leak report", icon: "insight", to: "/app/insight/leak" },
  { label: "Leads", icon: "growth", to: "/app/leads" },
  { label: "Inbox", icon: "message", to: "/app/inbox" },
  { label: "Invoices", icon: "revenue", to: "/app/invoices" },
  { label: "Insight — how the practice is doing", icon: "insight", to: "/app/insight" },
  { label: "Financial dashboard & charts", icon: "revenue", to: "/app/insight/dashboard" },
  { label: "Settings", icon: "settings", to: "/app/settings/profile" },
  { label: "Message & document templates", icon: "message", to: "/app/settings/templates" },
  { label: "Fee schedule", icon: "revenue", to: "/app/settings/fees" },
];

type VerbId = "book" | "settle" | "message" | "chart" | "record" | "new-patient" | "recovery";

interface Verb {
  id: VerbId;
  label: string;
  icon: IconName;
  /** Verbs that operate on a person ask "for whom?" as a second step. */
  needsPatient: boolean;
  /** What the second step is titled. */
  prompt?: string;
  keywords: string[];
}

const VERBS: Verb[] = [
  { id: "book", label: "Book an appointment", icon: "schedule", needsPatient: false, keywords: ["book", "appointment", "slot", "schedule", "new appointment"] },
  { id: "settle", label: "Take a payment", icon: "revenue", needsPatient: true, prompt: "Take a payment for", keywords: ["pay", "payment", "settle", "bill", "collect", "invoice", "upi"] },
  { id: "message", label: "Send a WhatsApp", icon: "message", needsPatient: true, prompt: "Message", keywords: ["message", "whatsapp", "wa", "text", "send"] },
  { id: "chart", label: "Chart a patient", icon: "clinical", needsPatient: true, prompt: "Chart", keywords: ["chart", "odontogram", "examine", "examination", "dictate", "findings"] },
  { id: "record", label: "Open a patient record", icon: "patients", needsPatient: true, prompt: "Open the record for", keywords: ["record", "notes", "open", "history"] },
  { id: "new-patient", label: "Register a new patient", icon: "patients", needsPatient: false, keywords: ["new patient", "register", "add patient", "create"] },
  { id: "recovery", label: "Work the recovery queue", icon: "growth", needsPatient: false, keywords: ["recovery", "chase", "unscheduled", "follow up", "deferred"] },
];

type ResultKind = "verb" | "patient" | "screen";
interface Result {
  key: string;
  kind: ResultKind;
  run: () => void;
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, openPatientPreview, showToast } = useUIStore();
  const { openBooking, openSettle } = useDeskStore();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Verb | null>(null);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setPaletteOpen(false);
    setPending(null);
    setQuery("");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setPending(null);
        setCursor(0);
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen]);

  useEffect(() => {
    if (paletteOpen) setTimeout(() => inputRef.current?.focus(), 20);
  }, [paletteOpen]);

  useEffect(() => setCursor(0), [query, pending]);

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
        .slice(0, pending ? 8 : 4),
    [q, pending],
  );

  const matchedVerbs = useMemo(
    () =>
      pending
        ? []
        : VERBS.filter(
            (v) =>
              !q ||
              v.label.toLowerCase().includes(q) ||
              v.keywords.some((k) => k.includes(q) || q.includes(k)),
          ),
    [q, pending],
  );

  const matchedScreens = useMemo(
    () => (pending ? [] : SCREENS.filter((s) => !q || s.label.toLowerCase().includes(q)).slice(0, 6)),
    [q, pending],
  );

  // --- what a selection does ------------------------------------------------

  const runVerb = (verb: Verb, patient?: Patient) => {
    if (verb.needsPatient && !patient) {
      setPending(verb);
      setQuery("");
      return;
    }

    switch (verb.id) {
      case "book":
        close();
        openBooking(patient ? { phone: patient.phone, patientId: patient.id } : undefined);
        break;
      case "settle":
        close();
        openSettle(patient!.id);
        break;
      case "message":
        close();
        window.open(waLink(patient!.phone, `Hello ${patient!.name}, this is ${clinicConfig.name}.`), "_blank", "noopener");
        showToast(`WhatsApp opened — ${patient!.name}`);
        break;
      case "chart":
        close();
        navigate(`/app/clinical/chart/${patient!.id}`);
        break;
      case "record":
        close();
        navigate(`/app/patients/${patient!.id}`);
        break;
      case "new-patient":
        close();
        navigate("/app/patients/new");
        break;
      case "recovery":
        close();
        navigate("/app/revenue/unscheduled");
        break;
    }
  };

  const pickPatient = (p: Patient) => {
    if (pending) runVerb(pending, p);
    else {
      close();
      openPatientPreview(p.id);
    }
  };

  // A flat list so ↑ ↓ ↵ traverse everything in the order it is displayed.
  const results: Result[] = [
    ...matchedVerbs.map((v) => ({ key: `v:${v.id}`, kind: "verb" as const, run: () => runVerb(v) })),
    ...matchedPatients.map((p) => ({ key: `p:${p.id}`, kind: "patient" as const, run: () => pickPatient(p) })),
    ...matchedScreens.map((s) => ({
      key: `s:${s.to}${s.label}`,
      kind: "screen" as const,
      run: () => {
        close();
        navigate(s.to);
      },
    })),
  ];

  const activeKey = results[cursor]?.key;

  useEffect(() => {
    if (!paletteOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (pending) setPending(null);
        else close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        results[cursor]?.run();
      } else if (e.key === "Backspace" && query === "" && pending) {
        e.preventDefault();
        setPending(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!paletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-center pt-[12vh] px-4 animate-dc-fade"
      style={{ background: "rgba(33,32,28,0.32)" }}
      onClick={close}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        className="w-[560px] max-w-full h-fit max-h-[62vh] bg-surface rounded-xl shadow-palette flex flex-col overflow-hidden animate-dc-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border">
          {pending ? (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold px-2 py-1 rounded-md bg-primary-tint text-primary border border-primary-tint-border shrink-0">
              <Icon name={pending.icon} size={12} />
              {pending.prompt ?? pending.label}
            </span>
          ) : (
            <Icon name="search" size={15} className="text-muted-2" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              pending ? "Which patient?" : "Search patients, or type what you want to do…"
            }
            className="flex-1 border-none outline-none text-sm bg-transparent text-ink placeholder:text-muted-2"
          />
          <span className="font-mono text-[10.5px] border border-border rounded px-1.5 py-px text-muted-2">
            esc
          </span>
        </div>

        <div className="overflow-y-auto p-2">
          {matchedVerbs.length > 0 && (
            <>
              <GroupLabel>DO</GroupLabel>
              {matchedVerbs.map((v) => (
                <button
                  key={v.id}
                  onMouseEnter={() => setCursor(results.findIndex((r) => r.key === `v:${v.id}`))}
                  onClick={() => runVerb(v)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-left",
                    activeKey === `v:${v.id}` ? "bg-primary-tint" : "hover:bg-bg",
                  )}
                >
                  <span className="w-[22px] h-[22px] rounded-[6px] bg-primary-tint text-primary grid place-items-center">
                    <Icon name={v.icon} size={12} />
                  </span>
                  <span className="font-medium flex-1">{v.label}</span>
                  {v.needsPatient && (
                    <span className="text-[10.5px] text-muted-2">needs a patient</span>
                  )}
                </button>
              ))}
            </>
          )}

          {matchedPatients.length > 0 && (
            <>
              <GroupLabel>{pending ? "CHOOSE A PATIENT" : "PATIENTS"}</GroupLabel>
              {matchedPatients.map((p) => (
                <button
                  key={p.id}
                  onMouseEnter={() => setCursor(results.findIndex((r) => r.key === `p:${p.id}`))}
                  onClick={() => pickPatient(p)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left",
                    activeKey === `p:${p.id}` ? "bg-primary-tint" : "hover:bg-bg",
                  )}
                >
                  <div className="w-[26px] h-[26px] rounded-full bg-primary-tint text-primary grid place-items-center text-[10.5px] font-bold shrink-0">
                    {initials(p.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-2 font-mono truncate">
                      {p.pno} · {p.phone}
                    </div>
                  </div>
                  <MedicalAlertBadge alert={p.alert} variant="chip" />
                  {p.balancePaise > 0 && (
                    <span className="text-[11.5px] text-muted tnum whitespace-nowrap">
                      {inr(p.balancePaise)} due
                    </span>
                  )}
                </button>
              ))}
            </>
          )}

          {matchedScreens.length > 0 && (
            <>
              <GroupLabel>GO TO</GroupLabel>
              {matchedScreens.map((s) => {
                const key = `s:${s.to}${s.label}`;
                return (
                  <button
                    key={key}
                    onMouseEnter={() => setCursor(results.findIndex((r) => r.key === key))}
                    onClick={() => {
                      close();
                      navigate(s.to);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-left",
                      activeKey === key ? "bg-primary-tint" : "hover:bg-bg",
                    )}
                  >
                    <Icon name={s.icon} size={14} className="text-muted" />
                    <span className="font-medium">{s.label}</span>
                  </button>
                );
              })}
            </>
          )}

          {results.length === 0 && (
            <div className="px-3 py-8 text-center flex flex-col gap-1.5">
              <div className="text-[13px] font-semibold">Nothing matches "{query}"</div>
              <div className="text-[12px] text-muted">
                Try a phone number, or one of: book, pay, message, chart.
              </div>
              <button
                onClick={() => {
                  close();
                  openBooking();
                }}
                className="text-[12.5px] font-semibold text-primary mt-1"
              >
                Book an appointment instead →
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 px-4 py-2 border-t border-border bg-bg-content text-[11px] text-muted-2">
          <Key>↑↓</Key> move
          <Key>↵</Key> select
          {pending && (
            <>
              <Key>⌫</Key> back
            </>
          )}
          <div className="flex-1" />
          <span>{results.length} result{results.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-bold tracking-[0.07em] text-muted-2 px-2.5 pt-2 pb-1">
      {children}
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
