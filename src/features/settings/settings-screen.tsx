import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/hooks/use-ui-store";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { clinicConfig, type ClinicFeatures } from "@/config/clinic";
import { applyBranding } from "@/lib/branding";
import { updateClinic, updateClinicBranding, updateClinicFeatures, type PublicClinic } from "@/features/clinic/api";
import { TemplateEditor } from "./template-editor";
import { FeeSchedule } from "./fee-schedule";

/*
 * Settings — clinic details, branding, fees and templates, wired to /clinic.
 * The design's promise is that a rebrand takes an hour, not a week: brand colour
 * and clinic identity are DATA here, the same tokens the whole app themes from,
 * so saving branding re-themes every surface live. Feature flags decide which
 * console sections exist; flipping one here hides its nav and routes at once.
 *
 * Every write requires settings:update — the server enforces it, and the UI
 * disables the controls with a reason for anyone else.
 */

type Section = "profile" | "branding" | "fees" | "templates" | "features";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "profile", label: "Clinic profile" },
  { key: "branding", label: "Branding" },
  { key: "fees", label: "Fee schedule" },
  { key: "templates", label: "Templates" },
  { key: "features", label: "Features" },
];

/** Human labels for the feature flags. Keys mirror ClinicFeatures. */
const FEATURE_LABELS: Record<keyof ClinicFeatures, string> = {
  publicSite: "Public website",
  onlineBooking: "Online booking",
  costCalculator: "Cost calculator",
  patientPortal: "Patient portal",
  whatsapp: "WhatsApp messaging",
  payments: "Online payments",
  inventory: "Inventory tracking",
  labTracking: "Lab case tracking",
  multiDoctor: "Multiple doctors",
  reviewRequests: "Review requests",
  recallEngine: "Recall engine",
  insuranceClaims: "Insurance claims",
};

const FIELD = "text-[13px] px-3 py-2 border border-border rounded-md bg-bg-content outline-none focus:border-border-strong w-full disabled:opacity-60";

