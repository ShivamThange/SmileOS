import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Meter } from "@/components/common/meter";
import { EmptyState } from "@/components/common/empty-state";
import { ToothArch, type ToothStyle } from "@/components/domain/tooth-arch";
import { useUIStore } from "@/hooks/use-ui-store";
import { useSession } from "@/hooks/use-session";
import { usePlansStore } from "./use-plans-store";
import { patients } from "@/lib/mock-data";
import { clinicConfig } from "@/config/clinic";
import { procedureCatalogue, formatDuration, type ProcedureDef } from "@/config/procedures";
import { inr } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import {
  PLAN_STATUS_META,
  TOOTH_VISUAL_STYLE,
  chosenOption,
  itemPricePaise,
  phaseTotalPaise,
  planGrossPaise,
  planNetPaise,
  planSelectedPaise,
  planDeferredPaise,
  planMarginPaise,
  planVisits,
  planChairMinutes,
  discountPaise,
  deriveStatus,
  toothVisuals,
  emiOptions,
  type PlanItem,
  type PlanPhase,
  type TreatmentPlan,
  type ToothVisual,
} from "./plans-data";

/*
 * The plan builder.
 *
 * This is where the most commercially important document in the practice gets
 * assembled, and in the old version it was a third the size of the screen that
 * displays it. That ratio was the wrong way round.
 *
 * Two columns. On the left the mouth — findings already carried over from the
 * examination, so no tooth is ever selected twice. On the right the plan as a
 * stack of phases, reorderable, each line showing fee, chair time and the tooth
 * it belongs to, with live totals in tabular numerals at the bottom and a
 * margin indicator only the owner can see.
 *
 * And underneath the arch: what the patient actually did with the link.
 */

/** Lab and materials as a share of fee, until the catalogue carries real costs. */
const ASSUMED_COST_RATIO = 0.34;

const NEUTRAL_TOOTH: ToothStyle = { bg: "#FBF9F4", border: "#DDD6C7" };
const SELECTED_TOOTH: ToothStyle = { bg: "#FFFFFF", border: "#20614E", shadow: "0 0 0 3px rgba(32,97,78,0.16)" };

