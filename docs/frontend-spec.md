# DentalOS — Frontend Specification

**Product:** White-labelled end-to-end clinic operating system for dental practices (India / Pune market)
**Stack:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
**Deployment model:** Single-tenant per clinic, but every data structure carries a `clinicId` so multi-tenant is a routing change later, not a rewrite.
**Scope:** Single-phase build. Everything described here is v1.

> **Reading this document:** This is a build contract, not a tutorial. It contains no code. It describes *what exists*, *what it is called*, *what it receives*, *what it renders*, and *what it does on interaction*. Pair it with `backend-spec.md`, which defines the endpoints each screen calls.

---

## PART 0 — THE ARCHITECTURAL IDEA

Before any component, understand the shape of the thing you are building. There are **three distinct applications sharing one codebase and one design system**:

| App | Audience | Auth | Rendering priority |
|---|---|---|---|
| **Site** — the public clinic website | Strangers on Google | None | Speed + trust + conversion |
| **Portal** — the patient area | Existing patients | Email OTP / Google | Clarity, mobile-first |
| **Console** — the staff back-office | Reception, doctors, owner | Email OTP / Google + RBAC | Density, keyboard speed |

These are not three repos. They are three **route trees** under one Vite app, each with its own shell (layout, nav, theme intensity), sharing the same primitive component layer. This is deliberate: when you sell to clinic #4, you rebrand once and all three change together.

**The conversion spine.** Every architectural decision serves one funnel. Memorise it, because it is why certain screens exist:

```
Google → Site → Cost Calculator / Booking → Lead → Consultation
→ Treatment Plan → Acceptance → Scheduling → Treatment → Payment
→ Review Request → Recall → Repeat Visit
```

Two stages leak money worse than all others, and the UI must be built around plugging them:

1. **Plan → Acceptance → Scheduling.** Industry-wide, only ~50–60% of presented treatment is accepted, and only 70–80% of *that* ever gets booked. The Treatment Plan Presentation screen and the Unscheduled Treatment Recovery worklist exist purely to attack this.
2. **Last visit → next visit.** 25–40% of "active" patients are silently overdue. The Recall Engine screens exist to attack this.

If you build nothing else well, build those.

---

## PART 1 — PROJECT STRUCTURE

### 1.1 Directory layout

```
src/
  app/                 Router, providers, global error boundary, app entry
  config/              Clinic config loader, feature flags, constants, enums
  design/              Design tokens, theme provider, Tailwind preset extensions
  components/
    ui/                Layer 1 — shadcn primitives (unmodified where possible)
    common/            Layer 2 — composites (DataTable, PageHeader, EmptyState...)
    domain/            Layer 3 — dental-aware components (Odontogram, ToothCard...)
    layouts/           Layer 4 — SiteLayout, PortalLayout, ConsoleLayout
  features/            Vertical slices — one folder per module
    auth/ patients/ appointments/ clinical/ treatment-plans/
    billing/ leads/ communications/ inventory/ lab/ staff/
    analytics/ settings/ public-site/ portal/
  hooks/               Cross-cutting hooks
  lib/                 API client, query client, formatters, validators, utils
  types/               Shared TypeScript contracts mirroring backend models
  assets/              Static images, icons, clinic-replaceable brand assets
```

**Rule:** a `feature/` folder owns its own `components/`, `hooks/`, `api/`, `types.ts`, and `routes.tsx`. Nothing outside a feature imports from inside another feature's `components/` — cross-feature sharing happens by promoting a component up to `components/domain/`. This is what keeps the codebase resellable instead of tangled.

### 1.2 Feature flags

The clinic config document (loaded once at boot) drives a `features` object. Every optional module reads a flag before rendering nav entries or routes. This is your customisation lever at sale time — a clinic that doesn't want inventory flips one boolean, not a code fork.

Flags: `publicSite`, `onlineBooking`, `costCalculator`, `patientPortal`, `whatsapp`, `payments`, `inventory`, `labTracking`, `multiDoctor`, `reviewRequests`, `recallEngine`, `insuranceClaims`.

---

## PART 2 — DESIGN SYSTEM

### 2.1 Why tokens matter here

You are selling this repeatedly. Rebranding must be a **data change, not a find-and-replace**. Every colour, radius, font and logo comes from the clinic config or CSS custom properties. No hardcoded hex values anywhere in components. Enforce with a lint rule.

### 2.2 Colour tokens

Defined as CSS custom properties on `:root`, consumed through Tailwind's theme extension. shadcn's convention is already this — follow it exactly.

| Token | Role | Default (medical-trust palette) |
|---|---|---|
| `background` / `foreground` | Page canvas and body text | Near-white / slate-900 |
| `primary` / `primary-foreground` | Brand actions, CTAs, active nav | Deep teal — replaceable per clinic |
| `secondary` | Low-emphasis buttons, chips | Slate-100 |
| `accent` | Hover states, subtle highlight | Teal-50 |
| `muted` / `muted-foreground` | Meta text, table headers, placeholders | Slate-100 / slate-500 |
| `destructive` | Delete, cancel, overdue | Red-600 |
| `success` | Paid, completed, confirmed | Emerald-600 |
| `warning` | Due soon, pending, partial payment | Amber-500 |
| `info` | Informational banners | Blue-500 |
| `border` / `input` / `ring` | Structural | Slate-200 |

