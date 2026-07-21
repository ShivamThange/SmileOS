# Phases 8–10 · first implementation pass

Nothing is committed. Everything below is working-tree changes on `main`.

This pass covers **all ten Quick Wins (§10.1)** and **five of the ten Small Features (§10.2)** — the
ones that make up the front desk's day: S1 Booking Bar, S2 Settle Sheet, S3 Check-in,
S4 resumable chips, S9 Recovery queue.

---

## What changed, and why

### The front door is now role-aware (Q1)

`/app` used to render the owner's financial dashboard. The person who opens the console most is the
receptionist, at 9:15, two hundred and fifty times a year — so `/app` now resolves by role:

| Role | Root |
|---|---|
| receptionist, admin, assistant, lab | **Morning Brief** |
| doctor, owner | **Clinical Day** |
| accountant | the financial dashboard |

The financial dashboard kept every pixel — it moved to `/app/insight` (and `/app/dashboard`), and the
sidebar's "Dashboard" item became "Today". Nothing was deleted.

**Morning Brief** reads top to bottom as a briefing note and every block empties:
the day in one sentence · unconfirmed first (the only block where acting in twenty minutes changes
the outcome) · a running-late lane · an arrivals rail with a **now marker that ticks** and inline
check-in · gaps as opportunity objects with one-tap fill · overnight collapsed to one expandable line.

**Clinical Day**: in-the-chair and next as the two focus cards, notes outstanding surfaced *before*
the day ends, the rest of the book, and three numbers — produced today, case acceptance,
your deferred cases.

Switch personas from the avatar menu in the header. That switcher is demo scaffolding — in
production the role comes from the server's RBAC claim and must not be client-settable.

### Medical alerts are now unmissable (Q5)

`Patient.alert` was free text that each screen split by hand. Now one module owns it
(`src/lib/medical-alert.ts`) and one component renders it in three sizes: `chip` for table rows,
`inline` for cards, `banner` for the drawer. Allergies outrank conditions and set the danger tone;
conditions get the warning tone. Full text always available via `title` and `aria-label`.

Surfaced on: patient rows, the preview drawer, palette results, booking bar, check-in rows, the
arrivals rail, the clinical day list, recovery cards.

### The Booking Bar (S1)

`⌘K → "book"`, the **Book** button in the shell, or Create → New appointment. It is an overlay,
never a route.

- **It never asks whether the patient is new.** Type the phone number: a match binds the patient
  silently and shows their history; a miss reveals three fields in place. Same flow, different
  amount pre-filled.
- **Requests are sentences.** `RCT anytime after 6 next week`, `cleaning tuesday morning Dr Rohan`.
  Parsed for procedure, duration, doctor, weekday and time window; what it understood is shown as
  chips so it can be corrected.
- **Three offers as sentences**, not a grid — `Tue 28 · 6:30pm · Dr. Kulkarni · Chair 2`. Arrow
  keys, Enter, done.
- **Duration is inferred** from the procedure catalogue (Q9). Nobody does arithmetic on the phone.
- A ghost preview shows what sits either side of the proposed slot.
- Esc parks the draft rather than binning it.

### The Settle Sheet (S2)

Opens from the preview drawer, a check-in row, the arrivals rail, or `⌘K → "pay"`. A drawer, not a
route. Split tenders in one submission, family/account grouping (surname heuristic standing in for a
real account object), a UPI payload with the amount pre-filled, WhatsApp receipt, and a park button.

### Check-in is a transaction, not a boolean (S3)

Rows carry **pre-arrival state** — dues, stale medical history, unsigned consent, lab not back —
*before* the patient reaches the desk, which is the only moment those are cheap to fix. Tapping
check-in expands a confirmation strip inline (never a modal); every item is one tap and skippable,
and Enter checks them in regardless. Four lanes: running late, in the clinic (with a ticking
waiting-time counter), arriving now (with early-arrival pull-forward), later today.

### Resumable task chips (S4)

Park any booking or settlement as a chip bottom-left; several coexist; each reopens with state
intact. Small in code, and the single most valuable thing here for someone interrupted every ninety
seconds.

### Recovery is a finite queue (S9)

