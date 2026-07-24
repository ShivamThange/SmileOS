# SmileOS — Production Enhancement Proposal (10 Features)

**Status:** Proposal for discussion — *nothing here is built yet.*
**Branch:** `claude/production-enhancements-10-features-f16l0e`
**Author:** Claude (Opus 4.8), for @kartikgaikwad
**Date:** 24 Jul 2026
**Constraint:** No deployment/infra changes. Everything below runs on the *existing* stack (React 18 + Vite + TanStack Query + Zustand + Tailwind token system on the front; Node/Express + Mongoose + Redis/BullMQ on the back). No new services, no new hosting, no migration downtime.

> **How to read this.** Ten features: **8 UI + 2 backend**. Each is a vertical slice grounded in files that already exist in this repo. Every feature carries **Why (with the research/impact behind it)**, **Scope (concrete FE/BE work against real paths)**, **Done when**, and an **Impact / effort** score. Read the "Why we chose these" section first — it explains the selection logic — then the two backend features (because two UI features depend on them), then the UI features. A **build order** and **discussion questions** close the doc.

---

## 0 · Why these ten, and the evidence behind them

I surveyed the 2026 dental-PMS landscape (Curve Dental, CareStack, Adit, Dental Intelligence, Solutionreach) and cross-referenced it against what SmileOS *already* does well versus where a production practice would feel friction. Three findings shaped the list:

1. **No-shows are the #1 controllable revenue leak.** Industry no-show rates run **10–20%**; a single empty chair-hour at a typical Indian metro practice is ₹1,500–₹6,000 of lost production. Every leading 2026 platform now ships *predictive* confirmation/overbooking — SmileOS confirms appointments but does not yet *rank* which unconfirmed ones will actually ghost. That is the highest-ROI backend gap. → **B1**.
2. **Embedded analytics is the 2026 differentiator.** The market has moved decisively from "export to a spreadsheet" to *embedded, benchmarked, at-a-glance* practice-health scoring (Dental Intelligence is a whole company built on this). SmileOS has a solid `reports.service.ts` aggregation layer but no single "how healthy is my practice right now, versus last month, versus benchmark" surface. → **B2 + U2**.
3. **The console is used 250 mornings a year by the same hands.** For a tool used that heavily, the compounding wins are *speed and comfort*: dark mode for evening clinics, keyboard-first global search, drag-to-reschedule, saved table views, a unified patient timeline, and a genuine accessibility pass. None of these need new infrastructure; all of them are felt on day one. → **U1, U3–U8**.

Two UI features (**U2 Scorecard**, **U3 No-show cockpit**) are the visible half of the two backend features, so the backend work is never speculative — it ships with a screen that consumes it.

---

## 1 · Backend features (2)

### B1 — No-show risk engine + smart confirmation targeting

**Why.** No-shows are the single largest controllable leak in a dental practice (10–20% industry baseline). The morning brief already surfaces "unconfirmed first," but it treats every unconfirmed appointment as equally risky. It is not: a first-time emergency booked online for 6pm on a rainy Tuesday behaves nothing like a 10-year recall patient who always confirms. Ranking risk lets the front desk spend its limited confirmation effort where a call actually changes the outcome — and enables *intelligent* overbooking of high-risk slots instead of blind double-booking.

**Approach — transparent scoring, not a black box.** No ML infra (that would be a deployment change). A deterministic, explainable scoring service that combines signals already present in Mongo:

| Signal | Source | Weight rationale |
|---|---|---|
| Historical no-show rate for the patient | `AppointmentModel` (past `no_show` / total) | Strongest single predictor |
| Lead time (booking → appointment) | `appointment.createdAt` vs `startAt` | Long lead time → higher risk |
| Confirmation state | `appointment.status` | `scheduled` unconfirmed > `confirmed` |
| Appointment type & source | `appointmentType`, `source` | `online`/`walk_in` new patients riskier than `recall` |
| Time-of-day / day-of-week | `startAt` | Late-evening & Monday slots historically ghost more |
| Outstanding dues | `InvoiceModel` overdue for patient | Financial avoidance correlates with no-show |
| Prior responsiveness | existing recovery "responsiveness" heuristic in `recovery-queue.ts` | Reuse, don't reinvent |

Each appointment gets a `riskScore` (0–100), a `riskBand` (`low`/`medium`/`high`), and a `reasons[]` array (the human-readable "why it's near the top", mirroring the pattern already used by the recovery queue). **Every score is explainable** — the desk sees *why*, which is what makes staff trust it.

