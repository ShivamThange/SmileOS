import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Panel } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { MoneyText } from "@/components/common/money-text";
import { PlaceholderScreen } from "@/components/common/placeholder-screen";
import { inr } from "@/lib/format";
import { initials } from "@/lib/utils";
import { patients } from "@/lib/mock-data";
import { useUIStore } from "@/hooks/use-ui-store";
import {
  Odontogram,
  ODONTOGRAM_LEGEND,
  SEED_FINDINGS,
  SURFACE_CONDITIONS,
  TOOTH_CONDITIONS,
  type Findings,
  type SurfaceCondition,
  type SurfaceKey,
  type ToothCondition,
} from "@/components/domain/odontogram";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "clinical", label: "Clinical" },
  { id: "gum", label: "Gum health" },
  { id: "plans", label: "Treatment plans", badge: "2" },
  { id: "billing", label: "Billing" },
  { id: "documents", label: "Documents", badge: "6" },
  { id: "messages", label: "Messages" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function PatientRecordScreen() {
  const { id } = useParams();
  const patient = patients.find((p) => p.id === id) ?? patients[0];
  const [tab, setTab] = useState<TabId>("clinical");
  const { showToast } = useUIStore();

  const alerts = patient.alert
    ? patient.alert.split("·").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="-mx-6 -mt-5 min-h-full flex flex-col">
      {/* Breadcrumb */}
      <div className="h-11 flex-none flex items-center gap-2.5 px-5 border-b border-border bg-surface text-[12.5px] text-muted">
        <Link to="/app/patients" className="flex items-center gap-1.5 font-medium">
          <Icon name="chevronLeft" size={13} strokeWidth={1.5} /> Patients
        </Link>
        <span className="text-border-strong">/</span>
        <span className="text-ink font-semibold">{patient.name}</span>
      </div>

      {/* Sticky patient header bar */}
      <div className="flex-none bg-surface border-b border-border sticky top-0 z-20">
        <div className="max-w-[1360px] mx-auto px-5 pt-3.5 flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 flex-none rounded-lg bg-primary-tint text-primary grid place-items-center text-[19px] font-bold border border-primary-tint-border">
              {initials(patient.name)}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <h1 className="m-0 text-[19px] font-semibold tracking-[-0.01em]">{patient.name}</h1>
                <span className="text-xs text-muted-2 font-mono">{patient.pno}</span>
                <span className="text-[12.5px] text-muted">{patient.agesex}</span>
              </div>
              <div className="flex items-center gap-3.5 text-[12.5px] text-muted flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Icon name="patients" size={12} className="text-muted-2" /> {patient.phone}
                </span>
                <span>Last visit: <b className="text-ink font-semibold">{patient.lastVisit}</b></span>
                <span>Next: <b className="text-ink font-semibold">{patient.nextVisit}</b></span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">OUTSTANDING</div>
              <div
                className="text-xl font-bold tnum"
                style={{ color: patient.balancePaise ? "var(--danger)" : "var(--primary)" }}
              >
                {patient.balancePaise ? <MoneyText paise={patient.balancePaise} /> : "Nil"}
              </div>
            </div>
            <div className="flex gap-2 self-center">
              <button onClick={() => showToast(`Booking started for ${patient.name}`)} className="text-[12.5px] font-semibold px-3.5 py-2 rounded-md bg-primary text-on-primary hover:bg-primary-hover">Book</button>
              <button onClick={() => showToast("New invoice — form opens")} className="text-[12.5px] font-semibold px-3.5 py-2 rounded-md border border-border bg-surface hover:bg-bg">Bill</button>
              <button onClick={() => showToast(`Message thread opened — ${patient.name}`)} className="text-[12.5px] font-semibold px-3.5 py-2 rounded-md border border-border bg-surface hover:bg-bg">Message</button>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="flex items-center gap-2.5 bg-danger-bg border rounded-[9px] px-3 py-2" style={{ borderColor: "#E4A8A0" }}>
              <div className="w-[22px] h-[22px] flex-none rounded-md bg-danger text-white grid place-items-center text-sm font-bold">!</div>
              <span className="text-[10.5px] font-bold tracking-[0.06em] text-danger">MEDICAL ALERT</span>
              <div className="flex gap-2 flex-wrap">
                {alerts.map((a) => (
                  <span key={a} className="text-xs font-semibold bg-surface border rounded-md px-2.5 py-0.5" style={{ color: "#7A241C", borderColor: "#E4A8A0" }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-0.5">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="relative px-3.5 pt-2.5 pb-3 text-[12.5px] hover:text-ink"
                  style={{
                    fontWeight: active ? 600 : 500,
                    color: active ? "var(--primary)" : "var(--muted)",
                    borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`,
                  }}
                >
                  {t.label}
                  {"badge" in t && t.badge && (
                    <span className="ml-1.5 text-[10px] font-bold bg-primary-tint text-primary rounded-lg px-1.5 py-px font-mono">
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 max-w-[1360px] w-full mx-auto p-5 box-border">
        {tab === "overview" && <OverviewTab patient={patient} />}
        {tab === "clinical" && <ClinicalTab />}
        {tab !== "overview" && tab !== "clinical" && <OtherTab tab={tab} />}
      </div>
    </div>
  );
}

function OverviewTab({ patient }: { patient: (typeof patients)[number] }) {
  const glance = [
    { value: inr(patient.ltvPaise), label: "Lifetime value" },
    { value: "23", label: "Visits" },
    { value: patient.balancePaise ? inr(patient.balancePaise) : "Nil", label: "Outstanding" },
    { value: patient.lastVisit.split(" ").slice(0, 2).join(" "), label: "Last seen" },
    { value: "Overdue", label: "Recall status" },
    { value: "8 yrs", label: "Patient since" },
  ];
  const contact = [
    { label: "Phone", value: patient.phone },
    { label: "Email", value: "r.iyer@gmail.com" },
    { label: "Address", value: "Baner, Pune" },
    { label: "Blood group", value: "B+" },
    { label: "Emergency", value: "Lata Iyer (wife)" },
    { label: "Referred by", value: "Dr. Kulkarni" },
  ];

  return (
    <div className="grid grid-cols-[300px_1fr] gap-[18px] items-start animate-dc-fade max-lg:grid-cols-1">
      <div className="flex flex-col gap-3.5">
        <Panel className="p-4">
          <div className="text-[11px] font-bold tracking-[0.07em] text-muted-2 mb-2.5">AT A GLANCE</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-3">
            {glance.map((g) => (
              <div key={g.label}>
                <div className="text-base font-bold tnum tracking-[-0.01em]">{g.value}</div>
                <div className="text-[11px] text-muted">{g.label}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="text-[11px] font-bold tracking-[0.07em] text-muted-2 mb-2.5">CONTACT &amp; PERSONAL</div>
          <div className="flex flex-col gap-2.5">
            {contact.map((c) => (
              <div key={c.label} className="flex justify-between gap-2.5 text-[12.5px]">
                <span className="text-muted-2">{c.label}</span>
                <span className="font-medium text-right">{c.value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel className="p-4">
        <div className="flex justify-between items-baseline mb-3.5">
          <div className="text-[13px] font-semibold">Timeline</div>
          <div className="text-[11.5px] text-muted-2">Every visit, treatment, payment and message</div>
        </div>
        <div className="flex flex-col">
          {patient.timeline.map((t, i) => (
            <div key={i} className="grid grid-cols-[70px_20px_1fr] gap-2">
              <div className="text-[11px] text-muted-2 font-mono text-right pt-0.5">{t.date}</div>
              <div className="flex flex-col items-center">
                <div className="w-[9px] h-[9px] rounded-full bg-primary border-2 border-surface mt-[3px]" style={{ boxShadow: "0 0 0 1.5px var(--primary)" }} />
                {i < patient.timeline.length - 1 && <div className="flex-1 w-[1.5px] bg-track" />}
              </div>
              <div className="pb-4">
                <div className="text-[12.5px] font-semibold">{t.text}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

const NOTES = [
  {
    date: "12 Jun 2026", doctor: "Dr. Meher", lock: "Amendable",
    lockStyle: { background: "var(--warning-bg)", color: "var(--warning)", borderColor: "var(--warning-border)" },
    fields: [
      ["Complaint", "Difficulty chewing; worn-down teeth"],
      ["Exam", "Generalised attrition, reduced VDO"],
      ["Diagnosis", "Severe tooth wear, multiple failing restorations"],
      ["Plan", "Staged full-mouth rehabilitation, 6 visits"],
    ],
  },
  {
    date: "3 Feb 2026", doctor: "Dr. Meher", lock: "🔒 Locked",
    lockStyle: { background: "var(--bg)", color: "var(--muted)", borderColor: "var(--border)" },
    fields: [
      ["Complaint", "Crown fitting — tooth 46"],
      ["Done", "Zirconia crown cemented, occlusion checked"],
      ["Materials", "Zirconia, resin cement"],
      ["Advice", "Avoid hard foods 24h; review in 6 months"],
    ],
  },
];

const CHART_HISTORY = [
  { date: "12 Jun", tooth: "16", text: "planned for crown; occlusal + mesial caries charted" },
  { date: "12 Jun", tooth: "11, 21", text: "incisal attrition recorded" },
  { date: "3 Feb", tooth: "46", text: "crown cemented (zirconia)" },
  { date: "18 Jan", tooth: "47", text: "root canal completed" },
  { date: "9 Dec", tooth: "36", text: "extracted; implant advised" },
];

function ClinicalTab() {
  const { showToast } = useUIStore();
  const [findings, setFindings] = useState<Findings>(SEED_FINDINGS);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (num: number, key: SurfaceKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const id = `${num}:${key}`;
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selNums = [...new Set([...selected].map((id) => +id.split(":")[0]))];

  const applySurface = (cond: SurfaceCondition) => {
    setFindings((f) => {
      const next = { ...f };
      selected.forEach((id) => {
        const [num, key] = id.split(":");
        const n = +num;
        const cur = { ...(next[n] ?? {}) };
        cur.surfaces = { ...(cur.surfaces ?? {}), [key]: cond };
        delete cur.tooth;
        next[n] = cur;
      });
      return next;
    });
    showToast(`${SURFACE_CONDITIONS[cond].label} charted on ${selected.size} surface(s)`);
  };

  const applyTooth = (cond: ToothCondition) => {
    setFindings((f) => {
      const next = { ...f };
      selNums.forEach((n) => (next[n] = { ...(next[n] ?? {}), tooth: cond }));
      return next;
    });
    setSelected(new Set());
    showToast(`${TOOTH_CONDITIONS[cond].label} set on tooth ${selNums.join(", ")}`);
  };

  const clearFinding = () => {
    setFindings((f) => {
      const next = { ...f };
      selNums.forEach((n) => delete next[n]);
      return next;
    });
    setSelected(new Set());
    showToast(`Cleared tooth ${selNums.join(", ")}`);
  };

  const hasSel = selected.size > 0;

  return (
    <div className="grid grid-cols-[1fr_320px] gap-[18px] items-start animate-dc-fade max-lg:grid-cols-1">
      <div className="flex flex-col gap-4">
        <Panel className="pt-[18px] px-5 pb-5">
          <div className="flex justify-between items-baseline mb-1.5">
            <div className="text-[13px] font-semibold">Odontogram</div>
            <div className="text-[11.5px] text-muted-2">
              FDI numbering · tap a surface to chart · {Object.keys(findings).length} teeth charted
            </div>
          </div>
          <div className="text-[11px] text-muted-2 mb-4">
            Permanent dentition · viewed as if facing the patient
          </div>

          <Odontogram findings={findings} selected={selected} onToggle={toggle} />

          <div className="flex gap-3.5 flex-wrap mt-[18px] pt-3.5 border-t border-[#EFEDE7]">
            {ODONTOGRAM_LEGEND.map((lg) => (
              <div key={lg.label} className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className="w-3 h-3 rounded-[3px]" style={{ background: lg.bg, border: `1px solid ${lg.border}` }} />
                {lg.label}
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex justify-between items-baseline mb-3">
            <div className="text-[13px] font-semibold">Clinical notes</div>
            <button onClick={() => showToast("New clinical note — structured form opens")} className="text-[11.5px] font-semibold text-primary">＋ New note</button>
          </div>
          <div className="flex flex-col gap-3">
            {NOTES.map((n) => (
              <div key={n.date} className="border border-border rounded-[10px] px-3.5 py-3">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs font-semibold">{n.date} · {n.doctor}</span>
                  <span className="text-[10px] font-bold tracking-[0.04em] px-2 py-0.5 rounded-[5px] border" style={n.lockStyle}>
                    {n.lock}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-[18px] gap-y-1.5">
                  {n.fields.map(([label, value]) => (
                    <div key={label} className="text-xs">
                      <span className="text-muted-2">{label}: </span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Side panel */}
      <div className="sticky top-[200px]">
        {hasSel ? (
          <Panel className="p-4 animate-dc-fade">
            <div className="flex justify-between items-center mb-1">
              <div className="text-[13px] font-semibold">Record finding</div>
              <button onClick={() => setSelected(new Set())} className="text-[11.5px] text-muted-2 hover:text-ink">Clear</button>
            </div>
            <div className="text-xs text-muted mb-3">
              {selected.size} surface{selected.size > 1 ? "s" : ""} on tooth {selNums.join(", ")}
            </div>

            <div className="text-[11px] font-bold tracking-[0.06em] text-muted-2 mb-2">SURFACE CONDITION</div>
            <div className="grid grid-cols-2 gap-1.5 mb-3.5">
              {(Object.keys(SURFACE_CONDITIONS) as SurfaceCondition[]).map((k) => (
                <button
                  key={k}
                  onClick={() => applySurface(k)}
                  className="flex items-center gap-[7px] px-2.5 py-2 border border-border rounded-md text-xs font-medium hover:bg-bg hover:border-border-strong"
                >
                  <span className="w-[11px] h-[11px] rounded-[3px] flex-none" style={{ background: SURFACE_CONDITIONS[k].color }} />
                  {SURFACE_CONDITIONS[k].label}
                </button>
              ))}
            </div>

            <div className="text-[11px] font-bold tracking-[0.06em] text-muted-2 mb-2">WHOLE TOOTH</div>
            <div className="grid grid-cols-2 gap-1.5 mb-3.5">
              {(Object.keys(TOOTH_CONDITIONS) as ToothCondition[]).map((k) => (
                <button
                  key={k}
                  onClick={() => applyTooth(k)}
                  className="flex items-center gap-[7px] px-2.5 py-2 border border-border rounded-md text-xs font-medium hover:bg-bg hover:border-border-strong"
                >
                  <span className="w-[11px] h-[11px] rounded-[3px] flex-none" style={{ background: TOOTH_CONDITIONS[k].color, border: `1px solid ${TOOTH_CONDITIONS[k].border}` }} />
                  {TOOTH_CONDITIONS[k].label}
                </button>
              ))}
            </div>

            <button onClick={clearFinding} className="w-full text-center text-xs font-semibold py-2.5 rounded-md border border-border bg-surface text-danger hover:bg-danger-bg">
              Clear this tooth
            </button>
          </Panel>
        ) : (
          <Panel className="p-4">
            <div className="text-[13px] font-semibold mb-3">Chart history</div>
            <div className="flex flex-col gap-2.5">
              {CHART_HISTORY.map((ch, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="font-mono text-[10.5px] text-muted-2 flex-none w-11 pt-px">{ch.date}</span>
                  <div>
                    <span className="font-semibold">{ch.tooth}</span> <span className="text-muted">{ch.text}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-[11.5px] text-muted-2 leading-relaxed mt-3.5 pt-3 border-t border-[#EFEDE7]">
              Select one or more tooth surfaces to record what you find or plan what's needed.
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function OtherTab({ tab }: { tab: TabId }) {
  const map: Record<string, { icon: Parameters<typeof PlaceholderScreen>[0]["icon"]; title: string; body: string; cta: string }> = {
    gum: { icon: "clinical", title: "Gum health", body: "Six-point periodontal charting for every tooth, built for rapid keyboard entry so a full mouth is recorded without a mouse. It produces a severity picture and compares against previous exams.", cta: "Start a new exam" },
    plans: { icon: "revenue", title: "Treatment plans", body: "Two plans on file — a full-mouth rehabilitation (₹81,450, deferred) and a single crown. Open one for the builder, or switch to the patient-facing view.", cta: "Open the builder" },
    billing: { icon: "revenue", title: "Billing", body: "Invoices, payments, instalment schedules and a running ledger. One invoice of ₹12,500 is outstanding. Create a bill from completed work, take a payment, or send a payment link.", cta: "Create an invoice" },
    documents: { icon: "insight", title: "Documents", body: "Six items on file — an OPG, two IOPAs, a CBCT, a consent form and ID. Images open in a viewer with zoom, invert, brightness and a measuring tool.", cta: "Upload a document" },
    messages: { icon: "growth", title: "Messages", body: "Every message to and from this patient, with a box to send more. A free-reply window is currently open.", cta: "Send a message" },
  };
  const ph = map[tab];
  return <PlaceholderScreen icon={ph.icon} title={ph.title} body={ph.body} cta={ph.cta} ctaTo="#" />;
}