Eight calls, scored by recoverability rather than recency:
value × clinical urgency × contact recency × the patient's own responsiveness × **plan engagement**.
Each card carries the reason it's near the top, the clinical finding, what the patient actually said,
and a **pre-written editable message** — someone who opened the plan three times and never replied
gets a different first sentence from someone who never opened it. Outcomes are one tap; "Not now"
suppresses for six months rather than deleting. The queue empties, and the week's recovered total is
visible. The old infinite table survives behind the **Everything** lens for Friday reconciliation.

### Command palette does verbs now (Q2)

`book · take a payment · send a WhatsApp · open a record · register a patient · work the recovery
queue`. Verbs that need a person ask "which patient?" as a second step instead of making you find
the patient first. Full arrow-key traversal across all three result groups.

### WhatsApp everywhere (Q10)

`src/lib/whatsapp.ts` — `wa.me` and `tel:` helpers plus message drafts. `PhoneLink` renders a number
with call and WhatsApp affordances that appear on hover. Applied to the patient list, preview
drawer, brief, check-in, recovery.

### Motion, empty states, skeletons, focus (Q3, Q6, Q7, Q8)

- Four spring easings in `tokens.css`, applied to exactly four things: drawer entry, toast, row state
  change, palette/popover open. Plus a `prefers-reduced-motion` block that kills all of it.
- `DataTable.empty` now takes `cta`/`onCta`; the patients list ends in "Book them in".
- `PatientSurfaceSkeleton` replaces the grey "Loading…" on `/plan`, `/portal`, `/calculator`.
- Skip link, focusable + Enter-activatable table rows, focus tint on rows, ARIA table roles.

---

## New files

```
src/config/procedures.ts              procedure catalogue — duration, fee, fuzzy matching
src/lib/schedule.ts                   free-time maths, gap finding, sentence → slots
src/lib/medical-alert.ts              alert parsing and severity
src/lib/whatsapp.ts                   wa.me / tel: links and message drafts
src/hooks/use-session.ts              who's signed in → which root screen
src/hooks/use-desk-store.ts           booking draft, settle draft, parked tasks
src/hooks/use-clinic-now.ts           the ticking clinic clock
src/components/common/medical-alert-badge.tsx
src/components/common/phone-link.tsx
src/components/common/skeleton.tsx
src/components/desk/booking-bar.tsx
src/components/desk/settle-sheet.tsx
src/components/desk/parked-tasks.tsx
src/features/dashboard/app-root.tsx
src/features/dashboard/morning-brief-screen.tsx
src/features/dashboard/clinical-day-screen.tsx
src/features/revenue/recovery-queue.ts
```

Rewritten: `command-palette.tsx`, `console-layout.tsx`, `checkin-screen.tsx`, `recovery-screen.tsx`.
Edited: `router.tsx`, `nav.ts`, `tokens.css`, `tailwind.config.js`, `icon.tsx`, `data-table.tsx`,
`patient-preview-drawer.tsx`, `patients-list-screen.tsx`.

---

## Things you should know before trusting this

**None of it has been compiled.** The sandbox that would run `npm run build` failed to start this
session, so every file here was written and reviewed by reading, not by typechecking. Run:

```
npm install
npm run build     # tsc -b && vite build
npm run dev
```

and send me whatever it says. `tsconfig.app.json` has `noUnusedLocals: false`, so stray imports
won't fail the build, but genuine type errors will.

**Deliberate stubs**, each marked in the code:

- **The UPI QR is a placeholder.** The payload (`upi://pay?...`) is real, correct and tappable — the
  visual tile is not a scannable code, because shipping something that *looks* scannable and isn't
  is worse in a clinic than shipping nothing. Add a QR encoder and swap the tile.
- **Engagement data is derived from row ids**, deterministically. `planViews`, `everReplied`,
  `daysSinceContact` in the recovery queue and `historyMonths` at check-in have no backing model
  yet. Stable across reloads on purpose — a queue that reshuffles itself is a queue nobody trusts.
- **The forward book is generated** from a seeded PRNG (`dayBook()` in `schedule.ts`). Day 0 is the
  real mock data; future days are synthetic so the booking bar has something to offer. When the API
  lands, only `dayBook()` changes — everything above it is already right.