**Scope.**
- **BE** — new `server/src/modules/appointment/risk.service.ts` (pure, testable, no HTTP — matches the layered rule in `backend-spec.md` §0). Exposes `scoreAppointments(clinicId, range)`.
- **BE** — enrich `GET /appointments` (and the day/brief queries) with `risk` on each appointment, behind a query flag so existing consumers are untouched.
- **BE** — `GET /appointments/risk-queue?date=` → the confirmation worklist: high/medium unconfirmed appointments, scored and sorted, each with a pre-written confirmation message (reuse `whatsapp.service.ts` / templates).
- **BE** — `POST /appointments/:id/confirm-outreach` records a confirmation attempt (audit event, per the "every write is an event" rule).
- No new collection — scores are computed on read and cached in Redis for the day (reuses existing `config/redis.ts`).

**Done when.** `GET /appointments/risk-queue?date=today` returns real, sorted, reason-annotated appointments from seeded data; scores are stable and explainable; a confirmation attempt writes an audit entry; existing `/appointments` responses are byte-identical unless the flag is passed.

**Impact: High (direct revenue protection) · Effort: Medium**

---

### B2 — Practice Health Scorecard service (embedded, benchmarked KPIs)

**Why.** The 2026 research is unanimous: analytics must be *embedded and comparative*, not exported. SmileOS can already aggregate revenue/appointments/plans (`analytics/reports.service.ts`) but has no single endpoint answering "is the practice healthy, and is it trending up or down?" That is the question an owner asks every morning and the reason platforms like Dental Intelligence exist.

