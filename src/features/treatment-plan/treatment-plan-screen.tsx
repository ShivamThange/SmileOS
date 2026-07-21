import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { inr } from "@/lib/format";
import { ToothArch, type ToothStyle } from "@/components/domain/tooth-arch";
import { useLocalToast, LocalToast } from "@/components/common/local-toast";
import { clinicConfig } from "@/config/clinic";
import { patients } from "@/lib/mock-data";
import { waLink } from "@/lib/whatsapp";
import { usePlansStore } from "./use-plans-store";
import {
  TOOTH_VISUAL_STYLE,
  DEFER_REASONS,
  chosenOption,
  itemPricePaise,
  phaseTotalPaise,
  planGrossPaise,
  planSelectedPaise,
  planDeferredPaise,
  discountPaise,
  toothVisuals,
  emiOptions,
  type PlanItem,
  type PlanPhase,
  type DeferReason,
} from "./plans-data";

/*
 * The treatment plan, as the patient receives it.
 *
 * Not a PDF. A living document at a WhatsApp link, and the single highest-stakes
 * screen in the product — an Indian dental patient has never had anything like
 * this from their dentist, and they will forward it to their spouse before
 * deciding anything.
 *
 * The things that make it different from a quotation:
 *
 *   It opens on *why*, not what. The mouth first, then one plain sentence per
 *   finding, then the money — in that order, because the order is the argument.
 *
 *   Acceptance is per item, not all-or-nothing. Real acceptance almost never is
 *   all-or-nothing: he takes the root canal and puts off the two crowns. When he
 *   does that here, the clinic learns exactly what was deferred and why —
 *   generated as a byproduct of his own honesty rather than reconstructed later
 *   by a receptionist guessing.
 *
 *   Alternatives are his to choose. Implant, bridge or denture, three prices,
 *   side by side, trade-offs stated plainly.
 *
 *   The same total is available as a monthly figure. A ₹1.8L plan refused on
 *   price is usually a ₹1.8L *number* refused on price.
 *
 *   "What happens if I wait" is written conservatively, once per procedure type.
 *   It is information, not a threat, and that boundary is deliberate.
 */

const DEFAULT_PLAN_ID = "tp1";

const NEUTRAL: ToothStyle = { bg: "#FBF9F4", border: "#DDD6C7" };
const DEFERRED_TOOTH: ToothStyle = { bg: "#F3EEE4", border: "#D8D0BE" };