export function PlanBuilderScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const { user } = useSession();

  const plan = usePlansStore((s) => s.plans.find((p) => p.id === id));
  const store = usePlansStore();

  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [pickerPhaseId, setPickerPhaseId] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const visuals = useMemo(() => (plan ? toothVisuals(plan) : {}), [plan]);

  if (!plan) {
    return (
      <div className="max-w-[1240px] mx-auto">
        <EmptyState
          icon="revenue"
          title="Plan not found"
          body="This treatment plan no longer exists, or was never created."
          cta="Back to treatment plans"
          onCta={() => navigate("/app/treatment-plans")}
        />
      </div>
    );
  }

  const patient = patients.find((p) => p.id === plan.patientId) ?? null;
  const status = deriveStatus(plan);
  const meta = PLAN_STATUS_META[status];
  const isOwner = user.role === "owner";

  const gross = planGrossPaise(plan);
  const discount = discountPaise(plan, gross);
  const net = planNetPaise(plan);
  const selected = planSelectedPaise(plan);
  const deferred = planDeferredPaise(plan);
  const margin = planMarginPaise(plan);
  const marginPct = selected > 0 ? Math.round((margin / selected) * 100) : 0;
  const emi = emiOptions(net)[1];

  const styleFor = (num: number): ToothStyle => {
    if (selectedTeeth.includes(num)) return SELECTED_TOOTH;
    const v = visuals[num];
    if (!v) return NEUTRAL_TOOTH;
    const st = TOOTH_VISUAL_STYLE[v];
    return { bg: st.bg, border: st.border };
  };

  const titleFor = (num: number): string => {
    const item = plan.phases
      .flatMap((ph) => ph.items)
      .find((i) => i.teeth.includes(num));
    return item ? `Tooth ${num} — ${chosenOption(item).name}` : `Tooth ${num} — nothing planned`;
  };

  const toggleTooth = (num: number) =>
    setSelectedTeeth((t) => (t.includes(num) ? t.filter((x) => x !== num) : [...t, num]));

  const addFromCatalogue = (phaseId: string, proc: ProcedureDef) => {
    store.addItem(plan.id, phaseId, {
      teeth: [...selectedTeeth],
      finding: "",
      plainFinding: "",
      ifYouWait: "",
      options: [
        {
          id: "o_new",
          name: selectedTeeth.length ? `${proc.name}, ${selectedTeeth.join(", ")}` : proc.name,
          plain: proc.name.toLowerCase(),
          pricePaise: proc.feePaise,
          costPaise: Math.round(proc.feePaise * ASSUMED_COST_RATIO),
          minutes: proc.minutes,
          visits: 1,
          longevity: "—",
          recommended: true,
          visual: visualFor(proc),
        },
      ],
      chosenOptionId: "o_new",
      decision: "undecided",
    });
    setSelectedTeeth([]);
    setPickerPhaseId(null);
    showToast(`${proc.name} added`);
  };

  const present = () => {
    store.present(plan.id, "21 Jul 2026");
    window.open(`/plan/${plan.id}`, "_blank");
  };

  return (
    <div className="max-w-[1320px] mx-auto flex flex-col gap-3.5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <Link to="/app/treatment-plans" className="text-muted hover:text-primary no-underline">
          Treatment plans
        </Link>
        <span className="text-muted-3">/</span>
        <span className="text-ink font-medium">{plan.patient}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="m-0 text-[18px] font-semibold tracking-[-0.01em]">{plan.title}</h1>
            <span
              className="text-[10.5px] font-bold px-2 py-[3px] rounded-[5px] border"
              style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
            >
              {meta.label}
            </span>
          </div>
          <div className="text-[12.5px] text-muted mt-0.5">
            <Link to={`/app/patients/${plan.patientId}`} className="text-primary font-medium">
              {plan.patient}
            </Link>
            {" · "}
            {plan.doctor}
            {plan.presentedOn ? ` · presented ${plan.presentedOn}` : " · not yet presented"}
            {" · updated "}
            {plan.updated}
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {patient && (
            <a
              href={waLink(
                patient.phone,
                `Hello ${patient.name.split(" ")[0]}, ${clinicConfig.name} here. Here's the plan ${plan.doctor} put together for you — you can accept or defer each part yourself, and there's an instalment view too. ${location.origin}/plan/${plan.id}`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-md border border-border bg-surface hover:bg-bg"
            >
              <Icon name="message" size={13} />
              Send on WhatsApp
            </a>
          )}
          <Button variant="primary" onClick={present}>
            Present to patient ↗
          </Button>
        </div>
      </div>

      <div className="grid gap-3.5 items-start max-xl:grid-cols-1" style={{ gridTemplateColumns: "0.95fr 1.35fr" }}>
        {/* ---------------------------------------------------------------- */}
        {/* Left — the mouth, and what the patient did with the link          */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col gap-3.5">
          <Panel className="px-4 py-4 flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <MicroLabel>The mouth</MicroLabel>
              {selectedTeeth.length > 0 && (
                <button
                  onClick={() => setSelectedTeeth([])}
                  className="text-[11.5px] font-semibold text-muted hover:text-ink"
                >
                  Clear selection
                </button>
              )}
            </div>

            <div className="text-[11.5px] text-muted leading-snug">
              Findings carried over from the examination. Select a tooth, then add a procedure to a
              phase — you never re-select teeth you've already examined.
            </div>

            <ToothArch size="plan" styleFor={styleFor} onToggle={toggleTooth} titleFor={titleFor} />

            <div className="flex flex-wrap justify-center gap-x-3.5 gap-y-1.5 text-[11px] text-muted-strong">
              {(Object.keys(TOOTH_VISUAL_STYLE) as ToothVisual[])
                .filter((v) => Object.values(visuals).includes(v))
                .map((v) => (
                  <span key={v} className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-[3px]"
                      style={{
                        background: TOOTH_VISUAL_STYLE[v].bg,
                        border: `1.5px solid ${TOOTH_VISUAL_STYLE[v].border}`,
                      }}
                    />
                    {TOOTH_VISUAL_STYLE[v].label}
                  </span>
                ))}
            </div>

            {selectedTeeth.length > 0 && (
              <div className="rounded-md border border-primary-tint-border bg-primary-tint px-3 py-2 text-[12px] text-primary font-medium animate-dc-row">
                {selectedTeeth.length} tooth{selectedTeeth.length > 1 ? "s" : ""} selected —{" "}
                {selectedTeeth.join(", ")}. Add a procedure from any phase below.
              </div>
            )}
          </Panel>

          {/* What the link told us */}
          <EngagementPanel plan={plan} />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Right — the plan as a stack of phases                             */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col gap-3">
          {plan.phases.map((phase, i) => (
            <PhaseCard
              key={phase.id}
              plan={plan}
              phase={phase}
              index={i}
              first={i === 0}
              last={i === plan.phases.length - 1}
              isOwner={isOwner}
              expandedItem={expandedItem}
              onExpandItem={(itemId) => setExpandedItem((e) => (e === itemId ? null : itemId))}
              pickerOpen={pickerPhaseId === phase.id}
              onTogglePicker={() => setPickerPhaseId((p) => (p === phase.id ? null : phase.id))}
              onPick={(proc) => addFromCatalogue(phase.id, proc)}
              selectedTeeth={selectedTeeth}
            />
          ))}

          <button
            onClick={() => store.addPhase(plan.id)}
            className="text-[12.5px] font-semibold text-primary text-left px-1 py-1.5 hover:text-primary-hover w-fit"
          >
            ＋ Add a phase
          </button>

          {/* Money — always tabular, always live */}
          <Panel className="px-4 py-4 flex flex-col gap-2.5">
            <MicroLabel>Money</MicroLabel>

            <MoneyRow label="Everything on the plan" value={inr(gross)} />

            <div className="flex justify-between items-center text-[12.5px]">
              <span className="text-muted flex items-center gap-2">
                Plan discount
                <span className="inline-flex items-center rounded-md border border-border bg-bg-content">
                  <StepBtn onClick={() => store.setDiscount(plan.id, plan.discountPct - 1)}>−</StepBtn>
                  <span className="px-2 text-[12px] font-semibold tnum">{plan.discountPct}%</span>
                  <StepBtn onClick={() => store.setDiscount(plan.id, plan.discountPct + 1)}>+</StepBtn>
                </span>
              </span>
              <span className="tnum text-primary">– {inr(discount)}</span>
            </div>

            <div className="h-px bg-border my-0.5" />

            <div className="flex justify-between items-baseline">
              <span className="text-[13px] font-semibold">Full plan</span>
              <span className="font-serif text-[24px] font-semibold tnum tracking-[-0.01em]">
                {inr(net)}
              </span>
            </div>

            {deferred > 0 && (
              <>
                <div className="flex justify-between items-baseline text-[12.5px]">
                  <span className="text-muted">Patient has deferred</span>
                  <span className="tnum text-warning font-semibold">{inr(deferred)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[13px] font-semibold">Currently accepted</span>
                  <span className="font-serif text-[20px] font-semibold tnum">{inr(selected)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between text-[11.5px] text-muted pt-1">
              <span>
                {planVisits(plan)} visits · {formatDuration(planChairMinutes(plan))} of chair time
              </span>
              <span className="tnum">{inr(emi.perMonthPaise)}/mo over 12</span>
            </div>

            {/*
             * Margin is owner-only. An associate seeing lab margins on every
             * plan changes how they treatment-plan, and not for the better.
             */}
            {isOwner && (
              <div className="mt-1.5 pt-2.5 border-t border-border-faint flex flex-col gap-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-2 font-semibold">Margin after lab & materials</span>
                  <span className="tnum font-semibold">
                    {inr(margin)} · {marginPct}%
                  </span>
                </div>
                <Meter value={marginPct} height={5} />
                <div className="text-[10.5px] text-muted-2">
                  Owner-only. Lab cost is currently estimated at{" "}
                  {Math.round(ASSUMED_COST_RATIO * 100)}% of fee for catalogue-added items.
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

function PhaseCard({
  plan,
  phase,
  index,
  first,
  last,
  isOwner,
  expandedItem,
  onExpandItem,
  pickerOpen,
  onTogglePicker,
  onPick,
  selectedTeeth,
}: {
  plan: TreatmentPlan;
  phase: PlanPhase;
  index: number;
  first: boolean;
  last: boolean;
  isOwner: boolean;
  expandedItem: string | null;
  onExpandItem: (id: string) => void;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onPick: (p: ProcedureDef) => void;
  selectedTeeth: number[];
}) {
  const store = usePlansStore();
  const subtotal = phaseTotalPaise(phase);
  const activeSubtotal = phaseTotalPaise(phase, (i) => i.decision !== "deferred");
  const dwell = plan.engagement.dwellByPhase[phase.id];

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-content">
        <div className="w-7 h-7 flex-none rounded-full bg-primary text-on-primary grid place-items-center font-serif text-[13px] font-semibold">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <input
            value={phase.title}
            onChange={(e) => store.updatePhase(plan.id, phase.id, { title: e.target.value })}
            className="w-full bg-transparent border-none outline-none text-[13px] font-semibold truncate focus:bg-surface focus:px-1 rounded-sm"
          />
          <input
            value={phase.when}
            onChange={(e) => store.updatePhase(plan.id, phase.id, { when: e.target.value })}
            className="w-full bg-transparent border-none outline-none text-[11px] text-muted-2 focus:bg-surface focus:px-1 rounded-sm"
          />
        </div>

        {dwell !== undefined && (
          <span
            title="How long the patient spent reading this phase"
            className="text-[10px] font-semibold text-muted-2 tnum"
          >
            read {dwell}s
          </span>
        )}

        <div className="text-right">
          <div className="text-[13px] font-semibold tnum">{inr(activeSubtotal)}</div>
          {activeSubtotal !== subtotal && (
            <div className="text-[10.5px] text-muted-2 tnum line-through">{inr(subtotal)}</div>
          )}
        </div>

        {/* Clinical sequencing is an action, not a decoration. */}
        <div className="flex flex-col">
          <IconStep disabled={first} onClick={() => store.movePhase(plan.id, phase.id, -1)} up />
          <IconStep disabled={last} onClick={() => store.movePhase(plan.id, phase.id, 1)} />
        </div>
      </div>

      <div className="px-4">
        {phase.items.length === 0 ? (
          <div className="py-5 text-center text-[12px] text-muted-2">
            Nothing in this phase yet.
          </div>
        ) : (
          phase.items.map((item, j) => (
            <ItemRow
              key={item.id}
              plan={plan}
              item={item}
              last={j === phase.items.length - 1}
              isOwner={isOwner}
              expanded={expandedItem === item.id}
              onExpand={() => onExpandItem(item.id)}
            />
          ))
        )}
      </div>

      <div className="px-4 py-2 border-t border-border-faint flex items-center gap-3">
        <button
          onClick={onTogglePicker}
          className="text-[11.5px] font-semibold text-primary hover:text-primary-hover"
        >
          {pickerOpen ? "Close" : "＋ Add procedure"}
        </button>
        {selectedTeeth.length > 0 && (
          <span className="text-[11px] text-muted-2">
            will be attached to {selectedTeeth.join(", ")}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => store.removePhase(plan.id, phase.id)}
          className="text-[11px] text-muted-3 hover:text-danger"
        >
          Remove phase
        </button>
      </div>

      {pickerOpen && <ProcedurePicker onPick={onPick} />}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Line items
// ---------------------------------------------------------------------------

function ItemRow({
  plan,
  item,
  last,
  isOwner,
  expanded,
  onExpand,
}: {
  plan: TreatmentPlan;
  item: PlanItem;
  last: boolean;
  isOwner: boolean;
  expanded: boolean;
  onExpand: () => void;
}) {
  const store = usePlansStore();
  const opt = chosenOption(item);
  const deferred = item.decision === "deferred";

  return (
    <div style={{ borderBottom: last ? "none" : "1px solid var(--border-faint)" }}>
      <div className={cn("flex items-start gap-3 py-2.5", deferred && "opacity-55")}>
        <button onClick={onExpand} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12.5px] font-medium">{opt.name}</span>
            {item.teeth.map((t) => (
              <span
                key={t}
                className="text-[9.5px] font-bold font-mono px-1 py-px rounded-[4px] bg-bg text-muted border border-border"
              >
                {t}
              </span>
            ))}
            {item.options.length > 1 && (
              <span className="text-[9.5px] font-bold px-1.5 py-px rounded-[4px] bg-primary-tint text-primary border border-primary-tint-border">
                {item.options.length} OPTIONS
              </span>
            )}
            {item.decision === "accepted" && (
              <span className="text-[9.5px] font-bold px-1.5 py-px rounded-[4px] bg-primary-tint text-primary border border-primary-tint-border">
                ACCEPTED
              </span>
            )}
            {deferred && (
              <span
                className="text-[9.5px] font-bold px-1.5 py-px rounded-[4px] bg-warning-bg text-warning border border-warning-border"
                title={item.deferReason ? `Reason given: ${item.deferReason}` : undefined}
              >
                DEFERRED{item.deferReason ? ` · ${item.deferReason.toUpperCase()}` : ""}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-2 mt-0.5">
            {formatDuration(opt.minutes)} · {opt.visits} visit{opt.visits > 1 ? "s" : ""} ·{" "}
            {opt.longevity}
          </div>
        </button>

        <div className="text-right shrink-0">
          <div className="text-[12.5px] font-medium tnum">{inr(itemPricePaise(item))}</div>
          {isOwner && (
            <div className="text-[10px] text-muted-2 tnum">lab {inr(opt.costPaise)}</div>
          )}
        </div>

        <button
          onClick={() => store.removeItem(plan.id, item.id)}
          aria-label="Remove item"
          className="w-[20px] h-[20px] grid place-items-center rounded-[5px] text-muted-3 hover:text-danger hover:bg-bg text-[11px] shrink-0"
        >
          ✕
        </button>
      </div>

      {expanded && (
        <div className="pb-3 pl-1 flex flex-col gap-3 animate-dc-row">
          {/* The three pieces of prose the presenter needs. */}
          <Field
            label="CLINICAL FINDING"
            value={item.finding}
            placeholder="What you recorded. The patient never sees this."
            onChange={(v) => store.updateItem(plan.id, item.id, { finding: v })}
          />
          <Field
            label="IN PLAIN LANGUAGE"
            value={item.plainFinding}
            placeholder="The same thing, without jargon. This is what the patient reads first."
            onChange={(v) => store.updateItem(plan.id, item.id, { plainFinding: v })}
          />
          <Field
            label="WHAT HAPPENS IF THIS WAITS"
            value={item.ifYouWait}
            placeholder="Honest and conservative. Information, not pressure."
            onChange={(v) => store.updateItem(plan.id, item.id, { ifYouWait: v })}
          />

          {/* Alternatives, as first-class objects. */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">
                WAYS TO DO IT
              </span>
              <span className="text-[10.5px] text-muted-2">
                — the patient picks between these
              </span>
            </div>

            {item.options.map((o) => {
              const isChosen = o.id === item.chosenOptionId;
              return (
                <div
                  key={o.id}
                  className={cn(
                    "flex items-start gap-2.5 rounded-md border px-2.5 py-2",
                    isChosen ? "border-primary-tint-border bg-primary-tint" : "border-border bg-surface",
                  )}
                >
                  <button
                    onClick={() => store.chooseOption(plan.id, item.id, o.id)}
                    aria-label={`Recommend ${o.name}`}
                    className="w-[15px] h-[15px] mt-0.5 rounded-full grid place-items-center flex-none"
                    style={{
                      border: `2px solid ${isChosen ? "var(--primary)" : "var(--border-strong)"}`,
                      background: isChosen ? "var(--primary)" : "transparent",
                    }}
                  >
                    {isChosen && <span className="w-[5px] h-[5px] rounded-full bg-on-primary" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold">{o.name}</div>
                    <div className="text-[11px] text-muted mt-px">{o.plain}</div>
                    {o.tradeoff && (
                      <div className="text-[11px] text-muted-2 italic mt-0.5">{o.tradeoff}</div>
                    )}
                    <div className="text-[10.5px] text-muted-2 mt-0.5">
                      {formatDuration(o.minutes)} · {o.visits} visit{o.visits > 1 ? "s" : ""} ·{" "}
                      {o.longevity}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[12px] font-semibold tnum">{inr(o.pricePaise)}</div>
                    {isChosen && (
                      <div className="text-[9.5px] font-bold text-primary">RECOMMENDED</div>
                    )}
                  </div>

                  {item.options.length > 1 && (
                    <button
                      onClick={() => store.removeOption(plan.id, item.id, o.id)}
                      aria-label="Remove option"
                      className="w-[18px] h-[18px] grid place-items-center rounded-[4px] text-muted-3 hover:text-danger text-[10px] shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}

            <button
              onClick={() =>
                store.addOption(plan.id, item.id, {
                  name: "Alternative",
                  plain: "Another way of doing this",
                  pricePaise: Math.round(opt.pricePaise * 0.7),
                  costPaise: Math.round(opt.costPaise * 0.7),
                  minutes: opt.minutes,
                  visits: opt.visits,
                  longevity: "—",
                  tradeoff: "Cheaper, but describe the trade-off here.",
                  visual: opt.visual,
                })
              }
              className="text-[11.5px] font-semibold text-primary self-start"
            >
              ＋ Offer an alternative
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Procedure picker
// ---------------------------------------------------------------------------

function ProcedurePicker({ onPick }: { onPick: (p: ProcedureDef) => void }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return procedureCatalogue
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.keywords.some((k) => k.includes(s)))
      .slice(0, 8);
  }, [q]);

  return (
    <div className="border-t border-border bg-bg-content px-4 py-3 flex flex-col gap-1.5 animate-dc-row">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the clinic's procedure list…"
        className="text-[12.5px] px-2.5 py-1.5 border border-border rounded-md bg-surface outline-none focus:border-primary"
      />
      {results.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p)}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-surface text-left"
        >
          <span className="text-[12.5px] font-medium flex-1 truncate">{p.name}</span>
          <span className="text-[11px] text-muted-2">{formatDuration(p.minutes)}</span>
          <span className="text-[12px] font-semibold tnum w-[76px] text-right">
            {inr(p.feePaise)}
          </span>
        </button>
      ))}
      {results.length === 0 && (
        <div className="px-2.5 py-3 text-[12px] text-muted-2">
          Nothing in the catalogue matches. Procedures are configured in Settings.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// What the patient did with the link
// ---------------------------------------------------------------------------

function EngagementPanel({ plan }: { plan: TreatmentPlan }) {
  const e = plan.engagement;
  const phases = plan.phases;
  const maxDwell = Math.max(1, ...Object.values(e.dwellByPhase));

  if (!e.sentOn) {
    return (
      <Panel className="px-4 py-4 flex flex-col gap-1.5">
        <MicroLabel>After you send it</MicroLabel>
        <div className="text-[12px] text-muted leading-relaxed">
          Once this plan is sent, you'll see here whether it was opened, which phase was read
          longest, and whether it was forwarded. That turns the follow-up call from a cold one into
          an informed one.
        </div>
      </Panel>
    );
  }

  const hot = e.opens >= 3 && e.dwellByPhase && Object.keys(e.dwellByPhase).length > 0;

  return (
    <Panel className="px-4 py-4 flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <MicroLabel>What they did with it</MicroLabel>
        <span className="text-[11px] text-muted-2">sent {e.sentOn}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Opens" value={String(e.opens)} />
        <Stat label="First read" value={e.firstOpenedOn?.split(",")[1]?.trim() ?? "—"} />
        <Stat label="Forwarded" value={e.forwarded ? "Yes" : "No"} />
      </div>

      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">
          TIME SPENT PER PHASE
        </span>
        {phases.map((ph) => {
          const secs = e.dwellByPhase[ph.id] ?? 0;
          return (
            <div key={ph.id} className="flex flex-col gap-1">
              <div className="flex justify-between text-[11.5px]">
                <span className="truncate">{ph.plainTitle}</span>
                <span className="tnum text-muted">{secs}s</span>
              </div>
              <Meter value={(secs / maxDwell) * 100} height={4} />
            </div>
          );
        })}
      </div>

      {hot && (
        <div className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-[11.5px] text-warning-text leading-snug">
          Opened {e.opens} times{e.forwarded ? " and forwarded" : ""}, longest on{" "}
          <b>{longestPhase(plan)}</b>. Somebody who reads a plan this often and hasn't replied is
          stuck on something specific — worth asking what, rather than asking whether they'd like to
          proceed.
        </div>
      )}
    </Panel>
  );
}

function longestPhase(plan: TreatmentPlan): string {
  let best = plan.phases[0];
  let bestSecs = -1;
  for (const ph of plan.phases) {
    const s = plan.engagement.dwellByPhase[ph.id] ?? 0;
    if (s > bestSecs) {
      bestSecs = s;
      best = ph;
    }
  }
  return best?.plainTitle ?? "—";
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="text-[12px] leading-relaxed px-2.5 py-1.5 border border-border rounded-md bg-bg-content outline-none focus:border-primary resize-y"
      />
    </label>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[12.5px]">
      <span className="text-muted">{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-2.5 py-1.5">
      <div className="text-[10px] font-bold tracking-[0.05em] text-muted-2">{label}</div>
      <div className="text-[13px] font-semibold tnum mt-px truncate">{value}</div>
    </div>
  );
}

function StepBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-[20px] h-[20px] grid place-items-center text-[12px] text-muted hover:text-ink hover:bg-bg rounded-[4px]"
    >
      {children}
    </button>
  );
}

function IconStep({ onClick, disabled, up }: { onClick: () => void; disabled: boolean; up?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={up ? "Move phase earlier" : "Move phase later"}
      className="w-[18px] h-[14px] grid place-items-center text-muted-3 hover:text-primary disabled:opacity-25 disabled:hover:text-muted-3"
    >
      <Icon
        name="chevronDown"
        size={11}
        style={{ transform: up ? "rotate(180deg)" : "none" }}
      />
    </button>
  );
}

/** Map a catalogue procedure to how it should read on the arch. */
function visualFor(proc: ProcedureDef): ToothVisual {
  switch (proc.category) {
    case "Implants":
      return "implant";
    case "Prostho":
      return proc.id.includes("denture") ? "denture" : "crown";
    case "Surgery":
      return "extract";
    default:
      return "treat";
  }
}
