import { useState } from "react";
import { Link } from "react-router-dom";
import { ToothArch, type ToothStyle } from "@/components/domain/tooth-arch";
import { useLocalToast, LocalToast } from "@/components/common/local-toast";
import { clinicConfig } from "@/config/clinic";
import { calcEstimate, type CalcEstimate, type EstimateInput } from "./api";

/*
 * Cost Calculator — public, honest cost estimator (Calculator.dc.html). Three
 * questions (treatment → amount → quality tier), then a genuine range with a
 * breakdown, EMI, and the assumptions spelled out. Never a single made-up
 * number; every path ends in "book a consultation", not a hard sell.
 */

type TreatmentKey = "implants" | "braces" | "rct" | "smile" | "fullmouth";
type Step = "treatment" | "amount" | "tier";

// Labels only — base prices live server-side and never reach the browser.
const TREATMENTS: Record<TreatmentKey, { name: string; glyph: string; hint: string }> = {
  implants: { name: "Dental implants", glyph: "⌾", hint: "Replacing one or more missing teeth" },
  braces: { name: "Braces & aligners", glyph: "〰", hint: "Straightening crooked or crowded teeth" },
  rct: { name: "Root canal & crown", glyph: "◉", hint: "Saving and capping a painful tooth" },
  smile: { name: "Smile design", glyph: "✦", hint: "Veneers & bonding for a brighter smile" },
  fullmouth: { name: "Full-mouth work", glyph: "▦", hint: "Rebuilding a worn or damaged bite" },
};

const TIERS = {
  standard: { name: "Standard", multiplier: "Best value", desc: "Trusted, well-proven materials — Indian and Korean implant systems, metal-ceramic crowns. Does the job well and lasts." },
  premium: { name: "Premium", multiplier: "Popular", desc: "Global-brand implants (Osstem, Straumann range), full-zirconia crowns matched to your shade. Better aesthetics and track record." },
  luxury: { name: "Luxury", multiplier: "Top-tier", desc: "Top-tier Swiss implants, layered e-max/zirconia by a master ceramist, digital smile design. For the most natural, lasting result." },
} as const;
type TierKey = keyof typeof TIERS;

/** Rupee figure → "₹12,34,500", rounded to the nearest ₹500 (estimates aren't exact). */
function inr(n: number): string {
  const r = Math.round(n / 500) * 500;
  const s = r.toString();
  return "₹" + (s.length <= 3 ? s : s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + s.slice(-3));
}

const STEP_ORDER: Step[] = ["treatment", "amount", "tier"];