**Clinical status colours are separate and non-negotiable across brands.** A tooth's condition must not change meaning because a clinic rebranded to red. Define these as a fixed second palette: `tooth-healthy`, `tooth-caries`, `tooth-restored`, `tooth-missing`, `tooth-implant`, `tooth-rct`, `tooth-crown`, `tooth-planned`, `tooth-extraction-advised`.

### 2.3 Typography

| Token | Usage | Size / weight / leading |
|---|---|---|
| `display` | Public site hero headlines | 48–60px, 700, tight |
| `h1` | Page titles | 30px, 600 |
| `h2` | Section headings | 24px, 600 |
| `h3` | Card titles, panel headers | 18px, 600 |
| `body` | Default | 14px console / 16px site, 400 |
| `body-sm` | Table cells, dense console text | 13px, 400 |
| `label` | Form labels, table headers | 12px, 500, wide tracking, uppercase for table headers only |
| `caption` | Timestamps, helper text | 12px, 400, muted |
| `numeric` | All money and counts | Tabular-nums variant, always |

Two families: one humanist sans for the public Site (warmth sells), one neutral UI sans for Console (density reads). Both loaded from the clinic config so a clinic can supply its own brand font.

**Money rule:** every currency figure uses tabular figures and the Indian digit grouping convention (lakh/crore grouping — ₹12,34,567). Build one formatter, use it everywhere, never format inline.

### 2.4 Spacing, radius, elevation

- Spacing scale: 4px base — use only 4/8/12/16/24/32/48/64. No arbitrary values.
- Radius: `sm` 4px (chips, inputs), `md` 8px (buttons, cards), `lg` 12px (modals, panels), `full` (avatars, pills).
- Elevation: only four levels. `flat` (borders only — default for Console), `raised` (cards on Site), `overlay` (dropdowns, popovers), `modal`. Console prefers borders over shadows; density beats decoration in a back-office.

### 2.5 Density modes

Console supports a `comfortable` / `compact` toggle stored in user preferences. It changes row height, cell padding and font size on tables only. Reception staff working an 8-hour desk will want compact; the owner glancing at dashboards wants comfortable. This is a small feature that reads as thoughtful in a sales demo.

---

## PART 3 — COMPONENT LAYERS

Four layers, strictly ordered. **A component may only import from layers below it.** Violations are how design systems die.

### Layer 1 — Primitives (`components/ui/`)

Pulled from shadcn/ui, styled only via tokens. Install and leave alone: Button, Input, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch, Slider, Label, Form, Card, Badge, Avatar, Separator, Tabs, Accordion, Dialog, Sheet, Drawer, Popover, Tooltip, DropdownMenu, ContextMenu, Command, Calendar, DatePicker, Table, Toast/Sonner, Skeleton, Progress, Alert, AlertDialog, Breadcrumb, Pagination, ScrollArea, Collapsible, HoverCard, Toggle, ToggleGroup, Resizable.

### Layer 2 — Composites (`components/common/`)

Generic, business-unaware. These are the workhorses; getting them right once saves you a thousand lines later.

**`DataTable`** — the single most important component in the Console.
Receives: a column definition list, a data array, total row count, loading flag, current sort state, current pagination state, current filter state, row-selection mode (none / single / multi), a row-click behaviour, a per-row action menu definition, an empty-state configuration, a density setting, and a set of bulk actions shown when rows are selected.
Renders: a toolbar (search input, filter chips, column-visibility menu, export button, bulk-action bar when selection is active), the table body, and a footer with pagination and total count.
Behaviour: sorting, filtering and pagination are **server-driven** — the component owns no data, only emits state-change events upward. Column visibility and density persist per user per table in local storage. Supports sticky first column and sticky header. Keyboard: arrow keys move row focus, Enter opens the row, Space toggles selection.

**`PageHeader`** — title, optional breadcrumb trail, optional descriptive subtitle, a slot for primary/secondary actions, and an optional row of stat pills. Every Console page begins with exactly one of these.

**`StatCard`** — a label, a primary value, an optional secondary comparison value, a trend direction and percentage, an optional sparkline, an optional icon, and an optional click target. Used across all dashboards.

**`EmptyState`** — illustration slot, headline, one-sentence explanation, and a primary call to action. Every list, table and panel must define one. An empty screen with no guidance is the most common reason a demo falls flat.

**`ErrorState`** — an error headline, a plain-language cause, a retry action, and a collapsible technical detail block shown only in development.

**`ConfirmDialog`** — title, body copy, confirm label, tone (neutral / destructive), and an optional required-typing confirmation for genuinely dangerous actions such as deleting a patient record.

**`FormLayout`** — a two-column responsive grid that collapses to one column on mobile, with support for grouped field sections each carrying a section title and optional description, plus a sticky footer action bar for save/cancel.

**`FilterBar`** — a horizontal set of filter controls (date range, multi-select, search, saved-view selector) that serialises its state into the URL query string. URL-serialised filters matter: staff share links, and you want back-button behaviour to be correct.

