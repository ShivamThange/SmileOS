import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLocalToast, LocalToast } from "@/components/common/local-toast";
import { clinicConfig } from "@/config/clinic";
import { inr } from "@/lib/format";
import { usePortalPlan, useSubmitPortalDecisions } from "./queries";
import type { PortalPlanItem } from "./api";

/*
 * At-home treatment-plan review (spec 4.14) — the real conversion path. The
 * patient sees their own plan (server ownership from the token) and accepts or
 * defers each proposed item; the batched decision posts to the Console. No mock
 * data — everything here is the patient's actual plan.
 */

type Choice = "accepted" | "deferred";
const LOCKED = ["scheduled", "in_progress", "completed", "cancelled"];

function toothList(teeth?: number[]): string {
  return teeth && teeth.length ? ` · teeth ${teeth.join(", ")}` : "";
}

export function PortalPlan() {
  const { id } = useParams();
  const { toast, show } = useLocalToast();
  const plan = usePortalPlan(id);
  const submit = useSubmitPortalDecisions(id ?? "");

  // Patient's working choices, seeded from the current server status.
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  const items = plan.data?.items ?? [];
  const decidable = items.filter((i) => !LOCKED.includes(i.status));

  const effectiveChoice = (it: PortalPlanItem): Choice | undefined =>
    choices[it._id] ?? (it.status === "accepted" ? "accepted" : it.status === "declined" ? "deferred" : undefined);

  const selectedPaise = useMemo(
    () => items.filter((it) => effectiveChoice(it) === "accepted").reduce((s, it) => s + (it.lineTotalPaise ?? 0), 0),
    [items, choices],
  );

  function setChoice(itemId: string, choice: Choice) {
    setChoices((c) => ({ ...c, [itemId]: c[itemId] === choice ? (undefined as never) : choice }));
  }

  function onSubmit() {
    const decisions = Object.entries(choices)
      .filter(([, v]) => v)
      .map(([itemId, outcome]) => ({ itemId, outcome }));
    if (decisions.length === 0) {
      show("Choose Accept or Not now on at least one item");
      return;
    }
    submit.mutate(decisions, {
      onSuccess: () => show("Thank you — your choices are with the clinic"),
      onError: () => show("Couldn't save just now — please try again"),
    });
  }

  return (
    <div className="min-h-screen font-sans text-[#26241F] bg-[#EFEBE3] flex justify-center">
      <div className="w-full max-w-[760px] bg-[#F3EFE7] min-h-screen flex flex-col">
        {/* Header */}
        <div className="px-5 pt-[26px] pb-3.5 flex items-center gap-3">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-primary text-on-primary grid place-items-center text-base font-bold flex-none">{clinicConfig.shortInitial}</div>
          <div className="flex-1">
            <div className="text-[13px] text-[#8C887E]">Your treatment plan</div>
            <div className="text-[17px] font-semibold tracking-[-0.01em]">{plan.data?.title || (plan.isLoading ? "Loading…" : "Plan")}</div>
          </div>
          <Link to="/portal" className="text-[12.5px] text-[#8C887E] hover:text-primary no-underline">← Portal</Link>
        </div>

        <div className="flex-1 px-5 pb-[120px] pt-1.5">
          {plan.isLoading ? (
            <div className="text-[13px] text-[#8C887E] py-6">Loading your plan…</div>
          ) : plan.isError || !plan.data ? (
            <div className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl px-5 py-6 text-[14px] text-muted-strong">
              We couldn't load this plan. It may have been withdrawn — please check with the clinic.
            </div>
          ) : (
            <>
              <div className="text-[13px] text-muted-strong leading-relaxed mb-4">
                Your dentist has prepared the plan below. Accept what you'd like to go ahead with, and choose
                <span className="font-medium"> Not now</span> for anything you'd rather defer — there's no rush, and you can change your mind.
              </div>

              <div className="flex flex-col gap-3">
                {items.map((it) => {
                  const locked = LOCKED.includes(it.status);
                  const choice = effectiveChoice(it);
                  return (
                    <div key={it._id} className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-[15px] font-semibold">{it.name || "Procedure"}<span className="text-[12.5px] text-[#8C887E] font-normal">{toothList(it.teeth)}</span></div>
                          {it.justification && <div className="text-[13px] text-muted-strong leading-snug mt-1">{it.justification}</div>}
                          {locked && <div className="text-[12px] text-primary font-semibold mt-1.5 uppercase tracking-[0.04em]">{it.status.replace(/_/g, " ")}</div>}
                        </div>
                        <div className="text-[15px] font-bold tabular-nums flex-none">{inr(it.lineTotalPaise ?? 0)}</div>
                      </div>
                      {!locked && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => setChoice(it._id, "accepted")}
                            className="flex-1 text-[13px] font-semibold py-2.5 rounded-[10px] border transition-colors"
                            style={{ background: choice === "accepted" ? "#20614E" : "#FBF9F4", color: choice === "accepted" ? "#F7F6F3" : "#26241F", borderColor: choice === "accepted" ? "#20614E" : "#E2DCCF" }}>
                            Accept
                          </button>
                          <button onClick={() => setChoice(it._id, "deferred")}
                            className="flex-1 text-[13px] font-semibold py-2.5 rounded-[10px] border transition-colors"
                            style={{ background: choice === "deferred" ? "#E4C9A0" : "#FBF9F4", color: "#26241F", borderColor: choice === "deferred" ? "#D9A93B" : "#E2DCCF" }}>
                            Not now
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {items.length === 0 && (
                <div className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl px-5 py-6 text-[14px] text-muted-strong">This plan has no items yet.</div>
              )}
            </>
          )}
        </div>

        {/* Sticky decision bar */}
        {plan.data && decidable.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 flex justify-center pointer-events-none">
            <div className="w-full max-w-[760px] px-5 pb-5 pointer-events-auto">
              <div className="bg-primary text-on-primary rounded-[16px] px-5 py-3.5 flex items-center justify-between gap-4 shadow-lg">
                <div>
                  <div className="text-[11.5px] text-[#9DC7B7] tracking-[0.05em]">SELECTED TO GO AHEAD</div>
                  <div className="font-serif text-[22px] font-semibold tabular-nums">{inr(selectedPaise)}</div>
                </div>
                <button onClick={onSubmit} disabled={submit.isPending}
                  className="text-sm font-semibold px-6 py-3 rounded-[11px] bg-[#FBF9F4] text-primary hover:bg-white disabled:opacity-60">
                  {submit.isPending ? "Saving…" : "Confirm choices"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <LocalToast toast={toast} bottom={96} />
    </div>
  );
}