export function TreatmentPlanScreen() {
  const { id } = useParams();
  const planId = id ?? DEFAULT_PLAN_ID;

  const plan = usePlansStore((s) => s.plans.find((p) => p.id === planId));
  const store = usePlansStore();
  const { toast, show } = useLocalToast();

  /*
   * The first phase is open on arrival. A document that opens fully collapsed
   * reads as a form to be filled in rather than a letter to be read, and the
   * first phase is the one we most want him to actually read.
   */
  const [openPhase, setOpenPhase] = useState<string | null>(
    () => usePlansStore.getState().plans.find((p) => p.id === planId)?.phases[0]?.id ?? null,
  );
  const [showEmi, setShowEmi] = useState(false);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [done, setDone] = useState<{ title: string; body: string } | null>(null);
  const openedRef = useRef(false);

  /*
   * Record the open once per mount — this is what the clinic sees.
   *
   * Both effects reach for the store imperatively rather than through the hook
   * result, because the hook result changes identity on every write; putting it
   * in a dependency array would make the dwell timer restart constantly and
   * double-count.
   */
  useEffect(() => {
    if (!openedRef.current) {
      openedRef.current = true;
      usePlansStore.getState().recordOpen(planId, "just now");
    }
  }, [planId]);

  /* Dwell: crude but honest — seconds with a phase expanded. */
  useEffect(() => {
    if (!openPhase) return;
    const started = Date.now();
    const phaseId = openPhase;
    return () => {
      const secs = Math.round((Date.now() - started) / 1000);
      if (secs > 0) usePlansStore.getState().recordDwell(planId, phaseId, secs);
    };
  }, [openPhase, planId]);

  const visuals = useMemo(() => (plan ? toothVisuals(plan) : {}), [plan]);

  const deferredTeeth = useMemo(() => {
    if (!plan) return new Set<number>();
    const set = new Set<number>();
    for (const ph of plan.phases)
      for (const it of ph.items)
        if (it.decision === "deferred") it.teeth.forEach((t) => set.add(t));
    return set;
  }, [plan]);

  if (!plan) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#EFEBE3] px-6 text-center font-sans">
        <div>
          <div className="font-serif text-[26px] font-medium">This plan isn't available.</div>
          <p className="text-[14px] text-[#8C887E] mt-2 max-w-[420px]">
            The link may have expired. Please message the clinic and we'll send you a fresh one.
          </p>
        </div>
      </div>
    );
  }

  const patient = patients.find((p) => p.id === plan.patientId) ?? null;
  const firstName = plan.patient.split(" ")[0];

  const gross = planGrossPaise(plan);
  const selected = planSelectedPaise(plan);
  const deferred = planDeferredPaise(plan);
  const selectedSub = gross - deferred;
  const discount = discountPaise(plan, selectedSub);
  const emis = emiOptions(selected);

  const allItems = plan.phases.flatMap((p) => p.items);
  const acceptedCount = allItems.filter((i) => i.decision !== "deferred").length;
  const deferredCount = allItems.filter((i) => i.decision === "deferred").length;

  const styleFor = (num: number): ToothStyle => {
    if (deferredTeeth.has(num)) return DEFERRED_TOOTH;
    const v = visuals[num];
    if (!v) return NEUTRAL;
    const st = TOOTH_VISUAL_STYLE[v];
    return { bg: st.bg, border: st.border };
  };

  const usedVisuals = Array.from(new Set(Object.values(visuals)));

  const setDecision = (item: PlanItem, next: "accepted" | "deferred") => {
    if (next === "deferred") {
      store.setDecision(plan.id, item.id, "deferred");
      setReasonFor(item.id);
    } else {
      store.setDecision(plan.id, item.id, "accepted");
      show("Added back in");
    }
  };

  const giveReason = (itemId: string, reason: DeferReason) => {
    store.setDecision(plan.id, itemId, "deferred", reason);
    setReasonFor(null);
    show("Thank you — that helps us more than you'd think");
  };

  const confirm = () => {
    setDone(
      deferredCount === 0
        ? {
            title: "Wonderful — let's get you started.",
            body: "We'll book your first visit and, if you'd like, set up the instalments at the desk. There's nothing to pay today.",
          }
        : {
            title: "That's a sensible place to start.",
            body: `We'll plan the ${acceptedCount} part${acceptedCount === 1 ? "" : "s"} you've chosen, and keep the rest here for whenever you're ready. Nothing is cancelled — it just waits.`,
          },
    );
  };

  return (
    <div className="min-h-screen font-sans text-[#26241F] bg-[#EFEBE3] flex justify-center px-4">
      <div className="w-full max-w-[820px] pt-7 pb-[140px]">
        {/* Clinic */}
        <div className="flex items-center justify-between mb-[26px]">
          <div className="flex items-center gap-[11px]">
            <div className="w-[34px] h-[34px] rounded-[9px] bg-primary text-on-primary grid place-items-center text-[15px] font-bold">
              {clinicConfig.shortInitial}
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[-0.01em]">{clinicConfig.name}</div>
              <div className="text-[11px] text-[#8C887E]">
                {clinicConfig.locality} · {clinicConfig.city}
              </div>
            </div>
          </div>
          {patient && (
            <a
              href={waLink(
                patient.phone,
                `Hello, I have a question about my treatment plan (ref ${plan.id.toUpperCase()}).`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12.5px] font-semibold text-primary no-underline"
            >
              Message the clinic
            </a>
          )}
        </div>

        {/* Why — before what */}
        <div className="animate-dc-fade-up">
          <div className="text-[12.5px] font-semibold tracking-[0.08em] text-primary uppercase">
            Your treatment plan
          </div>
          <h1 className="mt-2 mb-3 font-serif text-[34px] font-medium leading-[1.15] tracking-[-0.01em]">
            Here's what we'd like to do for you, {firstName}.
          </h1>
          <p className="m-0 text-[15px] leading-relaxed text-muted-strong max-w-[600px]">
            {plan.intro}
          </p>
          <div className="flex flex-wrap gap-[18px] mt-4 text-[12.5px] text-[#8C887E]">
            <span>
              Prepared by <b className="text-[#26241F] font-semibold">{plan.doctor}</b>
            </span>
            <span>·</span>
            <span>{plan.presentedOn ?? "Draft"}</span>
          </div>
        </div>

        {/* The mouth */}
        <div className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl px-6 py-[22px] mt-[26px] animate-dc-fade-up">
          <div className="font-serif text-[19px] font-medium mb-1">The work, shown on your teeth</div>
          <div className="text-[13px] text-[#8C887E] mb-[18px]">
            The teeth we'd treat are marked below. Anything you set aside turns pale.
          </div>
          <ToothArch size="plan" styleFor={styleFor} />
          <div className="flex flex-wrap justify-center gap-x-[18px] gap-y-2 mt-4 text-[11.5px] text-muted-strong">
            {usedVisuals.map((v) => (
              <Legend
                key={v}
                bg={TOOTH_VISUAL_STYLE[v].bg}
                border={TOOTH_VISUAL_STYLE[v].border}
                label={TOOTH_VISUAL_STYLE[v].label}
              />
            ))}
            {deferredTeeth.size > 0 && (
              <Legend bg={DEFERRED_TOOTH.bg} border={DEFERRED_TOOTH.border} label="Set aside for now" />
            )}
          </div>
        </div>

        {/* What we found, in plain words */}
        <div className="mt-[34px]">
          <div className="font-serif text-[22px] font-medium mb-1">What we found</div>
          <div className="text-[13.5px] text-[#8C887E] mb-4">
            One line each, in ordinary words. Ask us about any of them.
          </div>
          <div className="flex flex-col gap-2.5">
            {allItems
              .filter((i) => i.plainFinding)
              .map((item) => (
                <div key={item.id} className="flex gap-3 items-start">
                  <span
                    className="w-2 h-2 rounded-full mt-[7px] flex-none"
                    style={{ background: TOOTH_VISUAL_STYLE[chosenOption(item).visual].border }}
                  />
                  <p className="m-0 text-[14px] leading-relaxed text-muted-strong">
                    {item.plainFinding}
                  </p>
                </div>
              ))}
          </div>
        </div>

        {/* Phases */}
        <div className="mt-[34px]">
          <div className="font-serif text-[22px] font-medium mb-1">
            In {numberWord(plan.phases.length)} stage{plan.phases.length > 1 ? "s" : ""}
          </div>
          <div className="text-[13.5px] text-[#8C887E] mb-5">
            Spread over a few months, so nothing is rushed and your mouth heals properly between
            steps. You can take any part now and leave the rest — that's completely normal.
          </div>

          <div className="flex flex-col gap-4">
            {plan.phases.map((phase, i) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                index={i}
                open={openPhase === phase.id}
                onToggle={() => setOpenPhase((p) => (p === phase.id ? null : phase.id))}
                onDecide={setDecision}
                onChoose={(itemId, optionId) => {
                  store.chooseOption(plan.id, itemId, optionId);
                  show("Updated — the total below has changed");
                }}
                reasonFor={reasonFor}
                onGiveReason={giveReason}
                onSkipReason={() => setReasonFor(null)}
              />
            ))}
          </div>
        </div>

        {/* Money */}
        <div className="bg-[#26241F] text-[#F4F1EA] rounded-[18px] px-7 py-[26px] mt-[30px] animate-dc-fade-up">
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between text-sm text-[#C9C4B8]">
              <span>Everything we've suggested</span>
              <span className="tabular-nums">{inr(gross)}</span>
            </div>
            {deferred > 0 && (
              <div className="flex justify-between text-sm text-[#C9C4B8]">
                <span>Set aside for now</span>
                <span className="tabular-nums">– {inr(deferred)}</span>
              </div>
            )}
            {plan.discountPct > 0 && (
              <div className="flex justify-between text-sm text-[#9DC7B7]">
                <span>Plan discount ({plan.discountPct}%)</span>
                <span className="tabular-nums">– {inr(discount)}</span>
              </div>
            )}
            <div className="h-px bg-white/15 my-1.5" />
            <div className="flex justify-between items-baseline">
              <span className="text-[15px] font-semibold">
                {deferred > 0 ? "What you've chosen" : "What you'd pay"}
              </span>
              <span className="font-serif text-[32px] font-semibold tabular-nums tracking-[-0.01em]">
                {inr(selected)}
              </span>
            </div>

            <button
              onClick={() => setShowEmi((v) => !v)}
              className="self-start text-[13px] font-semibold text-[#9DC7B7] mt-1.5"
            >
              {showEmi ? "Show the total instead" : "Show this as a monthly amount →"}
            </button>
          </div>

          {showEmi && (
            <div className="mt-4 pt-4 border-t border-white/12 animate-dc-fade">
              <div className="grid grid-cols-3 gap-2.5 max-sm:grid-cols-1">
                {emis.map((e) => (
                  <div
                    key={e.months}
                    className="rounded-xl px-3.5 py-3 bg-white/[0.06] border border-white/12 flex flex-col gap-0.5 relative"
                  >
                    {e.tag && (
                      <div className="absolute -top-[9px] left-3 text-[9px] font-bold tracking-[0.05em] bg-[#9DC7B7] text-[#20614E] rounded-md px-1.5 py-0.5">
                        {e.tag}
                      </div>
                    )}
                    <div className="text-[12px] text-[#C9C4B8]">{e.months} months</div>
                    <div className="font-serif text-[23px] font-semibold tabular-nums">
                      {inr(e.perMonthPaise)}
                    </div>
                    <div className="text-[11px] text-[#9E998D]">per month · {e.note}</div>
                  </div>
                ))}
              </div>
              <div className="text-[11.5px] text-[#9E998D] mt-3 leading-normal">
                Through our finance partner, subject to their approval. We'll help you apply at the
                desk — it takes a few minutes, and there's no obligation.
              </div>
            </div>
          )}
        </div>

        {/* Ask */}
        {patient && (
          <div className="flex flex-wrap gap-2.5 mt-[22px]">
            <a
              href={waLink(
                patient.phone,
                `Hello, I've been reading my treatment plan (ref ${plan.id.toUpperCase()}) and I have a question about `,
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => store.recordForward(plan.id)}
              className="flex-1 min-w-[200px] text-center text-[13.5px] font-semibold py-[13px] rounded-[11px] border border-[#CFC8B8] bg-[#FBF9F4] no-underline text-[#26241F] hover:bg-[#F3EEE4]"
            >
              Ask us something about this
            </a>
            <button
              onClick={() => {
                store.recordForward(plan.id);
                show("Link copied — send it to whoever you'd like");
                navigator.clipboard?.writeText(`${location.origin}/plan/${plan.id}`);
              }}
              className="flex-1 min-w-[200px] text-center text-[13.5px] font-semibold py-[13px] rounded-[11px] border border-[#CFC8B8] bg-[#FBF9F4] hover:bg-[#F3EEE4]"
            >
              Share this with my family
            </button>
          </div>
        )}

        <p className="text-[12.5px] text-[#8C887E] leading-relaxed mt-6 max-w-[620px]">
          Nothing here is decided until you say so, and nothing is charged from this page. Prices
          hold for ninety days. If you'd rather talk it through than read it, just message us — that's
          usually easier anyway.
        </p>
      </div>

      {/* Sticky summary */}
      <div
        className="fixed left-0 right-0 bottom-0 z-40 flex justify-center px-4 py-3.5"
        style={{ background: "linear-gradient(to top,#EFEBE3 55%,rgba(239,235,227,0))" }}
      >
        <div
          className="w-full max-w-[720px] flex items-center gap-3.5 bg-[#FBF9F4] border border-[#E2DCCF] rounded-xl py-3 pr-4 pl-5"
          style={{ boxShadow: "0 10px 30px rgba(38,36,31,0.14)" }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold">
              {acceptedCount === 0
                ? "You've set everything aside"
                : deferredCount === 0
                  ? "The full plan"
                  : `${acceptedCount} of ${allItems.length} parts chosen`}
            </div>
            <div className="text-xs text-[#8C887E] tabular-nums">
              {inr(selected)}
              {deferredCount > 0 && ` · ${inr(deferred)} kept for later`}
            </div>
          </div>
          <button
            onClick={confirm}
            disabled={acceptedCount === 0}
            className="text-[13.5px] font-semibold px-5 py-[11px] rounded-[10px] bg-primary text-on-primary whitespace-nowrap hover:bg-primary-hover disabled:opacity-45"
          >
            {acceptedCount === 0 ? "Nothing selected" : "Book my first visit"}
          </button>
        </div>
      </div>

      {/* Done */}
      {done && (
        <div
          className="fixed inset-0 z-[70] bg-[#26241F]/45 grid place-items-center p-5 animate-dc-fade"
          onClick={() => setDone(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[440px] bg-[#FBF9F4] rounded-[20px] px-[30px] py-8 text-center animate-dc-fade-up"
          >
            <div className="w-14 h-14 rounded-full bg-primary-tint text-primary grid place-items-center mx-auto mb-[18px] text-[26px]">
              ✓
            </div>
            <div className="font-serif text-2xl font-medium leading-tight">{done.title}</div>
            <p className="text-sm text-muted-strong leading-relaxed my-3 mb-[22px]">{done.body}</p>
            <button
              onClick={() => setDone(null)}
              className="w-full text-[13.5px] font-semibold py-[13px] rounded-[11px] bg-primary text-on-primary hover:bg-primary-hover"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <LocalToast toast={toast} bottom={100} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function PhaseCard({
  phase,
  index,
  open,
  onToggle,
  onDecide,
  onChoose,
  reasonFor,
  onGiveReason,
  onSkipReason,
}: {
  phase: PlanPhase;
  index: number;
  open: boolean;
  onToggle: () => void;
  onDecide: (item: PlanItem, next: "accepted" | "deferred") => void;
  onChoose: (itemId: string, optionId: string) => void;
  reasonFor: string | null;
  onGiveReason: (itemId: string, reason: DeferReason) => void;
  onSkipReason: () => void;
}) {
  const active = phaseTotalPaise(phase, (i) => i.decision !== "deferred");
  const full = phaseTotalPaise(phase);
  const allDeferred = phase.items.every((i) => i.decision === "deferred");

  return (
    <div
      className={`bg-[#FBF9F4] border rounded-2xl overflow-hidden animate-dc-fade-up ${
        allDeferred ? "border-[#E7E1D4] opacity-70" : "border-[#E2DCCF]"
      }`}
    >
      <button onClick={onToggle} className="w-full flex items-center gap-3.5 px-[22px] py-4 text-left">
        <div className="w-[34px] h-[34px] flex-none rounded-full bg-primary text-on-primary grid place-items-center font-serif text-base font-semibold">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold">{phase.plainTitle}</div>
          <div className="text-[12.5px] text-[#8C887E]">{phase.when}</div>
        </div>
        <div className="text-right">
          <div className="text-[15px] font-bold tabular-nums">{inr(active)}</div>
          {active !== full && (
            <div className="text-[11px] text-[#A39E92] tabular-nums line-through">{inr(full)}</div>
          )}
        </div>
        <span className="text-[#B3AD9F] text-[13px] ml-1">{open ? "▴" : "▾"}</span>
      </button>

      <div className="px-[22px] pb-4">
        {phase.items.map((item, i) => (
          <ItemBlock
            key={item.id}
            item={item}
            open={open}
            last={i === phase.items.length - 1}
            onDecide={onDecide}
            onChoose={onChoose}
            askingReason={reasonFor === item.id}
            onGiveReason={onGiveReason}
            onSkipReason={onSkipReason}
          />
        ))}

        {open && phase.rationale && (
          <div className="mt-2 text-[12.5px] text-[#8C887E] italic leading-relaxed">
            Why this stage comes {ordinal(index)}: {phase.rationale}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemBlock({
  item,
  open,
  last,
  onDecide,
  onChoose,
  askingReason,
  onGiveReason,
  onSkipReason,
}: {
  item: PlanItem;
  open: boolean;
  last: boolean;
  onDecide: (item: PlanItem, next: "accepted" | "deferred") => void;
  onChoose: (itemId: string, optionId: string) => void;
  askingReason: boolean;
  onGiveReason: (itemId: string, reason: DeferReason) => void;
  onSkipReason: () => void;
}) {
  const opt = chosenOption(item);
  const isDeferred = item.decision === "deferred";

  return (
    <div
      className="py-3.5"
      style={{ borderBottom: last ? "none" : "1px solid #EDE7DB", opacity: isDeferred ? 0.6 : 1 }}
    >
      <div className="flex gap-3.5">
        {/* The tick. This is the whole feature. */}
        <button
          onClick={() => onDecide(item, isDeferred ? "accepted" : "deferred")}
          aria-label={isDeferred ? `Include ${opt.plain}` : `Set aside ${opt.plain}`}
          className="w-[22px] h-[22px] mt-0.5 flex-none rounded-[7px] grid place-items-center transition-colors"
          style={{
            border: `1.5px solid ${isDeferred ? "#CFC8B8" : "#20614E"}`,
            background: isDeferred ? "transparent" : "#20614E",
          }}
        >
          {!isDeferred && <span className="text-on-primary text-[12px] leading-none">✓</span>}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between gap-3 items-baseline">
            <div className="text-[14.5px] font-semibold">{capitalise(opt.plain)}</div>
            <div className="text-sm font-bold tabular-nums whitespace-nowrap">
              {inr(itemPricePaise(item))}
            </div>
          </div>

          <div className="text-[13px] text-muted-strong leading-normal mt-[3px]">
            {item.plainFinding}
          </div>

          <div className="text-[11.5px] text-[#A39E92] mt-1">
            {opt.visits} visit{opt.visits > 1 ? "s" : ""}
            {opt.longevity !== "—" && ` · usually lasts ${opt.longevity}`}
          </div>

          {open && (
            <div className="mt-3 flex flex-col gap-3">
              {/* What happens if this waits — honest, not fear-mongering. */}
              {item.ifYouWait && (
                <div className="rounded-[10px] border border-[#E5D2AC] bg-[#FAF3E7] px-3.5 py-2.5">
                  <div className="text-[10.5px] font-bold tracking-[0.05em] text-[#8A6B33]">
                    IF THIS WAITS
                  </div>
                  <div className="text-[12.5px] text-muted-strong leading-relaxed mt-1">
                    {item.ifYouWait}
                  </div>
                </div>
              )}

              {/* Alternatives — the patient's choice, not the dentist's. */}
              {item.options.length > 1 && (
                <div className="flex flex-col gap-2">
                  <div className="text-[12.5px] font-semibold">
                    There's more than one way to do this
                  </div>
                  {item.options.map((o) => {
                    const chosen = o.id === item.chosenOptionId;
                    return (
                      <button
                        key={o.id}
                        onClick={() => onChoose(item.id, o.id)}
                        className="flex items-start gap-3 rounded-xl px-3.5 py-3 text-left transition-colors"
                        style={{
                          border: `1.5px solid ${chosen ? "#20614E" : "#E2DCCF"}`,
                          background: chosen ? "#EAF1EE" : "#FFFFFF",
                        }}
                      >
                        <span
                          className="w-[18px] h-[18px] mt-0.5 flex-none rounded-full grid place-items-center"
                          style={{
                            border: `2px solid ${chosen ? "#20614E" : "#CFC8B8"}`,
                            background: chosen ? "#20614E" : "transparent",
                          }}
                        >
                          {chosen && <span className="w-[6px] h-[6px] rounded-full bg-on-primary" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13.5px] font-semibold">
                            {capitalise(o.plain)}
                          </span>
                          {o.tradeoff && (
                            <span className="block text-[12.5px] text-muted-strong leading-normal mt-0.5">
                              {o.tradeoff}
                            </span>
                          )}
                          <span className="block text-[11.5px] text-[#A39E92] mt-1">
                            {o.visits} visit{o.visits > 1 ? "s" : ""} · usually lasts {o.longevity}
                          </span>
                        </span>
                        <span className="text-[14px] font-bold tabular-nums whitespace-nowrap">
                          {inr(o.pricePaise)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/*
           * Why it was set aside. Asked gently, skippable, and worth more to the
           * clinic than any amount of guesswork later.
           */}
          {askingReason && (
            <div className="mt-3 rounded-xl border border-[#E2DCCF] bg-white px-4 py-3.5 animate-dc-fade">
              <div className="text-[13px] font-semibold">
                Fine to leave this for now — may we ask why?
              </div>
              <div className="text-[12px] text-[#8C887E] mt-0.5 mb-2.5">
                It helps us know how to help. Skip it if you'd rather.
              </div>
              <div className="flex flex-col gap-1.5">
                {DEFER_REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onGiveReason(item.id, r.id)}
                    className="text-left text-[13px] px-3 py-2 rounded-[9px] border border-[#E2DCCF] bg-[#FBF9F4] hover:border-primary"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <button
                onClick={onSkipReason}
                className="text-[12px] text-[#8C887E] mt-2.5 hover:text-[#26241F]"
              >
                I'd rather not say
              </button>
            </div>
          )}

          {isDeferred && !askingReason && (
            <div className="mt-2 text-[12px] text-[#8C887E]">
              Kept for later
              {item.deferReason &&
                ` — ${DEFER_REASONS.find((r) => r.id === item.deferReason)?.label.toLowerCase()}`}
              .
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Legend({ bg, border, label }: { bg: string; border: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-[3px]" style={{ background: bg, border: `1.5px solid ${border}` }} />
      {label}
    </div>
  );
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
function ordinal(zeroBasedIndex: number): string {
  return ORDINALS[zeroBasedIndex] ?? `${zeroBasedIndex + 1}th`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
