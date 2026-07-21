# DentalOS — Implementation Roadmap

**Goal:** make the product actually *be* the thing `frontend-spec.md` and `backend-spec.md` describe — a
single wired system where every user type has a clear path in, every screen shows real data, and every
button does what it claims. Everything in both specs is in scope.

**How to use this document.** This is a flat, ordered list of **pick-up-able tasks**. Each task is a
vertical slice (frontend + backend together where relevant), self-contained enough for one person or agent
to take, and written so that finishing it leaves the project visibly better than before. Grab the
lowest-numbered task whose dependencies are met. Multiple people can work in parallel where the
**Depends on** graph allows.

Each task carries:
- **Why** — the one-line reason it exists.
- **Scope** — concrete work, frontend (FE) and backend (BE).
- **Done when** — testable acceptance criteria. A task is not done until these are demonstrably true in a
  running app, not just written.
- **Depends on** — task IDs that must land first.

> **Two standing rules for every task**, from the specs, that override local convenience:
> money is always integer **paise** end-to-end (format only at display, via the one formatter);
> and clinical status is **never colour-alone** — always carry an icon/shape/label too.

---

## Current state snapshot (so you don't re-derive it)

- **Frontend** (`src/`): nearly every screen exists and is design-faithful, but is **100% mock data** —
  40 files import `mock-data.ts` / `*-data.ts`; there are **zero** API calls; `main.tsx`'s §8.1 boot
  sequence is a comment; there is no API client, no login, no route guards. The role switcher is demo
  scaffolding. The UI was deliberately "reimagined" beyond the literal spec (Morning Brief, Recovery
  Queue, Booking Bar, etc.) under the Claude Design authority — **we keep these** and fill gaps around them.
- **Backend** (`server/`): data model complete (all Part 2 collections + indexes). Live modules: auth,
  clinic, patients, appointments, treatment-plans + recovery, billing, leads, recalls, analytics-dashboard,
  public, portal. **Missing modules:** users/roles admin, clinical CRUD (chart/notes/prescriptions/
  consents), operations CRUD (inventory/lab/suppliers/PO), communications (conversations/messages/
  templates/automation), content management, most analytics reports.
- **Build:** one TypeScript error (`src/features/clinical/chart-data.ts:354`); passes 2–4 were never
  compiled. It is ~one fix from green.
- **Missing frontend pieces the spec names:** full public Site (multi-page), real Patient Portal,
  `PerioChart`, `XrayViewer`, `InstalmentPlanEditor`, `FileUploader`, `ConversationThread`/`WhatsAppComposer`,
  `ConsentFormViewer`, `PrescriptionEditor`.

---

## Track ordering at a glance

```
Track 0  Foundation & wiring rails      ← do first; unblocks everything
Track 1  Auth & per-user flows          ← the "no proper flow" fix; do right after Track 0
Track 2  Console module wiring          ← highest visible value; mock→real, gaps filled
Track 3  Missing modules (FE+BE)        ┐
Track 4  Public Site & Patient Portal   │ pickable in parallel once Track 0–1 land,
Track 5  Domain components              │ following each task's own deps
Track 6  Cross-cutting production-ready ┘ (some early: seed, consistency; some late: tests, perf)
```

**Demo-ready milestone** (the sales narrative): Track 0 + Track 1 + Track 2 + T0.5 seed + T4.1/T4.2 Site
& Booking + T2.8 Calculator. That is spec PART 7 steps 1–10 wired to real data.

---

# Track 0 — Foundation & wiring rails

### T0.1 — Green the build and set a baseline
**Why:** nothing can be trusted until `tsc` and `vite build` pass; four passes went uncompiled.
**Scope:** FE — fix `chart-data.ts:354` (`Property 'label' does not exist on type 'never'`) and any error it
was masking; get `npm run build` (`tsc -b && vite build`) clean. BE — confirm `npm run build` clean.
Add a `typecheck` script both sides. Commit the working tree as the baseline (currently everything is
uncommitted).
**Done when:** both `npm run build`s exit 0; a clean baseline commit exists on a branch; `npm run dev` boots
the app without console errors.
**Depends on:** —

### T0.2 — Shared contract layer (enums + types, single source)
**Why:** spec §8.3 — two divergent copies of an enum is the most reliable way to ship a production-only bug.
**Scope:** Make `server/src/shared/enums.ts` the single source of truth. FE — replace `src/types/enums.ts`
and hand-written model types with types imported/derived from the backend contract (shared package, codegen
from validators, or a checked-in mirror with a drift test). Align `src/types/index.ts` to the backend
model field names.
**Done when:** appointment status, plan-item status, payment mode, lead stage, tooth condition, recall type,
user role each exist in exactly one place; a drift check fails CI if FE and BE diverge.
**Depends on:** T0.1

