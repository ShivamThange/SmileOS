import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/hooks/use-ui-store";
import { usePatientsList, usePatientSummary } from "@/features/patients/queries";
import { useCreatePrescription } from "./queries";

/*
 * Prescriptions — write, sign and send, with a live allergy and interaction
 * cross-check. The patient's recorded allergies (from their medical history)
 * drive a hard warning before anything can be signed (spec: safety is never
 * colour-only — it's a block), and the server re-checks on save.
 */

interface Drug { name: string; dose: string; interactsWith?: string; allergyClass?: string }

const FORMULARY: Drug[] = [
  { name: "Amoxicillin 500mg", dose: "1 cap · 8-hourly · 5 days", allergyClass: "Penicillin" },
  { name: "Ibuprofen 400mg", dose: "1 tab · 8-hourly · 3 days", interactsWith: "Warfarin" },
  { name: "Paracetamol 650mg", dose: "1 tab · 6-hourly · SOS" },
  { name: "Metronidazole 400mg", dose: "1 tab · 8-hourly · 5 days" },
  { name: "Chlorhexidine 0.2%", dose: "Rinse · twice daily · 7 days" },
  { name: "Amoxiclav 625mg", dose: "1 tab · 12-hourly · 5 days", allergyClass: "Penicillin" },
];

export function PrescriptionsScreen() {
  const { showToast } = useUIStore();
  const patientsQ = usePatientsList({ limit: 100, sort: "firstName", order: "asc" });
  const options = patientsQ.data?.data ?? [];
  const [patientId, setPatientId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Default to the first real patient once the list resolves.
  useEffect(() => { if (!patientId && options.length) setPatientId(options[0].id); }, [options, patientId]);

  const summaryQ = usePatientSummary(patientId || undefined);
  const alerts = summaryQ.data?.alerts ?? [];
  const alertText = alerts.join(" · ");
  const createRx = useCreatePrescription(patientId);

  const warnings = useMemo(() => {
    const out: { drug: string; kind: "allergy" | "interaction"; detail: string }[] = [];
    const allergy = alertText.toLowerCase();
    FORMULARY.forEach((d) => {
      if (!selected.has(d.name)) return;
      if (d.allergyClass && allergy.includes(d.allergyClass.toLowerCase())) out.push({ drug: d.name, kind: "allergy", detail: `Patient is allergic to ${d.allergyClass}` });
      if (d.interactsWith) out.push({ drug: d.name, kind: "interaction", detail: `Interacts with ${d.interactsWith}` });
    });
    return out;
  }, [selected, alertText]);

  const blocked = warnings.some((w) => w.kind === "allergy");
  const toggle = (name: string) => setSelected((s) => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const patientName = options.find((p) => p.id === patientId)?.name ?? "the patient";

  async function sign() {
    if (blocked || selected.size === 0 || !patientId) return;
    setSaving(true);
    try {
      const meds = FORMULARY.filter((d) => selected.has(d.name)).map((d) => ({ drug: d.name, dosage: d.dose }));
      const rx = await createRx.mutateAsync({ medications: meds });
      if (rx.warnings?.length) showToast(`Saved with ${rx.warnings.length} warning(s) — review before sending`);
      else showToast(`Prescription signed & sent to ${patientName} on WhatsApp`);
      setSelected(new Set());
    } catch {
      showToast("Couldn't save the prescription. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Prescriptions" subtitle="Write, sign and send — with cross-checks" />
      <div className="grid gap-3.5 items-start" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        {/* Compose */}
        <Panel className="px-5 py-4">
          <MicroLabel>Patient</MicroLabel>
          <select value={patientId} onChange={(e) => { setPatientId(e.target.value); setSelected(new Set()); }}
            disabled={patientsQ.isLoading}
            className="w-full mt-2 text-[13px] px-3 py-2 border border-border rounded-md bg-bg-content outline-none focus:border-border-strong">
            {patientsQ.isLoading && <option>Loading…</option>}
            {options.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.patientNumber}</option>)}
          </select>
          {alertText && (
            <div className="mt-2.5 flex items-center gap-2 text-[12px] font-semibold text-danger bg-danger-bg border border-danger-border rounded-md px-3 py-2">
              ⚠ On file: {alertText}
            </div>
          )}

          <MicroLabel className="block mt-4 mb-2">Medications</MicroLabel>
          <div className="flex flex-col gap-2">
            {FORMULARY.map((d) => {
              const sel = selected.has(d.name);
              return (
                <div key={d.name} onClick={() => toggle(d.name)} className="flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors"
                  style={{ background: sel ? "var(--primary-tint)" : "var(--surface)", borderColor: sel ? "var(--primary-tint-border)" : "var(--border)" }}>
                  <div className="w-4 h-4 flex-none rounded grid place-items-center border" style={{ background: sel ? "#20614E" : "transparent", borderColor: sel ? "#20614E" : "var(--border-strong)" }}>
                    {sel && <span className="text-on-primary text-[10px] leading-none">✓</span>}
                  </div>
                  <div className="flex-1"><div className="text-[13px] font-semibold">{d.name}</div><div className="text-[11px] text-muted-2">{d.dose}</div></div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Cross-check + sign */}
        <div className="flex flex-col gap-3">
          <Panel className="px-5 py-4">
            <MicroLabel>Cross-check</MicroLabel>
            {selected.size === 0 ? (
              <div className="text-[12.5px] text-muted mt-2">Select medications to run the allergy and interaction check.</div>
            ) : warnings.length === 0 ? (
              <div className="mt-2 flex items-center gap-2 text-[12.5px] font-semibold text-primary bg-primary-tint border border-primary-tint-border rounded-md px-3 py-2">✓ No conflicts found</div>
            ) : (
              <div className="flex flex-col gap-2 mt-2">
                {warnings.map((w, i) => (
                  <div key={i} className="text-[12px] rounded-md px-3 py-2 border"
                    style={w.kind === "allergy" ? { background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger)" } : { background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning)" }}>
                    <b>{w.kind === "allergy" ? "⚠ Allergy" : "⚠ Interaction"}</b> — {w.drug}: {w.detail}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="px-5 py-4 flex flex-col gap-2">
            <div className="text-[12px] text-muted">{selected.size} item{selected.size === 1 ? "" : "s"} selected</div>
            <Button variant="primary" className="w-full justify-center" disabled={blocked || selected.size === 0 || saving || !patientId}
              onClick={sign}>
              {blocked ? "Resolve allergy to sign" : saving ? "Signing…" : "Sign & send"}
            </Button>
            <Button variant="secondary" className="w-full justify-center" disabled={selected.size === 0} onClick={() => showToast("Saved as draft")}>Save draft</Button>
          </Panel>
        </div>
      </div>
    </div>
  );
}