**`Timeline`** — a vertical list of dated events, each with an icon, actor, title, optional body and optional attachments. Used for patient history, lead activity, and audit trails.

**`FileUploader`** — drag-and-drop zone with click fallback, accepted-type and size constraints, per-file upload progress, thumbnail previews for images, retry on failure, and a delete affordance. Used for X-rays, intra-oral photos, consent forms and lab prescriptions.

**`AvatarStack`**, **`CopyButton`**, **`StatusBadge`**, **`MoneyText`**, **`DateText`** (with relative-time hover), **`PhoneText`** (with click-to-call and click-to-WhatsApp actions) — small but used constantly.

**`CommandPalette`** — global keyboard-triggered search across patients, appointments, invoices and navigation targets. Bound to Ctrl/Cmd+K. This single feature makes the product feel expensive during a demo.

### Layer 3 — Domain components (`components/domain/`)

Dental-aware. This layer is your moat — competitors have generic charting.

**`Odontogram`** — the centrepiece clinical component.
Receives: the tooth-numbering system to use (FDI two-digit, Universal, or Palmer — **default FDI**, which is what Indian dental education uses), a dentition mode (permanent / primary / mixed), a map of tooth number to condition records, a map of tooth number to planned procedures, a selection mode (single tooth, multiple teeth, or surface-level), the currently selected teeth/surfaces, a read-only flag, and a legend-visibility flag.
Renders: an anatomically arranged arch layout — upper right, upper left, lower left, lower right quadrants — with each tooth drawn as an SVG occlusal diagram divided into five clickable surfaces (mesial, distal, buccal/facial, lingual/palatal, occlusal/incisal). Conditions paint surfaces; whole-tooth states (missing, implant, crown, bridge pontic) override the tooth silhouette. Bridges render a connecting bar across abutments. A legend maps colour to condition.
Behaviour: clicking a surface toggles selection; clicking a tooth number selects the whole tooth; shift-click extends a range; right-click opens a quick-action menu of common procedures. Hovering shows a tooltip with that tooth's condition history and planned work. Emits selection changes and procedure-application requests upward. Must be fully usable on a tablet — clinicians chart chairside on iPads, so touch targets are minimum 44px and there is a pinch-zoom container.
Read-only variant is embedded in the patient timeline and in the treatment plan PDF preview.

**`PerioChart`** — a six-point-per-tooth grid capturing probing depth, gingival margin, bleeding on probing, suppuration, mobility and furcation. Auto-calculates clinical attachment loss. Supports tab-to-advance rapid entry so a clinician can chart a full mouth without touching the mouse. Renders a colour-coded severity heatmap and a summary of pocket-depth distribution.

**`ToothConditionPicker`** — a searchable, categorised list of conditions and procedures scoped to what is valid for the selected tooth and surface, showing each procedure's default price from the clinic's service catalogue.

**`TreatmentPlanBuilder`** — a phased list builder. Each phase has a name, an intended sequence, and a set of line items; each line item carries a tooth/surface reference, a procedure, a quantity, a unit price, a discount, a priority (urgent / recommended / elective) and a status. Shows running totals per phase and for the plan overall, with a discount control and a live "what the patient pays" figure. Supports drag-to-reorder within and between phases, duplicating a phase, and applying a saved plan template.

**`TreatmentPlanPresentation`** — a deliberately separate, patient-facing view of the same data, designed to be turned toward the patient on a screen. Large type, the odontogram with only the planned work highlighted, before/after or reference imagery per procedure, plain-language procedure descriptions (not clinical codes), the total, the EMI/instalment breakdown, and three large decision buttons: Accept All, Accept Selected Phases, Think About It. Choosing "Think About It" **requires a follow-up date and reason**, which is what feeds the recovery worklist. This screen is the highest-revenue-impact surface in the product.

**`AppointmentCalendar`** — a resource-scheduling calendar.
Receives: a view mode (day / 3-day / week / month / agenda), a resource axis mode (by operatory/chair, by doctor, or combined), the resource list, the appointment list, working-hours and break definitions per resource, blocked/holiday periods, slot granularity (default 15 minutes), and drag-and-drop enablement.
Renders: a time-axis grid with resources as columns, appointments as blocks colour-coded by status, with the patient name, procedure and duration visible. Non-working time is visually struck out. A "now" indicator line tracks the current time on today's view.
Behaviour: click-drag on empty space opens the booking sheet pre-filled with that resource and time; dragging an existing appointment reschedules it (with a confirmation and an automatic patient notification prompt); resizing changes duration. Overlaps are prevented for the same chair but permitted for the same doctor across chairs, since a dentist genuinely does move between operatories. Double-booking attempts show an inline conflict warning rather than a blocking error.

**`AppointmentCard`** — the block rendered inside the calendar and reused in list views. Shows patient name, age/sex, procedure, doctor, chair, duration, status badge, and small indicator icons for: new patient, has outstanding balance, has an unsigned consent, is a lead-conversion appointment, and reminder-delivery state.

**`PatientHeaderBar`** — a persistent context bar shown on every screen inside a patient's record. Displays photo, name, patient ID, age/sex, phone with WhatsApp action, allergy and medical-alert badges in red, outstanding balance, last visit date, next appointment, and quick actions (book, invoice, message, add note). Medical alerts must be impossible to miss — this is a genuine patient-safety surface, not decoration.

