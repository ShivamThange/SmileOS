/*
 * The treatment plan, as a proposal with structure.
 *
 * The old model was a flat list of stages, each a list of priced lines, with a
 * single status on the plan. That shape cannot express the thing that actually
 * happens in a consulting room: the patient accepts the root canal and defers
 * the two crowns. A plan with one status throws that nuance away — and the
 * deferred items are the entire basis of the recovery worklist, so throwing it
 * away means reconstructing it later by hand.
 *
 * Three changes make the difference:
 *
 *   Phases      — clinical sequencing (urgent → functional → aesthetic) is how
 *                 dentists think and how patients afford treatment. ₹1.8L
 *                 presented as ₹1.8L gets "let me think about it". Presented as
 *                 three phases of ₹60,000, three months apart, it gets accepted.
 *
 *   Alternatives— for a missing tooth: implant, bridge, or denture, three
 *                 prices, side by side, and the *patient* chooses. Choice raises
 *                 acceptance; a single take-it-or-leave-it number lowers it.
 *                 Almost no practice software models this properly.
 *
 *   Per-item    — every line carries its own decision and, when deferred, the
 *   decisions     reason the patient gave. That reason is worth more than any
 *                 amount of guessing by the front desk, and it arrives as a
 *                 byproduct of the patient's own honesty.
 *
 * Money is integer paise throughout, per the backend contract.
 */

const rs = (rupees: number) => rupees * 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanStatus = "draft" | "presented" | "accepted" | "partial" | "declined";

export type ItemDecision = "undecided" | "accepted" | "deferred";

export type DeferReason = "cost" | "time" | "family" | "nervous" | "unsure" | "other";

export const DEFER_REASONS: { id: DeferReason; label: string }[] = [
  { id: "cost", label: "The cost — I need to plan for it" },
  { id: "time", label: "Finding the time for the visits" },
  { id: "family", label: "I want to discuss it with family" },
  { id: "nervous", label: "I feel a bit nervous about it" },
  { id: "unsure", label: "I'm not sure I need it yet" },
  { id: "other", label: "Something else" },
];

/** How a treated tooth reads on the arch. */
export type ToothVisual = "implant" | "crown" | "treat" | "extract" | "denture";

/**
 * One way of solving one problem. Most items have a single option; the
 * interesting ones have two or three, and the patient picks.
 */
export interface PlanOption {
  id: string;
  /** Clinical name, for the dentist. */
  name: string;
  /** The same thing in language a patient uses. */
  plain: string;
  pricePaise: number;
  /** Lab and materials. Owner-only — drives the margin indicator. */
  costPaise: number;
  /** Chair time across all visits. */
  minutes: number;
  visits: number;
  /** "15–25 years" — honest, ranged, never a promise. */
  longevity: string;
  /** The trade-off, in one clause. */
  tradeoff?: string;
  recommended?: boolean;
  visual: ToothVisual;
}

export interface PlanItem {
  id: string;
  /** FDI numbers this item treats. Empty means arch-wide or general. */
  teeth: number[];
  /** What the dentist recorded. */
  finding: string;
  /** The same finding without jargon. This is what the patient reads. */
  plainFinding: string;
  /**
   * What happens if this waits. Written conservatively and once per procedure
   * type — this is a clinical-ethics boundary, not a sales lever, and it should
   * read as information rather than as a threat.
   */
  ifYouWait: string;
  options: PlanOption[];
  chosenOptionId: string;
  decision: ItemDecision;
  deferReason?: DeferReason;
}

export interface PlanPhase {
  id: string;
  /** Clinical title, shown in the builder. */
  title: string;
  /** Patient-facing title, shown in the presenter. */
  plainTitle: string;
  when: string;
  /** Why this phase comes where it does. */
  rationale: string;
  items: PlanItem[];
}

/**
 * What the plan link told us.
 *
 * Which phase was expanded, how long it was read, whether it was forwarded.
 * This turns follow-up from cold calling into an informed conversation — a
 * patient who opened the plan four times and never replied is stuck on
 * something specific, and someone who never opened it may not have received it.
 * Disclose it in the privacy policy; it is standard for proposal software.
 */
