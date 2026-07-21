import { create } from "zustand";
import {
  treatmentPlans,
  type TreatmentPlan,
  type PlanPhase,
  type PlanItem,
  type PlanOption,
  type ItemDecision,
  type DeferReason,
} from "./plans-data";

/*
 * Plans, held in one place.
 *
 * The builder and the presenter are two views of the same object — the dentist
 * assembles it, the patient decides on it — so they cannot each keep their own
 * copy in component state. When the patient unticks the two crowns, the console
 * must know, because that untick *is* the recovery worklist entry.
 *
 * In production this is TanStack Query over /treatment-plans with optimistic
 * mutations; the shape of the actions below is deliberately what those
 * mutations would be.
 */

let seq = 0;
const nid = (p: string) => `${p}_${Date.now().toString(36)}_${seq++}`;

interface PlansState {
  plans: TreatmentPlan[];

  get: (planId: string) => TreatmentPlan | undefined;

  /** Drop a whole plan in — how the findings-to-plan engine delivers a draft. */
  addPlan: (plan: TreatmentPlan) => void;

  // --- the dentist's side ---
  addPhase: (planId: string) => void;
  updatePhase: (planId: string, phaseId: string, patch: Partial<PlanPhase>) => void;
  removePhase: (planId: string, phaseId: string) => void;
  movePhase: (planId: string, phaseId: string, dir: -1 | 1) => void;

  addItem: (planId: string, phaseId: string, item: Omit<PlanItem, "id">) => void;
  updateItem: (planId: string, itemId: string, patch: Partial<PlanItem>) => void;
  removeItem: (planId: string, itemId: string) => void;
  moveItem: (planId: string, itemId: string, toPhaseId: string) => void;

  addOption: (planId: string, itemId: string, option: Omit<PlanOption, "id">) => void;
  updateOption: (planId: string, itemId: string, optionId: string, patch: Partial<PlanOption>) => void;
  removeOption: (planId: string, itemId: string, optionId: string) => void;

  setDiscount: (planId: string, pct: number) => void;
  present: (planId: string, on: string) => void;

  // --- the patient's side ---
  chooseOption: (planId: string, itemId: string, optionId: string) => void;
  setDecision: (planId: string, itemId: string, decision: ItemDecision, reason?: DeferReason) => void;
  setPhaseDecision: (planId: string, phaseId: string, decision: ItemDecision) => void;

  // --- what the link told us ---
  recordOpen: (planId: string, at: string) => void;
  recordDwell: (planId: string, phaseId: string, seconds: number) => void;
  recordForward: (planId: string) => void;
}

/** Apply a change to one plan without touching the others. */
function mapPlan(
  plans: TreatmentPlan[],
  planId: string,
  fn: (p: TreatmentPlan) => TreatmentPlan,
): TreatmentPlan[] {
  return plans.map((p) => (p.id === planId ? fn(p) : p));
}

function mapItem(
  plan: TreatmentPlan,
  itemId: string,
  fn: (i: PlanItem) => PlanItem,
): TreatmentPlan {
  return {
    ...plan,
    phases: plan.phases.map((ph) => ({
      ...ph,
      items: ph.items.map((it) => (it.id === itemId ? fn(it) : it)),
    })),
  };
}

const touch = (p: TreatmentPlan): TreatmentPlan => ({ ...p, updated: "Just now" });

