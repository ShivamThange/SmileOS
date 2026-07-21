import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inrFromRupees } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import { clinicConfig } from "@/config/clinic";
import { TemplateEditor } from "./template-editor";

/*
 * Settings — clinic details, branding, fees and templates. The design's promise
 * is that a rebrand takes an hour, not a week: brand colour and clinic identity
 * are data here, the same tokens the whole app themes from.
 */

type Section = "profile" | "branding" | "fees" | "templates" | "features";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "profile", label: "Clinic profile" },
  { key: "branding", label: "Branding" },
  { key: "fees", label: "Fee schedule" },
  { key: "templates", label: "Templates" },
  { key: "features", label: "Features" },
];

const FEES: [string, number][] = [
  ["Consultation", 500], ["Scaling & polishing", 1200], ["Composite filling", 2000],
  ["Root canal (molar)", 8500], ["Zirconia crown", 12000], ["Single implant", 42000],
  ["Clear aligners (full)", 148000], ["E-max veneer (per tooth)", 14000],
];

const FIELD = "text-[13px] px-3 py-2 border border-border rounded-md bg-bg-content outline-none focus:border-border-strong w-full";

export function SettingsScreen() {
  const { showToast } = useUIStore();
  const navigate = useNavigate();
  const { section: sectionParam } = useParams();
  const [brand, setBrand] = useState("#20614E");

  /*
   * The section lives in the URL, not in component state.
   *
   * A route that matches and is then ignored is worse than a route that
   * doesn't exist — /app/settings/templates used to render the profile tab,
   * which makes every link and bookmark to a settings section quietly wrong.
   */
  const section: Section =
    SECTIONS.find((s) => s.key === sectionParam)?.key ?? "profile";
  const setSection = (next: Section) => navigate(`/app/settings/${next}`);

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Settings" subtitle="Clinic details, branding, fees and templates"
        aside={<Button variant="primary" onClick={() => showToast("Settings saved")}>Save changes</Button>} />

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
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <Labeled label="Clinic name"><input defaultValue={clinicConfig.name} className={FIELD} /></Labeled>
                <Labeled label="Owner"><input defaultValue={clinicConfig.ownerName} className={FIELD} /></Labeled>
                <Labeled label="Locality"><input defaultValue={clinicConfig.locality} className={FIELD} /></Labeled>
                <Labeled label="City"><input defaultValue={clinicConfig.city} className={FIELD} /></Labeled>
                <Labeled label="Branch"><input defaultValue={clinicConfig.branch} className={FIELD} /></Labeled>
                <Labeled label="Timezone"><input defaultValue={clinicConfig.timezone} className={`${FIELD} font-mono`} /></Labeled>
              </div>
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
                    <input type="color" value={brand} onChange={(e) => setBrand(e.target.value)} className="w-9 h-9 rounded-md border border-border bg-surface cursor-pointer" />
                    <input value={brand} onChange={(e) => setBrand(e.target.value)} className={`${FIELD} font-mono w-[120px]`} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {["#20614E", "#2E6DA4", "#7A4C8A", "#9A6215", "#A8342A"].map((c) => (
                  <button key={c} onClick={() => setBrand(c)} className="w-8 h-8 rounded-md border-2" style={{ background: c, borderColor: brand === c ? "var(--ink)" : "transparent" }} />
                ))}
              </div>
              <div className="text-[12px] text-muted-2">In production this writes the brand token and rethemes every surface — console, site and portal — at once.</div>
            </Panel>
          )}

          {section === "fees" && (
            <Panel className="overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-bg-content flex items-center justify-between">
                <MicroLabel>Fee schedule</MicroLabel>
                <button onClick={() => showToast("Add fee item")} className="text-[11.5px] font-semibold text-primary">＋ Add item</button>
              </div>
              {FEES.map(([name, rupees], i) => (
                <div key={name} className="flex items-center justify-between px-4 py-2.5 text-[12.5px]" style={{ borderBottom: i < FEES.length - 1 ? "1px solid var(--border-faint)" : "none" }}>
                  <span className="font-medium">{name}</span>
                  <span className="tnum font-semibold">{inrFromRupees(rupees)}</span>
                </div>
              ))}
            </Panel>
          )}

          {section === "templates" && <TemplateEditor />}

          {section === "features" && (
            <Panel className="px-5 py-4">
              <MicroLabel className="block mb-2">Feature flags</MicroLabel>
              <div className="flex flex-col">
                {Object.entries(clinicConfig.features).map(([k, v], i, arr) => (
                  <div key={k} className="flex items-center justify-between py-2.5 text-[12.5px]" style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border-faint)" : "none" }}>
                    <span className="font-medium">{k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-[3px] rounded-[5px] border"
                      style={v ? { background: "#EAF1EE", color: "#20614E", borderColor: "#C7DAD1" } : { background: "#F4F3EF", color: "#6E6C64", borderColor: "#E6E4DE" }}>
                      {v ? "● On" : "○ Off"}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
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