export interface PlanEngagement {
  sentOn?: string;
  firstOpenedOn?: string;
  lastOpenedOn?: string;
  opens: number;
  /** Seconds spent, keyed by phase id. */
  dwellByPhase: Record<string, number>;
  forwarded: boolean;
}

export interface TreatmentPlan {
  id: string;
  patientId: string;
  patient: string;
  title: string;
  status: PlanStatus;
  discountPct: number;
  updated: string;
  presentedOn?: string;
  doctor: string;
  /** The "why", in the dentist's own voice. Opens the patient-facing view. */
  intro: string;
  phases: PlanPhase[];
  engagement: PlanEngagement;
}

export const PLAN_STATUS_META: Record<
  PlanStatus,
  { label: string; bg: string; color: string; border: string }
> = {
  draft: { label: "Draft", bg: "#F4F3EF", color: "#6E6C64", border: "#E6E4DE" },
  presented: { label: "Presented", bg: "#FAF3E7", color: "#8A6B33", border: "#E5D2AC" },
  accepted: { label: "Accepted", bg: "#EAF1EE", color: "#20614E", border: "#C7DAD1" },
  partial: { label: "Partly accepted", bg: "#EDE3F0", color: "#7A4C8A", border: "#D9C7E0" },
  declined: { label: "Declined", bg: "#FBEFED", color: "#A8342A", border: "#EFC7C2" },
};

export const TOOTH_VISUAL_STYLE: Record<ToothVisual, { bg: string; border: string; label: string }> = {
  implant: { bg: "#DDE7E3", border: "#4E8A75", label: "New implant" },
  crown: { bg: "#F2E4C0", border: "#B08529", label: "New cap" },
  treat: { bg: "#EAF1EE", border: "#20614E", label: "Treatment" },
  extract: { bg: "#FBEFED", border: "#A8342A", label: "Removal" },
  denture: { bg: "#EDE3F0", border: "#7A4C8A", label: "Denture" },
};

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const noEngagement = (): PlanEngagement => ({ opens: 0, dwellByPhase: {}, forwarded: false });

