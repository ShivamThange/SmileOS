# DentalOS — Design System (extracted from the Claude Design project)

Source of truth: the Claude Design project `587f92db-e779-4980-91a2-6ea564344639`
("Design brief document"), files `DentalOS/Console/PatientRecord/Site/Calculator/
TreatmentPlan/Portal.dc.html`. **These design choices override the palette described
in `frontend-spec.md`.** The design is a warm, editorial IBM-Plex system — not the
generic teal+slate the spec text suggested.

Demo clinic in the mock: **Meher Dental Care**, Aundh · Pune. Owner: Dr. Anjali Meher.

## Typography
- **IBM Plex Sans** — all UI/body. Weights 400/500/600/700.
- **IBM Plex Serif** — display/marketing headlines (hub h1, Site hero). Weights 400/500/600.
- **IBM Plex Mono** — numeric IDs, times, phone numbers, keyboard shortcuts, small meta. 400/500/600.
- Page title (`h1`): 18px / 600 / -0.01em. Section heading: 13px / 600.
- Body 12.5px. Small 11–12px. Micro label: 10–11px / 700 / 0.06–0.09em tracking / UPPERCASE / `--muted-2`.
- Big numbers 20–32px / 700, **always `font-variant-numeric: tabular-nums`**, -0.02em.

## Colour tokens
| Token | Hex | Role |
|---|---|---|
| `--bg` | `#F4F3EF` | App canvas (warm cream); sidebar bg |
| `--bg-content` | `#FAF9F6` | Main content region |
| `--surface` | `#FFFFFF` | Cards, header, drawers, popovers |
| `--ink` | `#21201C` | Primary text; also dark/toast surface |
| `--muted` | `#6E6C64` | Secondary text |
| `--muted-strong` | `#57534A` / `#4A4944` | Body-muted / nav idle text |
| `--muted-2` | `#98968C` | Faint meta, micro-labels |
| `--muted-3` | `#B0AEA4` | Faintest |
| `--border` | `#E6E4DE` | Default border/divider |
| `--border-strong` | `#CFCDC5` / `#DDDBD3` | Hover border |
| `--border-faint` | `#F0EEE8` | Row dividers |
| `--track` | `#EFEDE7` | Progress/bar track; also `#EBEAE4` nav hover |
| `--primary` | `#20614E` | Brand (forest teal); CTAs, active nav |
| `--primary-hover` | `#17493A` | |
| `--primary-lift` | `#2A7A63` | Darker-bg hover on dark |
| `--primary-tint` | `#EAF1EE` | Avatar/confirmed bg, tint buttons |
| `--primary-tint-border` | `#C7DAD1` / `#D4E0DA` | |
| `--on-primary` | `#F7F6F3` | Text on teal |
| `--warning` | `#9A6215` | "Money at risk", amber accents |
| `--warning-bg` | `#FFFDF7` / `#FAF3E7` | |
| `--warning-border` | `#EBD9BC` / `#E5D2AC` | |
| `--warning-text` | `#8A6B33` | |
| `--danger` | `#A8342A` | Destructive, no-show, overdue, alerts |
| `--danger-bg` | `#FBEFED` | |
| `--danger-border` | `#EFC7C2` | |
| `--danger-text` | `#B07770` | |
| `--info` | `#2E6DA4` | Lead stage "contacted" |
| `--accent-purple` | `#7A4C8A` | Lead stage "consult booked" |

**Chart green ramp** (mono, single-hue): `#20614E → #4E8A75 → #8FB5A6 → #CBDDD5 → #D4E0DA`.
**Lead-stage accents:** new `#9A6215`, contacted `#2E6DA4`, consult `#7A4C8A`, won `#20614E`, lost `#98968C`.