- **Case acceptance is hardcoded at 61%** on the clinical day screen. Plans don't carry accept/defer
  state until M1/M2.
- **The role switcher is demo scaffolding.** Remove it when real auth lands.

**Not attempted this pass** (§10.2 onward): S5 unified inbox, S6 message suppression, S7 family
accounts as a real model, S8 day-book/reconciliation, S10 lab↔appointment binding, and all of §10.3+.
S6 is the one I'd do next regardless of order — a suppression layer is painful to retrofit, and the
recovery and recall engines are already both sending.

---

---
---

# Second pass · Weeks 7–12 — the money

**M1 plan builder, M2 plan presenter, M6 leak report.** Still nothing committed.

## The plan is now a proposal with structure

The old model was a flat list of stages, each a list of priced lines, with one status on the plan.
That shape cannot express what actually happens in a consulting room — the patient takes the root
canal and defers the two crowns — and the deferred items *are* the recovery worklist, so throwing
them away means reconstructing them later by hand.

Three structural changes in `plans-data.ts`:

| | |
|---|---|
| **Phases** | Clinical sequencing as a first-class object, reorderable. ₹1.8L presented as ₹1.8L gets "let me think about it"; presented as three phases three months apart it gets accepted. |
| **Alternatives** | `PlanOption` — implant vs bridge vs denture, three prices, trade-offs stated plainly, and the **patient** chooses. Almost no PMS models this. |
| **Per-item decisions** | Every line carries `decision` and, when deferred, the reason the patient gave. Plan status is now *derived* from the decisions rather than set by hand. |

Plus `PlanEngagement` — opens, first/last read, dwell per phase, forwarded.

All money is derived, never stored: `planGrossPaise`, `planSelectedPaise`, `planDeferredPaise`,
`planMarginPaise`, `emiOptions`, `deriveStatus`, `toothVisuals`.

State lives in `use-plans-store.ts` so the builder and the presenter are two views of one object —
when the patient unticks a crown, the console knows.

## M1 — the builder

Two columns, and the ratio is now right: this screen is where the practice's most commercially
important document gets assembled, and it used to be a third the size of the screen that displays it.

