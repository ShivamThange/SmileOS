import type { Findings, SurfaceKey } from "@/components/domain/odontogram";
import { procedureCatalogue } from "@/config/procedures";
import type {
  PlanItem,
  PlanOption,
  PlanPhase,
  TreatmentPlan,
  ToothVisual,
} from "@/features/treatment-plan/plans-data";

/*
 * Findings propose treatment.
 *
 * This is the payoff for everything in the charting screen, and the single
 * largest piece of admin in a dental practice collapsing to almost nothing.
 * Today the sequence is: examine, chart, and then that evening open a blank
 * plan builder and re-derive from the chart what you already decided at the
 * chair — twenty minutes of retyping, done tired, hours after the patient left.
 *
 * Here the findings propose the plan. Caries on 18 occlusal proposes a
 * composite at the clinic's own fee. Missing 17 with sound neighbours proposes
 * an implant, a bridge and a denture, side by side, so the patient chooses. The
 * dentist reviews and edits rather than authors, and the gap between "I have
 * examined this mouth" and "the patient has a priced plan in their hand" goes
 * from a twenty-minute evening task to about forty seconds at the chair.
 *
 * Three rules govern what's in here, and they matter more than the mapping:
 *
 *   1. It proposes; it never decides. Everything it emits is a draft the
 *      dentist edits, and the plan is not presentable until she has.
 *   2. Where there is more than one defensible answer, it offers all of them
 *      rather than picking. Missing tooth: implant, bridge, denture.
 *   3. The "if you wait" prose is conservative by construction. These are
 *      clinic-level templates, and the whole feature is only ethical if they
 *      stay descriptive rather than becoming a sales lever.
 */

/** Lab and materials as a share of fee, until the catalogue carries real costs. */
const COST_RATIO = 0.34;

function fee(id: string): number {
  return procedureCatalogue.find((p) => p.id === id)?.feePaise ?? 0;
}
function minutes(id: string): number {
  return procedureCatalogue.find((p) => p.id === id)?.minutes ?? 30;
}

let seq = 0;
const nid = (p: string) => `${p}_gen_${seq++}`;

function opt(
  partial: Omit<PlanOption, "id" | "costPaise"> & { costPaise?: number },
): PlanOption {
  return {
    ...partial,
    id: nid("o"),
    costPaise: partial.costPaise ?? Math.round(partial.pricePaise * COST_RATIO),
  };
}

interface Proposal {
  item: Omit<PlanItem, "id">;
  /** Which phase this belongs in. */
  phase: 0 | 1 | 2;
  /** Higher sorts earlier within a phase. */
  weight: number;
}

// ---------------------------------------------------------------------------
// The mapping
// ---------------------------------------------------------------------------

/** Third molars are not routinely replaced when lost. */
const THIRD_MOLARS = [18, 28, 38, 48];

const ANTERIORS = [13, 12, 11, 21, 22, 23, 33, 32, 31, 41, 42, 43];