## Appointment status model (colour + label)
| status | bg | border | text | sub | label |
|---|---|---|---|---|---|
| `booked` | `#FFFFFF` | `#DDDBD3` | `#21201C` | `#6E6C64` | Booked |
| `confirmed` | `#EAF1EE` | `#C7DAD1` | `#21201C` | `#5B7A6E` | Confirmed (labelColor `#20614E`) |
| `arrived` | `#FAF3E7` | `#E5D2AC` | `#21201C` | `#8A6B33` | Arrived (labelColor `#9A6215`) |
| `inchair` | `#20614E` | `#17493A` | `#F7F6F3` | `#BFD5CC` | In the chair (labelColor `#CBDDD5`) |
| `done` | `#F4F3EF` | `#E6E4DE` | `#98968C` | `#B0AEA4` | Done |
| `cancelled` | 45° stripes `#FAF9F6`/`#EFEDE7` | `#E6E4DE` | `#98968C` | | Cancelled |
| `noshow` | `#FBEFED` | `#EFC7C2` | `#21201C` | `#B07770` | No-show (labelColor `#A8342A`) |

Urgency chips: High → danger tint, Moderate → warning tint, Routine → neutral (`#F4F3EF`/`#6E6C64`/`#E6E4DE`).
Appointment flag chips: `NEW`, `₹ DUE`, `CONSENT`, `LEAD`, `✓ REMINDED`.

## Shape & elevation
- Radius: 6–7px (nav item, chip, small btn), 8px (button, input, select), 10px (inner cards), 12–14px (panels/cards/modal), 50% (avatar/dot).
- Shadows: card-hover `0 2px 8px rgba(33,32,28,.06)` / `0 4px 16px rgba(33,32,28,.07)`;
  dropdown `0 8px 24px rgba(33,32,28,.12)`; drawer `-16px 0 48px rgba(33,32,28,.14)`;
  palette `0 24px 64px rgba(33,32,28,.3)`; toast `0 8px 24px rgba(33,32,28,.3)`.
- Console prefers borders over shadows (density > decoration).
- Spacing scale (px): 2 4 6 8 10 12 14 16 18 20 22 24 32 40.

## Money
Indian grouping, tabular figures: `₹12,34,567`. Group last 3 digits, then in 2s.
Backend stores paise (integer); formatter converts at display. One formatter, used everywhere.

## ConsoleLayout
- **Sidebar** 224px (expanded) / 60px (collapsed), bg `--bg`, right border. Logo = 28px teal
  rounded square with clinic initial. Nav groups: ungrouped `Dashboard / Schedule / Patients /
  Clinical`; **BUSINESS** `Revenue(3) / Growth(5)`; **CLINIC** `Operations(2) / Team / Insight /
  Settings`. Count badges are teal pills, mono. Active item: white bg, teal text, 600. Collapse
  toggle pinned at bottom.
- **Header** 52px, white, bottom border. ⌘K search trigger (320px, muted, mono ⌘K chip) · spacer ·
  date label + branch · notification bell (red dot) · teal **Create** button (dropdown) · avatar (tint circle, initials).
- **Main** bg `--bg-content`, scrolls; padding `20px 24px 40px`; screens centered at max-width 1240–1400px.
- **Right drawers**: patient preview 400px, appointment detail 360px; slide-in `dcDrawer` anim.
- **Command palette**: 560px modal, 12vh top, overlay `rgba(33,32,28,.32)`; sections PATIENTS / GO TO.
- **Toast**: bottom-center, ink bg, cream text, auto-dismiss ~2.6s.

## Screens designed at full fidelity (rebuild faithfully)
Owner **Dashboard** (Money-at-risk hero panel + Today panel + 5 stat cards + collections bars +
revenue-by-treatment + production-per-doctor + lead-source + new-vs-returning), **Calendar**
(day grid by chair/doctor with now-line, lunch hatch, status-coloured blocks + list view + waitlist
rail), **Recovery worklist** (4 summary cards + filters + value-sorted table w/ row expansion +
bulk bar), **Leads** kanban (5 stages, drag, per-column value), **Patient Record** (see PatientRecord.dc.html — persistent header bar, medical alerts, odontogram).
Undesigned Console routes use the design's own **placeholder pattern** (icon tile + title + one-line
body + CTA) — do not invent bespoke visuals for them.