**Approach.** A `scorecard.service.ts` that computes the canonical dental KPIs over a date range with previous-period comparison (the `reports.service.ts` `Range`/`comparison` contract already exists — extend it, don't fork it):

- **Production** (invoiced) and **Collections** (paid), plus **collection rate** %.
- **Case acceptance rate** — accepted plan value ÷ presented plan value (`TreatmentPlanItemModel`).
- **Chair / doctor utilization** — booked minutes ÷ available minutes.
- **New patients** vs **reactivated** (recall-sourced) vs **churn signal**.
- **No-show / cancellation rate** (feeds off B1's data).
- **Outstanding A/R** and **A/R aging buckets** (0–30 / 31–60 / 60+).
- **Recall effectiveness** — recalls sent ÷ booked.

Each KPI returns `{ value, previous, deltaPct, trend[], band }` where `band` is `good/watch/poor` against a **configurable benchmark** (stored on `clinicConfig`, not hard-coded — a solo practice and a 6-chair DSO have different targets).

**Scope.**
- **BE** — `server/src/modules/analytics/scorecard.service.ts` (pure/testable) + `GET /analytics/scorecard?from&to&compare`.
- **BE** — benchmark defaults added to clinic config with per-KPI override.
- Reuses existing models and aggregation idioms; **no new collection, no new job**.

**Done when.** `GET /analytics/scorecard` returns all KPIs with real values, previous-period deltas, and trend arrays from seeded data; each carries a benchmark band; the response is a stable, documented contract that **U2** renders directly.

**Impact: High (owner decision-making) · Effort: Medium**

---

## 2 · UI features (8)

### U1 — Dark mode + full theming pass

**Why.** Dental consoles run into the evening under bright operatory lights; a light-only UI is fatiguing and reads as dated in 2026. The groundwork is *already done*: `src/design/tokens.css` is a pure CSS-variable system with a clean "brand-replaceable vs semantic-fixed" split. Dark mode is therefore a **token addition, not a refactor** — the highest impact-to-risk ratio on this list.

**Scope.**
- Add a `:root[data-theme="dark"]` block in `tokens.css` re-mapping structural + semantic vars (keep clinical-status hues legible — allergy red must stay unmistakable in dark).
- Theme store in `use-ui-store.ts`: `light | dark | system`, persisted to `localStorage`, `prefers-color-scheme` default, `data-theme` stamped on `<html>` at boot (`app-boot.tsx`).
- Toggle in the header/avatar menu; respect the existing `prefers-reduced-motion` discipline.
- Audit the ~30 common components for any hard-coded hex that dodges the tokens.

**Done when.** Toggling gives a fully legible dark console across every screen incl. odontogram, charts, drawers, toasts; refresh persists; system mode tracks OS; no contrast regressions (WCAG AA).

**Impact: High (daily comfort, perceived quality) · Effort: Medium**

---

### U2 — Practice Health Scorecard dashboard *(consumes B2)*

**Why.** The visible half of B2 — the embedded, benchmarked analytics surface the 2026 market treats as table stakes. Lands at `/app/insight` as the narrative front door owners already expect.

**Scope.**
- New `src/features/insight/scorecard-screen.tsx` rendering B2's payload as KPI tiles: big number, delta pill (▲/▼ vs previous), inline sparkline, benchmark band color.
- Charts built per the **`dataviz` skill** (one visual system, light+dark aware, accessible) — reuse existing `stat-card.tsx` / `meter.tsx`.
- Range switcher (7/30/90 days, MTD, custom) + compare toggle wired to B2 query params via a new `queries.ts` hook.
- Drill-through: each tile links to the existing detailed report.

**Done when.** Scorecard renders real KPIs with deltas, sparklines, benchmark bands; range/compare switching refetches; works in light + dark; degrades to skeletons then empty states.

**Impact: High · Effort: Medium**

---

### U3 — No-show cockpit + Confirmation Blitz *(consumes B1)*

**Why.** The visible half of B1 — turns risk scores into a *batchable action* the desk runs each morning: the moment where twenty minutes of targeted outreach actually saves chairs.

**Scope.**
- Risk badges (`low/med/high` chips) on the morning brief's unconfirmed lane, the calendar, and check-in rows — reusing the `status-badge` / `medical-alert-badge` chip patterns.
- New "Confirmation Blitz" panel: the risk-sorted worklist from `GET /appointments/risk-queue`, each row showing the *reason* it's high-risk + a pre-written editable WhatsApp/SMS message (reuse `whatsapp.ts` + `send-guard.tsx`), one-tap send, outcome capture.
- Overbooking hint: high-risk slots surface a subtle "safe to double-book" affordance in the calendar.

**Done when.** Brief/calendar show risk bands; the blitz panel lists real high-risk unconfirmed appts with reasons + drafts; sending records an outreach attempt; the list shrinks as confirmations land.

**Impact: High (revenue) · Effort: Medium**

---

### U4 — Command palette → true global search

**Why.** `command-palette.tsx` today does *verbs* (book, take payment…) — excellent, but a receptionist on the phone also needs "find Priya Sharma / invoice INV-2043 / plan #88" in one keystroke. Fast cross-entity lookup is the single most-used affordance in mature PMS UIs.

**Scope.**
- Extend the palette with a **search mode**: debounced query across patients / appointments / invoices / plans using **existing list endpoints** (patient search already exists) — no new backend needed, keeping us at exactly 2 backend features.
- Grouped, keyboard-navigable results (arrow/enter across groups — the traversal pattern is already built); medical-alert chips on patient results; recent-items memory in `use-ui-store`.
- `⌘K` / `Ctrl-K` from anywhere; result → deep link.

**Done when.** Typing a name/number returns grouped live results in <200ms perceived; full keyboard traversal; recents persist; alerts visible on patient hits.

**Impact: High (every-session speed) · Effort: Medium**

---

### U5 — Advanced DataTable: sort, columns, saved views, CSV export, bulk actions

**Why.** `data-table.tsx` backs patients, invoices, leads, inventory, staff — the app's highest-traffic surface. Column sorting, show/hide columns, **saved filter views** ("My overdue > ₹5k"), CSV export, and multi-select bulk actions are the leverage features power users expect and that turn a list into a workflow tool.

**Scope.**
- Extend `DataTable`: column-header sort, a column-visibility menu, row multi-select + a bulk-action bar, client-side CSV export.
- **Saved views** persisted in `use-ui-store` (filter + sort + columns under a name).
- Apply to patients, invoices, leads first; keep the API backward-compatible so untouched tables are unaffected.

**Done when.** Sort/columns/selection/export work on the three flagship tables; saved views persist and reload; existing tables that don't opt in render unchanged.

**Impact: High (daily leverage) · Effort: Medium–High**

---

### U6 — Calendar: drag-to-reschedule, resize duration, conflict detection

**Why.** The calendar is the operational heart of the practice, and today rescheduling is a multi-step edit. Drag-to-move, drag-edge-to-resize, and live conflict/double-book highlighting are what make a scheduling UI feel professional — and they cut the most common daily task to one gesture.

**Scope.**
- Pointer drag-to-reschedule + edge-resize in `calendar-screen.tsx`, optimistic update via existing appointment-update mutation with rollback on failure.
- Real-time conflict highlighting (overlap with same chair/doctor), respecting `APPOINTMENT_TRANSITIONS`.
- Keyboard reschedule for accessibility (select + arrow keys); honors reduced-motion.

**Done when.** An appointment can be dragged/resized to a new valid slot and persists; conflicts highlight live; invalid transitions are refused with a clear toast; keyboard path works.

**Impact: High · Effort: High**

---

### U7 — Unified patient timeline

**Why.** A patient's story is currently split across tabs (appointments, plans, billing, clinical, messages). Clinicians and front desk repeatedly ask "what's the whole history?" A single reverse-chronological, filterable timeline — visits, plans presented/accepted, payments, clinical notes, messages, recalls — is a signature clinical-value feature and pure frontend composition over data already fetched on the record screen.

**Scope.**
- New `timeline` tab in `patient-record-screen.tsx` merging existing per-domain queries into one sorted event stream.
- Event-type filters, medical-alert context at top, deep-links from each event to its source.
- Skeleton + empty states consistent with the app.

**Done when.** Timeline merges all domains in true chronological order with working filters and deep links; renders in light + dark; empties gracefully for a new patient.

**Impact: High (clinical value) · Effort: Medium**

---

### U8 — Accessibility (WCAG 2.2 AA) + responsive/tablet polish + i18n formatting

**Why.** Healthcare software carries real accessibility obligations (and DPDP-aligned professionalism), front-desk staff increasingly work on tablets, and money/dates must format correctly for the India locale (₹, lakh grouping, `Asia/Kolkata`). The app already has good bones (skip link, ARIA table roles, focus tints) — this closes the gap to a defensible AA bar and a tablet-first desk.

**Scope.**
- Audit with the **`design` plugin's `/design:accessibility`** command: focus traps in drawers/palette, visible focus rings everywhere, form-label/`aria-describedby` coverage, color-contrast fixes (light + dark), reduced-motion completeness.
- Responsive pass on the console shell + top 6 screens down to tablet (1024/768) — collapsible sidebar, touch targets ≥44px.
- Centralize currency/number/date via `Intl` helpers (INR grouping, timezone-correct) replacing ad-hoc formatting; scaffold an i18n string layer (no full translation now, just the seam).

**Done when.** Automated a11y check passes AA on the top 6 screens in both themes; keyboard-only completes book→settle→check-in; console is usable at 768px; all money/dates route through the shared formatters.

**Impact: High (compliance + reach) · Effort: Medium–High**

---

## 3 · Advanced Claude frontend skills (surfaced for install)

Per your ask, I searched the skills/plugin marketplace for advanced frontend tooling. Three are directly relevant and I'm rendering install cards for them in chat:

| Skill / Plugin | What it gives us | Used by |
|---|---|---|
| **`web-artifacts-builder`** (Anthropic skill) | React + Tailwind + shadcn/ui patterns, state/routing for rich UI | U1, U2, U5, U7 |
| **`design`** (plugin: critique, handoff, **accessibility**, ux-copy) | WCAG audit, design critique, UX copy | U8, all UI polish |
| **`modern-web-guidance`** (plugin) | Current web-platform best practices | U1, U6, U8 |
| **`dataviz`** (already available) | One accessible chart system, light+dark | U2, U3 |

*Installing a skill is your click to make (the cards appear in chat) — I can't enable them for your account, but once enabled they load automatically when the matching work starts.*

---

## 4 · Suggested build order

Grounded in the dependency graph and risk:

1. **U1 Dark mode** — unblocks correct theming for everything after; lowest risk, immediate wow.
2. **B1 No-show engine** → **U3 Cockpit** — highest revenue ROI; ship the pair.
3. **B2 Scorecard service** → **U2 Scorecard screen** — highest owner value; ship the pair.
4. **U4 Global search** — high-use, self-contained.
5. **U5 DataTable power features** — broad leverage.
6. **U7 Patient timeline** — clinical value, pure composition.
7. **U6 Calendar drag/resize** — highest-effort UI, do it with room.
8. **U8 A11y + responsive + i18n** — finishing pass over everything above (do it last so it covers new surfaces too).

Each ships as its own commit (or small PR) on this branch — never on `main`. No feature touches deployment/infra.

---

## 5 · Guardrails held throughout

- **No deployment changes.** No new services, hosts, or migrations. Scores/KPIs compute on read + Redis cache (existing). New endpoints are additive; enriched responses are flag-gated.
- **Backward compatibility.** Existing API contracts unchanged unless a caller opts in.
- **Layered backend.** Business logic in pure services (`*.service.ts`), controllers stay thin — matches `backend-spec.md` §0.
- **Every write is an event** — new mutations write audit entries.
- **Feature-flag aware** — new console sections respect `use-features` + RBAC, like the rest of the app.
- **Token discipline** — no hard-coded colors; motion only where the design system already permits.
- **Enum single-source** — any new enum lands in `server/src/shared/enums.ts` and is mirrored (`npm run check:enums`).

---

## 6 · Open questions for our discussion

1. **Backend pair confirmation** — happy with **No-show engine (B1)** + **Practice Scorecard (B2)** as the two backend features? Or would you swap one for, e.g., a **unified global-search endpoint** or an **insurance-claims module** (`insuranceClaims` flag is currently off)?
2. **Scorecard benchmarks** — use sensible India-metro defaults, or leave benchmarks unset until you provide targets?
3. **Dark mode default** — `system` (follow OS) or `light` with opt-in?
4. **Scope depth** — full build of all 10, or land the top 4 (U1, B1+U3, B2+U2) first and reassess?
5. **Tests** — there's currently no test harness. Want me to add a lightweight Vitest setup for the two new backend services (pure, easily testable), or stay implementation-only for now?

*Reply with your calls on §6 and I'll start implementing in the recommended order — each feature committed to this branch.*
