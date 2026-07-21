import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { inrFromRupees as inr } from "@/lib/format";
import { ToothArch, type ToothStyle } from "@/components/domain/tooth-arch";
import { useLocalToast, LocalToast } from "@/components/common/local-toast";
import { clinicConfig } from "@/config/clinic";

/*
 * Treatment Plan — patient-facing "present to patient" view (TreatmentPlan.dc.html).
 * Reads gently, never pushes: the work shown on the patient's own teeth, the
 * cost in three unhurried stages, EMI options, and three equally-fine ways to
 * proceed — including "I'd like to think about it", which opens a warm
 * follow-up sheet rather than a dead end.
 */

const FIRST_NAME = "Ramesh";

const TREATED: Record<number, "implant" | "crown" | "treat"> = {
  34: "treat", 35: "treat", 36: "implant", 37: "crown", 16: "crown", 46: "treat",
};
const TREAT_STYLE: Record<string, ToothStyle> = {
  implant: { bg: "#DDE7E3", border: "#4E8A75" },
  crown: { bg: "#F2E4C0", border: "#B08529" },
  treat: { bg: "#EAF1EE", border: "#20614E" },
};

const GROSS = 90500;
const DISCOUNT = Math.round(GROSS * 0.1);
const NET = GROSS - DISCOUNT;
const PARTIAL = 46500;

const STAGES = [
  {
    n: "1", title: "Getting the foundation right", when: "Now · one visit", subtotal: 6500,
    items: [
      { name: "Deep clean & gum treatment", why: "Healthy gums first — everything else lasts longer when the foundation is sound.", price: 4500, imgLabel: "gum care" },
      { name: "One filling, lower right", why: "A small cavity we'd close before it grows into something bigger.", price: 2000, imgLabel: "filling" },
    ],
  },
  {
    n: "2", title: "Replacing the missing tooth", when: "In 2–3 weeks · one visit", subtotal: 42000,
    items: [
      { name: "Single tooth implant, lower left", why: "A titanium root to replace the tooth you lost. It stops the neighbouring teeth from drifting.", price: 42000, imgLabel: "implant" },
    ],
  },
  {
    n: "3", title: "The finishing caps", when: "In about 3 months · two visits", subtotal: 42000,
    items: [
      { name: "Cap on the new implant", why: "The visible tooth that sits on the implant — matched to your natural shade.", price: 18000, imgLabel: "implant cap" },
      { name: "Cap on the cracked tooth, upper right", why: "This tooth has a crack under an old filling. A cap protects it from splitting.", price: 24000, imgLabel: "crown" },
    ],
  },
];

const EMI_DEFS = [
  { months: 6, note: "0% interest", tag: "" },
  { months: 12, note: "0% interest", tag: "MOST CHOSEN" },
  { months: 24, note: "small interest", total: NET + 6000 },
];

const CHOICE_DEFS = [
  { id: "all", title: "Go ahead with everything", body: "Start with the deep clean and gum treatment. We'll book your first visit today.", amount: inr(NET), amtColor: "#20614E" },
  { id: "some", title: "Just the essential parts for now", body: "The implant and gum treatment. The caps can wait a few months if you'd prefer.", amount: inr(PARTIAL), amtColor: "#26241F" },
  { id: "think", title: "I'd like to think about it", body: "Completely understandable. We'll note it down and check in when it suits you.", amount: "—", amtColor: "#A39E92" },
];

const WHEN_DEFS: [string, string][] = [
  ["1w", "In a week"], ["1m", "In a month"], ["3m", "In 3 months"], ["after", "After the festival season"],
];
const REASON_DEFS: [string, string][] = [
  ["cost", "The cost — I need to plan for it"],
  ["family", "I want to discuss with family"],
  ["time", "Finding the time for visits"],
  ["nervous", "I feel a bit nervous about it"],
];

interface Done { glyph: string; title: string; body: string; cta: string; }

