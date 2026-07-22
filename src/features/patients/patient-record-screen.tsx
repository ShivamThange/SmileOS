import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Panel } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { MoneyText } from "@/components/common/money-text";
import { PlaceholderScreen } from "@/components/common/placeholder-screen";
import { EmptyState } from "@/components/common/empty-state";
import { inr, fmtDate } from "@/lib/format";
import { initials } from "@/lib/utils";
import { isApiError } from "@/lib/api";
import { useUIStore } from "@/hooks/use-ui-store";
import { useDeskStore } from "@/hooks/use-desk-store";
import { usePatient, usePatientSummary } from "./queries";
import type { PatientRecord, PatientSummary } from "./api";
import { useChart, useUpdateTooth } from "@/features/clinical/queries";
import type { ToothRecord } from "@/features/clinical/api";
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
  { id: "plans", label: "Treatment plans" },
  { id: "billing", label: "Billing" },
  { id: "documents", label: "Documents" },
  { id: "messages", label: "Messages" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Compact "52 M" from whatever age/sex the record carries. */
function ageSex(p: PatientRecord): string {
  let age: number | undefined = p.ageFallback;
  if (p.dob) {
    const d = new Date(p.dob);
    if (!Number.isNaN(d.getTime())) age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  }
  const sex = p.gender ? p.gender[0].toUpperCase() : "";
  return [age != null ? String(age) : "", sex].filter(Boolean).join(" ");
}

export function PatientRecordScreen() {
  const { id } = useParams();
  const [tab, setTab] = useState<TabId>("overview");
  const { showToast } = useUIStore();
  const { openBooking } = useDeskStore();
  const navigate = useNavigate();

  // Summary loads first and independently of the full record so the medical
  // alert banner and balance can paint the instant they arrive (spec T2.2).
  const summaryQ = usePatientSummary(id);
  const recordQ = usePatient(id);
  const record = recordQ.data;
  const summary = summaryQ.data;

  if (recordQ.isError) {
    const notFound = isApiError(recordQ.error) && recordQ.error.code === "NOT_FOUND";
    return (
      <div className="max-w-[680px] mx-auto pt-10">
        <EmptyState
          icon="patients"
          title={notFound ? "Patient not found" : "Couldn't load this patient"}
          body={notFound ? "This record may have been merged or removed." : "Something went wrong fetching the record. Please try again."}
          cta="Back to patients"
          onCta={() => navigate("/app/patients")}
        />
      </div>
    );
  }

  const name = record?.name ?? summary?.name ?? "Patient";
  const alerts = summary?.alerts ?? [];

  return (
    <div className="-mx-6 -mt-5 min-h-full flex flex-col">
      {/* Breadcrumb */}
      <div className="h-11 flex-none flex items-center gap-2.5 px-5 border-b border-border bg-surface text-[12.5px] text-muted">
        <Link to="/app/patients" className="flex items-center gap-1.5 font-medium">
          <Icon name="chevronLeft" size={13} strokeWidth={1.5} /> Patients
        </Link>
        <span className="text-border-strong">/</span>
        <span className="text-ink font-semibold">{name}</span>
      </div>

      {/* Sticky patient header bar */}
      <div className="flex-none bg-surface border-b border-border sticky top-0 z-20">
        <div className="max-w-[1360px] mx-auto px-5 pt-3.5 flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 flex-none rounded-lg bg-primary-tint text-primary grid place-items-center text-[19px] font-bold border border-primary-tint-border">
              {initials(name)}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <h1 className="m-0 text-[19px] font-semibold tracking-[-0.01em]">{name}</h1>
                <span className="text-xs text-muted-2 font-mono">{record?.patientNumber ?? summary?.patientNumber ?? ""}</span>
                {record && <span className="text-[12.5px] text-muted">{ageSex(record)}</span>}
              </div>
              <div className="flex items-center gap-3.5 text-[12.5px] text-muted flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Icon name="patients" size={12} className="text-muted-2" /> {record?.phone ?? summary?.phone ?? "—"}
                </span>
                <span>Last visit: <b className="text-ink font-semibold">{summary?.lastVisit ? fmtDate(summary.lastVisit) : "—"}</b></span>
                <span>Next: <b className="text-ink font-semibold">{summary?.nextVisit ? fmtDate(summary.nextVisit.start) : "None booked"}</b></span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">OUTSTANDING</div>
              <div
                className="text-xl font-bold tnum"
                style={{ color: summary?.balancePaise ? "var(--danger)" : "var(--primary)" }}
              >
                {summaryQ.isLoading ? <span className="text-muted-2 text-sm font-medium">…</span> : summary?.balancePaise ? <MoneyText paise={summary.balancePaise} /> : "Nil"}
              </div>
            </div>
            <div className="flex gap-2 self-center">
              <button onClick={() => openBooking({ patientId: id, phone: record?.phone })} className="text-[12.5px] font-semibold px-3.5 py-2 rounded-md bg-primary text-on-primary hover:bg-primary-hover">Book</button>
              <button onClick={() => showToast("New invoice — form opens")} className="text-[12.5px] font-semibold px-3.5 py-2 rounded-md border border-border bg-surface hover:bg-bg">Bill</button>
              <button onClick={() => showToast(`Message thread opened — ${name}`)} className="text-[12.5px] font-semibold px-3.5 py-2 rounded-md border border-border bg-surface hover:bg-bg">Message</button>
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
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 max-w-[1360px] w-full mx-auto p-5 box-border">
        {tab === "overview" && <OverviewTab record={record} summary={summary} loading={recordQ.isLoading} />}
        {tab === "clinical" && <ClinicalTab patientId={id} />}
        {tab !== "overview" && tab !== "clinical" && <OtherTab tab={tab} />}
      </div>
    </div>
  );
}

function OverviewTab({ record, summary, loading }: { record?: PatientRecord; summary?: PatientSummary; loading: boolean }) {
  if (loading || !record) {
    return <div className="text-[12.5px] text-muted-2 py-10 text-center">Loading the record…</div>;
  }

  const addr = record.address;
  const addressLine = [addr?.line1, addr?.locality, addr?.city].filter(Boolean).join(", ");
  const since = record.createdAt ? new Date(record.createdAt).getFullYear() : undefined;

  const glance = [
    { value: summary?.balancePaise ? inr(summary.balancePaise) : "Nil", label: "Outstanding" },
    { value: summary?.lastVisit ? fmtDate(summary.lastVisit) : "—", label: "Last seen" },
    { value: summary?.nextVisit ? fmtDate(summary.nextVisit.start) : "None", label: "Next visit" },
    { value: summary?.nextRecallDate ? fmtDate(summary.nextRecallDate) : "—", label: "Recall due" },
    { value: record.status ? record.status[0].toUpperCase() + record.status.slice(1) : "Active", label: "Status" },
    { value: since ? String(since) : "—", label: "Patient since" },
  ];
  const contact = [
    { label: "Phone", value: record.phone },
    { label: "Alt phone", value: record.altPhone },
    { label: "Email", value: record.email },
    { label: "Address", value: addressLine },
    { label: "Blood group", value: record.bloodGroup },
    { label: "Occupation", value: record.occupation },
    { label: "Emergency", value: record.emergencyContact?.name ? `${record.emergencyContact.name}${record.emergencyContact.relationship ? ` (${record.emergencyContact.relationship})` : ""}` : undefined },
    { label: "Referred by", value: record.referralSource },
  ].filter((c) => c.value);

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
        {record.notes ? (
          <div className="text-[12.5px] text-muted leading-relaxed border border-border-faint rounded-lg px-3.5 py-3 mb-3">
            <span className="text-muted-2 text-[11px] font-bold tracking-[0.05em] block mb-1">INTAKE NOTE</span>
            {record.notes}
          </div>
        ) : null}
        <div className="text-[12.5px] text-muted-2 py-6 text-center border border-dashed border-border rounded-lg">
          A merged event timeline (visits, treatments, payments, messages) lands with the patient-events endpoint.
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

/*
 * Odontogram ↔ chart record mapping. The odontogram's surface conditions
 * (caries/filled/wear/planned) are all valid backend tooth conditions, and its
 * surface keys match the backend's; only the whole-tooth "plannedTooth" differs
 * from the backend's "planned". Unknown backend conditions (bridge, veneer, …)
 * the odontogram can't render are skipped on load.
 */
const FE_SURFACE_CONDS = new Set(["caries", "filled", "wear", "planned"]);
const FE_TOOTH_CONDS = new Set(["crown", "rct", "implant", "missing"]);

function findingToToothBody(finding?: Findings[number]): Partial<ToothRecord> {
  const body: Partial<ToothRecord> = { wholeConditions: [], surfaces: [], presence: "present" };
  if (finding?.tooth) {
    body.wholeConditions = [finding.tooth === "plannedTooth" ? "planned" : finding.tooth];
    body.presence = finding.tooth === "missing" ? "missing" : "present";
  }
  if (finding?.surfaces) {
    body.surfaces = Object.entries(finding.surfaces).map(([surface, condition]) => ({ surface, condition: condition as string }));
  }
  return body;
}

function chartToFindings(teeth: Record<string, ToothRecord>): Findings {
  const out: Findings = {};
  for (const [numStr, rec] of Object.entries(teeth ?? {})) {
    const finding: Findings[number] = {};
    const whole = rec.wholeConditions?.find((c) => FE_TOOTH_CONDS.has(c) || c === "planned");
    if (whole) finding.tooth = (whole === "planned" ? "plannedTooth" : whole) as ToothCondition;
    else if (rec.presence === "missing") finding.tooth = "missing";
    if (rec.surfaces?.length) {
      const surfaces: Partial<Record<SurfaceKey, SurfaceCondition>> = {};
      for (const s of rec.surfaces) {
        if (FE_SURFACE_CONDS.has(s.condition)) surfaces[s.surface as SurfaceKey] = s.condition as SurfaceCondition;
      }
      if (Object.keys(surfaces).length) finding.surfaces = surfaces;
    }
    if (finding.tooth || finding.surfaces) out[+numStr] = finding;
  }
  return out;
}

function ClinicalTab({ patientId }: { patientId?: string }) {
  const { showToast } = useUIStore();
  const chartQ = useChart(patientId);
  const updateTooth = useUpdateTooth(patientId ?? "");
  const [findings, setFindings] = useState<Findings>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Hydrate the odontogram from the persisted chart (falls back to the seed
  // findings only when there is no patient context, e.g. a design preview).
  useEffect(() => {
    if (chartQ.data) setFindings(chartToFindings(chartQ.data.teeth));
    else if (!patientId) setFindings(SEED_FINDINGS);
  }, [chartQ.data, patientId]);

  /** Persist one tooth's finding through PUT /chart/tooth/:n (append to history). */
  const persist = (n: number, finding: Findings[number] | undefined) => {
    if (!patientId) return;
    updateTooth.mutate({ toothNumber: n, body: findingToToothBody(finding) });
  };

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
    const next = { ...findings };
    selected.forEach((id) => {
      const [num, key] = id.split(":");
      const n = +num;
      const cur = { ...(next[n] ?? {}) };
      cur.surfaces = { ...(cur.surfaces ?? {}), [key]: cond };
      delete cur.tooth;
      next[n] = cur;
    });
    setFindings(next);
    selNums.forEach((n) => persist(n, next[n]));
    showToast(`${SURFACE_CONDITIONS[cond].label} charted on ${selected.size} surface(s)`);
  };

  const applyTooth = (cond: ToothCondition) => {
    const next = { ...findings };
    selNums.forEach((n) => (next[n] = { ...(next[n] ?? {}), tooth: cond }));
    setFindings(next);
    selNums.forEach((n) => persist(n, next[n]));
    setSelected(new Set());
    showToast(`${TOOTH_CONDITIONS[cond].label} set on tooth ${selNums.join(", ")}`);
  };

  const clearFinding = () => {
    const next = { ...findings };
    selNums.forEach((n) => delete next[n]);
    setFindings(next);
    selNums.forEach((n) => persist(n, undefined));
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