**Left:** the arch, with findings already carried over — select teeth, then add a procedure from the
clinic's catalogue to any phase. You never re-select teeth you already examined. Below it,
**what the patient did with the link**: opens, dwell per phase as bars, forwarded, and a plain-language
read of what that means ("opened four times and forwarded, longest on Phase 2 — somebody who reads a
plan this often and hasn't replied is stuck on something specific").

**Right:** phases as a reorderable stack. Each item expands to the three pieces of prose the presenter
needs (clinical finding / in plain language / what happens if this waits) and the list of ways to do
it, where you set the recommended one and add alternatives. Live totals at the bottom with a discount
stepper, visit and chair-time counts, an EMI line — and a **margin indicator visible only to the
owner**, because an associate seeing lab margins on every plan changes how they treatment-plan, and
not for the better.

## M2 — the presenter

Kept the existing warm editorial voice — it was the best thing in the repo — and rebuilt underneath it.

- **Opens on why, not what.** The dentist's own paragraph, then the mouth, then one plain sentence per
  finding, then money. The order is the argument.
- **Per-item accept/defer.** A tick beside every line; the arch pales, the phase subtotal drops, the
  sticky footer updates. Unticking asks — gently, skippably — *why*, and that answer is worth more to
  the clinic than any amount of front-desk guesswork.
- **Alternatives the patient picks.** Trade-offs written plainly: "cheaper, but the two healthy teeth
  beside the gap have to be trimmed down permanently."
- **"If this waits"** per item, written conservatively. Information, not a threat — that boundary is
  deliberate and should stay.
- **EMI as one toggle** on the same total.
- **WhatsApp with the plan reference pre-filled**, and a share button for the spouse — because it will
  be forwarded either way, so we may as well know.
- Opens and dwell are recorded back to the store.

## M6 — the leak report

`/app/insight/leak`, linked from the dashboard's money-at-risk panel. One figure, four components:
diagnosed-never-scheduled, idle chair time, appointments not kept, money never collected. Each card
states what it is, **why it happens** (honestly — no-shows are a reminder problem, not a respect
problem), a conservative recoverable share, and a button to the screen that fixes it.

Figures are computed from the actual book: idle hours come from `dayBook()` against chairs and
opening hours, valued at this clinic's own revenue-per-chair-hour rather than an industry average.

## New and changed this pass

```
NEW  src/features/treatment-plan/use-plans-store.ts
NEW  src/features/insight/leak-report-screen.tsx
REW  src/features/treatment-plan/plans-data.ts          (new model + seed)
REW  src/features/treatment-plan/plan-builder-screen.tsx
REW  src/features/treatment-plan/treatment-plan-screen.tsx
REW  src/features/treatment-plan/plans-list-screen.tsx  (decided + engagement columns)
EDIT src/app/router.tsx, src/features/dashboard/dashboard-screen.tsx
```

## Stubs and assumptions in this pass

- **Lab cost is estimated at 34% of fee** for anything added from the procedure catalogue
  (`ASSUMED_COST_RATIO`). Seeded plan items carry hand-written costs. The margin figure is only as
  good as that number.
- **Monthly leak figures extrapolate from one day's book** across 26 working days. Directional, not
  audited — stated on the screen itself. The event log will make them real.
- **Recoverable shares (35/30/50/60%) are assumptions**, not forecasts. Also stated on screen.
- **Dwell tracking is wall-clock while a phase is expanded** — crude, and it can't tell reading from
  a phone left face-up on a table. Good enough to rank phases against each other, not good enough to
  quote in seconds to a patient.
- **Case acceptance on the clinical day screen is still hardcoded at 61%.** It could now be computed
  from `deriveStatus` across plans — worth doing, small job.
- **Phase reordering is buttons, not drag.** Deliberate: drag needs a dependency or a lot of pointer
  code, and up/down is faster with three phases anyway.

Still not compiled — same caveat as the first pass. `npm run build` and send me the output.

---
---

# Third pass · Weeks 13–20 — the chair

**S6 suppression, L1 versioned charting, F1 dictated charting, L2 findings → plan.** Still nothing
committed. This is the flagship block: F1 and the L1/L2 either side of it are the differentiator the
Phase 9 analysis identified as the seam no incumbent can rebuild without breaking their installed base.

## S6 — the suppression layer (done first, deliberately)

Three engines can now message the same patient on the same day, and each of them is right to on its
own terms. `src/lib/messaging.ts` holds the rules; `use-message-log.ts` holds the single log they all
check against — the moment recalls keep their own log, "one message a day" quietly becomes "one a day
per engine".

Message kinds are tiered. **Transactional** (reply, receipt, confirmation) is never suppressed — a
receipt that doesn't arrive is a support call. **Time-critical** (reminder, running-late) passes the
upcoming-appointment rule. Everything else is suppressible.

The rules: one message per patient per day across all channels · nothing within 48h of an appointment
(have it at the desk instead) · no marketing to someone already being chased for money · no recall
while a plan conversation is open · quiet hours 8am–9pm · a "third approach this week" warning.

`<SendGuard>` makes it visible rather than silent — a held message says exactly why, in a sentence a
receptionist would say out loud, and offers an override. **The override is deliberate.** A rule with
no way through gets worked around with a personal phone, and then the clinic has no record at all.

## L1 — charts are versions

`chart-data.ts` stores every chart rather than overwriting one. Ramesh has four across three years,
and the arc is the ordinary one: a small cavity that got bigger, a tooth saved, a tooth lost, and the
consequences arriving in the teeth either side.

`diffCharts()` computes what changed between any two — in clinical language for the dentist, plain
language for the patient. `ChartScrubber` is the slider: drag it, or press play and watch the arch
morph. It never loops, because a looping animation of someone's dental decay would be a strange thing
to build.

Two tones. **Clinical** uses the full odontogram, surfaces and all. **Patient** uses the friendlier
arch and plain sentences — a five-surface caries map is frightening without being informative to
someone who isn't a dentist. The patient version is now on the portal, which is the one thing on that
page worth coming back for.

## F1 — dictated charting

`src/lib/chart-dictation.ts` is the grammar. What makes this tractable rather than a general speech
problem is that the vocabulary is closed: ~32 tooth identifiers, 5 surfaces, ~12 conditions. The
parser is forgiving on purpose — a dentist mid-examination says "sixteen, uh, MOD amalgam" and "one
six occlusal decay" in the same breath, and an interface that rejects either gets abandoned inside a
week.

It handles `"one six"` / `"sixteen"` / `"16"` / `"tooth 16"`, MOD/MO/DO abbreviations, restoration
materials mapping to *filled*, and "sound / healthy / normal" clearing a tooth. A surface condition
with no surface named defaults to occlusal, which is where most unqualified findings actually are.

`charting-screen.tsx` (`/app/clinical/chart/:patientId`) puts it together: mic on the left of the
panel, arch filling in live, newly-set teeth highlighting for about a second so the assistant can
catch errors as they happen, and a transcript beside it where any line can be removed.

**Every fallback the Phase 8 analysis asked for exists.** The same parser backs a typed input (also
the demo path, since browser speech is unreliable). Full tap-to-chart works throughout with a
condition palette. There's a bulk mode for a practice migrating three thousand paper records. And
crucially, *manual clicks produce the same kind of segment as speech* — so the transcript is a single
log of everything done in a sitting, undo works identically for both, and the assistant has one place
to look for errors instead of hunting the arch.

## L2 — findings propose the plan

`findings-to-plan.ts` maps a chart to a priced, sequenced draft. Caries on 1–2 surfaces → composite;
3+ → crown, with root-canal-and-crown and extraction offered alongside. Missing tooth (not a third
molar) → implant / bridge / denture, three prices, trade-offs written out. Root-treated and
unprotected → crown. Cracked restoration → crown or onlay. Worn anteriors → a guard. Hygiene is
inserted first whenever there's restorative work, because restorations on inflamed tissue fail early.

Three rules govern it and they matter more than the mapping:

1. **It proposes; it never decides.** Everything is a draft the dentist edits.
2. **Where more than one answer is defensible, it offers all of them** rather than picking.
3. **The "if you wait" prose is conservative by construction.** These are clinic-level templates, and
   the feature is only ethical if they stay descriptive rather than becoming a sales lever.

"Propose a plan →" on the charting screen produces the draft and drops you into the M1 builder. The
gap between *I have examined this mouth* and *the patient has a priced plan in their hand* is now one
button.

## New and changed this pass

```
NEW  src/lib/messaging.ts                        suppression rules
NEW  src/hooks/use-message-log.ts                the single outbound log
NEW  src/components/common/send-guard.tsx        suppression, made visible
NEW  src/lib/chart-dictation.ts                  the tooth-notation grammar
NEW  src/features/clinical/chart-data.ts         versioned charts + diffing
NEW  src/features/clinical/use-charts-store.ts   append-only chart store
NEW  src/features/clinical/chart-scrubber.tsx    the time scrubber
NEW  src/features/clinical/charting-screen.tsx   chairside charting
NEW  src/features/clinical/findings-to-plan.ts   the proposal engine
EDIT router · command palette (chart verb) · patient preview drawer ·
     clinical queue · recovery screen (SendGuard) · portal home (scrubber) ·
     use-plans-store (addPlan)
```

## Stubs and assumptions in this pass

- **Browser speech recognition is `webkitSpeechRecognition`** — Chrome and Edge only, and it needs a
  network round trip. Accents outside its training set will transcribe badly, which is exactly why
  the typed path is a first-class citizen rather than a fallback. A production build should use a
  server-side model fine-tuned on the closed vocabulary; the parser doesn't care where text comes from.
- **The grammar is English-only.** A Pune practice will code-switch mid-sentence. Worth testing before
  claiming this works in the room.
- **Third molars are excluded from replacement proposals**, and pulpal involvement is offered as an
  alternative rather than assumed. Both are defensible defaults, neither is a clinical rule the
  software should be enforcing — a dentist should be able to configure this.
- **The night guard price is hardcoded at ₹6,500** because there's no catalogue entry for it yet.
- **Lab cost is still estimated at 34% of fee** for generated options.
- **Suppression is client-side only.** It stops honest mistakes; it does not stop a misbehaving
  integration. The same check has to exist on the server.
- **The `check()` selector pattern matters** — `useMessageLog((s) => s.check(...))` would hand React a
  fresh object every render and loop `useSyncExternalStore`. Select the function, then call it. There's
  a comment on it, but it's an easy thing to reintroduce.

Still not compiled. `npm install && npm run build` and send me the output — this pass touches types in
several directions at once and I'd expect `tsc` to have opinions.

---
---

# Fourth pass · the UI block

**M3 calendar, M5 analytics, M9 templating.** Still nothing committed. This pass is about the three
biggest surfaces that were rendering correctly and doing nothing when you touched them.

## M3 — the calendar actually responds now

The old grid drew the day beautifully and answered every interaction with a toast describing what
would happen in a real product. This one does the things.

- **Drag on empty space to create.** The block you draw is *held* — the booking bar opens with it
  pinned at the top and preselected, tagged `HELD`. The calendar and the booking bar are one flow,
  not two features, and she shouldn't have to describe back to the system the thing she just drew.
  (`HeldSlot` on `BookingDraft` carries it.)
- **Drag a block to move it**, across times *and* across chairs. **Drag its bottom edge to resize.**
  Both snap to fifteen minutes.
- **Conflicts refuse while you're still holding the mouse.** The ghost turns red and names the
  problem — "Overlaps Rohit Deshpande", "Runs across lunch". Being told it doesn't fit *after* you
  let go is being told too late.
- **Density control** — compact / normal / roomy. A four-chair practice at full tilt needs the whole
  day at once; a quiet Tuesday wants detail. One control, one number.
- **Gaps drawn as objects**, not as absence: a dashed block sitting in the hole saying "45 min free ·
  FILL". Column headers show free time per chair, and the rail totals what today's unsold hours are
  worth at this practice's own rate.
- Now-line ticks off the real clock; blocks carry a medical-alert dot; the drawer opens the real
  preview drawer and settle sheet rather than toasting.

One implementation note worth keeping: **the drop handler's side effects live outside the state
updater.** React may invoke an updater twice, and double-booking someone because of StrictMode is
exactly the class of bug this product cannot have.

## M5 — analytics as narrative

Five sentences at the top, generated from the data, each expandable for its provenance and each
ending in a button that goes to the screen that fixes it. A number with no next step changes nothing.

Below them, the three views that actually change decisions:

- **Chair utilisation heatmap** — weekday × hour, darker is busier, empty cells read amber so they
  draw the eye. The shape is the point: an owner reads it in two seconds and knows where to put a
  hygienist. Tuesday afternoons show up as the dead patch, and the panel offers to run a targeted
  recall at that window.
- **Per doctor** — production, visits, acceptance, rework. **An associate sees only their own row.**
  Associates who can see their own numbers behave differently and revenue-share settlements stop
  being contentious; associates who can see everyone's numbers start comparing, which is worse.
- **Cohort retention** — of patients first seen each quarter, how many are still active at 3/6/9/12/18
  months. No practice owner has seen this for their own clinic, and it's the difference between "we
  need more advertising" and "we need a recall system", which cost very different amounts.

The old report-picker frame is gone rather than kept — it answered questions nobody asked.

## M9 — templating, and it's wired through

`templates-data.ts` holds nineteen shipped defaults across three groups: **messages** (what goes out),
**clinical prose** (the "if this waits" text under each plan item), **consent & post-op** (documents).

The editor is in Settings → Templates: template list, source on the left, **live preview on the
right** rendered as the thing it will actually be — a WhatsApp bubble, a plan callout, a printed
document. Variables insert at the cursor from a chip row, because typing braces from memory is how
you end up with `{nmae}` in four hundred messages. Unknown tokens are flagged, character count warns
at WhatsApp's 1024 limit, and Meta-approved templates carry a badge saying edits need re-approval.

Two design decisions worth defending:

- **Only overrides are stored**, keyed by id. Reset is a delete, not a copy — so a future improvement
  to the shipped prose reaches every clinic that hasn't deliberately overridden it.
- **It's wired through.** `lib/whatsapp.ts` and `recovery-queue.ts` now render from the store via
  `renderById()`. Editing the recovery wording in Settings changes what actually goes out of the
  recovery queue. A settings screen that only changes what the settings screen shows is theatre.

Group-level guidance sits next to the writing rather than in a design doc — the clinical group says
plainly that "if this waits" is an ethics boundary and not a place for urgency.

## New and changed this pass

```
NEW  src/features/insight/narrative.ts             sentences, heatmap, cohorts, doctors
NEW  src/features/settings/templates-data.ts       19 defaults + render/validate
NEW  src/features/settings/use-templates-store.ts  overrides + renderById()
NEW  src/features/settings/template-editor.tsx     editor with live preview
REW  src/features/appointments/calendar-screen.tsx
REW  src/features/insight/analytics-screen.tsx
EDIT use-desk-store (HeldSlot) · booking-bar (pinned held slot) · settings-screen ·
     whatsapp.ts (drafts now render from templates) · recovery-queue.ts ·
     morning-brief · checkin · settle-sheet (draft call sites)
```

## Stubs and assumptions in this pass

- **The heatmap, cohorts and rework percentages are shaped, not measured.** They're deterministic and
  plausible — evening peaks, a Tuesday-afternoon dead patch, Saturday busy from open — because the
  mock data is a single day. The *layout* is the deliverable here; the numbers arrive with the API.
- **Doctor production extrapolates one day × 22.** Directional only.
- **Only day and list views exist.** The 3-day and week buttons are gone rather than faked. Adding
  them is mostly re-parameterising the column set, but it's real work and I'd rather not claim it.
- **Drag is pointer-events only** — it will work on a tablet, but there's no long-press-to-drag
  affordance and no haptic feedback, and a chairside tablet deserves both.
- **`draftConfirmation` and friends changed signature** to named args (`{name, date, time, doctor,
  clinic}`) so they can map onto template variables. Four call sites updated.
- **Consent wording needs a lawyer.** The shipped default is a plausible skeleton and says so in the
  editor. Do not ship it as-is.

Still not compiled. Same ask: `npm install && npm run build`.

## Routing audit

Every `navigate()`, `<Link to>` and nav entry in the app was checked against the router. No dead
links — but the audit found three things that "no 404s" was hiding, all now fixed.

**1. The Insight screen was orphaned.** `/app/insight` rendered the old financial dashboard while the
rebuilt narrative screen sat at `/app/analytics`, which nothing in the nav or palette pointed to. So
the whole M5 pass was unreachable by clicking. Now:

| Route | Screen |
|---|---|
| `/app/insight` | Narrative — five sentences, heatmap, doctors, cohorts |
| `/app/insight/dashboard` | The financial dashboard and charts |
| `/app/insight/leak` | The leak report |
| `/app/analytics`, `/app/dashboard` | Redirect to the above, so old bookmarks still land |

**2. Settings sections weren't linkable.** `settings/*` matched the route and then ignored it — every
tab was component state, so `/app/settings/templates` opened the profile tab. A route that matches
and is then ignored is worse than one that doesn't exist, because links and bookmarks go quietly
wrong. The section is now `settings/:section`, and the palette can deep-link to Templates and Fees.

**3. Unmatched paths redirected silently.** `path: "*"` bounced everything to `/app`, so a typo or a
stale bookmark dumped you on the brief with no explanation, which reads as the product having lost
your page. There's a real 404 now (`not-found-screen.tsx`) that shows the path you asked for, opens
the command palette, and says plainly that an in-app link landing here is a bug worth reporting.

Two aliases kept deliberately: `/app/appointments` → calendar, and `/plan` with no id → the seeded
plan. Both are harmless and both are things people type.

## Suggested next block

Weeks 21–28, the business — and this is the phase most teams skip and then die of:
**M7 offline tolerance** (the clinic's internet will fail mid-procedure, and in India that's table
stakes rather than an edge case), **M8 onboarding and migration** (bulk chart entry already exists;
the patient importer doesn't), and **L4 multi-branch**. M9 is done.

On the UI side specifically, the two gaps I'd close next:

- **`findings-to-plan.ts` still hardcodes its prose.** The template store now exists and the clinical
  group already has the four "if this waits" texts in it — the proposal engine should read them via
  `renderById()` rather than carrying its own copies. Small job, closes the loop properly.
- **Week and 3-day calendar views.** Mostly re-parameterising the column set to be days rather than
  chairs, but the drag maths needs a second axis and that's where the actual work is.