**`ProcedureSelector`** — a combobox over the clinic's service catalogue with category grouping, showing code, name, default price and default duration.

**`PaymentCollector`** — the sheet used to record money. Shows the invoice's outstanding balance, an amount input with quick-fill buttons (full, half, custom), a payment-mode selector (cash, UPI, card, bank transfer, online gateway link, cheque), a reference field, an optional instalment-plan applicator, and a receipt-delivery choice (print, WhatsApp, email, none).

**`InstalmentPlanEditor`** — splits a treatment total across N instalments with configurable dates and amounts, previews the schedule, and shows which instalments are paid, due and overdue. This matters more in India than anywhere: implants, orthodontics and full-mouth rehabilitation are almost always paid in parts, and money genuinely gets lost tracking it on paper.

**`LeadPipelineBoard`** — a kanban board with stage columns, drag-to-move cards, per-stage counts and total pipeline value in rupees, and a card design showing name, phone, source, interest (treatment type), estimated value, days-in-stage, and next-follow-up date with an overdue indicator.

**`WhatsAppComposer`** — template picker showing only approved templates, variable-substitution fields with a live preview of the exact rendered message, a recipient summary, a send-now or schedule choice, and a clear indicator of whether the recipient is inside the 24-hour session window (which determines whether a free-form message is permitted or a template is mandatory).

**`ConversationThread`** — a WhatsApp-style two-sided message list with delivery/read ticks, inbound message highlighting, attachment rendering, an assignment control (which staff member owns this conversation), and a reply composer that switches between free-form and template mode based on the session window.

**`ToothSelectorMini`**, **`ConsentFormViewer`**, **`PrescriptionEditor`**, **`XrayViewer`** (with zoom, pan, invert, brightness/contrast, measurement ruler and side-by-side comparison), **`RecallCard`**, **`LabCaseCard`**, **`StockLevelIndicator`**.

### Layer 4 — Layouts (`components/layouts/`)

**`SiteLayout`** — sticky transparent-to-solid header with logo, primary nav, a phone number, and a high-contrast "Book Appointment" button; a floating WhatsApp action button on mobile; a footer with clinic details, service links, hours, embedded map, and social links. Includes an exit-intent or scroll-triggered appointment prompt on desktop, shown at most once per session.

**`PortalLayout`** — minimal top bar with clinic logo and patient avatar menu; bottom tab navigation on mobile (Home, Appointments, Records, Bills); sidebar on desktop.

**`ConsoleLayout`** — collapsible icon-and-label sidebar with role-filtered navigation groups; a top bar containing global search trigger, a date/branch context selector, a notification bell with unread count, a quick-create button, and the user menu; a main content region; and a right-hand contextual drawer used for quick patient preview and quick appointment detail without leaving the current screen. The drawer is important — it prevents reception losing their place in a list every time they check something.

---

## PART 4 — ROUTE MAP

### 4.1 Site (public, unauthenticated)

| Path | Screen | Conversion purpose |
|---|---|---|
| `/` | Home | Trust + primary CTA |
| `/about` | About the clinic | Credibility |
| `/doctors` | Doctor listing | Credibility |
| `/doctors/:slug` | Doctor profile | Credibility, direct booking to a named doctor |
| `/services` | Service categories | SEO surface |
| `/services/:slug` | Service detail | SEO landing page, per-treatment CTA |
| `/cost-calculator` | Treatment Cost Estimator | **Lead magnet** |
| `/book` | Online booking flow | Direct conversion |
| `/gallery` | Before/after cases | Case acceptance pre-warming |
| `/testimonials` | Reviews wall | Social proof |
| `/blog`, `/blog/:slug` | Content | Organic acquisition |
| `/contact` | Contact + map | Local intent |
| `/patient-forms` | Pre-visit digital forms | Chair-time saving |
| `/privacy`, `/terms` | Legal | DPDP requirement |

### 4.2 Portal (patient, authenticated)

`/portal` dashboard · `/portal/appointments` (upcoming, past, reschedule/cancel) · `/portal/records` (visit history, prescriptions, reports, X-rays) · `/portal/treatment-plans` (view and accept a plan remotely) · `/portal/billing` (invoices, instalments, pay online) · `/portal/documents` · `/portal/profile` · `/portal/messages`.

The ability for a patient to **accept a treatment plan from home, after discussing cost with family**, is a real and underserved conversion path. Build it.

### 4.3 Console (staff, authenticated + RBAC)

