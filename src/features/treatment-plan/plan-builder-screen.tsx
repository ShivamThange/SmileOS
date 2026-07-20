import { useParams, useNavigate, Link } from "react-router-dom";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { useUIStore } from "@/hooks/use-ui-store";
import { EmptyState } from "@/components/common/empty-state";
import {
  findPlan,
  planGross,
  planNet,
  PLAN_STATUS_META,
} from "./plans-data";

/*
 * Treatment plan builder (Console) — the staff-side view of a single plan:
 * stages and line items on the left, the money and the "Present to patient"
 * action on the right. Presenting opens the patient-facing /plan view (the
 * TreatmentPlan.dc.html surface) in a new tab.
 */

export function PlanBuilderScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const plan = id ? findPlan(id) : undefined;

  if (!plan) {
    return (
      <div className="max-w-[1240px] mx-auto">
        <EmptyState icon="revenue" title="Plan not found" body="This treatment plan no longer exists or was never created." />
        <div className="text-center mt-4">
          <Link to="/app/treatment-plans" className="text-[12.5px] font-semibold text-primary">Back to treatment plans</Link>
        </div>
      </div>
    );
  }

  const gross = planGross(plan);
  const discount = gross - planNet(plan);
  const net = planNet(plan);
  const emi12 = Math.ceil(net / 12 / 10000) * 10000; // paise, rounded up to ₹100
  const meta = PLAN_STATUS_META[plan.status];

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <Link to="/app/treatment-plans" className="text-muted hover:text-primary no-underline">Treatment plans</Link>
        <span className="text-muted-3">/</span>
        <span className="text-ink font-medium">{plan.patient}</span>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="m-0 text-[18px] font-semibold tracking-[-0.01em]">{plan.title}</h1>
            <span className="text-[10.5px] font-bold px-2 py-[3px] rounded-[5px] border" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>{meta.label}</span>
          </div>
          <div className="text-[12.5px] text-muted mt-0.5">
            <Link to={`/app/patients/${plan.patientId}`} className="text-primary font-medium">{plan.patient}</Link>
            {" · "}{plan.doctor}{plan.presentedOn ? ` · presented ${plan.presentedOn}` : " · not yet presented"}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button variant="secondary" onClick={() => showToast("Plan sent to patient on WhatsApp")}>Send ↗</Button>
          <Button variant="primary" onClick={() => window.open(`/plan/${plan.id}`, "_blank")}>Present to patient ↗</Button>
        </div>
      </div>

      <div className="grid gap-3.5 items-start" style={{ gridTemplateColumns: "1.8fr 1fr" }}>
        {/* Stages */}
        <div className="flex flex-col gap-3">
          {plan.stages.map((st, i) => {
            const subtotal = st.items.reduce((s, it) => s + it.pricePaise, 0);
            return (
              <Panel key={i} className="overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-content">
                  <div className="w-7 h-7 flex-none rounded-full bg-primary text-on-primary grid place-items-center font-serif text-[13px] font-semibold">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{st.title}</div>
                    <div className="text-[11px] text-muted-2">{st.when}</div>
                  </div>
                  <div className="text-[13px] font-semibold tnum">{inr(subtotal)}</div>
                </div>
                <div className="px-4">
                  {st.items.map((it, j) => (
                    <div key={j} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: j < st.items.length - 1 ? "1px solid var(--border-faint)" : "none" }}>
                      <span className="text-[12.5px]">{it.name}</span>
                      <span className="text-[12.5px] font-medium tnum">{inr(it.pricePaise)}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-border-faint">
                  <button onClick={() => showToast("Add a line item to this stage")} className="text-[11.5px] font-semibold text-primary hover:text-primary-hover">＋ Add item</button>
                </div>
              </Panel>
            );
          })}
          <button onClick={() => showToast("Add a new stage")} className="text-[12px] font-semibold text-primary text-left px-1 py-1 hover:text-primary-hover w-fit">＋ Add stage</button>
        </div>

        {/* Money sidebar */}
        <div className="flex flex-col gap-3">
          <Panel className="px-4 py-4">
            <MicroLabel>Summary</MicroLabel>
            <div className="flex flex-col gap-2 mt-3">
              <Row label="Everything above" value={inr(gross)} />
              {plan.discountPct > 0 && <Row label={`Plan discount (${plan.discountPct}%)`} value={`– ${inr(discount)}`} accent="#20614E" />}
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] font-semibold">What they'd pay</span>
                <span className="font-serif text-[24px] font-semibold tnum tracking-[-0.01em]">{inr(net)}</span>
              </div>
            </div>
          </Panel>

          <Panel className="px-4 py-4">
            <MicroLabel>Instalments</MicroLabel>
            <div className="mt-2 text-[13px]">
              <span className="font-serif text-[20px] font-semibold tnum">{inr(emi12)}</span>
              <span className="text-muted"> / month over 12 months</span>
            </div>
            <div className="text-[11.5px] text-muted-2 mt-1">0% plan · subject to finance-partner approval</div>
          </Panel>

          <Panel className="px-4 py-4 flex flex-col gap-2">
            <Button variant="primary" className="w-full justify-center" onClick={() => window.open(`/plan/${plan.id}`, "_blank")}>Present to patient ↗</Button>
            <Button variant="tint" className="w-full justify-center" onClick={() => showToast("Marked as accepted — first visit can now be booked")}>Mark accepted</Button>
            <Button variant="secondary" className="w-full justify-center" onClick={() => navigate("/app/treatment-plans")}>Back to list</Button>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between text-[12.5px]">
      <span className="text-muted">{label}</span>
      <span className="tnum" style={{ color: accent }}>{value}</span>
    </div>
  );
}