export function TreatmentPlanScreen() {
  const { toast, show } = useLocalToast();
  const [choice, setChoice] = useState<string | null>(null);
  const [emi, setEmi] = useState<number | null>(null);
  const [thinkOpen, setThinkOpen] = useState(false);
  const [thinkWhen, setThinkWhen] = useState<string | null>(null);
  const [thinkReason, setThinkReason] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const emis = useMemo(
    () =>
      EMI_DEFS.map((e) => {
        const total = e.total ?? NET;
        const per = Math.ceil(total / e.months / 100) * 100;
        return { ...e, perMonth: inr(per) };
      }),
    [],
  );

  const styleFor = (num: number): ToothStyle => {
    const t = TREATED[num];
    return t ? TREAT_STYLE[t] : { bg: "#FBF9F4", border: "#DDD6C7" };
  };

  const bar =
    choice === "all"
      ? { title: "Starting the full plan", sub: "First visit: deep clean & gum treatment", cta: "Book first visit", confirm: () => setDone({ glyph: "✓", title: "Wonderful — let's get you started.", body: "We'll book your first visit at the desk and set up your instalment plan. You're in good hands.", cta: "Done" }) }
      : choice === "some"
        ? { title: "Starting with the essentials", sub: `Implant & gum treatment — ${inr(PARTIAL)}`, cta: "Book first visit", confirm: () => setDone({ glyph: "✓", title: "That's a sensible place to start.", body: "We'll plan the implant and gum treatment first, and keep the rest ready for whenever you're ready.", cta: "Done" }) }
        : null;

  const pickChoice = (id: string) => {
    if (id === "think") { setChoice("think"); setThinkOpen(true); }
    else setChoice(id);
  };

  const submitThink = () => {
    if (!thinkWhen) { show("Just pick when we should check in"); return; }
    setThinkOpen(false);
    setDone({ glyph: "🕰", title: "Noted — we'll check in then.", body: "Your plan is saved and a gentle reminder is set. There's no pressure at all. We're here whenever you decide.", cta: "Thank you" });
  };

  return (
    <div className="min-h-screen font-sans text-[#26241F] bg-[#EFEBE3] flex justify-center px-4">
      <div className="w-full max-w-[820px] pt-7 pb-[120px]">
        {/* Clinic header */}
        <div className="flex items-center justify-between mb-[26px]">
          <div className="flex items-center gap-[11px]">
            <div className="w-[34px] h-[34px] rounded-[9px] bg-primary text-on-primary grid place-items-center text-[15px] font-bold">
              {clinicConfig.shortInitial}
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[-0.01em]">{clinicConfig.name}</div>
              <div className="text-[11px] text-[#8C887E]">{clinicConfig.locality} · {clinicConfig.city}</div>
            </div>
          </div>
          <Link to="/app/patients/p1" className="text-xs text-[#8C887E] no-underline flex items-center gap-1.5 hover:text-primary">
            ‹ Back to record
          </Link>
        </div>

        {/* Intro */}
        <div className="animate-dc-fade-up">
          <div className="text-[12.5px] font-semibold tracking-[0.08em] text-primary uppercase">Your treatment plan</div>
          <h1 className="mt-2 mb-2.5 font-serif text-[34px] font-medium leading-[1.15] tracking-[-0.01em]">
            Here's what we'd like to do for you, {FIRST_NAME}.
          </h1>
          <p className="m-0 text-[15px] leading-relaxed text-muted-strong max-w-[560px]">
            Dr. Meher has put together a plan to rebuild your bite and replace the missing tooth. Take your time with
            it — there's no rush, and nothing here is decided until you're ready.
          </p>
          <div className="flex gap-[18px] mt-4 text-[12.5px] text-[#8C887E]">
            <span>Prepared by <b className="text-[#26241F] font-semibold">{clinicConfig.ownerName}</b></span>
            <span>·</span>
            <span>20 July 2026</span>
          </div>
        </div>

        {/* Arch */}
        <div className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl px-6 py-[22px] mt-[26px] animate-dc-fade-up">
          <div className="font-serif text-[19px] font-medium mb-1">The work, shown on your teeth</div>
          <div className="text-[13px] text-[#8C887E] mb-[18px]">The teeth we'd treat are marked below.</div>
          <ToothArch size="plan" styleFor={styleFor} />
          <div className="flex justify-center gap-[18px] mt-4 text-[11.5px] text-muted-strong">
            <Legend bg="#DDE7E3" border="#4E8A75" label="New implant" />
            <Legend bg="#F2E4C0" border="#B08529" label="New cap" />
            <Legend bg="#EAF1EE" border="#20614E" label="Treatment" />
          </div>
        </div>

        {/* Stages */}
        <div className="mt-[34px]">
          <div className="font-serif text-[22px] font-medium mb-1">In three stages</div>
          <div className="text-[13.5px] text-[#8C887E] mb-5">
            We'd do this over a few months, so nothing is rushed and your mouth heals properly between steps.
          </div>
          <div className="flex flex-col gap-4">
            {STAGES.map((st) => (
              <div key={st.n} className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl overflow-hidden animate-dc-fade-up">
                <div className="flex items-center gap-3.5 px-[22px] py-4 border-b border-[#EDE7DB]">
                  <div className="w-[34px] h-[34px] flex-none rounded-full bg-primary text-on-primary grid place-items-center font-serif text-base font-semibold">
                    {st.n}
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-semibold">{st.title}</div>
                    <div className="text-[12.5px] text-[#8C887E]">{st.when}</div>
                  </div>
                  <div className="text-[15px] font-bold tabular-nums">{inr(st.subtotal)}</div>
                </div>
                <div className="px-[22px] pt-1.5 pb-3.5">
                  {st.items.map((it, i) => (
                    <div
                      key={it.name}
                      className="flex gap-3.5 py-3.5"
                      style={{ borderBottom: i < st.items.length - 1 ? "1px solid #EDE7DB" : "none" }}
                    >
                      <div className="w-[58px] h-[58px] flex-none rounded-[10px] border border-[#E2DCCF] grid place-items-center text-[#B3AD9F] text-[8px] font-mono text-center leading-[1.3] p-1"
                        style={{ background: "repeating-linear-gradient(135deg,#EDE7DB 0 6px,#F3EEE4 6px 12px)" }}>
                        {it.imgLabel}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-3 items-baseline">
                          <div className="text-[14.5px] font-semibold">{it.name}</div>
                          <div className="text-sm font-bold tabular-nums whitespace-nowrap">{inr(it.price)}</div>
                        </div>
                        <div className="text-[13px] text-muted-strong leading-normal mt-[3px]">{it.why}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Money summary */}
        <div className="bg-[#26241F] text-[#F4F1EA] rounded-[18px] px-7 py-[26px] mt-[30px] animate-dc-fade-up">
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between text-sm text-[#C9C4B8]"><span>Everything above</span><span className="tabular-nums">{inr(GROSS)}</span></div>
            <div className="flex justify-between text-sm text-[#9DC7B7]"><span>Plan discount (10%)</span><span className="tabular-nums">– {inr(DISCOUNT)}</span></div>
            <div className="h-px bg-white/15 my-1.5" />
            <div className="flex justify-between items-baseline">
              <span className="text-[15px] font-semibold">What you'd pay</span>
              <span className="font-serif text-[32px] font-semibold tabular-nums tracking-[-0.01em]">{inr(NET)}</span>
            </div>
          </div>
        </div>

        {/* EMI */}
        <div className="mt-[26px]">
          <div className="font-serif text-[22px] font-medium mb-1">Or spread it over months</div>
          <div className="text-[13.5px] text-[#8C887E] mb-[18px]">
            Through our finance partner. No cost added on the shorter plans — you pay exactly the same total.
          </div>
          <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            {emis.map((e) => {
              const sel = emi === e.months;
              return (
                <div
                  key={e.months}
                  onClick={() => { setEmi(e.months); show(`${e.perMonth}/month over ${e.months} months selected`); }}
                  className="rounded-xl px-4 py-[18px] cursor-pointer flex flex-col gap-1 relative hover:border-primary"
                  style={{ background: sel ? "#EAF1EE" : "#FBF9F4", border: `1.5px solid ${sel ? "#20614E" : "#E2DCCF"}` }}
                >
                  {e.tag && (
                    <div className="absolute -top-[9px] left-3.5 text-[9.5px] font-bold tracking-[0.05em] bg-primary text-on-primary rounded-md px-2 py-0.5">{e.tag}</div>
                  )}
                  <div className="text-[13px] text-[#8C887E] font-medium">{e.months} months</div>
                  <div className="font-serif text-[26px] font-semibold tabular-nums tracking-[-0.01em]">{e.perMonth}</div>
                  <div className="text-[11.5px] text-[#8C887E]">per month · {e.note}</div>
                </div>
              );
            })}
          </div>
          <div className="text-[11.5px] text-[#A39E92] mt-2.5 leading-normal">
            Subject to approval by our finance partner. We'll help you apply at the desk — it takes a few minutes.
          </div>
        </div>

        {/* Choices */}
        <div className="mt-[34px] animate-dc-fade-up">
          <div className="font-serif text-[22px] font-medium mb-1">How would you like to go ahead?</div>
          <div className="text-[13.5px] text-[#8C887E] mb-[18px]">
            Whatever you choose is completely fine. We can also send this to you to look over at home.
          </div>
          <div className="flex flex-col gap-3">
            {CHOICE_DEFS.map((c) => {
              const sel = choice === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => pickChoice(c.id)}
                  className="flex items-center gap-4 rounded-xl px-5 py-[18px] cursor-pointer hover:border-primary"
                  style={{ background: sel ? "#EAF1EE" : "#FBF9F4", border: `1.5px solid ${sel ? "#20614E" : "#E2DCCF"}` }}
                >
                  <div
                    className="w-[22px] h-[22px] flex-none rounded-full grid place-items-center"
                    style={{ border: `2px solid ${sel ? "#20614E" : "#CFC8B8"}`, background: sel ? "#20614E" : "transparent" }}
                  >
                    {sel && <span className="w-[9px] h-[9px] rounded-full bg-on-primary" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-[15px] font-semibold">{c.title}</div>
                    <div className="text-[13px] text-muted-strong mt-0.5 leading-snug">{c.body}</div>
                  </div>
                  <div className="text-[15px] font-bold tabular-nums" style={{ color: c.amtColor }}>{c.amount}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Send */}
        <div className="flex flex-wrap gap-2.5 mt-[22px]">
          <div onClick={() => show("Plan sent to Ramesh on WhatsApp — 98220 44513")} className="flex-1 min-w-[180px] text-center text-[13.5px] font-semibold py-[13px] rounded-[11px] border border-[#CFC8B8] bg-[#FBF9F4] cursor-pointer hover:bg-[#F3EEE4]">
            Send this to me on WhatsApp
          </div>
          <div onClick={() => show("Breakdown emailed to r.iyer@gmail.com")} className="flex-1 min-w-[180px] text-center text-[13.5px] font-semibold py-[13px] rounded-[11px] border border-[#CFC8B8] bg-[#FBF9F4] cursor-pointer hover:bg-[#F3EEE4]">
            Email me the breakdown
          </div>
        </div>
      </div>

      {/* Sticky confirm bar */}
      {bar && (
        <div className="fixed left-0 right-0 bottom-0 z-40 flex justify-center px-4 py-3.5" style={{ background: "linear-gradient(to top,#EFEBE3 55%,rgba(239,235,227,0))" }}>
          <div className="w-full max-w-[720px] flex items-center gap-3.5 bg-[#FBF9F4] border border-[#E2DCCF] rounded-xl py-3 pr-4 pl-5" style={{ boxShadow: "0 10px 30px rgba(38,36,31,0.14)" }}>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold">{bar.title}</div>
              <div className="text-xs text-[#8C887E]">{bar.sub}</div>
            </div>
            <div onClick={bar.confirm} className="text-[13.5px] font-semibold px-5 py-[11px] rounded-[10px] bg-primary text-on-primary cursor-pointer whitespace-nowrap hover:bg-primary-hover">
              {bar.cta}
            </div>
          </div>
        </div>
      )}

      {/* Think-about-it sheet */}
      {thinkOpen && (
        <div
          className="fixed inset-0 z-[60] bg-[#26241F]/40 flex items-end justify-center animate-dc-fade"
          onClick={() => { setThinkOpen(false); if (!thinkWhen) setChoice(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[560px] bg-[#FBF9F4] rounded-t-[20px] px-[26px] pt-[26px] pb-[30px] max-h-[88vh] overflow-y-auto"
            style={{ animation: "dc-sheet .22s cubic-bezier(.2,.8,.2,1)" }}
          >
            <div className="w-[38px] h-1 rounded-sm bg-[#DBD5C7] mx-auto mb-[18px]" />
            <div className="font-serif text-[23px] font-medium leading-tight">Take all the time you need.</div>
            <p className="text-sm text-muted-strong leading-relaxed my-2.5 mb-5">
              This plan will be here whenever you're ready. So we know when to gently check in — and so it doesn't get
              forgotten — could you tell us a little?
            </p>

            <div className="text-[12.5px] font-semibold text-[#26241F] mb-2.5">When should we follow up?</div>
            <div className="flex flex-wrap gap-2 mb-[22px]">
              {WHEN_DEFS.map(([id, label]) => {
                const sel = thinkWhen === id;
                return (
                  <div key={id} onClick={() => setThinkWhen(id)} className="text-[13px] font-medium px-[15px] py-[9px] rounded-[10px] cursor-pointer hover:border-primary"
                    style={{ border: `1.5px solid ${sel ? "#20614E" : "#CFC8B8"}`, background: sel ? "#20614E" : "#FBF9F4", color: sel ? "#F7F6F3" : "#26241F" }}>
                    {label}
                  </div>
                );
              })}
            </div>

            <div className="text-[12.5px] font-semibold text-[#26241F] mb-2.5">
              What's making you hesitate? <span className="font-normal text-[#8C887E]">(this really helps us help you)</span>
            </div>
            <div className="flex flex-col gap-2 mb-[22px]">
              {REASON_DEFS.map(([id, label]) => {
                const sel = thinkReason === id;
                return (
                  <div key={id} onClick={() => setThinkReason(id)} className="flex items-center gap-[11px] text-[13.5px] px-[15px] py-3 rounded-[11px] cursor-pointer hover:border-primary"
                    style={{ border: `1.5px solid ${sel ? "#20614E" : "#CFC8B8"}`, background: sel ? "#EAF1EE" : "#FBF9F4" }}>
                    <div className="w-[18px] h-[18px] flex-none rounded-full" style={{ border: `2px solid ${sel ? "#20614E" : "#CFC8B8"}`, background: sel ? "#20614E" : "transparent" }} />
                    {label}
                  </div>
                );
              })}
            </div>

            <div onClick={submitThink} className="text-center text-sm font-semibold py-3.5 rounded-xl text-on-primary cursor-pointer hover:opacity-90"
              style={{ background: thinkWhen ? "#20614E" : "#B3AD9F" }}>
              {thinkWhen ? "Save this for me" : "Pick a follow-up time"}
            </div>
            <div className="text-center text-xs text-[#8C887E] mt-3">Nothing is charged and nothing is booked.</div>
          </div>
        </div>
      )}

      {/* Done modal */}
      {done && (
        <div className="fixed inset-0 z-[70] bg-[#26241F]/45 grid place-items-center p-5 animate-dc-fade" onClick={() => setDone(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] bg-[#FBF9F4] rounded-[20px] px-[30px] py-8 text-center animate-dc-fade-up">
            <div className="w-14 h-14 rounded-full bg-primary-tint text-primary grid place-items-center mx-auto mb-[18px] text-[26px]">{done.glyph}</div>
            <div className="font-serif text-2xl font-medium leading-tight">{done.title}</div>
            <p className="text-sm text-muted-strong leading-relaxed my-3 mb-[22px]">{done.body}</p>
            <div onClick={() => setDone(null)} className="text-[13.5px] font-semibold py-[13px] rounded-[11px] bg-primary text-on-primary cursor-pointer hover:bg-primary-hover">{done.cta}</div>
          </div>
        </div>
      )}

      <LocalToast toast={toast} bottom={100} />
    </div>
  );
}

function Legend({ bg, border, label }: { bg: string; border: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-[3px]" style={{ background: bg, border: `1.5px solid ${border}` }} />
      {label}
    </div>
  );
}