| Group | Paths |
|---|---|
| Dashboard | `/app` |
| Schedule | `/app/calendar`, `/app/appointments`, `/app/waitlist`, `/app/check-in` |
| Patients | `/app/patients`, `/app/patients/new`, `/app/patients/:id` with nested tabs: `overview`, `clinical` (odontogram), `perio`, `treatment-plans`, `appointments`, `billing`, `documents`, `prescriptions`, `communications`, `notes` |
| Clinical | `/app/clinical/queue` (today's chairside worklist), `/app/clinical/prescriptions` |
| Revenue | `/app/treatment-plans`, **`/app/revenue/unscheduled`** (the recovery worklist), `/app/revenue/pending-payments`, `/app/invoices`, `/app/payments`, `/app/expenses` |
| Growth | `/app/leads`, `/app/leads/:id`, `/app/recalls`, `/app/campaigns`, `/app/reviews`, `/app/inbox` (unified WhatsApp inbox) |
| Operations | `/app/lab`, `/app/inventory`, `/app/inventory/purchase-orders`, `/app/suppliers` |
| Team | `/app/staff`, `/app/staff/:id`, `/app/attendance`, `/app/doctor-performance` |
| Insight | `/app/analytics`, `/app/reports/:reportKey` |
| Settings | `/app/settings/*` — clinic profile, branding, branches, operatories, working hours, holidays, services & pricing, treatment templates, users & roles, message templates, automation rules, payment settings, taxes, integrations, audit log |

---

## PART 5 — SCREEN SPECIFICATIONS

Each screen below defines: purpose, layout, components used, states, and interactions. Endpoint names referenced here are defined in `backend-spec.md`.

---

### 5.1 SITE — Home

**Purpose:** convert a stranger from Google into a booking or a lead within 30 seconds.

**Sections top to bottom:**

1. **Hero** — clinic name, a one-line positioning statement, trust markers (years established, patients treated, doctor qualifications), a primary "Book Appointment" button, a secondary "WhatsApp Us" button, and a background image of the actual clinic interior. On mobile the two buttons stack and remain above the fold.
2. **Trust strip** — Google rating with review count, years in practice, number of specialists, key certifications. Pulled live from the reviews summary endpoint where available, with cached fallback.
3. **Services grid** — icon cards for the top 6–8 treatments, each linking to its service page. Each card shows a starting price if the clinic enables price display.
4. **Cost calculator teaser** — a compact band inviting the visitor to estimate their treatment cost. This is the highest-intent capture point on the page.
5. **Doctors** — photo cards with name, qualification, specialisation, experience, and a "Book with Dr. X" action.
6. **Before / after gallery** — a filterable carousel by treatment type, with consent-gated images only.
7. **Testimonials** — text and video reviews with source attribution.
8. **Facility / technology** — photographs of equipment and sterilisation protocol. Sterilisation imagery converts unusually well in the Indian market; patients ask about it.
9. **Location & hours** — embedded map, address, parking note, hours table with a live open/closed indicator.
10. **FAQ** — accordion, also serving as SEO structured data.
11. **Final CTA band** — booking form inline, not a link.

**Performance requirements:** hero image preloaded and format-negotiated, all below-fold imagery lazy-loaded, Lighthouse performance ≥ 90 on mobile. Every section emits structured data (LocalBusiness / Dentist, Physician, FAQPage, Review) — this is not optional, it is the entire top of the funnel.

---

### 5.2 SITE — Treatment Cost Calculator

**Purpose:** the lead magnet. A visitor researching implants or aligners wants a number before they will call. Give them one, and capture them in exchange.

**Verdict on whether this is worth building: yes, strongly — but only for high-value, high-consideration treatments.** Nobody calculates the cost of a scaling. They absolutely do research implants, orthodontics, aligners, veneers and full-mouth rehabilitation, and these are the treatments that carry the practice. It doubles as a case-acceptance tool: reception can send the same calculator link to a hesitant patient.

**Flow — a multi-step wizard, one question per step, with a progress indicator:**

1. **Treatment category** — large illustrated choice cards (Dental Implants, Braces & Aligners, Root Canal & Crown, Smile Design / Veneers, Full Mouth Rehabilitation, General Dentistry).
2. **Scope** — category-dependent. Implants: number of teeth missing, chosen via a simplified tooth-picker rather than a number input; whether bone grafting may be needed (with a "not sure" option). Orthodontics: metal / ceramic / self-ligating / clear aligners, plus approximate severity chosen from three illustrated options. Crowns: material (metal-ceramic, zirconia, e-max) and count.
3. **Quality tier** — Standard / Premium / Luxury, each explained in plain language with the actual brand tier it corresponds to (e.g. implant system origin), since this is genuinely where price varies most.
4. **Result** — an estimated **range**, never a single figure. Show a breakdown by component (procedure, materials, imaging, follow-ups), an EMI preview at the clinic's configured tenures, a clear disclaimer that a clinical examination determines the final plan, and the assumptions used.
5. **Capture** — the result is visible immediately (do not gate it — gating kills trust and bounce rates spike), but three actions sit beneath it: "Get this estimate on WhatsApp", "Book a consultation", "Email me this breakdown". Any of these creates a **Lead** carrying the full calculator payload, so the front desk knows exactly what the person was pricing before they ever speak.

**Components:** wizard shell with step state in the URL, illustrated `ChoiceCard`, `ToothSelectorMini`, `RangeResultCard`, `EMIPreview`, `LeadCaptureSheet`.

**Behaviour notes:** state persists in session storage so a refresh doesn't lose progress. The estimate is computed **server-side** from the clinic's configured pricing rules — never in the browser, or a competitor reads your entire price book from the bundle. Every completed calculation is logged with its inputs even if the visitor doesn't convert; that dataset tells the clinic what people are shopping for, which is a genuinely valuable analytics screen later.

---

### 5.3 SITE — Online Booking

**Flow:** treatment type → doctor (or "any available") → date → available slot → patient details (name, phone, email, new/returning) → OTP verification of the phone or email → confirmation.

**Requirements:** the slot grid must reflect true availability including doctor leave, chair capacity, procedure duration and buffer time — a booking system that offers unavailable slots destroys trust with the clinic on day one. Show only the next 30 days. Group slots by morning / afternoon / evening. Confirmation screen offers add-to-calendar, a WhatsApp confirmation, directions, and a pre-visit form link. An abandoned booking (details entered, never confirmed) is captured as a Lead after a short delay.

---

### 5.4 CONSOLE — Dashboard

**Purpose:** the owner's and receptionist's morning screen. Role-aware: the same route renders different content per role.

**Owner view:**
- Stat row: today's collection, month-to-date collection vs target, month-to-date production, outstanding receivables, new patients this month, appointment fill rate.
- **Revenue-at-risk panel** — unscheduled treatment value, overdue recalls count and value, unpaid invoice ageing. Each figure is a link into the corresponding worklist. This panel is the single most persuasive thing in the product; it converts abstract "we should follow up" into a rupee figure the owner can see.
- Charts: collection trend (daily, 30 days), revenue by treatment category, new vs returning patient split, lead source attribution, doctor-wise production.
- Today's schedule summary and a live chair-utilisation bar.

**Reception view:**
- Today's appointment list with check-in status and a one-tap check-in action.
- Arrivals expected in the next hour.
- Unconfirmed appointments for tomorrow, with a bulk "send reminders" action.
- Pending payment collections for patients currently in the clinic.
- Unread WhatsApp conversations and new leads awaiting first contact.

**Doctor view:**
- Personal chair schedule for today.
- Chairside queue: checked-in patients waiting, in order, with waiting time.
- Incomplete clinical notes from previous days (a real compliance nag that clinics need).
- Lab cases due back.

---

### 5.5 CONSOLE — Calendar

The operational heart. `AppointmentCalendar` fills the viewport below a control bar containing: view switcher, date navigator with a "today" reset, resource-axis toggle (chair / doctor), doctor and treatment-type filters, a branch selector when multi-branch is enabled, and a "new appointment" button.

**Right drawer** opens on appointment click, showing full detail and actions: confirm, check in, start treatment, complete, reschedule, cancel with reason, mark no-show, collect payment, open patient record, send message.

**Critical interactions:**
- Drag to reschedule prompts "notify the patient?" with the message preview pre-filled.
- Cancellation requires a reason from a fixed list — this data drives the cancellation-analysis report.
- Marking a no-show automatically creates a follow-up task and can trigger an automation rule.
- A waitlist panel lets reception slot a waiting patient into a freed cancellation gap with one drag. Clinics love this; it directly recovers lost chair time.
- Colour legend for statuses: scheduled, confirmed, checked-in, in-chair, completed, no-show, cancelled.

---

### 5.6 CONSOLE — Patient Record

`PatientHeaderBar` pinned at top, tabbed content below.

**Overview tab:** demographic and contact summary, medical history alerts, an activity timeline merging appointments, treatments, payments, messages and notes into one chronological stream, plus quick-stat cards (lifetime value, visit count, last visit, next visit, outstanding balance, recall due date).

**Clinical tab:** full-width `Odontogram` with a right panel that changes based on selection — when teeth are selected it offers condition recording and procedure planning; when nothing is selected it shows the chart history log. Below the chart: chronological clinical notes with a structured entry form (chief complaint, examination findings, diagnosis, treatment performed, materials used, advice, next visit plan), each note attributable and locked after a configurable window with edits tracked as amendments rather than overwrites.

**Treatment Plans tab:** list of plans with status, total value, accepted value, and completion percentage; each opens the `TreatmentPlanBuilder`, with a prominent "Present to Patient" action switching into `TreatmentPlanPresentation`.

**Billing tab:** invoices, payments, instalment schedules, outstanding balance, and a ledger view. Actions: create invoice from completed procedures, record payment, send a payment link, issue a refund, print or WhatsApp a receipt.

**Documents tab:** categorised uploads — X-rays and imaging, consent forms, lab reports, referral letters, insurance documents, identity proof. Images open in `XrayViewer`.

**Communications tab:** the full message history with this patient across WhatsApp, SMS and email, plus a composer.

---

### 5.7 CONSOLE — Unscheduled Treatment Recovery

**This is the screen you demo third, right after the dashboard and calendar, and it is what closes the sale.**

**Purpose:** surface every procedure that was diagnosed and planned but never scheduled or completed, ranked by recoverable rupee value. The research is unambiguous: 20–30% of unscheduled treatment is recoverable with systematic follow-up, and most clinics have no idea what their number even is.

**Layout:**
- Header stat band: total unscheduled value, count of affected patients, value recovered in the last 30 days, and current recovery rate.
- `FilterBar`: treatment category, value band, plan age (0–30 / 31–90 / 90+ days), priority level, assigned doctor, last-contact recency, and follow-up-due status.
- `DataTable` with rows at **plan-line granularity grouped by patient**, columns: patient, phone with WhatsApp action, procedure, tooth, value, plan date, days since planned, priority, last contact, contact attempt count, outcome of last attempt, next follow-up date, assigned staff member.
- Row expansion shows the clinical note context and the reason recorded when the patient deferred.
- Row actions: call, send WhatsApp (with a template pre-filled with the specific procedure and price), book the appointment directly, log a contact attempt with an outcome, snooze with a date, or mark permanently declined with a reason.
- Bulk action: send a templated recovery campaign to a filtered segment.

**Design intent:** this screen must feel like a call list a receptionist can work top-to-bottom for twenty minutes a day. Default sort is value descending within follow-up-due. Every row must be actionable without navigating away.

---

### 5.8 CONSOLE — Recalls

Same structural pattern as above, aimed at the second leak. Rows are patients whose next recall (hygiene, ortho adjustment, implant review, post-treatment check) is due or overdue. Columns: patient, recall type, due date, days overdue, last visit, lifetime value, contact attempts, status. Bulk WhatsApp campaigns segmented by recall type and overdue band. A recall is auto-created when a treatment completes, driven by rules in settings (e.g. scaling → 6 months, implant → 3 months then annually).

---

### 5.9 CONSOLE — Leads

Two synchronised views over the same data, toggled in the header: `LeadPipelineBoard` (kanban) and `DataTable` (list).

**Stages:** New → Contacted → Consultation Booked → Consulted → Treatment Planned → Converted, with Lost as a terminal state requiring a reason.

**Lead detail drawer:** contact details, source (website form, cost calculator, call, walk-in, Google, Instagram, referral, Practo), the treatment they enquired about, estimated value, the calculator payload if it exists, assigned staff, an activity timeline, a notes composer, follow-up scheduling, and conversion actions (book consultation, convert to patient).

**Header metrics:** total open pipeline value, conversion rate by source, average time-to-first-contact, leads with overdue follow-up highlighted in red. Time-to-first-contact is the metric that actually moves conversion; put it on screen.

---

### 5.10 CONSOLE — Unified Inbox

A three-pane layout: conversation list (filterable by unread, assigned-to-me, unassigned, channel), `ConversationThread` in the centre, and a right context panel showing the linked patient or lead with their upcoming appointment, outstanding balance and recent treatment. Supports assignment, internal notes not visible to the patient, quick-reply snippets, and template sending. Unassigned inbound messages raise a notification. The session-window state must be unmistakable, because sending a free-form message outside it simply fails.

---

### 5.11 CONSOLE — Billing & Payments

**Invoice list:** filterable by status (draft, sent, partially paid, paid, overdue, cancelled), date range, doctor and patient. Ageing buckets shown as filter chips with counts.

**Invoice detail / editor:** patient block, line items pulled from completed procedures or added manually, per-line discounts, plan-level discount, tax handling per the clinic's configuration, totals, payment history, balance, and instalment schedule. Actions: send via WhatsApp or email, generate a payment link, record an offline payment, print, duplicate, cancel with reason.

**Payments screen:** a chronological ledger of all money received with mode breakdown, daily close-of-day summary and reconciliation view, and refund handling.

**Payment gateway behaviour:** the online payment link opens a hosted checkout. Status is confirmed by webhook, never by the browser's redirect — the UI shows a "confirming payment" state and settles on the webhook-driven result. Failed and pending payments are visible, not silently dropped.

---

### 5.12 CONSOLE — Remaining operational screens (summarised)

**Lab tracking:** cases as cards or rows with patient, tooth, work type, lab, sent date, expected date, received date, trial dates, status and cost. Overdue cases surface on the doctor dashboard. Prevents the single most embarrassing clinic failure — patient arrives, crown isn't back.

**Inventory:** item list with category, current stock, reorder level, unit, expiry, supplier and value. Low-stock and near-expiry alerts. Stock movements ledger, purchase orders, and optional auto-deduction of consumables when a procedure is marked complete.

**Staff:** user list with role, permissions, contact, schedule and status. Attendance log. Doctor performance view showing production, collection, patient count, case acceptance rate and average revenue per patient per doctor.

**Analytics:** a report library with a consistent shell — filter bar, chart region, data table, export. Reports: revenue (production vs collection), appointment analytics (fill rate, no-show rate, cancellation reasons), patient analytics (new vs returning, retention cohorts, lifetime value distribution), treatment analytics (procedure volume and revenue mix, case acceptance rate by doctor and by treatment), marketing (lead source ROI, campaign performance, calculator usage by treatment), and operations (chair utilisation, average wait time, lab turnaround).

**Settings:** grouped forms per the route list in 4.3. The branding section — logo, colours, fonts, clinic details, domain — is what you touch when reselling, so it must be complete enough that a rebrand takes under an hour.

---

## PART 6 — CROSS-CUTTING FRONTEND CONCERNS

### 6.1 State management

Three distinct kinds of state, three distinct tools. Do not mix them.

| Kind | Tool | Examples |
|---|---|---|
| Server state | TanStack Query | Patients, appointments, invoices — everything from the API |
| Global client state | Zustand (small stores) | Auth session, clinic config, UI preferences, active branch, notification queue |
| Local state | Component state / URL | Form values, dialog open state, table filters (URL), wizard step (URL) |

**Query key convention:** hierarchical arrays — entity, scope, identifier, parameters. Invalidate at the narrowest level that is correct. Define, for every mutation, exactly which query keys it invalidates; write that list next to the mutation. Half of all "why is the UI stale" bugs come from skipping this step.

**Optimistic updates** only where the operation is near-certain and reversal is visually cheap: appointment status changes, drag-reschedule, task completion, lead stage moves. Never optimistically update money.

### 6.2 Data fetching conventions

One API client wrapping fetch, responsible for: attaching the auth token, attaching the clinic context header, normalising the envelope, mapping error codes to typed errors, retrying idempotent requests on network failure only, and redirecting to login on an authentication error. Every feature exposes its endpoints through a typed function per endpoint — components never construct URLs.

**Loading strategy:** skeletons that match the eventual layout, never spinners, for initial page loads. Inline spinners only inside buttons during a mutation. Suspense boundaries at the route level, error boundaries at the route and at each independent panel so one failing widget doesn't blank the dashboard.

### 6.3 Forms and validation

React Hook Form with a Zod schema per form. The **same validation shapes exist on the server** — the client copy is for user experience, the server copy is the truth. Validate on blur, re-validate on change after the first error, and disable submit only while the request is in flight (never based on validity — a disabled button with no explanation is a support ticket).

Required patterns: unsaved-changes guard on navigation for any form with clinical or financial data; autosave with a visible saved indicator for long clinical notes; field-level server error mapping; and a consistent error summary at the top of long forms.

### 6.4 Permissions in the UI

The RBAC matrix is defined in `backend-spec.md`. On the client, a single permission hook answers "can this user do X". Use it to hide navigation entries and disable actions — but never rely on it for security. Any hidden action must also be refused by the server. Disabled actions show a tooltip explaining which role is required, rather than being silently inert.

### 6.5 Responsive strategy

- **Site:** mobile-first. Most Indian patients arrive on a phone.
- **Portal:** mobile-first, bottom tab navigation.
- **Console:** desktop-first at 1280px and above, but three surfaces must work fully on tablet because that is where they are genuinely used — the Odontogram, the chairside clinical queue, and the treatment plan presentation. Below tablet, Console degrades to a focused subset: today's schedule, patient search, check-in, and payment collection. Do not attempt to render a full data table on a phone; render a card list instead.

### 6.6 Accessibility and clinical safety

Beyond standard requirements (keyboard operability, focus management in dialogs, labelled inputs, 4.5:1 contrast, live regions for toasts): **clinical status must never be communicated by colour alone.** Every tooth condition, allergy alert and payment status carries a shape, icon or text label in addition to colour. A colour-blind dentist misreading an odontogram is a real risk, not a checkbox.

### 6.7 Internationalisation and locale

Even if you ship English-only, route all strings through a translation layer from day one — Marathi and Hindi will be asked for in Pune, and retrofitting is miserable. Dates display as DD MMM YYYY, times in 12-hour with am/pm, currency in the Indian grouping convention, phone numbers with a +91 default.

### 6.8 Performance budget

Initial Console bundle under 250KB gzipped; route-level code splitting for every feature; the Odontogram, XrayViewer and charting library all lazily loaded. Virtualise any list expected to exceed 100 rows. Debounce search inputs at 300ms. Cache the clinic config aggressively — it changes almost never.

### 6.9 Whitelabelling checklist (your resale runbook)

To deploy for a new clinic, exactly these must change and nothing else: brand colour tokens, logo and favicon assets, clinic profile details, doctor and service content, price book, imagery, domain and email sender identity, WhatsApp business number, payment gateway credentials, and the feature-flag set. If anything else needs a code change, that is a bug in this architecture — fix it by moving the value into config.

---

## PART 7 — BUILD ORDER

Single phase overall, but there is a dependency-correct sequence. Follow it or you will rebuild things.

1. Project scaffold, tokens, Tailwind preset, shadcn primitives, layouts, router shell.
2. Layer 2 composites — `DataTable` first, because half the Console is a table.
3. Auth flows (email OTP, Google, session handling, route guards, permission hook).
4. Settings and clinic config, since everything else reads from it.
5. Patients module (list, create, record shell, header bar).
6. Appointments and calendar.
7. Clinical — Odontogram, notes, prescriptions, documents.
8. Treatment plans — builder, then presentation view.
9. Billing, payments, instalments, gateway integration.
10. Leads, cost calculator, public Site.
11. Communications — templates, inbox, automation, recalls.
12. Unscheduled recovery worklist and analytics (these consume everything above).
13. Inventory, lab, staff.
14. Patient Portal.

**Demo-readiness note:** the "hypothetical clinic" demo you plan to show only needs steps 1–10 populated with realistic seed data. Build a seed script producing 18 months of plausible history — around 400 patients, 2,000 appointments, treatment plans in every acceptance state, partially paid invoices, and an unscheduled treatment backlog worth a believable ₹8–15 lakh. A demo with three test patients named "asdf" loses the sale before you open your mouth.
