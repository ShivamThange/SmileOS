import { useState } from "react";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import { PROCEDURE_CATEGORIES, type ProcedureCategory } from "@/shared/enums";
import { useProcedures, useCreateProcedure, useUpdateProcedure, useDeleteProcedure } from "./procedures-queries";
import type { Procedure } from "./procedures-api";

/*
 * Fee schedule — the price book, wired to /procedures (T2.1). This is the single
 * source every money surface reads: edit a price here and it flows to the cost
 * calculator and the treatment-plan builder, because they quote the same
 * catalogue. Editing is gated to settings:update; the server enforces it too.
 */

const CATEGORY_LABEL: Record<ProcedureCategory, string> = {
  preventive: "Preventive",
  restorative: "Restorative",
  endodontic: "Endodontic",
  periodontal: "Periodontal",
  oral_surgery: "Oral surgery",
  prosthodontic: "Prosthodontic",
  orthodontic: "Orthodontic",
  pedodontic: "Pedodontic",
  implant: "Implant",
  cosmetic: "Cosmetic",
};

const FIELD = "text-[13px] px-2.5 py-1.5 border border-border rounded-md bg-bg-content outline-none focus:border-border-strong";

export function FeeSchedule({ canEdit, editHint }: { canEdit: boolean; editHint?: string }) {
  const { showToast } = useUIStore();
  const { data: procedures, isLoading, isError } = useProcedures();
  const update = useUpdateProcedure();
  const remove = useDeleteProcedure();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");

  function startEdit(p: Procedure) {
    setEditingId(p._id);
    setPriceDraft(String(Math.round(p.defaultPricePaise / 100)));
  }

  async function saveEdit(p: Procedure) {
    const rupees = Number(priceDraft);
    if (!Number.isFinite(rupees) || rupees < 0) {
      showToast("Enter a valid price");
      return;
    }
    try {
      await update.mutateAsync({ id: p._id, input: { defaultPricePaise: Math.round(rupees * 100) } });
      setEditingId(null);
      showToast(`${p.name} price updated`);
    } catch {
      showToast("Couldn't save the price. Please try again.");
    }
  }

  async function del(p: Procedure) {
    try {
      await remove.mutateAsync(p._id);
      showToast(`${p.name} removed`);
    } catch {
      showToast("Couldn't remove the item. Please try again.");
    }
  }

  return (
    <Panel className="overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-bg-content flex items-center justify-between">
        <MicroLabel>Fee schedule {procedures ? `· ${procedures.length} items` : ""}</MicroLabel>
        {canEdit ? (
          <button onClick={() => setAdding((a) => !a)} className="text-[11.5px] font-semibold text-primary">{adding ? "Cancel" : "＋ Add item"}</button>
        ) : (
          <span className="text-[11px] text-muted-2" title={editHint}>Read-only</span>
        )}
      </div>

      {adding && canEdit && <AddRow onDone={() => setAdding(false)} />}

      {isLoading && <div className="px-4 py-6 text-[12.5px] text-muted-2">Loading the price book…</div>}
      {isError && <div className="px-4 py-6 text-[12.5px] text-danger">Couldn't load the fee schedule.</div>}
      {procedures && procedures.length === 0 && !adding && (
        <div className="px-4 py-8 text-center text-[12.5px] text-muted-2">
          No procedures in the price book yet.{canEdit ? " Add your first item above." : ""}
        </div>
      )}

      {procedures?.map((p, i) => {
        const editing = editingId === p._id;
        return (
          <div key={p._id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px]" style={{ borderBottom: i < procedures.length - 1 ? "1px solid var(--border-faint)" : "none" }}>
            <div className="min-w-0">
              <div className="font-medium truncate">{p.name}</div>
              <div className="text-[10.5px] text-muted-2">{CATEGORY_LABEL[p.category] ?? p.category}</div>
            </div>
            <div className="flex items-center gap-2 flex-none">
              {editing ? (
                <>
                  <span className="text-muted-2">₹</span>
                  <input autoFocus value={priceDraft} onChange={(e) => setPriceDraft(e.target.value.replace(/[^\d]/g, ""))} className={`${FIELD} w-[92px] tnum text-right`} />
                  <Button variant="primary" onClick={() => saveEdit(p)} disabled={update.isPending}>{update.isPending ? "…" : "Save"}</Button>
                  <button onClick={() => setEditingId(null)} className="text-[11.5px] text-muted hover:text-ink px-1">Cancel</button>
                </>
              ) : (
                <>
                  <span className="tnum font-semibold">{inr(p.defaultPricePaise)}</span>
                  {canEdit && (
                    <>
                      <button onClick={() => startEdit(p)} className="text-[11px] font-semibold text-primary px-1" title="Edit price">Edit</button>
                      <button onClick={() => del(p)} disabled={remove.isPending} className="text-[11px] font-semibold text-danger px-1" title="Remove item">Remove</button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

/* A minimal add row — name, category, price. Enough to seed the book from the
 * UI; richer fields (tiers, consent, lab) live in the item editor later. */
function AddRow({ onDone }: { onDone: () => void }) {
  const { showToast } = useUIStore();
  const create = useCreateProcedure();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProcedureCategory>("restorative");
  const [price, setPrice] = useState("");

  async function submit() {
    if (name.trim().length < 2) {
      showToast("Give the procedure a name");
      return;
    }
    try {
      await create.mutateAsync({
        name: name.trim(),
        category,
        defaultPricePaise: Math.round((Number(price) || 0) * 100),
      });
      showToast(`${name.trim()} added`);
      onDone();
    } catch {
      showToast("Couldn't add the item. Please try again.");
    }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-bg-content border-b border-border flex-wrap">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Procedure name" className={`${FIELD} flex-1 min-w-[160px]`} />
      <select value={category} onChange={(e) => setCategory(e.target.value as ProcedureCategory)} className={FIELD}>
        {PROCEDURE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
      </select>
      <div className="flex items-center gap-1"><span className="text-muted-2">₹</span>
        <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" className={`${FIELD} w-[92px] tnum text-right`} />
      </div>
      <Button variant="primary" onClick={submit} disabled={create.isPending}>{create.isPending ? "Adding…" : "Add"}</Button>
    </div>
  );
}