export function CostCalculatorScreen() {
  const { toast, show } = useLocalToast();
  const [step, setStep] = useState<Step>("treatment");
  const [treatment, setTreatment] = useState<TreatmentKey | null>(null);
  const [teeth, setTeeth] = useState<Record<number, boolean>>({});
  const [braceType, setBraceType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);
  const [tier, setTier] = useState<TierKey | null>(null);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<CalcEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  const teethCount = Object.values(teeth).filter(Boolean).length;
  const tr = treatment ? TREATMENTS[treatment] : null;
  const idx = STEP_ORDER.indexOf(step);

  // Step 2 config
  let amountQ = { title: "", sub: "", isTeeth: false, isChoice: false };
  let amountChoices: { id: string; name: string; hint: string }[] = [];
  if (treatment === "implants") amountQ = { title: "How many teeth are missing?", sub: "Tap them on the diagram — a rough idea is fine.", isTeeth: true, isChoice: false };
  else if (treatment === "braces") {
    amountQ = { title: "What kind, and how much movement?", sub: "Choose what feels closest to your situation.", isTeeth: false, isChoice: true };
    amountChoices = [
      { id: "metal_mild", name: "Metal braces · mild crowding", hint: "A little crooked, front teeth mostly" },
      { id: "ceramic_mod", name: "Ceramic braces · moderate", hint: "Noticeable crowding or gaps" },
      { id: "aligner_mild", name: "Clear aligners · mild", hint: "Minor correction, want it invisible" },
      { id: "aligner_full", name: "Clear aligners · full correction", hint: "Significant movement needed" },
    ];
  } else if (treatment === "smile") {
    amountQ = { title: "How much of your smile?", sub: "Roughly how many teeth show when you smile widely.", isTeeth: false, isChoice: true };
    amountChoices = [
      { id: "few", name: "Just the front few", hint: "Around 6 upper teeth" },
      { id: "half", name: "The full upper smile", hint: "Around 8 teeth" },
      { id: "full", name: "Upper and lower", hint: "Around 10 teeth" },
    ];
  } else if (treatment === "rct") {
    amountQ = { title: "How many teeth are troubling you?", sub: "Most people come in for one. Choose what fits.", isTeeth: false, isChoice: true };
    amountChoices = [
      { id: "1", name: "One tooth", hint: "A single painful tooth" },
      { id: "2", name: "Two teeth", hint: "Two separate teeth" },
    ];
  } else if (treatment === "fullmouth") {
    amountQ = { title: "How extensive does it feel?", sub: "We'll refine this properly at your visit.", isTeeth: false, isChoice: true };
    amountChoices = [
      { id: "upper", name: "One arch", hint: "Upper or lower rebuilt" },
      { id: "both", name: "Both arches", hint: "A complete rehabilitation" },
    ];
  }
  const choiceKey = treatment === "braces" ? "braceType" : "severity";
  const choiceVal = choiceKey === "braceType" ? braceType : severity;
  const setChoiceVal = (v: string) => (choiceKey === "braceType" ? setBraceType(v) : setSeverity(v));

  const amountAnswered =
    treatment === "implants" ? teethCount > 0 : treatment === "braces" ? !!braceType : !!severity;

  const computeQty = () => {
    if (treatment === "implants") return Math.max(1, teethCount);
    return undefined;
  };

  // Result comes from the server (spec 4.9) — the browser never holds prices.
  const low = result ? result.lowPaise / 100 : 0;
  const high = result ? result.highPaise / 100 : 0;
  const summary = result && tier ? `${result.treatment} · ${TIERS[tier].name} tier` : "";
  const breakdown: { label: string; value: string }[] = (result?.breakdown ?? []).map((b) => ({
    label: b.label,
    value: b.valuePaise != null ? inr(b.valuePaise / 100) : String(b.value ?? ""),
  }));
  const assumptions = result?.assumptions ?? [];

  const stepAnswered = step === "treatment" ? !!treatment : step === "amount" ? amountAnswered : !!tier;

  const styleFor = (num: number): ToothStyle =>
    teeth[num]
      ? { bg: "#20614E", border: "#17493A", shadow: "0 2px 8px rgba(32,97,78,0.3)" }
      : { bg: "#FBF9F4", border: "#DDD6C7" };

  async function fetchEstimate() {
    if (!treatment || !tier) return;
    const input: EstimateInput = { treatment, tier };
    const qty = computeQty();
    if (qty != null) input.quantity = qty;
    if (treatment === "braces" && braceType) input.braceType = braceType;
    if (treatment === "smile" || treatment === "fullmouth") input.severity = severity ?? undefined;
    setEstimating(true);
    try {
      const r = await calcEstimate(input);
      setResult(r);
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      show("Couldn't fetch an estimate just now — please try again");
    } finally {
      setEstimating(false);
    }
  }

  const next = () => {
    if (!stepAnswered) { show(step === "treatment" ? "Pick a treatment to continue" : "Make a choice to continue"); return; }
    if (estimating) return;
    if (step === "tier") void fetchEstimate();
    else setStep(STEP_ORDER[idx + 1]);
  };
  const restart = () => { setStep("treatment"); setTreatment(null); setTeeth({}); setBraceType(null); setSeverity(null); setTier(null); setDone(false); setResult(null); };

  return (
    <div className="min-h-screen font-sans text-[#26241F] bg-[#EFEBE3] flex justify-center px-4">
      <div className="w-full max-w-[760px] pt-6 pb-[60px]">
        <div className="flex items-center justify-between mb-[22px]">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-[9px] bg-primary text-on-primary grid place-items-center text-[15px] font-bold">{clinicConfig.shortInitial}</div>
            <div>
              <div className="text-sm font-semibold text-[#26241F]">{clinicConfig.name}</div>
              <div className="text-[10.5px] text-[#8C887E]">Cost estimate</div>
            </div>
          </Link>
          <Link to="/" className="text-[12.5px] text-[#8C887E] no-underline">Close ✕</Link>
        </div>

        {!done && (
          <>
            <div className="flex gap-1.5 mb-[26px]">
              {STEP_ORDER.map((_, i) => (
                <div key={i} className="flex-1 h-[5px] rounded-[3px] transition-colors" style={{ background: i <= idx ? "#20614E" : "#DDD6C7" }} />
              ))}
            </div>

            {step === "treatment" && (
              <div style={{ animation: "dc-fade .25s ease" }}>
                <div className="text-xs font-semibold tracking-[0.06em] text-[#8C887E]">STEP 1 OF 3</div>
                <h1 className="font-serif text-[29px] font-medium leading-[1.15] mt-2 mb-1.5 tracking-[-0.01em]">What are you thinking about?</h1>
                <p className="text-[14.5px] text-muted-strong mb-[22px]">Pick the one closest to what's on your mind. You can always change it.</p>
                <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
                  {(Object.keys(TREATMENTS) as TreatmentKey[]).map((k) => {
                    const t = TREATMENTS[k];
                    const sel = treatment === k;
                    return (
                      <div key={k} onClick={() => { setTreatment(k); setTeeth({}); setSeverity(null); setBraceType(null); }}
                        className="flex items-center gap-4 rounded-xl px-[18px] py-4 cursor-pointer hover:border-primary"
                        style={{ background: sel ? "#EAF1EE" : "#FBF9F4", border: `1.5px solid ${sel ? "#20614E" : "#E2DCCF"}` }}>
                        <div className="w-[46px] h-[46px] flex-none rounded-[11px] grid place-items-center text-xl" style={{ background: sel ? "#D4E4DC" : "#EFE9DD" }}>{t.glyph}</div>
                        <div className="flex-1">
                          <div className="text-[15.5px] font-semibold">{t.name}</div>
                          <div className="text-[12.5px] text-[#8C887E] mt-px">{t.hint}</div>
                        </div>
                        <div className="text-lg" style={{ color: sel ? "#20614E" : "#C9C1AF" }}>›</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === "amount" && (
              <div style={{ animation: "dc-fade .25s ease" }}>
                <div className="text-xs font-semibold tracking-[0.06em] text-[#8C887E]">STEP 2 OF 3</div>
                <h1 className="font-serif text-[29px] font-medium leading-[1.15] mt-2 mb-1.5 tracking-[-0.01em]">{amountQ.title}</h1>
                <p className="text-[14.5px] text-muted-strong mb-[22px]">{amountQ.sub}</p>

                {amountQ.isTeeth && (
                  <>
                    <div className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl px-5 py-[22px] mb-[18px]">
                      <div className="text-xs text-[#8C887E] text-center mb-2">Tap the teeth that are missing</div>
                      <ToothArch size="calc" styleFor={styleFor} onToggle={(n) => setTeeth((s) => ({ ...s, [n]: !s[n] }))} titleFor={(n) => `Tooth ${n}`} />
                      <div className="text-center mt-2.5 text-sm"><b className="text-[17px]">{teethCount}</b> {teethCount === 1 ? "tooth" : "teeth"} selected</div>
                    </div>
                    <div onClick={() => { setTeeth({ 36: true }); show("No problem — we've assumed one for now. We'll confirm at your visit."); }}
                      className="text-center text-[13px] font-medium text-primary p-2.5 rounded-[10px] border border-dashed border-[#CFC8B8] cursor-pointer mb-2 hover:bg-[#FBF9F4]">
                      I'm not sure how many — help me work it out
                    </div>
                  </>
                )}

                {amountQ.isChoice && (
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
                    {amountChoices.map((ac) => {
                      const sel = choiceVal === ac.id;
                      return (
                        <div key={ac.id} onClick={() => setChoiceVal(ac.id)} className="flex items-center gap-3.5 rounded-xl px-[18px] py-4 cursor-pointer hover:border-primary"
                          style={{ background: sel ? "#EAF1EE" : "#FBF9F4", border: `1.5px solid ${sel ? "#20614E" : "#E2DCCF"}` }}>
                          <div className="w-5 h-5 flex-none rounded-full grid place-items-center" style={{ border: `2px solid ${sel ? "#20614E" : "#CFC8B8"}`, background: sel ? "#20614E" : "transparent" }}>
                            {sel && <span className="w-2 h-2 rounded-full bg-on-primary" />}
                          </div>
                          <div className="flex-1">
                            <div className="text-[15px] font-semibold">{ac.name}</div>
                            <div className="text-[12.5px] text-[#8C887E] mt-px">{ac.hint}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {step === "tier" && (
              <div style={{ animation: "dc-fade .25s ease" }}>
                <div className="text-xs font-semibold tracking-[0.06em] text-[#8C887E]">STEP 3 OF 3</div>
                <h1 className="font-serif text-[29px] font-medium leading-[1.15] mt-2 mb-1.5 tracking-[-0.01em]">Which quality tier?</h1>
                <p className="text-[14.5px] text-muted-strong mb-[22px]">This is where the price genuinely moves. Here's what actually differs — honestly.</p>
                <div className="flex flex-col gap-2.5">
                  {(Object.keys(TIERS) as TierKey[]).map((k) => {
                    const t = TIERS[k];
                    const sel = tier === k;
                    return (
                      <div key={k} onClick={() => setTier(k)} className="rounded-xl px-[18px] py-4 cursor-pointer hover:border-primary"
                        style={{ background: sel ? "#EAF1EE" : "#FBF9F4", border: `1.5px solid ${sel ? "#20614E" : "#E2DCCF"}` }}>
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 flex-none rounded-full grid place-items-center" style={{ border: `2px solid ${sel ? "#20614E" : "#CFC8B8"}`, background: sel ? "#20614E" : "transparent" }}>
                            {sel && <span className="w-2 h-2 rounded-full bg-on-primary" />}
                          </div>
                          <div className="flex-1"><div className="text-[15.5px] font-semibold">{t.name}</div></div>
                          <div className="text-[13px] font-semibold text-[#8C887E]">{t.multiplier}</div>
                        </div>
                        <div className="text-[13px] text-muted-strong leading-normal mt-2 pl-8">{t.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-[26px]">
              {idx > 0 && (
                <div onClick={() => setStep(STEP_ORDER[Math.max(0, idx - 1)])} className="text-sm font-semibold px-[22px] py-[13px] rounded-[11px] border border-[#CFC8B8] bg-[#FBF9F4] cursor-pointer hover:bg-[#F3EEE4]">Back</div>
              )}
              <div onClick={next} className="flex-1 text-center text-[14.5px] font-semibold py-[13px] rounded-[11px] text-on-primary cursor-pointer hover:opacity-90"
                style={{ background: stepAnswered ? "#20614E" : "#B3AD9F" }}>
                {step === "tier" ? (estimating ? "Calculating…" : "See my estimate") : "Continue"}
              </div>
            </div>
          </>
        )}

        {done && (
          <div style={{ animation: "dc-fade-up .35s ease" }}>
            <div className="text-center mb-2">
              <div className="text-xs font-semibold tracking-[0.06em] text-primary">YOUR ESTIMATE</div>
            </div>
            <div className="bg-[#26241F] text-[#F4F1EA] rounded-[20px] p-7 text-center">
              <div className="text-sm text-[#C9C4B8]">{summary}</div>
              <div className="font-serif text-[38px] font-semibold tracking-[-0.015em] mt-2.5 mb-1 tabular-nums">{inr(low)} – {inr(high)}</div>
              <div className="text-[13px] text-[#9DC7B7]">A genuine range — never a single made-up number.</div>
            </div>

            <div className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl px-[22px] py-5 mt-4">
              <div className="text-[13px] font-semibold mb-3">What makes up the estimate</div>
              {breakdown.map((b, i) => (
                <div key={b.label} className="flex justify-between gap-3 py-2 text-[13.5px]" style={{ borderBottom: i < breakdown.length - 1 ? "1px solid #EDE7DB" : "none" }}>
                  <span className="text-[#3D3A33]">{b.label}</span>
                  <span className="tabular-nums text-muted-strong">{b.value}</span>
                </div>
              ))}
            </div>

            <div className="bg-[#EAF1EE] border border-[#CFE0D8] rounded-2xl px-[22px] py-[18px] mt-3.5">
              <div className="text-[13px] font-semibold text-primary">Or from {inr(low / 12)}/month</div>
              <div className="text-[12.5px] text-[#3D6B5C] mt-[3px]">on a 0% plan over 12 months, subject to approval.</div>
            </div>

            <div className="mt-3.5 px-5 py-4 bg-[#FBF9F4] border border-[#E2DCCF] rounded-xl">
              <div className="text-xs font-semibold text-[#8C887E] tracking-[0.04em] mb-2">WHAT THIS ASSUMES</div>
              {assumptions.map((a) => (
                <div key={a} className="flex gap-[9px] text-[13px] text-muted-strong leading-normal mb-1.5"><span className="text-primary flex-none">·</span>{a}</div>
              ))}
              <div className="text-[12.5px] text-[#8C887E] leading-relaxed mt-2 pt-2.5 border-t border-[#EDE7DB]">
                Only a proper examination — and often an X-ray — can settle the exact figure. This is here to help you
                plan, not to commit you to anything.
              </div>
            </div>

            <div className="mt-5">
              <div className="font-serif text-[19px] font-medium mb-3">Happy with this? Here's what you can do</div>
              <div className="flex flex-col gap-2.5">
                <div onClick={() => show("Estimate sent to your WhatsApp")} className="flex items-center gap-3 text-sm font-semibold px-[18px] py-3.5 rounded-xl bg-primary text-on-primary cursor-pointer hover:bg-primary-hover"><span className="text-[17px]">✆</span>Send this estimate to me on WhatsApp</div>
                <Link to="/#book" className="flex items-center gap-3 text-sm font-semibold px-[18px] py-3.5 rounded-xl border border-[#CFC8B8] bg-[#FBF9F4] cursor-pointer no-underline text-[#26241F] hover:bg-[#F3EEE4]"><span className="text-base">🗓</span>Book a consultation</Link>
                <div onClick={() => show("Breakdown emailed to you")} className="flex items-center gap-3 text-sm font-semibold px-[18px] py-3.5 rounded-xl border border-[#CFC8B8] bg-[#FBF9F4] cursor-pointer hover:bg-[#F3EEE4]"><span className="text-[15px]">✉</span>Email me the full breakdown</div>
              </div>
              <div className="text-center mt-4"><span onClick={restart} className="text-[13px] font-medium text-[#8C887E] cursor-pointer hover:text-primary">↺ Start over</span></div>
            </div>
          </div>
        )}
      </div>
      <LocalToast toast={toast} />
    </div>
  );
}
