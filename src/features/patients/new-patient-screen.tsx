import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { useUIStore } from "@/hooks/use-ui-store";
import { isApiError } from "@/lib/api";
import { useCreatePatient } from "./queries";
import type { CreatePatientInput } from "./api";
import type { Gender } from "@/shared/enums";

/*
 * New patient (T2.2) — wired to POST /patients. The patient number is assigned
 * by the server (never invented at the desk), so we don't show a fake one; the
 * record opens on its real number after creation. Name + phone are the only
 * hard requirements — everything else can be filled on the next visit.
 */

function Input({ label, placeholder, value, onChange, mono }: { label: string; placeholder?: string; value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <MicroLabel>{label}</MicroLabel>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`${inputClass} ${mono ? "font-mono" : ""}`} />
    </label>
  );
}

/** Parse "52 M" / "52/F" / "M 52" into an age and a gender enum. */
function parseAgeSex(raw: string): { ageFallback?: number; gender?: Gender } {
  const ageMatch = raw.match(/\d{1,3}/);
  const ageFallback = ageMatch ? Number(ageMatch[0]) : undefined;
  const g = /[mf]/i.exec(raw)?.[0]?.toLowerCase();
  const gender: Gender | undefined = g === "m" ? "male" : g === "f" ? "female" : undefined;
  return { ageFallback, gender };
}

export function NewPatientScreen() {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const create = useCreatePatient();
  const [f, setF] = useState({ name: "", phone: "", agesex: "", email: "", address: "", allergies: "", conditions: "", referredBy: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const canSave = f.name.trim() && f.phone.trim() && !create.isPending;

  async function submit() {
    if (!canSave) return;
    const [firstName, ...rest] = f.name.trim().split(/\s+/);
    const { ageFallback, gender } = parseAgeSex(f.agesex);
    // Free-text allergies/conditions are preserved on the record note until the
    // structured medical-history editor lands; they still reach the clinician.
    const medical = [f.allergies.trim() && `Allergies: ${f.allergies.trim()}`, f.conditions.trim() && `Conditions: ${f.conditions.trim()}`].filter(Boolean).join(" · ");
    const input: CreatePatientInput = {
      firstName,
      lastName: rest.join(" ") || undefined,
      phone: f.phone.trim(),
      email: f.email.trim() || undefined,
      ageFallback,
      gender,
      address: f.address.trim() ? { line1: f.address.trim() } : undefined,
      referralSource: f.referredBy.trim() || undefined,
      notes: medical || undefined,
    };
    try {
      const patient = await create.mutateAsync(input);
      showToast(`${patient.name} created — ${patient.patientNumber}`);
      navigate(`/app/patients/${patient.id}`);
    } catch (err) {
      const msg = isApiError(err) && err.code === "CONFLICT_DUPLICATE"
        ? "A patient with this phone number already exists."
        : isApiError(err) && err.code === "VALIDATION_FAILED"
          ? "Please check the name and phone number."
          : "Couldn't create the patient. Please try again.";
      showToast(msg);
    }
  }

  return (
    <div className="max-w-[820px] mx-auto flex flex-col gap-3.5">
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <button onClick={() => navigate("/app/patients")} className="text-muted hover:text-primary">Patients</button>
        <span className="text-muted-3">/</span>
        <span className="text-ink font-medium">New patient</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="m-0 text-[18px] font-semibold tracking-[-0.01em]">New patient</h1>
        <span className="text-[12px] text-muted">Patient no. is <span className="font-medium text-ink">assigned on save</span></span>
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
          <Button variant="primary" disabled={!canSave} onClick={submit}>{create.isPending ? "Creating…" : "Create patient"}</Button>
          <Button variant="secondary" onClick={() => navigate("/app/patients")}>Cancel</Button>
          {!f.name.trim() || !f.phone.trim() ? <span className="self-center text-[11.5px] text-muted-2">Name and phone are required</span> : null}
        </div>
      </Panel>
    </div>
  );
}