### T0.3 — API client + response envelope + typed error mapping
**Why:** spec §6.2 — one client owns auth token, clinic-context header, envelope normalisation, typed error
codes, idempotent retry, and 401→login. Components never build URLs.
**Scope:** FE — `src/lib/api/` client wrapping fetch: attaches access token + clinic header, unwraps the
standard envelope, maps `AUTH_* / PERM_* / VALIDATION_* / NOT_FOUND / CONFLICT_* / PAYMENT_* / ...` codes to
typed errors, retries idempotent GETs on network failure, redirects to login on auth error. One typed
function per endpoint, colocated per feature (`features/*/api.ts`).
**Done when:** a smoke call (`GET /clinic`) returns typed data through the client; a forced 401 redirects to
login; an error code renders a mapped message, never a parsed string.
**Depends on:** T0.2

### T0.4 — TanStack Query conventions + env/proxy
**Why:** spec §6.1 — hierarchical query keys and per-mutation invalidation lists prevent half of all
stale-UI bugs.
**Scope:** FE — establish the query-key convention (`[entity, scope, id, params]`), a shared query/mutation
factory, and the rule that every mutation documents which keys it invalidates. Add `VITE_API_URL`, a Vite
dev proxy to the server, and `.env` handling. BE — CORS for the dev origin.
**Done when:** one screen (pick Patients list, wired in T2.2 later) can be built on the convention; a
documented example mutation invalidates exactly the right keys; the dev proxy reaches the API.
**Depends on:** T0.3

### T0.5 — Expand the demo seed to 18 months of coherent data
**Why:** spec §8.4 — "a demo with three test patients named asdf loses the sale." Every wired screen needs
believable data behind it.
**Scope:** BE — extend `server/src/scripts/seed*.ts` to ~400 patients (realistic Pune names/addresses/ages),
~2,000 appointments across all statuses (~10% no-show), plans across every acceptance state (~55%
acceptance), invoices in every payment state incl. partials + live instalment plans, an **unscheduled
backlog worth ₹8–15 lakh** across 60–80 patients, ~150 leads across stages/sources, message history,
populated inventory + lab cases. Make `SEED_SCALE` reliable.
**Done when:** `npm run seed` produces the above against Mongo; the dashboard's revenue-at-risk figure reads
₹8–15 lakh from real records; no placeholder/"asdf" data anywhere.
**Depends on:** T0.1

---

# Track 1 — Auth & per-user flows  *(the "no proper flow" fix)*

### T1.1 — §8.1 boot sequence + branding-before-paint
**Why:** the app must resolve *who you are* and *which clinic* before it can route you anywhere useful.
**Scope:** FE — implement the real boot in `main.tsx`/an `AppBoot`: read refresh cookie → silent
`/auth/refresh` → on success fetch `/auth/me` + `/clinic` in parallel → apply branding tokens to CSS custom
properties **before first paint** → hydrate permission set → register feature-flag-filtered routes. On
refresh failure, render public Site or redirect to login depending on the requested route.
**Done when:** loading `/app` while logged out silently refreshes or bounces to login; clinic brand colours
come from `/clinic`, not hardcoded; no flash of unbranded content.
**Depends on:** T0.3

### T1.2 — Staff login → Console
**Why:** staff currently have no way in; the Console is reached only by typing `/app`.
**Scope:** FE — `/login` staff surface: email-OTP (`/auth/otp/request` + `/auth/otp/verify`), Google
(`/auth/google`), and password fallback (`/auth/login`). Store access token in memory, refresh token in the
httpOnly cookie the server sets. BE — confirm staff self-registration is refused (invite-only).
**Done when:** a staff member logs in via OTP/Google/password and lands in the Console; tokens use the staff
audience; wrong/expired codes show mapped errors.
**Depends on:** T1.1

### T1.3 — Patient login → Portal
**Why:** patients have no path to their own records; separate token audience is a security requirement (§3.2).
**Scope:** FE — `/portal/login`: email-OTP and Google only (no password for patients). Uses the **patient**
token audience so a patient token can never address a Console endpoint.
**Done when:** a patient logs in and reaches the Portal dashboard; a patient token is rejected by any `/app`
/ Console API; OTP registration-implies-login works for a fresh patient email.
**Depends on:** T1.1