export function proposeFromFindings(
  patientId: string,
  patientName: string,
  findings: Findings,
  doctor: string,
): TreatmentPlan {
  const proposals: Proposal[] = [];

  const cariousTeeth: number[] = [];
  const wornAnteriors: number[] = [];

  for (const [key, finding] of Object.entries(findings)) {
    const tooth = Number(key);
    const surfaces = finding.surfaces ?? {};
    const carious = (Object.keys(surfaces) as SurfaceKey[]).filter((s) => surfaces[s] === "caries");
    const restored = (Object.keys(surfaces) as SurfaceKey[]).filter((s) => surfaces[s] === "filled");
    const worn = (Object.keys(surfaces) as SurfaceKey[]).filter((s) => surfaces[s] === "wear");

    if (worn.length > 0 && ANTERIORS.includes(tooth)) wornAnteriors.push(tooth);

    // --- missing tooth -----------------------------------------------------
    if (finding.tooth === "missing" && !THIRD_MOLARS.includes(tooth)) {
      proposals.push(replaceMissing(tooth));
      continue;
    }

    // --- root-treated but unprotected --------------------------------------
    if (finding.tooth === "rct") {
      proposals.push(crownAfterRct(tooth));
      continue;
    }

    // --- caries ------------------------------------------------------------
    if (carious.length > 0) {
      cariousTeeth.push(tooth);
      proposals.push(
        carious.length >= 3 ? extensiveCaries(tooth, carious) : simpleCaries(tooth, carious),
      );
      continue;
    }

    // --- a cracked or failing restoration flagged at the chair --------------
    if (finding.tooth === "plannedTooth" && restored.length > 0) {
      proposals.push(crackedRestoration(tooth));
      continue;
    }
  }

  // --- whole-mouth items ---------------------------------------------------

  // Hygiene comes first when there's restorative work to place — restorations
  // put on inflamed tissue fail early, and this is cheap to include.
  if (cariousTeeth.length >= 2 || proposals.length >= 3) {
    proposals.unshift(hygiene());
  }

  if (wornAnteriors.length >= 3) {
    proposals.push(nightguard(wornAnteriors));
  }

  return assemble(patientId, patientName, doctor, proposals);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function hygiene(): Proposal {
  return {
    phase: 0,
    weight: 100,
    item: {
      teeth: [],
      finding: "Generalised deposits; scaling and polishing indicated before restorative work.",
      plainFinding:
        "There's hardened deposit around the gumline that ordinary brushing can't remove.",
      ifYouWait:
        "Gum inflammation tends to worsen slowly rather than suddenly. Left long enough it starts to affect the bone holding the teeth, and that part doesn't grow back. It also makes fillings and caps placed now fail sooner.",
      options: [
        opt({
          name: "Full-mouth scaling & polish",
          plain: "A thorough clean, including under the gumline",
          pricePaise: fee("scaling"),
          minutes: minutes("scaling"),
          visits: 1,
          longevity: "6–12 months before the next clean",
          recommended: true,
          visual: "treat",
        }),
      ],
      chosenOptionId: "",
      decision: "undecided",
    },
  };
}

function simpleCaries(tooth: number, surfaces: SurfaceKey[]): Proposal {
  const s = surfaces.map(abbrev).join("");
  return {
    phase: 0,
    weight: 60,
    item: {
      teeth: [tooth],
      finding: `Caries on ${tooth} ${s}, into dentine.`,
      plainFinding: `A cavity in tooth ${tooth}. It may not be hurting yet — most don't until they're deep.`,
      ifYouWait:
        "Cavities only grow. This one is currently a filling. If it reaches the nerve it becomes a root canal and a cap, which is several times the cost and several more visits.",
      options: [
        opt({
          name: `Composite restoration, ${tooth} ${s}`,
          plain: "A tooth-coloured filling",
          pricePaise: fee("composite"),
          minutes: minutes("composite"),
          visits: 1,
          longevity: "7–10 years",
          recommended: true,
          visual: "treat",
        }),
      ],
      chosenOptionId: "",
      decision: "undecided",
    },
  };
}

function extensiveCaries(tooth: number, surfaces: SurfaceKey[]): Proposal {
  const s = surfaces.map(abbrev).join("");
  return {
    phase: 1,
    weight: 70,
    item: {
      teeth: [tooth],
      finding: `Extensive caries on ${tooth} (${s}). Insufficient remaining tooth structure for a direct restoration; cuspal coverage indicated. Pulpal involvement to be confirmed.`,
      plainFinding: `Tooth ${tooth} has decay across several of its surfaces — enough that a simple filling wouldn't hold.`,
      ifYouWait:
        "A tooth this broken down usually fractures eventually, often while eating. If it splits below the gumline it can't always be saved, which turns a cap into a replacement.",
      options: [
        opt({
          name: `Zirconia crown, ${tooth}`,
          plain: "A cap that wraps the whole tooth and holds it together",
          pricePaise: fee("crown"),
          minutes: minutes("crown"),
          visits: 2,
          longevity: "12–20 years",
          recommended: true,
          visual: "crown",
        }),
        opt({
          name: `Root canal + crown, ${tooth}`,
          plain: "A root canal first, then a cap",
          pricePaise: fee("rct") + fee("crown"),
          minutes: minutes("rct") + minutes("crown"),
          visits: 3,
          longevity: "12–20 years",
          tradeoff:
            "Needed only if the nerve turns out to be involved. We'd know once we open the tooth, and we'd tell you before going further.",
          visual: "crown",
        }),
        opt({
          name: `Extraction, ${tooth}`,
          plain: "Taking the tooth out instead",
          pricePaise: fee("extraction"),
          minutes: minutes("extraction"),
          visits: 1,
          longevity: "—",
          tradeoff:
            "Much cheaper today. But the gap then needs replacing later, which costs considerably more than saving the tooth now.",
          visual: "extract",
        }),
      ],
      chosenOptionId: "",
      decision: "undecided",
    },
  };
}

function crownAfterRct(tooth: number): Proposal {
  return {
    phase: 1,
    weight: 80,
    item: {
      teeth: [tooth],
      finding: `${tooth} root-treated and unprotected. Cuspal coverage indicated.`,
      plainFinding: `Tooth ${tooth} has had a root canal but no cap over it.`,
      ifYouWait:
        "A back tooth that's had a root canal and no cap fractures within a couple of years in most cases. If that happens the root canal is wasted along with the tooth.",
      options: [
        opt({
          name: `Zirconia crown, ${tooth}`,
          plain: "A cap over the treated tooth",
          pricePaise: fee("crown"),
          minutes: minutes("crown"),
          visits: 2,
          longevity: "12–20 years",
          recommended: true,
          visual: "crown",
        }),
      ],
      chosenOptionId: "",
      decision: "undecided",
    },
  };
}

function crackedRestoration(tooth: number): Proposal {
  return {
    phase: 1,
    weight: 65,
    item: {
      teeth: [tooth],
      finding: `Cracked restoration on ${tooth} with craze lines extending into tooth structure. Cusp-fracture risk under load.`,
      plainFinding: `The old filling in tooth ${tooth} has cracked, and the crack has spread into the tooth around it.`,
      ifYouWait:
        "It may hold for a long time, or it may split while you're eating. If it splits below the gumline the tooth usually can't be kept.",
      options: [
        opt({
          name: `Zirconia crown, ${tooth}`,
          plain: "A cap that wraps the whole tooth",
          pricePaise: fee("crown"),
          minutes: minutes("crown"),
          visits: 2,
          longevity: "12–20 years",
          recommended: true,
          visual: "crown",
        }),
        opt({
          name: `Cuspal-coverage onlay, ${tooth}`,
          plain: "A partial cap covering only the weakened part",
          pricePaise: Math.round(fee("crown") * 0.68),
          minutes: minutes("crown") - 15,
          visits: 2,
          longevity: "8–12 years",
          tradeoff: "Keeps more of your own tooth, but protects slightly less of it.",
          visual: "crown",
        }),
      ],
      chosenOptionId: "",
      decision: "undecided",
    },
  };
}

function replaceMissing(tooth: number): Proposal {
  return {
    phase: 1,
    weight: 90,
    item: {
      teeth: [tooth],
      finding: `${tooth} absent. Assess adjacent tipping and opposing over-eruption; confirm bone volume before placement.`,
      plainFinding: `The gap where tooth ${tooth} used to be. Teeth either side tend to lean into a gap over time, and the tooth above it can drop down.`,
      ifYouWait:
        "The neighbouring teeth keep drifting, and past a point they need straightening before anything can go in the gap — which adds time and cost. The bone in the gap also thins slowly once a tooth is gone.",
      options: [
        opt({
          name: `Single implant, ${tooth}`,
          plain: "A titanium root with a cap on top — closest thing to a real tooth",
          pricePaise: fee("implant-place") + fee("crown"),
          minutes: minutes("implant-place") + minutes("crown"),
          visits: 3,
          longevity: "15–25 years, often longer",
          tradeoff: "Takes about three months in total, because the bone needs to fuse to it.",
          recommended: true,
          visual: "implant",
        }),
        opt({
          name: `Three-unit bridge across ${tooth}`,
          plain: "A false tooth held by caps on the two teeth either side",
          pricePaise: fee("bridge"),
          minutes: minutes("bridge"),
          visits: 2,
          longevity: "8–12 years",
          tradeoff:
            "Faster and a little cheaper, but the two healthy teeth beside the gap have to be trimmed down permanently.",
          visual: "crown",
        }),
        opt({
          name: "Removable partial denture",
          plain: "A small removable plate carrying the missing tooth",
          pricePaise: Math.round(fee("denture") * 0.38),
          minutes: 45,
          visits: 3,
          longevity: "4–6 years",
          tradeoff:
            "Much cheaper and nothing is drilled, but it comes out to be cleaned and most people find it less comfortable.",
          visual: "denture",
        }),
      ],
      chosenOptionId: "",
      decision: "undecided",
    },
  };
}

function nightguard(teeth: number[]): Proposal {
  return {
    phase: 2,
    weight: 30,
    item: {
      teeth,
      finding: `Generalised attrition on ${teeth.join(", ")} consistent with parafunction. Occlusal splint indicated to protect existing and planned restorations.`,
      plainFinding:
        "Your front teeth are wearing flat, which usually means grinding — most often at night, and most people have no idea they do it.",
      ifYouWait:
        "Wear doesn't reverse. It progresses slowly, and it wears down new caps and fillings at the same rate it wore the teeth. A guard is largely about protecting what we're about to build.",
      options: [
        opt({
          name: "Hard occlusal splint (night guard)",
          plain: "A thin clear guard worn at night",
          pricePaise: 650000,
          minutes: 45,
          visits: 2,
          longevity: "3–5 years",
          recommended: true,
          visual: "treat",
        }),
      ],
      chosenOptionId: "",
      decision: "undecided",
    },
  };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

const PHASE_DEFS: { title: string; plainTitle: string; when: string; rationale: string }[] = [
  {
    title: "Phase 1 · Stabilise",
    plainTitle: "Getting the foundation right",
    when: "Now · one or two visits",
    rationale:
      "Gum health and active decay first. Restorations placed on inflamed tissue or beside untreated decay fail early.",
  },
  {
    title: "Phase 2 · Restore function",
    plainTitle: "Rebuilding what's broken or missing",
    when: "Over the next few months",
    rationale:
      "Teeth that are cracked, root-treated or absent — the work that keeps the bite stable and stops further drifting.",
  },
  {
    title: "Phase 3 · Protect and finish",
    plainTitle: "Protecting what we've built",
    when: "Once everything has settled",
    rationale: "Protective and finishing work, once the rest has healed and settled into place.",
  },
];

function assemble(
  patientId: string,
  patientName: string,
  doctor: string,
  proposals: Proposal[],
): TreatmentPlan {
  const phases: PlanPhase[] = PHASE_DEFS.map((def, i) => {
    const items = proposals
      .filter((p) => p.phase === i)
      .sort((a, b) => b.weight - a.weight)
      .map((p) => {
        const id = nid("it");
        const item: PlanItem = { ...p.item, id };
        // Options were built before the item existed, so bind the recommended
        // one now rather than making every rule remember to.
        const recommended = item.options.find((o) => o.recommended) ?? item.options[0];
        return { ...item, chosenOptionId: recommended.id };
      });

    return { id: nid("ph"), ...def, items };
  }).filter((ph) => ph.items.length > 0);

  const totalItems = phases.reduce((s, p) => s + p.items.length, 0);

  return {
    id: `tp_${Date.now().toString(36)}`,
    patientId,
    patient: patientName,
    title: titleFor(phases),
    status: "draft",
    discountPct: 0,
    updated: "Just now",
    doctor,
    intro: introFor(patientName, totalItems),
    phases,
    engagement: { opens: 0, dwellByPhase: {}, forwarded: false },
  };
}

function titleFor(phases: PlanPhase[]): string {
  const visuals = new Set<ToothVisual>();
  for (const ph of phases)
    for (const it of ph.items) {
      const o = it.options.find((x) => x.id === it.chosenOptionId) ?? it.options[0];
      visuals.add(o.visual);
    }

  const parts: string[] = [];
  if (visuals.has("treat")) parts.push("stabilising work");
  if (visuals.has("crown")) parts.push("crowns");
  if (visuals.has("implant")) parts.push("implant");
  if (visuals.has("denture")) parts.push("denture");
  if (visuals.has("extract")) parts.push("extraction");

  return parts.length ? capitalise(parts.join(", ")) : "Treatment plan";
}

function introFor(patientName: string, itemCount: number): string {
  const first = patientName.split(" ")[0];
  return `${first}, this is drawn straight from the examination we've just done, so it reflects exactly what we saw today. There are ${itemCount} things we'd suggest, grouped so that the most important comes first — and where there's more than one sensible way to do something, we've put the options side by side so you can choose. Nothing here is decided until you say so.`;
}

function abbrev(s: SurfaceKey): string {
  return { mesial: "M", occlusal: "O", distal: "D", buccal: "B", lingual: "L" }[s];
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
