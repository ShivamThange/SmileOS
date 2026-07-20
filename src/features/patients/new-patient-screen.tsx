import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/hooks/use-ui-store";

/*
 * New patient — the record-creation form. The patient number is generated
 * automatically (shown read-only) so the desk never has to invent one.
 */

const NEXT_PNO = "MDC-1259";

function Input({ label, placeholder, value, onChange, mono }: { label: string; placeholder?: string; value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <MicroLabel>{label}</MicroLabel>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`text-[13px] px-3 py-2 border border-border rounded-md bg-bg-content outline-none focus:border-border-strong ${mono ? "font-mono" : ""}`} />
    </label>
  );
}

export function NewPatientScreen() {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const [f, setF] = useState({ name: "", phone: "", agesex: "", email: "", address: "", allergies: "", conditions: "", referredBy: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const canSave = f.name.trim() && f.phone.trim();

  return (
    <div className="max-w-[820px] mx-auto flex flex-col gap-3.5">
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <button onClick={() => navigate("/app/patients")} className="text-muted hover:text-primary">Patients</button>
        <span className="text-muted-3">/</span>
        <span className="text-ink font-medium">New patient</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="m-0 text-[18px] font-semibold tracking-[-0.01em]">New patient</h1>
        <span className="text-[12px] text-muted">Patient no. <span className="font-mono font-semibold text-ink">{NEXT_PNO}</span> · auto-generated</span>
      </div>

      <Panel className="px-5 py-5 flex flex-col gap-4">
        <div>
          <MicroLabel className="block mb-2.5">Identity</MicroLabel>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Input label="Full name" placeholder="e.g. Ramesh Iyer" value={f.name} onChange={set("name")} />
            <Input label="Phone" placeholder="10-digit mobile" value={f.phone} onChange={set("phone")} mono />
            <Input label="Age / sex" placeholder="e.g. 52 M" value={f.agesex} onChange={set("agesex")} />
            <Input label="Email (optional)" placeholder="name@email.com" value={f.email} onChange={set("email")} />
          </div>
        </div>
        <div>
          <MicroLabel className="block mb-2.5">Contact</MicroLabel>
          <Input label="Address" placeholder="Area, city" value={f.address} onChange={set("address")} />
        </div>
        <div>
          <MicroLabel className="block mb-2.5">Medical — surfaces as an alert on the record</MicroLabel>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Input label="Allergies" placeholder="e.g. Penicillin" value={f.allergies} onChange={set("allergies")} />
            <Input label="Conditions" placeholder="e.g. Type 2 diabetes" value={f.conditions} onChange={set("conditions")} />
          </div>
        </div>
        <div>
          <MicroLabel className="block mb-2.5">Source</MicroLabel>
          <Input label="Referred by (optional)" placeholder="Patient, doctor or channel" value={f.referredBy} onChange={set("referredBy")} />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="primary" disabled={!canSave} onClick={() => { showToast(`${f.name || "Patient"} created — ${NEXT_PNO}`); navigate("/app/patients"); }}>Create patient</Button>
          <Button variant="secondary" onClick={() => navigate("/app/patients")}>Cancel</Button>
          {!canSave && <span className="self-center text-[11.5px] text-muted-2">Name and phone are required</span>}
        </div>
      </Panel>
    </div>
  );
}