### T1.4 — Route guards + role-aware landing + retire the demo switcher
**Why:** this is the core of "no proper flow" — each user type must be gated to their app and dropped on the
page that shows *their* info.
**Scope:** FE — guard `/app/*` (staff audience) and `/portal/*` (patient audience); unauthenticated hits go
to the correct login. Post-login, route by role to the right landing (receptionist/admin/assistant/lab →
Morning Brief; doctor/owner → Clinical Day; accountant → financial dashboard; patient → Portal home).
Replace the client-settable role switcher with the real RBAC claim from `/auth/me` (keep a dev-only override
behind a flag).
**Done when:** each role, logging in fresh, lands on its correct home with no manual navigation; a guest
cannot reach any guarded route; the demo switcher no longer drives production role.
**Depends on:** T1.2, T1.3

### T1.5 — Permission hook + nav/action gating
**Why:** spec §6.4 — one hook answers "can this user do X"; hide nav, disable actions with a reason.
**Scope:** FE — `usePermission()` reading effective permissions from `/auth/me`. Filter sidebar/nav
(`config/nav.ts`) and disable gated actions with a tooltip naming the required role (never silently inert).
BE — every gated action already refused server-side (verify, don't trust the UI).
**Done when:** a Receptionist sees no full clinical-notes entry and no financial exports; a disabled action
explains itself; hiding in the UI is backed by a 403 on the server.
**Depends on:** T1.4

### T1.6 — The three-app navigation spine
**Why:** Site, Portal and Console feel disconnected; the conversion spine (Site → book → lead → portal) must
be walkable.
**Scope:** FE — Site header/footer link to Book and to Portal login; Portal links back to the Site; Console
"Book"/create flows and public booking share one path. Make the funnel navigable end-to-end:
`Site → Cost Calculator/Booking → Lead → (in Console) → Patient → Portal`.
**Done when:** from the public home you can reach booking, from booking you become a lead visible in the
Console, and a converted patient can log into the Portal — clicking only, no URL typing.
**Depends on:** T1.4

---

# Track 2 — Console module wiring  *(mock → real, gaps filled; demo-priority order)*

> Pattern for every Track 2 task: replace the feature's `*-data.ts` mock with typed endpoint functions
> (T0.3) and TanStack Query hooks (T0.4); keep the existing reimagined UI; add any spec endpoint/behaviour
> the screen is missing; delete the mock once nothing imports it.

### T2.1 — Clinic config, Settings & feature flags
**Why:** spec PART 7 step 4 — everything reads from clinic config; branding is the resale lever.
**Scope:** FE — wire `settings-screen.tsx` sections to `/clinic`, `/clinic/branding`, `/clinic/working-hours`,
`/clinic/holidays`, `/clinic/branches`, `/clinic/operatories`, `/clinic/features`, `/clinic/integrations`,
`/procedures`, `/plan-templates`, `/consent-templates`. Drive the `features` flags object from `/clinic`
(not a constant). BE — fill any missing settings sub-routes.
**Done when:** editing branding changes the live theme; flipping a feature flag hides its nav + routes;
procedures/price-book edits persist and flow into the calculator and plan builder.
**Depends on:** T0.4, T1.5

### T2.2 — Patients module
**Why:** spec PART 7 step 5 — the record shell everything else hangs off.
**Scope:** FE — wire list/search/create/record/summary/timeline/medical-history/documents/ledger to
`/patients*`. `PatientHeaderBar` loads `/patients/:id/summary` first and independently so **medical alerts
appear immediately**. Server-driven pagination/sort/filter mirrored into the URL. BE — fill gaps: documents
list/upload, admin notes, check-duplicate, merge, portal-access toggle.
**Done when:** the list paginates/sorts/filters server-side from the URL; a new patient auto-gets a patient
number; the header bar shows real alerts/balance/last+next visit; the timeline merges real events.
**Depends on:** T2.1

### T2.3 — Appointments & Calendar
**Why:** spec PART 7 step 6 — the operational heart; drag/booking must hit the real conflict engine.
**Scope:** FE — wire calendar to `/appointments/calendar` (one payload: appts + resources + hours + blocks);
booking bar + calendar drag-create/move/resize to real create/reschedule with server conflict codes;
status transitions (confirm/check-in/start/complete/cancel-with-reason/no-show); waitlist; check-in;
blocked-time; `/appointments/bulk-remind`. Availability from `/appointments/availability`.
**Done when:** an overlapping chair booking is refused with the conflicting appointment surfaced (not a dead
error); reschedule prompts the notify preview and persists; check-in stamps drive wait-time; no mock book.
**Depends on:** T2.2

### T2.4 — Clinical module (BE build + wiring)
**Why:** the clinical endpoints don't exist yet; the chair is the product's moat.
**Scope:** BE — build clinical CRUD: `/patients/:id/chart` (+ tooth PUT, bulk-update, history), perio-charts,
clinical-notes (create/edit-in-window/amend/sign-lock), prescriptions (+ pdf, send, interaction-check),
consents (+ sign), `/drugs/search`. FE — wire `charting-screen.tsx`, the patient **Clinical** tab
(`Odontogram` + condition/procedure panel + chart-history), `prescriptions-screen.tsx`, and the versioned
`ChartScrubber` to real endpoints; enforce note lock + amendment-only after the window.
**Done when:** charting a tooth persists and appends to chart history; a note locks after the configured
window and thereafter only accepts amendments; a prescription generates a PDF and runs an allergy check.
**Depends on:** T2.2

### T2.5 — Treatment Plans (builder + presenter, end to end)
**Why:** spec §2.5 / PART 7 step 8 — the revenue core; item-level status is the whole design.
**Scope:** FE — wire `plan-builder-screen.tsx`, `treatment-plan-screen.tsx` (presenter), `plans-list-screen.tsx`
to `/treatment-plans*`: create, item CRUD, reorder, `present` (stamps the timestamp acceptance measures
from), batched per-item `decision` (accept/decline/defer + reason + follow-up date), schedule item, complete
item, from-template, PDF, and the tokenised public accept path (`/public/treatment-plans/:token[/accept]`).
Totals always come from the server. BE — confirm derived metrics (case-acceptance, scheduling rate,
unscheduled value) compute correctly.
**Done when:** deferring one item (not the plan) leaves it in the recovery worklist; presenter decisions post
as one batched call; the displayed total always matches the server; a patient can accept remotely via token+OTP.
**Depends on:** T2.4

### T2.6 — Unscheduled Recovery worklist + Recalls
**Why:** spec §5.7 — "the screen you demo third that closes the sale"; recalls share the pattern.
**Scope:** FE — wire `recovery-screen.tsx` / `recovery-queue.ts` and `recalls-screen.tsx` to
`/revenue/unscheduled(+/summary)`, `contact/snooze/decline/assign/campaign`, and `/recalls*`. Replace the
id-derived engagement stubs (`planViews`, `everReplied`, `daysSinceContact`) with real fields from the API.
Summary + list fetched in parallel; row actions invalidate both.
**Done when:** the worklist shows real plan-line rows grouped by patient, sorted by value within
follow-up-due; logging a contact/snooze/decline persists and re-ranks; recovered-value-30d is real.
**Depends on:** T2.5

### T2.7 — Billing, Payments, Instalments
**Why:** spec §5.11 / PART 7 step 9 — money; balance is authoritative from the server, never client-computed.
**Scope:** FE — wire invoices/payments/expenses/pending-payments screens to `/invoices*`, `/payments*`,
`/expenses*`, `/instalment-plans*`. Build `InstalmentPlanEditor` (T5.3) and the `PaymentCollector` sheet to
real endpoints (split tenders, quick-fill, mode selector, receipt delivery). Online payment: create-order →
hosted checkout → **confirming state that settles on the webhook-derived status**, never the browser
redirect. Refunds permission-gated; daily-summary reconciliation.
**Done when:** a recorded payment updates a server-computed balance (no incrementing field); an online
payment resolves via webhook while the UI shows "confirming"; instalments show paid/due/overdue from real data.
**Depends on:** T2.5

### T2.8 — Leads + Cost Calculator
**Why:** spec §5.9 / §5.2 — top of the funnel; calculator is the lead magnet and must compute server-side.
**Scope:** FE — wire `leads-screen.tsx` (board + list, both over one dataset) to `/leads*` (stage drag
optimistic w/ rollback, convert, lose-with-reason, activities, summary incl. **time-to-first-contact** on
screen). Wire `cost-calculator-screen.tsx` to `/public/calculator/config|estimate|capture` — estimate is
**server-side** (price book never reaches the browser); every run logged; capture creates a Lead carrying
the full payload.
**Done when:** a calculator run produces a server-computed range and, on capture, a Lead appears in the
Console with its payload; dragging a lead stage persists and rolls back on failure; time-to-first-contact shows.
**Depends on:** T2.2

### T2.9 — Dashboard / Insight (role-aware, real analytics)
**Why:** spec §5.4 — the owner's/reception's morning screen; the revenue-at-risk panel is the sales moment.
**Scope:** FE — wire Morning Brief, Clinical Day, financial dashboard, analytics narrative, and leak report
to `/analytics/dashboard` (role-aware), `/analytics/revenue-at-risk`, `/appointments/today|queue`. Replace
hardcoded stubs (case acceptance "61%", one-day-extrapolated heatmaps/cohorts) with real aggregates.
BE — ensure the role-aware dashboard payload + revenue-at-risk are accurate against seed data.
**Done when:** each role's home shows real numbers; revenue-at-risk figures link into the matching worklists;
no hardcoded percentages remain on these screens.
**Depends on:** T2.6, T2.7

---

# Track 3 — Missing modules (build FE + BE)

### T3.1 — Users, Roles & Team
**Why:** RBAC, staff admin and doctor performance have no endpoints yet.
**Scope:** BE — `/users*` (+ invite/activate/deactivate/permissions/schedule/leave), `/attendance`,
`/users/:id/performance`; role documents (seeded roles + custom). FE — wire `staff-screen.tsx`,
`attendance-screen.tsx`, doctor-performance to these; invite flow; per-user permission overrides UI.
**Done when:** an admin invites a user who then logs in; role/permission edits change effective access;
doctor performance shows real production/collection/acceptance.
**Depends on:** T1.5

### T3.2 — Communications (Inbox, templates, automation)
**Why:** the unified inbox, WhatsApp composer and automation rules are core but unbuilt on both sides.
**Scope:** BE — `/conversations*`, `/messages*`, `/templates*` (+ submit-approval), `/automation-rules*`
(+ toggle/logs), `/notifications*`. FE — build the three-pane Unified Inbox with `ConversationThread` +
`WhatsAppComposer` (session-window state unmistakable), template management, and the automation-rules editor.
Wire the existing `SendGuard` suppression layer to real message logs; recall/recovery campaigns send through
this.
**Done when:** an inbound WhatsApp appears in the inbox and can be replied to inside the session window
(and only a template outside it); an automation rule fires on its trigger respecting quiet hours; suppression
is enforced server-side, not just client-side.
**Depends on:** T2.6, T6.8

### T3.3 — Operations (Inventory, Lab, Suppliers, POs)
**Why:** operations CRUD is unbuilt; auto-deduction ties to appointment completion.
**Scope:** BE — `/inventory*` (+ adjust/low-stock/expiring/movements), `/purchase-orders*` (+ receive),
`/suppliers*`, `/lab-cases*` (+ status/due/overdue). FE — wire inventory/lab/suppliers screens; overdue lab
cases surface on the doctor dashboard; consumables auto-deduct when a procedure is marked complete.
**Done when:** completing a procedure deducts its consumables and logs a stock movement; a lab case going
overdue shows on the doctor's home; low-stock/expiry alerts fire.
**Depends on:** T2.3, T2.4

### T3.4 — Reviews & Campaigns
**Why:** the private→public review routing and campaign audience-preview are conversion tools.
**Scope:** BE — `/reviews/request`, `/reviews`, public rating capture + submit (route 4+ to public platform,
lower into service recovery), `/reviews/summary`; `/campaigns*` (+ preview-audience, send, schedule, results).
FE — wire `reviews-screen.tsx` and `campaigns-screen.tsx`; review request queued at appointment completion.
**Done when:** completing a visit queues a review request within 24h; a satisfied rating routes to the public
platform, a poor one into recovery; a campaign previews its audience count before sending (never fires blind).
**Depends on:** T3.2

### T3.5 — Content management (make the Site editable)
**Why:** spec §4.15 — without this every content tweak is a support ticket; needed before the Site is real.
**Scope:** BE — `/content/{pages,blog,faqs,testimonials,gallery,banners}`, `PATCH /content/seo/:pageKey`,
`POST /content/media` (format conversion + responsive sizes; consent check before any clinical photo is
published). FE — a Settings content editor for these.
**Done when:** clinic staff can edit a Site page, add a blog post/testimonial, and publish a gallery case
only after its consent flag is set — all without a code change.
**Depends on:** T2.1

### T3.6 — Analytics report library
**Why:** spec §4.12 / §5.12 — the report shell and the long tail of reports.
**Scope:** BE — remaining `/analytics/*` (revenue, collections, appointments, patients, retention, treatments,
case-acceptance, doctors, chair-utilisation, marketing, leads) with the consistent range+comparison+grouping
contract and `/analytics/export`. FE — the consistent report shell (filter bar + chart + table + export)
behind the narrative screen.
**Done when:** each report accepts a date range + comparison flag and returns series + totals + deltas;
export produces a file; the heatmap/cohorts/doctor views read real aggregates.
**Depends on:** T2.9

---

# Track 4 — Public Site & Patient Portal

### T4.1 — Public Site (full multi-page build)
**Why:** the Site is the entire top of the funnel and today is a placeholder.
**Scope:** FE — build all Site routes (`/`, about, doctors + `:slug`, services + `:slug`, gallery,
testimonials, blog + `:slug`, contact, patient-forms, privacy, terms) on `SiteLayout`, wired to `/public/*`
and the content endpoints. Structured data (LocalBusiness/Dentist, Physician, FAQPage, Review) on every
section. Performance budget: preloaded hero, lazy below-fold, Lighthouse mobile ≥ 90.
**Done when:** all Site pages render real clinic content; structured data validates; a mobile Lighthouse run
scores ≥ 90 on the home page.
**Depends on:** T3.5

### T4.2 — Online Booking flow
**Why:** spec §5.3 — direct conversion; offering unavailable slots destroys trust on day one.
**Scope:** FE — wizard: treatment → doctor/any → date → slot (grouped morning/afternoon/evening, next 30
days) → details → OTP → confirmation (add-to-calendar, WhatsApp confirm, directions, pre-visit form). Slots
come from true availability (`/public/availability`). BE — abandoned booking (details entered, never
confirmed) captured as a Lead after a delay.
**Done when:** the slot grid reflects real doctor leave/chair capacity/duration/buffer; a completed booking
creates an appointment + confirmation; an abandoned one becomes a Lead.
**Depends on:** T2.3, T1.6

### T4.3 — Patient Portal (full build)
**Why:** spec §4.2 — the at-home treatment-plan acceptance is a real, underserved conversion path.
**Scope:** FE — build Portal on `PortalLayout` (bottom tabs mobile / sidebar desktop): dashboard,
appointments (self-book/reschedule/cancel within policy), records, treatment-plans with **remote per-item
acceptance**, billing with online pay, documents (short-lived presigned URLs), messages, profile, pre-visit
forms + consent signing. BE — all `/portal/*` endpoints derive identity from the token and **ignore any path
id**.
**Done when:** a patient reviews a plan at home and accepts selected items (which updates the Console),
pays an invoice online, and views their own X-rays via presigned URLs — and cannot access another patient's
data by changing an id.
**Depends on:** T2.5, T2.7, T1.3

---

# Track 5 — Domain components (missing / partial)

### T5.1 — PerioChart
**Why:** spec Layer 3 — six-point perio charting with rapid tab-entry; nothing exists.
**Scope:** FE — the six-site-per-tooth grid (probing depth, gingival margin, BoP, suppuration, mobility,
furcation), tab-to-advance rapid entry, auto CAL, severity heatmap + pocket-depth summary. BE — perio-chart
endpoints (built in T2.4) + comparison.
**Done when:** a full-mouth perio exam can be charted keyboard-only; CAL auto-computes; two exams compare.
**Depends on:** T2.4

### T5.2 — XrayViewer + Documents + FileUploader
**Why:** imaging review and secure uploads are used across documents, consents and lab.
**Scope:** FE — `FileUploader` (drag-drop, presigned S3 upload, per-file progress, thumbnails, retry, delete);
`XrayViewer` (zoom/pan/invert/brightness/contrast/measurement ruler/side-by-side). Wire the patient
**Documents** tab. BE — presigned upload/download (built in T6.8), thumbnail jobs.
**Done when:** an X-ray uploads via presigned URL (never through the API server), opens in the viewer with
working tools, and downloads only via a short-lived signed URL after a permission check.
**Depends on:** T2.2, T6.8

### T5.3 — InstalmentPlanEditor
**Why:** spec Layer 3 — implants/ortho/full-mouth are paid in parts; paper tracking loses money.
**Scope:** FE — split a total across N instalments with configurable dates/amounts, schedule preview, and
paid/due/overdue state, wired to `/instalment-plans*`.
**Done when:** an instalment plan can be created against a plan/invoice and shows live paid/due/overdue;
overdue entries feed receivables + the reminder automation.
**Depends on:** T2.7

### T5.4 — ConsentFormViewer + PrescriptionEditor
**Why:** named Layer-3 components still missing; both are legal/clinical surfaces.
**Scope:** FE — `PrescriptionEditor` (medication lines, allergy cross-check warning, PDF preview) and
`ConsentFormViewer` (rendered snapshot, signature/OTP acceptance capture). Wire to clinical endpoints.
**Done when:** a prescription is authored with an allergy warning and sent as PDF; a consent is signed
(signature or OTP) and stores its rendered snapshot + timestamp + IP.
**Depends on:** T2.4

### T5.5 — Layer-2/3 composite audit & consistency
**Why:** "nothing is consistent" — the shared composites must behave identically everywhere.
**Scope:** FE — audit `DataTable` (server-driven sort/filter/pagination, column visibility + density persisted
per user, sticky header/first column, keyboard nav), `FilterBar` (URL-serialised), `FormLayout`, `Timeline`,
`ConfirmDialog` (typed-confirmation for dangerous actions), `EmptyState`/`ErrorState` against the spec, and
make every list/table use the same ones. Every list >100 rows virtualised (see T6.4).
**Done when:** every Console table shares one `DataTable` with consistent keyboard + density + persistence;
every list defines an `EmptyState`; filters live in the URL app-wide.
**Depends on:** T2.2

---

# Track 6 — Cross-cutting production readiness

### T6.1 — Design consistency & token enforcement
**Why:** "nothing is consistent / production ready" — rebrand must be a data change, not find-and-replace.
**Scope:** FE — lint rule banning hardcoded hex in components; confirm all colour/radius/font/spacing come
from tokens/config; the one money formatter used everywhere (no inline formatting); the fixed clinical
status palette + **non-colour-alone** encoding audited across teeth/alerts/payment status; density modes;
route all strings through an i18n layer (English-only ship, but wired for Marathi/Hindi).
**Done when:** the lint rule passes with zero hardcoded colours; every rupee figure uses the formatter with
Indian grouping; every clinical status carries an icon/label; a string audit shows no inline user-facing text.
**Depends on:** T2.1

### T6.2 — Forms & validation standard
**Why:** spec §6.3 — consistent validation, guards and error mapping across every form.
**Scope:** FE — React Hook Form + a Zod schema per form, sharing shapes with the server; validate on blur,
re-validate on change after first error; disable submit only while in flight; unsaved-changes guard on any
clinical/financial form; autosave + saved-indicator for long clinical notes; field-level server-error mapping;
error summary at the top of long forms.
**Done when:** a representative form (new patient, clinical note, invoice) follows the standard; navigating
away from a dirty clinical form warns; a server field error maps to its field.
**Depends on:** T2.2

### T6.3 — Loading / error / skeleton / boundary standard
**Why:** spec §6.2 — skeletons that match layout, boundaries so one widget can't blank a page.
**Scope:** FE — route-level Suspense + skeletons shaped like the eventual layout (never spinners for page
loads); inline button spinners for mutations; error boundaries at route and per independent panel with the
`ErrorState` retry.
**Done when:** each major screen shows a layout-matched skeleton on first load; a single failing dashboard
widget shows its own error+retry without blanking the rest.
**Depends on:** T2.9

### T6.4 — Performance budget
**Why:** spec §6.8 — Console bundle < 250KB gz; heavy components lazy; long lists virtualised.
**Scope:** FE — route-level code splitting per feature; lazy-load Odontogram, XrayViewer and the charting
library; virtualise any list expected > 100 rows; debounce search at 300ms; cache clinic config aggressively.
**Done when:** the initial Console chunk is < 250KB gzipped; the odontogram/xray/charts are not in the initial
chunk; a 500-row worklist scrolls smoothly (virtualised).
**Depends on:** T5.5

### T6.5 — Accessibility & clinical safety
**Why:** spec §6.6 — a colour-blind dentist misreading an odontogram is a real risk.
**Scope:** FE — keyboard operability, focus management/trapping in dialogs, labelled inputs, 4.5:1 contrast,
live regions for toasts, and the non-colour-alone rule enforced on every clinical status surface.
**Done when:** every dialog traps and restores focus; an axe/lighthouse a11y pass is clean on the core
screens; no clinical status relies on colour alone.
**Depends on:** T6.1

### T6.6 — RBAC + sensitive-action re-auth (end to end)
**Why:** spec §3.4 — hidden UI is not security; sensitive actions need a second factor.
**Scope:** BE — enforce the RBAC matrix on every endpoint; require re-auth/2FA for deleting a patient,
refunds above a threshold, bulk patient export, and changing gateway credentials; ownership checks on every
patient-scoped route independent of role. FE — surface the re-auth challenge for those actions.
**Done when:** each role is provably confined to its matrix via API tests; a sensitive action prompts re-auth
and is refused without it; a patient cannot address a Console endpoint.
**Depends on:** T1.5, T3.1

### T6.7 — Background jobs & automation build-out
**Why:** spec PART 6 — reminders, recall generation, digests, reconciliation and materialisation drive the
product's automation story.
**Scope:** BE — scheduled jobs (reminder dispatcher, automation evaluator, recall generator, owner digest,
follow-up worklist refresh, overdue-instalment reminders, birthday greetings, inventory alerts, analytics
materialisation, LTV refresh, lapsed-patient detection, backup verification, retention sweep) and event-driven
jobs (appointment completed → recall + draft invoice + inventory deduct + review request; no-show → follow-up;
plan presented → follow-up if no decision; item deferred → recovery worklist; invoice overdue → reminders;
lead created → notify + start TTFC timer).
**Done when:** completing an appointment fires its four event jobs; the daily recall generator + follow-up
refresh run on schedule against seed data; quiet hours are respected.
**Depends on:** T2.3, T2.6, T3.2

### T6.8 — Integrations hardening
**Why:** WhatsApp and payments are the two failure modes a clinic notices within minutes.
**Scope:** BE — WhatsApp Cloud API (template mgmt + approval, variable substitution, session-window rule,
media, interactive buttons, inbound webhook → inbox, delivery status, quiet hours, opt-out); Razorpay
(order checkout, payment links, full/partial refunds, EMI display, daily reconciliation, gateway ids stored
on every payment); SMTP email set (all transactional templates, queued w/ backoff + dead-letter, bounce
handling); S3 presigned upload/download + async thumbnails; webhooks signature-verified + idempotent by
event id.
**Done when:** a payment webhook is the sole authority on payment status and is idempotent; a WhatsApp send
respects the session window + quiet hours + opt-out; uploads/downloads go through presigned URLs only.
**Depends on:** T2.7, T3.2

### T6.9 — Security & DPDP compliance
**Why:** spec PART 7 — health data under India's DPDP Act; audit + consent + retention are legal, not optional.
**Scope:** BE — audit logging on every **read** of clinical data (not just writes); consent as a first-class
artefact (purpose/duration/scope/revocability) with a withdrawal path; patient rights endpoints (access,
correction, erasure subject to retention); configurable retention per data category; NoSQL-operator input
sanitisation everywhere; file validation by magic bytes; application-level encryption of identity/ABHA fields;
session revocation on role change.
**Done when:** reading a clinical note writes an audit entry; a patient can request their data and a
withdrawal is honoured; retention is config-driven; a NoSQL-injection payload is rejected.
**Depends on:** T2.4, T6.6

### T6.10 — Test suites
**Why:** spec PART 7 — the three areas where bugs are most expensive must be covered.
**Scope:** BE — unit tests on every service with business logic; integration tests on every endpoint
(happy / permission-denied / validation-failure); dedicated suites for **appointment conflict detection**,
**invoice + payment arithmetic**, and the **treatment-plan status state machine**. FE — smoke/interaction
tests on the critical flows (login-per-role, booking, plan acceptance, payment).
**Done when:** the three critical BE suites pass and are wired into CI; each endpoint has its three-path
coverage; the critical FE flows have a passing smoke test.
**Depends on:** T2.5, T2.7, T6.6

---

## Parallelisation notes for a team

- **Serialise first:** T0.1 → T0.2 → T0.3 → T0.4, then T1.1 → (T1.2 ‖ T1.3) → T1.4 → T1.5. After T1.5 the
  app has real per-user flows and the rest fans out.
- **T0.5 (seed)** can start immediately after T0.1 and should — every wired screen needs it.
- **Track 2** is the critical path to the demo; take it in order (each builds on the last), but T2.8
  (Leads/Calculator) only needs T2.2 and can go in parallel with T2.3–T2.7.
- **Track 3, 4, 5** tasks are largely independent once their listed deps land — hand them to separate
  agents by domain.
- **Track 6** is partly continuous (T6.1 consistency, T6.2 forms) and partly a hardening pass at the end
  (T6.4 perf, T6.9 security, T6.10 tests). Don't leave T6.6 RBAC or T6.8 integrations to the very end —
  they gate correctness of everything above.

## Definition of done for the whole roadmap

Every route reachable by the correct user type through clicks alone; every screen backed by real data with
no mock imports remaining; every button performs its stated action; the RBAC matrix enforced on both sides;
the demo narrative (dashboard → revenue-at-risk → recovery worklist, on ₹8–15 lakh of real seed data) runs
end-to-end; and `npm run build` + the critical test suites are green on both sides.