export const treatmentPlans: TreatmentPlan[] = [
  {
    id: "tp1",
    patientId: "p1",
    patient: "Ramesh Iyer",
    title: "Foundation, implant & finishing crowns",
    status: "presented",
    discountPct: 10,
    updated: "20 Jul",
    presentedOn: "20 Jul 2026",
    doctor: "Dr. Meher",
    intro:
      "Your lower left molar has been missing for a while and the teeth either side have started to lean into the space. Before we replace it we should settle the gums, because everything we build lasts longer on a healthy foundation. Nothing here is urgent this week — but the longer the gap stays open, the more preparation the replacement needs.",
    phases: [
      {
        id: "ph1",
        title: "Phase 1 · Stabilise",
        plainTitle: "Getting the foundation right",
        when: "Now · one visit",
        rationale: "Gum health first — restorations placed on inflamed tissue fail early.",
        items: [
          {
            id: "it1",
            teeth: [],
            finding: "Generalised chronic gingivitis with moderate calculus; BOP in all quadrants.",
            plainFinding:
              "Your gums are inflamed and bleed when brushed. There's hardened deposit under the gumline that a normal clean can't reach.",
            ifYouWait:
              "Inflammation tends to worsen slowly rather than suddenly. Left a year or two it can start to loosen the bone that holds the teeth, and that part doesn't grow back.",
            options: [
              {
                id: "o1",
                name: "Full-mouth scaling & subgingival debridement",
                plain: "A deep clean, including under the gumline",
                pricePaise: rs(4500),
                costPaise: rs(400),
                minutes: 60,
                visits: 1,
                longevity: "6–12 months before the next clean",
                recommended: true,
                visual: "treat",
              },
            ],
            chosenOptionId: "o1",
            decision: "undecided",
          },
          {
            id: "it2",
            teeth: [46],
            finding: "Occlusal caries on 46, into dentine, asymptomatic.",
            plainFinding: "A small cavity in your lower right molar. It isn't hurting yet.",
            ifYouWait:
              "Cavities only grow. This one is currently a filling; if it reaches the nerve it becomes a root canal and a crown, which is roughly ten times the cost.",
            options: [
              {
                id: "o2",
                name: "Composite restoration, 46 occlusal",
                plain: "A tooth-coloured filling",
                pricePaise: rs(2000),
                costPaise: rs(250),
                minutes: 30,
                visits: 1,
                longevity: "7–10 years",
                recommended: true,
                visual: "treat",
              },
            ],
            chosenOptionId: "o2",
            decision: "undecided",
          },
        ],
      },
      {
        id: "ph2",
        title: "Phase 2 · Replace the missing tooth",
        plainTitle: "Replacing the tooth you're missing",
        when: "In 2–3 weeks",
        rationale:
          "36 has been absent eight months; 35 is tipping mesially. The window for a straightforward placement is closing.",
        items: [
          {
            id: "it3",
            teeth: [36],
            finding:
              "36 missing ~8 months. 35 tipping mesially, 26 over-erupting. CBCT shows adequate bone volume for immediate placement.",
            plainFinding:
              "The gap where your lower left molar used to be. The teeth on either side have begun leaning into it, and the tooth above has started to drop down.",
            ifYouWait:
              "The neighbouring teeth keep drifting, and at some point they need straightening before anything can be put in the gap — which adds both time and cost. The bone in the gap also thins slowly once a tooth is gone.",
            options: [
              {
                id: "o3a",
                name: "Single implant, 36",
                plain: "A titanium root with a cap on top — closest thing to a real tooth",
                pricePaise: rs(42000),
                costPaise: rs(14000),
                minutes: 90,
                visits: 3,
                longevity: "15–25 years, often longer",
                tradeoff: "Takes about three months in total, because the bone needs to fuse.",
                recommended: true,
                visual: "implant",
              },
              {
                id: "o3b",
                name: "Three-unit bridge, 35–37",
                plain: "A false tooth held by caps on the two teeth either side",
                pricePaise: rs(32000),
                costPaise: rs(11000),
                minutes: 120,
                visits: 2,
                longevity: "8–12 years",
                tradeoff:
                  "Faster and slightly cheaper, but the two healthy teeth beside the gap have to be trimmed down permanently.",
                visual: "crown",
              },
              {
                id: "o3c",
                name: "Removable partial denture",
                plain: "A small removable plate with one tooth on it",
                pricePaise: rs(9000),
                costPaise: rs(3000),
                minutes: 45,
                visits: 3,
                longevity: "4–6 years",
                tradeoff:
                  "Much cheaper and nothing is drilled, but it comes out to be cleaned and most people find it less comfortable.",
                visual: "denture",
              },
            ],
            chosenOptionId: "o3a",
            decision: "undecided",
          },
        ],
      },
      {
        id: "ph3",
        title: "Phase 3 · Protect and finish",
        plainTitle: "The finishing caps",
        when: "In about 3 months",
        rationale: "Implant restoration once integrated, plus protection of the cracked 16.",
        items: [
          {
            id: "it4",
            teeth: [36],
            finding: "Screw-retained zirconia crown on 36 implant, post-integration.",
            plainFinding: "The visible tooth that sits on top of the new implant, shade-matched to yours.",
            ifYouWait:
              "This can't really wait — it's the part that makes the implant a working tooth. It's included here so you can see the full cost of the implant from the start rather than being surprised later.",
            options: [
              {
                id: "o4",
                name: "Zirconia crown on implant, 36",
                plain: "The cap for the new implant",
                pricePaise: rs(18000),
                costPaise: rs(6500),
                minutes: 45,
                visits: 2,
                longevity: "15+ years",
                recommended: true,
                visual: "implant",
              },
            ],
            chosenOptionId: "o4",
            decision: "undecided",
          },
          {
            id: "it5",
            teeth: [16],
            finding:
              "Cracked amalgam on 16 with visible craze lines extending onto the mesiobuccal cusp. Cusp-fracture risk under load.",
            plainFinding:
              "An old silver filling in your upper right molar has cracked, and the crack has spread into the tooth around it.",
            ifYouWait:
              "Cracked cusps usually fracture eventually, often while eating something hard. If it breaks below the gumline the tooth can't always be saved — which is the difference between a cap and losing the tooth.",
            options: [
              {
                id: "o5a",
                name: "Zirconia crown, 16",
                plain: "A cap that wraps the whole tooth and holds it together",
                pricePaise: rs(24000),
                costPaise: rs(8000),
                minutes: 90,
                visits: 2,
                longevity: "12–20 years",
                recommended: true,
                visual: "crown",
              },
              {
                id: "o5b",
                name: "Cuspal-coverage onlay, 16",
                plain: "A partial cap covering only the weak part of the tooth",
                pricePaise: rs(16000),
                costPaise: rs(5500),
                minutes: 75,
                visits: 2,
                longevity: "8–12 years",
                tradeoff: "Keeps more of your own tooth, but protects slightly less of it.",
                visual: "crown",
              },
            ],
            chosenOptionId: "o5a",
            decision: "undecided",
          },
        ],
      },
    ],
    engagement: {
      sentOn: "20 Jul 2026",
      firstOpenedOn: "20 Jul 2026, 8:42pm",
      lastOpenedOn: "21 Jul 2026, 11:06am",
      opens: 4,
      dwellByPhase: { ph1: 22, ph2: 186, ph3: 41 },
      forwarded: true,
    },
  },

  {
    id: "tp2",
    patientId: "p2",
    patient: "Sunita Deshmukh",
    title: "Full-arch rehabilitation (upper)",
    status: "accepted",
    discountPct: 8,
    updated: "18 Jul",
    presentedOn: "16 Jul 2026",
    doctor: "Dr. Meher",
    intro:
      "The upper teeth that remain are loose and can't be saved, but the bone underneath is in good condition — which means we can give you a fixed set of teeth rather than a plate that comes out.",
    phases: [
      {
        id: "ph1",
        title: "Phase 1 · Extractions & grafting",
        plainTitle: "Clearing and preparing",
        when: "Now",
        rationale: "Remove non-restorable teeth and graft the deficient right quadrant.",
        items: [
          {
            id: "it1",
            teeth: [14, 15, 16],
            finding: "Grade III mobility on 14, 15, 16. Non-restorable.",
            plainFinding: "Three upper teeth that are too loose to keep.",
            ifYouWait: "Loose teeth make the bone around them shrink faster, which makes what comes next harder.",
            options: [
              {
                id: "o1",
                name: "Extraction × 3 with socket preservation",
                plain: "Removing three teeth and protecting the bone underneath",
                pricePaise: rs(9000),
                costPaise: rs(2000),
                minutes: 75,
                visits: 1,
                longevity: "—",
                recommended: true,
                visual: "extract",
              },
            ],
            chosenOptionId: "o1",
            decision: "accepted",
          },
          {
            id: "it2",
            teeth: [],
            finding: "Ridge augmentation, upper right.",
            plainFinding: "Building the bone back up on the right side so implants have something to hold on to.",
            ifYouWait: "Without this the implants on that side wouldn't be stable.",
            options: [
              {
                id: "o2",
                name: "Bone graft, upper right quadrant",
                plain: "A bone graft",
                pricePaise: rs(16000),
                costPaise: rs(6000),
                minutes: 60,
                visits: 1,
                longevity: "Permanent once healed",
                recommended: true,
                visual: "treat",
              },
            ],
            chosenOptionId: "o2",
            decision: "accepted",
          },
        ],
      },
      {
        id: "ph2",
        title: "Phase 2 · Implant placement",
        plainTitle: "Placing the supports",
        when: "In 6 weeks",
        rationale: "Four-implant fixed protocol once graft has consolidated.",
        items: [
          {
            id: "it3",
            teeth: [13, 11, 21, 23],
            finding: "All-on-4 protocol, upper arch.",
            plainFinding: "Four implants that will hold the whole upper set in place.",
            ifYouWait: "Nothing can be fixed in until these are in and healed.",
            options: [
              {
                id: "o3",
                name: "4 implants (All-on-4), upper",
                plain: "Four implants",
                pricePaise: rs(180000),
                costPaise: rs(62000),
                minutes: 180,
                visits: 2,
                longevity: "20+ years",
                recommended: true,
                visual: "implant",
              },
            ],
            chosenOptionId: "o3",
            decision: "accepted",
          },
        ],
      },
      {
        id: "ph3",
        title: "Phase 3 · Final bridge",
        plainTitle: "Your new teeth",
        when: "In 4 months",
        rationale: "Definitive zirconia superstructure.",
        items: [
          {
            id: "it4",
            teeth: [],
            finding: "Screw-retained monolithic zirconia full-arch bridge.",
            plainFinding: "The fixed set of teeth that screws onto the implants. It doesn't come out.",
            ifYouWait: "You'd stay in the temporary set, which is fine short-term but wears quickly.",
            options: [
              {
                id: "o4",
                name: "Fixed zirconia full-arch bridge",
                plain: "The final fixed teeth",
                pricePaise: rs(95000),
                costPaise: rs(38000),
                minutes: 150,
                visits: 3,
                longevity: "15–20 years",
                recommended: true,
                visual: "crown",
              },
            ],
            chosenOptionId: "o4",
            decision: "accepted",
          },
        ],
      },
    ],
    engagement: {
      sentOn: "16 Jul 2026",
      firstOpenedOn: "16 Jul 2026, 7:10pm",
      lastOpenedOn: "17 Jul 2026, 9:22pm",
      opens: 6,
      dwellByPhase: { ph1: 64, ph2: 210, ph3: 158 },
      forwarded: true,
    },
  },

  {
    id: "tp3",
    patientId: "p3",
    patient: "Farhan Shaikh",
    title: "Root canal & crown, upper left",
    status: "draft",
    discountPct: 0,
    updated: "19 Jul",
    doctor: "Dr. Kulkarni",
    intro:
      "The nerve inside your upper left molar has become infected. Treating it saves the tooth; the alternative is losing it.",
    phases: [
      {
        id: "ph1",
        title: "Phase 1 · Root canal",
        plainTitle: "Treating the infection",
        when: "Now",
        rationale: "Irreversible pulpitis, symptomatic to cold and percussion.",
        items: [
          {
            id: "it1",
            teeth: [26],
            finding: "Irreversible pulpitis 26. Periapical radiolucency ~2mm.",
            plainFinding: "The nerve inside the tooth is infected and won't recover on its own.",
            ifYouWait:
              "Infected nerves usually flare up eventually, often at night and often badly. At that point it becomes an emergency visit, and sometimes the tooth can no longer be saved.",
            options: [
              {
                id: "o1",
                name: "RCT, 26",
                plain: "A root canal",
                pricePaise: rs(8500),
                costPaise: rs(1200),
                minutes: 90,
                visits: 2,
                longevity: "10–20 years with a crown",
                recommended: true,
                visual: "treat",
              },
              {
                id: "o1b",
                name: "Extraction, 26",
                plain: "Removing the tooth instead",
                pricePaise: rs(2500),
                costPaise: rs(300),
                minutes: 45,
                visits: 1,
                longevity: "—",
                tradeoff:
                  "Cheaper today, but the gap then needs replacing later, which costs considerably more than saving the tooth now.",
                visual: "extract",
              },
            ],
            chosenOptionId: "o1",
            decision: "undecided",
          },
        ],
      },
      {
        id: "ph2",
        title: "Phase 2 · Crown",
        plainTitle: "Protecting the treated tooth",
        when: "In 2 weeks",
        rationale: "Post-endodontic cuspal coverage — mandatory for molars.",
        items: [
          {
            id: "it2",
            teeth: [26],
            finding: "Zirconia crown, 26.",
            plainFinding: "A cap over the treated tooth.",
            ifYouWait:
              "A back tooth that's had a root canal and no cap fractures within a couple of years in most cases. The root canal is then wasted.",
            options: [
              {
                id: "o2",
                name: "Zirconia crown, 26",
                plain: "A cap",
                pricePaise: rs(12000),
                costPaise: rs(4200),
                minutes: 75,
                visits: 2,
                longevity: "12–20 years",
                recommended: true,
                visual: "crown",
              },
            ],
            chosenOptionId: "o2",
            decision: "undecided",
          },
        ],
      },
    ],
    engagement: noEngagement(),
  },

  {
    id: "tp4",
    patientId: "p4",
    patient: "Priya Nair",
    title: "Clear aligners, full correction",
    status: "partial",
    discountPct: 5,
    updated: "15 Jul",
    presentedOn: "12 Jul 2026",
    doctor: "Dr. Patil",
    intro:
      "Your lower front teeth have crowded over the years, which makes them harder to clean and is why that area bleeds. Straightening them is as much a hygiene decision as a cosmetic one.",
    phases: [
      {
        id: "ph1",
        title: "Phase 1 · Records & setup",
        plainTitle: "Planning your movement",
        when: "Now",
        rationale: "Scans, photographs and digital setup before aligner fabrication.",
        items: [
          {
            id: "it1",
            teeth: [],
            finding: "Intraoral scan, extraoral photographs, digital treatment setup.",
            plainFinding: "A scan of your teeth and a digital plan showing how they'll move.",
            ifYouWait: "Nothing can be made until this exists.",
            options: [
              {
                id: "o1",
                name: "Scans, photos & digital setup",
                plain: "Scan and plan",
                pricePaise: rs(12000),
                costPaise: rs(3500),
                minutes: 45,
                visits: 1,
                longevity: "—",
                recommended: true,
                visual: "treat",
              },
            ],
            chosenOptionId: "o1",
            decision: "accepted",
          },
        ],
      },
      {
        id: "ph2",
        title: "Phase 2 · Aligner therapy",
        plainTitle: "Moving the teeth",
        when: "Over 14 months",
        rationale: "Full-arch correction, approximately 28 stages.",
        items: [
          {
            id: "it2",
            teeth: [],
            finding: "Clear aligner therapy, both arches, ~28 stages.",
            plainFinding: "A series of clear trays, each worn about two weeks.",
            ifYouWait: "Crowding tends to worsen slowly with age rather than settle.",
            options: [
              {
                id: "o2",
                name: "Clear aligners — full course",
                plain: "The full aligner course",
                pricePaise: rs(148000),
                costPaise: rs(58000),
                minutes: 240,
                visits: 8,
                longevity: "Permanent with retainers",
                recommended: true,
                visual: "treat",
              },
              {
                id: "o2b",
                name: "Lower-arch-only correction",
                plain: "Straightening just the lower front teeth",
                pricePaise: rs(72000),
                costPaise: rs(28000),
                minutes: 150,
                visits: 5,
                longevity: "Permanent with retainers",
                tradeoff:
                  "Fixes the crowding that's causing the bleeding, but the bite won't be fully corrected.",
                visual: "treat",
              },
            ],
            chosenOptionId: "o2",
            decision: "deferred",
            deferReason: "cost",
          },
          {
            id: "it3",
            teeth: [],
            finding: "Fixed lingual retainers + removable retainers, both arches.",
            plainFinding: "Retainers, so the teeth don't drift back.",
            ifYouWait: "Teeth move back within months without retention. This isn't optional.",
            options: [
              {
                id: "o3",
                name: "Retainers (upper & lower)",
                plain: "Retainers",
                pricePaise: rs(9000),
                costPaise: rs(2600),
                minutes: 45,
                visits: 2,
                longevity: "3–5 years per set",
                recommended: true,
                visual: "treat",
              },
            ],
            chosenOptionId: "o3",
            decision: "deferred",
            deferReason: "cost",
          },
        ],
      },
    ],
    engagement: {
      sentOn: "12 Jul 2026",
      firstOpenedOn: "12 Jul 2026, 10:14pm",
      lastOpenedOn: "14 Jul 2026, 8:03pm",
      opens: 3,
      dwellByPhase: { ph1: 18, ph2: 142 },
      forwarded: false,
    },
  },

  {
    id: "tp5",
    patientId: "p5",
    patient: "Vikram Sathe",
    title: "Root canal & crown, lower right",
    status: "presented",
    discountPct: 0,
    updated: "9 Jul",
    presentedOn: "30 Jun 2026",
    doctor: "Dr. Kulkarni",
    intro:
      "The decay in your lower right molar has reached close to the nerve, which is why it's sensitive to cold. Treating it now is straightforward; leaving it usually isn't.",
    phases: [
      {
        id: "ph1",
        title: "Phase 1 · Root canal & crown",
        plainTitle: "Saving the tooth",
        when: "Now · two visits",
        rationale: "Deep caries approaching pulp, symptomatic to cold.",
        items: [
          {
            id: "it1",
            teeth: [46],
            finding: "Deep caries 46 approaching pulp horn; cold test lingering.",
            plainFinding: "Deep decay in your lower right molar, close enough to the nerve to make it ache with cold drinks.",
            ifYouWait:
              "Once the nerve becomes infected this stops being a planned appointment and becomes an emergency one, usually at an inconvenient hour.",
            options: [
              {
                id: "o1",
                name: "RCT 46 + PFM crown",
                plain: "A root canal and a cap",
                pricePaise: rs(32000),
                costPaise: rs(9500),
                minutes: 150,
                visits: 3,
                longevity: "10–20 years",
                recommended: true,
                visual: "crown",
              },
            ],
            chosenOptionId: "o1",
            decision: "undecided",
          },
        ],
      },
    ],
    engagement: {
      sentOn: "30 Jun 2026",
      firstOpenedOn: "30 Jun 2026, 6:55pm",
      lastOpenedOn: "14 Jul 2026, 10:41pm",
      opens: 5,
      dwellByPhase: { ph1: 240 },
      forwarded: true,
    },
  },

  {
    id: "tp6",
    patientId: "p6",
    patient: "Asha Kulkarni",
    title: "Crown, upper right",
    status: "presented",
    discountPct: 0,
    updated: "20 Jul",
    presentedOn: "5 Jul 2026",
    doctor: "Dr. Meher",
    intro:
      "The old filling in your upper right molar has cracked and the crack has spread into the tooth. A cap holds it together.",
    phases: [
      {
        id: "ph1",
        title: "Phase 1 · Protect the cracked tooth",
        plainTitle: "Protecting the cracked tooth",
        when: "Now · two visits",
        rationale: "Cracked amalgam with cusp-fracture risk.",
        items: [
          {
            id: "it1",
            teeth: [16],
            finding: "Cracked amalgam 16, craze lines onto MB cusp.",
            plainFinding: "A cracked old filling in your upper right molar.",
            ifYouWait:
              "It may hold for a long time, or it may split while you're eating. If it splits below the gumline the tooth usually can't be kept.",
            options: [
              {
                id: "o1",
                name: "Zirconia crown, 16",
                plain: "A cap",
                pricePaise: rs(14500),
                costPaise: rs(5000),
                minutes: 90,
                visits: 2,
                longevity: "12–20 years",
                recommended: true,
                visual: "crown",
              },
            ],
            chosenOptionId: "o1",
            decision: "undecided",
          },
        ],
      },
    ],
    engagement: {
      sentOn: "5 Jul 2026",
      firstOpenedOn: "5 Jul 2026, 9:31pm",
      lastOpenedOn: "5 Jul 2026, 9:33pm",
      opens: 1,
      dwellByPhase: { ph1: 34 },
      forwarded: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Derived values — computed, never stored
// ---------------------------------------------------------------------------

export function chosenOption(item: PlanItem): PlanOption {
  return item.options.find((o) => o.id === item.chosenOptionId) ?? item.options[0];
}

export function itemPricePaise(item: PlanItem): number {
  return chosenOption(item).pricePaise;
}

export function itemCostPaise(item: PlanItem): number {
  return chosenOption(item).costPaise;
}

export function allItems(plan: TreatmentPlan): PlanItem[] {
  return plan.phases.flatMap((ph) => ph.items);
}

export function phaseTotalPaise(phase: PlanPhase, filter?: (i: PlanItem) => boolean): number {
  return phase.items
    .filter((i) => (filter ? filter(i) : true))
    .reduce((s, i) => s + itemPricePaise(i), 0);
}

/** Everything on the plan, before discount. */
export function planGrossPaise(plan: TreatmentPlan): number {
  return allItems(plan).reduce((s, i) => s + itemPricePaise(i), 0);
}

export function discountPaise(plan: TreatmentPlan, subtotal: number): number {
  return Math.round((subtotal * plan.discountPct) / 100);
}

/** What the patient would pay for everything, after discount. */
export function planNetPaise(plan: TreatmentPlan): number {
  const gross = planGrossPaise(plan);
  return gross - discountPaise(plan, gross);
}

/**
 * What they've actually said yes to. Undecided items count as accepted while
 * the plan is still being read — the patient hasn't rejected anything yet, and
 * showing a total of zero on first open would be absurd.
 */
export function planSelectedPaise(plan: TreatmentPlan): number {
  const sub = allItems(plan)
    .filter((i) => i.decision !== "deferred")
    .reduce((s, i) => s + itemPricePaise(i), 0);
  return sub - discountPaise(plan, sub);
}

/** What they've explicitly put off. This is what the recovery worklist is made of. */
export function planDeferredPaise(plan: TreatmentPlan): number {
  return allItems(plan)
    .filter((i) => i.decision === "deferred")
    .reduce((s, i) => s + itemPricePaise(i), 0);
}

/** Owner-only. Fee minus lab and materials, across the selected items. */
export function planMarginPaise(plan: TreatmentPlan): number {
  const sub = allItems(plan).filter((i) => i.decision !== "deferred");
  const revenue = sub.reduce((s, i) => s + itemPricePaise(i), 0) - discountPaise(plan, sub.reduce((s, i) => s + itemPricePaise(i), 0));
  const cost = sub.reduce((s, i) => s + itemCostPaise(i), 0);
  return revenue - cost;
}

export function planVisits(plan: TreatmentPlan): number {
  return allItems(plan)
    .filter((i) => i.decision !== "deferred")
    .reduce((s, i) => s + chosenOption(i).visits, 0);
}

export function planChairMinutes(plan: TreatmentPlan): number {
  return allItems(plan)
    .filter((i) => i.decision !== "deferred")
    .reduce((s, i) => s + chosenOption(i).minutes, 0);
}

/**
 * Status derived from the decisions, not set by hand.
 *
 * "Partly accepted" going *up* over time is a good sign — it means the product
 * is capturing revenue that used to be invisible, not that acceptance is falling.
 */
export function deriveStatus(plan: TreatmentPlan): PlanStatus {
  if (!plan.presentedOn) return "draft";
  const items = allItems(plan);
  const accepted = items.filter((i) => i.decision === "accepted").length;
  const deferred = items.filter((i) => i.decision === "deferred").length;
  if (accepted === 0 && deferred === items.length) return "declined";
  if (accepted === items.length) return "accepted";
  if (accepted > 0 && deferred > 0) return "partial";
  return "presented";
}

/** Which teeth are being treated, and how they should read on the arch. */
export function toothVisuals(plan: TreatmentPlan): Record<number, ToothVisual> {
  const map: Record<number, ToothVisual> = {};
  for (const item of allItems(plan)) {
    if (item.decision === "deferred") continue;
    const visual = chosenOption(item).visual;
    for (const t of item.teeth) map[t] = visual;
  }
  return map;
}

// ---------------------------------------------------------------------------
// Instalments
// ---------------------------------------------------------------------------

export interface EmiOption {
  months: number;
  perMonthPaise: number;
  totalPaise: number;
  note: string;
  tag?: string;
}

/**
 * A ₹1.8L plan refused on price is usually a ₹1.8L *number* refused on price.
 * The same plan at ₹15,400 a month is a different conversation entirely.
 */
export function emiOptions(netPaise: number): EmiOption[] {
  const defs = [
    { months: 6, interest: 0, note: "0% interest", tag: undefined as string | undefined },
    { months: 12, interest: 0, note: "0% interest", tag: "MOST CHOSEN" },
    { months: 24, interest: 0.07, note: "small interest", tag: undefined },
  ];

  return defs.map((d) => {
    const total = Math.round(netPaise * (1 + d.interest));
    // Round the monthly figure up to the nearest ₹100 so it reads cleanly.
    const per = Math.ceil(total / d.months / 10000) * 10000;
    return { months: d.months, perMonthPaise: per, totalPaise: total, note: d.note, tag: d.tag };
  });
}

export function findPlan(id: string): TreatmentPlan | undefined {
  return treatmentPlans.find((p) => p.id === id);
}

/** The plan a given patient is currently being asked to decide on. */
export function planForPatient(patientId: string): TreatmentPlan | undefined {
  return treatmentPlans.find((p) => p.patientId === patientId);
}