export const usePlansStore = create<PlansState>((set, get) => ({
  plans: treatmentPlans,

  get: (planId) => get().plans.find((p) => p.id === planId),

  addPlan: (plan) => set((s) => ({ plans: [plan, ...s.plans] })),

  // --- phases --------------------------------------------------------------

  addPhase: (planId) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) =>
        touch({
          ...p,
          phases: [
            ...p.phases,
            {
              id: nid("ph"),
              title: `Phase ${p.phases.length + 1}`,
              plainTitle: "A new stage",
              when: "To be scheduled",
              rationale: "",
              items: [],
            },
          ],
        }),
      ),
    })),

  updatePhase: (planId, phaseId, patch) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) =>
        touch({
          ...p,
          phases: p.phases.map((ph) => (ph.id === phaseId ? { ...ph, ...patch } : ph)),
        }),
      ),
    })),

  removePhase: (planId, phaseId) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) =>
        touch({ ...p, phases: p.phases.filter((ph) => ph.id !== phaseId) }),
      ),
    })),

  /*
   * Reordering phases is clinical sequencing, so it is a first-class action
   * rather than a drag handle bolted on: urgent work first, function next,
   * aesthetics last — that ordering is both how dentists think and how patients
   * pay.
   */
  movePhase: (planId, phaseId, dir) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) => {
        const i = p.phases.findIndex((ph) => ph.id === phaseId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= p.phases.length) return p;
        const phases = [...p.phases];
        [phases[i], phases[j]] = [phases[j], phases[i]];
        return touch({ ...p, phases });
      }),
    })),

  // --- items ---------------------------------------------------------------

  addItem: (planId, phaseId, item) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) =>
        touch({
          ...p,
          phases: p.phases.map((ph) =>
            ph.id === phaseId ? { ...ph, items: [...ph.items, { ...item, id: nid("it") }] } : ph,
          ),
        }),
      ),
    })),

  updateItem: (planId, itemId, patch) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) => touch(mapItem(p, itemId, (i) => ({ ...i, ...patch })))),
    })),

  removeItem: (planId, itemId) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) =>
        touch({
          ...p,
          phases: p.phases.map((ph) => ({ ...ph, items: ph.items.filter((i) => i.id !== itemId) })),
        }),
      ),
    })),

  moveItem: (planId, itemId, toPhaseId) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) => {
        const item = p.phases.flatMap((ph) => ph.items).find((i) => i.id === itemId);
        if (!item) return p;
        return touch({
          ...p,
          phases: p.phases.map((ph) => {
            const without = ph.items.filter((i) => i.id !== itemId);
            return ph.id === toPhaseId ? { ...ph, items: [...without, item] } : { ...ph, items: without };
          }),
        });
      }),
    })),

  // --- alternatives --------------------------------------------------------

  addOption: (planId, itemId, option) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) =>
        touch(mapItem(p, itemId, (i) => ({ ...i, options: [...i.options, { ...option, id: nid("o") }] }))),
      ),
    })),

  updateOption: (planId, itemId, optionId, patch) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) =>
        touch(
          mapItem(p, itemId, (i) => ({
            ...i,
            options: i.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
          })),
        ),
      ),
    })),

  removeOption: (planId, itemId, optionId) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) =>
        touch(
          mapItem(p, itemId, (i) => {
            const options = i.options.filter((o) => o.id !== optionId);
            if (options.length === 0) return i; // an item must always have one way to do it
            return {
              ...i,
              options,
              chosenOptionId: i.chosenOptionId === optionId ? options[0].id : i.chosenOptionId,
            };
          }),
        ),
      ),
    })),

  // --- plan-level ----------------------------------------------------------

  setDiscount: (planId, pct) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) =>
        touch({ ...p, discountPct: Math.max(0, Math.min(50, Math.round(pct))) }),
      ),
    })),

  present: (planId, on) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) =>
        touch({
          ...p,
          status: "presented",
          presentedOn: on,
          engagement: { ...p.engagement, sentOn: on },
        }),
      ),
    })),

  // --- the patient's side --------------------------------------------------

  chooseOption: (planId, itemId, optionId) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) =>
        mapItem(p, itemId, (i) => ({ ...i, chosenOptionId: optionId })),
      ),
    })),

  setDecision: (planId, itemId, decision, reason) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) =>
        mapItem(p, itemId, (i) => ({
          ...i,
          decision,
          deferReason: decision === "deferred" ? (reason ?? i.deferReason) : undefined,
        })),
      ),
    })),

  setPhaseDecision: (planId, phaseId, decision) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) => ({
        ...p,
        phases: p.phases.map((ph) =>
          ph.id === phaseId
            ? {
                ...ph,
                items: ph.items.map((i) => ({
                  ...i,
                  decision,
                  deferReason: decision === "deferred" ? i.deferReason : undefined,
                })),
              }
            : ph,
        ),
      })),
    })),

  // --- engagement ----------------------------------------------------------

  recordOpen: (planId, at) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) => ({
        ...p,
        engagement: {
          ...p.engagement,
          opens: p.engagement.opens + 1,
          firstOpenedOn: p.engagement.firstOpenedOn ?? at,
          lastOpenedOn: at,
        },
      })),
    })),

  recordDwell: (planId, phaseId, seconds) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) => ({
        ...p,
        engagement: {
          ...p.engagement,
          dwellByPhase: {
            ...p.engagement.dwellByPhase,
            [phaseId]: (p.engagement.dwellByPhase[phaseId] ?? 0) + seconds,
          },
        },
      })),
    })),

  recordForward: (planId) =>
    set((s) => ({
      plans: mapPlan(s.plans, planId, (p) => ({
        ...p,
        engagement: { ...p.engagement, forwarded: true },
      })),
    })),
}));