export function SettingsScreen() {
  const { showToast } = useUIStore();
  const navigate = useNavigate();
  const { section: sectionParam } = useParams();
  const { can, rolesFor } = usePermission();
  const clinic = useAuth((s) => s.clinic);
  const features = useAuth((s) => s.features);
  const setFeatures = useAuth((s) => s.setFeatures);
  const setClinic = useAuth((s) => s.setClinic);

  const canEdit = can("settings:update");
  const editHint = canEdit ? undefined : `Editing settings is available to ${rolesFor("settings:update")}`;

  const [brand, setBrand] = useState(clinic?.branding?.primary ?? "#20614E");
  const [saving, setSaving] = useState(false);

  /*
   * The section lives in the URL, not in component state — a route that matches
   * and is then ignored is worse than one that doesn't exist.
   */
  const section: Section = SECTIONS.find((s) => s.key === sectionParam)?.key ?? "profile";
  const setSection = (next: Section) => navigate(`/app/settings/${next}`);

  async function saveBranding() {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const saved = await updateClinicBranding({ ...(clinic?.branding ?? {}), primary: brand, primaryHover: brand });
      applyBranding(saved); // re-theme every surface live
      if (clinic) setClinic({ ...clinic, branding: saved });
      showToast("Branding saved — the whole app re-themed");
    } catch {
      showToast("Couldn't save branding. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleFeature(key: keyof ClinicFeatures) {
    if (!canEdit || saving) return;
    const current = features[key] !== false;
    const next = { ...features, [key]: !current };
    setFeatures(next); // optimistic — nav/routes react immediately
    setSaving(true);
    try {
      setFeatures(await updateClinicFeatures(next));
      showToast(`${FEATURE_LABELS[key]} ${!current ? "enabled" : "disabled"}`);
    } catch {
      setFeatures({ ...features, [key]: current }); // roll back
      showToast("Couldn't update feature. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-3.5">
      <PageHeader
        title="Settings"
        subtitle="Clinic details, branding, fees and templates"
        aside={
          section === "branding" ? (
            <Button variant="primary" onClick={saveBranding} disabled={!canEdit || saving} title={editHint}>
              {saving ? "Saving…" : "Save branding"}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3.5 items-start" style={{ gridTemplateColumns: "200px 1fr" }}>
        <Panel className="p-1.5 flex flex-col gap-0.5">
          {SECTIONS.map((s) => {
            const sel = section === s.key;
            return (
              <button key={s.key} onClick={() => setSection(s.key)} className="text-left text-[12.5px] font-semibold px-3 py-2 rounded-md transition-colors"
                style={{ background: sel ? "var(--surface)" : "transparent", color: sel ? "var(--primary)" : "var(--muted-strong)", boxShadow: sel ? "inset 0 0 0 1px var(--primary-tint-border)" : "none" }}>
                {s.label}
              </button>
            );
          })}
        </Panel>

        <div>
          {section === "profile" && (
            <Panel className="px-5 py-5 flex flex-col gap-3">
              <MicroLabel>Clinic profile</MicroLabel>
              {!canEdit && <div className="text-[12px] text-muted-2">{editHint}. These details are read-only for your role.</div>}
              <ProfileForm clinicName={clinic?.name} disabled={!canEdit} onSaved={setClinic} />
            </Panel>
          )}

          {section === "branding" && (
            <Panel className="px-5 py-5 flex flex-col gap-4">
              <MicroLabel>Branding — a rebrand should take an hour, not a week</MicroLabel>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl grid place-items-center text-2xl font-bold text-on-primary" style={{ background: brand }}>{clinicConfig.shortInitial}</div>
                <div className="flex flex-col gap-1.5">
                  <MicroLabel>Brand colour</MicroLabel>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={brand} onChange={(e) => setBrand(e.target.value)} disabled={!canEdit} className="w-9 h-9 rounded-md border border-border bg-surface cursor-pointer disabled:opacity-60" />
                    <input value={brand} onChange={(e) => setBrand(e.target.value)} disabled={!canEdit} className={`${FIELD} font-mono w-[120px]`} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {["#20614E", "#2E6DA4", "#7A4C8A", "#9A6215", "#A8342A"].map((c) => (
                  <button key={c} onClick={() => canEdit && setBrand(c)} disabled={!canEdit} className="w-8 h-8 rounded-md border-2 disabled:opacity-60" style={{ background: c, borderColor: brand === c ? "var(--ink)" : "transparent" }} />
                ))}
              </div>
              <div className="text-[12px] text-muted-2">Saving writes the brand token and re-themes every surface — console, site and portal — at once.</div>
            </Panel>
          )}

          {section === "fees" && <FeeSchedule canEdit={canEdit} editHint={editHint} />}

          {section === "templates" && <TemplateEditor />}

          {section === "features" && (
            <Panel className="px-5 py-4">
              <MicroLabel className="block mb-2">Feature flags {!canEdit && <span className="font-normal text-muted-2">· {editHint}</span>}</MicroLabel>
              <div className="flex flex-col">
                {(Object.keys(FEATURE_LABELS) as (keyof ClinicFeatures)[]).map((key, i, arr) => {
                  const on = features[key] !== false;
                  return (
                    <div key={key} className="flex items-center justify-between py-2.5 text-[12.5px]" style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border-faint)" : "none" }}>
                      <span className="font-medium">{FEATURE_LABELS[key]}</span>
                      <button
                        onClick={() => toggleFeature(key)}
                        disabled={!canEdit || saving}
                        title={editHint}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-[3px] rounded-[5px] border disabled:cursor-not-allowed"
                        style={on ? { background: "#EAF1EE", color: "#20614E", borderColor: "#C7DAD1" } : { background: "#F4F3EF", color: "#6E6C64", borderColor: "#E6E4DE" }}
                      >
                        {on ? "● On" : "○ Off"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

/*
 * Profile form. Reads the live clinic name from /clinic (falling back to the
 * boot config for the fields the public profile doesn't carry) and PATCHes the
 * clinic on save. Kept uncontrolled — this is a low-frequency admin form, not a
 * hot path — with the name field the one that round-trips to the server today.
 */
function ProfileForm({ clinicName, disabled, onSaved }: { clinicName?: string; disabled: boolean; onSaved: (c: PublicClinic) => void }) {
  const { showToast } = useUIStore();
  const [name, setName] = useState(clinicName ?? clinicConfig.name);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (disabled || saving) return;
    setSaving(true);
    try {
      const updated = await updateClinic({ name: name.trim() });
      onSaved(updated);
      showToast("Clinic profile saved");
    } catch {
      showToast("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Labeled label="Clinic name"><input value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} className={FIELD} /></Labeled>
        <Labeled label="Owner"><input defaultValue={clinicConfig.ownerName} disabled={disabled} className={FIELD} /></Labeled>
        <Labeled label="Locality"><input defaultValue={clinicConfig.locality} disabled={disabled} className={FIELD} /></Labeled>
        <Labeled label="City"><input defaultValue={clinicConfig.city} disabled={disabled} className={FIELD} /></Labeled>
        <Labeled label="Branch"><input defaultValue={clinicConfig.branch} disabled={disabled} className={FIELD} /></Labeled>
        <Labeled label="Timezone"><input defaultValue={clinicConfig.timezone} disabled={disabled} className={`${FIELD} font-mono`} /></Labeled>
      </div>
      {!disabled && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
        </div>
      )}
    </>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <MicroLabel>{label}</MicroLabel>
      {children}
    </label>
  );
}
