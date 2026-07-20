# DentalOS — Backend Specification

**Stack:** Node.js + Express + MongoDB (Mongoose) + Redis
**Deployment model:** Single-tenant per clinic, multi-tenant-ready. Every document carries `clinicId`. Every query is scoped by it. Flipping to shared multi-tenancy later becomes a middleware change, not a migration.
**Scope:** Single-phase build.

> **Reading this document:** No code. It defines collections and their fields, endpoints and their contracts, the rules that govern them, and the wiring back to the frontend. Pair with `frontend-spec.md`.

---

## PART 0 — ARCHITECTURAL PRINCIPLES

Six decisions that shape everything below. Understand *why* each exists.

**1. Layered, not tangled.** Request flows: Route → Middleware → Validator → Controller → Service → Repository/Model. Controllers only translate HTTP to service calls; they contain no business logic. Services contain all business logic and are the only layer permitted to orchestrate across multiple collections. This matters because your revenue logic (case acceptance, recovery worklists, recall generation) is genuinely complex and must be testable without HTTP.

**2. Every write is an event.** Any state change that a human might later ask "who did this and when" about — and in a clinic, that is nearly all of them — writes an audit entry. This is a legal requirement under DPDP-aligned health data handling and it is also the feature that makes an owner trust the software with their money.

**3. Money is never floating point.** Store all currency as integers in paise. Every rupee figure in the API is an integer count of paise, converted only at the display layer. Floating-point rupees will, with certainty, produce a ₹0.01 reconciliation dispute that costs you a weekend.

**4. Derived numbers are computed, not stored — except when they aren't.** Balances, totals and acceptance rates are computed from source records so they cannot drift. The exception is aggregate analytics over large ranges, which are materialised nightly into summary documents. Never store an invoice balance as a mutable field that payments increment.

**5. Soft delete, always.** Nothing clinical or financial is ever hard-deleted. Every collection carries `isDeleted`, `deletedAt`, `deletedBy`. Default query scope excludes deleted documents.

**6. External calls are queued, never inline.** WhatsApp sends, emails, PDF generation and payment reconciliation run through a job queue. An HTTP request must never block on Meta's API.

---

## PART 1 — PROJECT STRUCTURE

```
src/
  config/          env loading and validation, db, redis, queue, logger, constants
  models/          Mongoose schemas
  modules/         one folder per domain: routes, controller, service, validator, types
  middleware/      auth, tenant, rbac, validate, rateLimit, errorHandler, audit, upload
  services/        cross-cutting: email, whatsapp, payment, storage, pdf, sms, notification
  jobs/            queue definitions, processors, schedulers
  utils/           money, date, pagination, slug, id-generation, encryption
  webhooks/        payment gateway, whatsapp, calendar
  scripts/         seed, migrations, backfills
  tests/
```

**Response envelope.** Every endpoint returns a consistent shape: a success flag, a data payload, an optional message, an optional pagination block, and on failure an error object carrying a machine-readable code, a human message, and an optional field-level detail map. Never return bare arrays; you will want to add metadata later and breaking your own client is avoidable.

**Error codes.** Define a fixed enum. Categories: `AUTH_*`, `PERM_*`, `VALIDATION_*`, `NOT_FOUND`, `CONFLICT_*` (e.g. slot already booked), `PAYMENT_*`, `EXTERNAL_*`, `RATE_LIMIT`, `INTERNAL`. The frontend maps codes to messages; never parse error strings.

---

## PART 2 — DATA MODEL

Common fields on every collection unless stated: `clinicId`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `isDeleted`, `deletedAt`, `deletedBy`.

### 2.1 Identity & configuration

**Clinic** — the tenant root and the whitelabelling payload.
Name, legal name, slug, logo URL, favicon, brand colour set, font choices, tagline, description, registration numbers, GSTIN, address block, geo coordinates, contact numbers, email, website domain, social links, timezone (fixed to Asia/Kolkata), currency, working hours per weekday with break windows, holiday list, appointment slot granularity, default appointment duration, buffer time, cancellation policy window, features flag object, subscription/plan metadata, and integration credential references (never raw secrets — store references to an encrypted secrets store).

**Branch** — for multi-location clinics. Name, address, phone, working hours override, operatory list reference, active flag. Every operationally-scoped document carries an optional `branchId`.

**Operatory (Chair)** — name, branch, equipment notes, active flag, colour for calendar rendering.

**User** — staff account. Name, email (unique per clinic), phone, password hash (nullable — OTP and Google users may have none), auth providers list, role, custom permission overrides, avatar, employment details, doctor profile sub-document when the role is doctor (registration number, qualifications, specialisations, years of experience, bio, public profile flag, consultation fee, slug for the public site, signature image), working schedule, leave records, active flag, last login, failed login count, lockout timestamp.

**Role & Permission** — roles are seeded (Owner, Admin, Doctor, Receptionist, Assistant, Accountant, Lab Technician) but stored as documents so a clinic can add one. A permission is a resource-action pair. A user's effective permissions are their role's set, plus explicit grants, minus explicit denials.

**Session / RefreshToken** — user reference, token hash, device fingerprint, IP, user agent, issued and expiry timestamps, revoked flag and reason.

**OtpToken** — identifier (email or phone), channel, purpose (login, registration, booking verification, password reset, plan acceptance), code hash, attempt count, max attempts, expiry, consumed flag, requesting IP. Codes are hashed, never stored plaintext, and expire in 10 minutes.

### 2.2 Patient domain

**Patient** — clinic-scoped human record.
Patient number (human-readable, sequential per clinic, e.g. a configurable prefix plus a zero-padded counter), first/last name, date of birth, age fallback when DOB is unknown (extremely common in Indian practice — accept it), gender, blood group, phone (primary, indexed), alternate phone, WhatsApp number if different, email, full address, occupation, referral source, referred-by patient reference, ABHA number (optional, for future ABDM readiness), government ID reference, emergency contact, photo, family group reference, tags, notes, marketing consent flags per channel, portal access enabled flag, portal user credential reference, status (active, inactive, archived), first visit date, last visit date, next recall date, and a lifetime-value snapshot updated by a nightly job.

**MedicalHistory** — one per patient, versioned on change. Allergies (list with substance, reaction, severity), current medications, chronic conditions (diabetes, hypertension, cardiac, thyroid, asthma, bleeding disorders — flagged individually because each changes dental treatment), past surgeries, hospitalisations, pregnancy status and trimester, smoking and tobacco use (critical in the Indian context — gutkha and pan masala history directly predicts oral cancer screening need), alcohol use, previous dental history, previous complications with anaesthesia, and a free-text notes field. Any allergy or high-severity condition must be surfaced by the patient read endpoint as a top-level alerts array so the UI cannot fail to display it.

**FamilyGroup** — group name, member patient references with relationship labels, primary contact, and a shared-billing flag. Indian dental practice is heavily family-based; one person books for four people and pays for all of them. Supporting this properly is a differentiator.

**Document** — patient reference, category (xray, opg, cbct, intraoral photo, consent, lab report, prescription, insurance, identity, other), file storage key, original filename, MIME type, size, thumbnail key, associated appointment or treatment reference, tooth references, capture date, uploaded-by, description, and a consent-for-marketing-use flag on clinical photographs.

### 2.3 Scheduling domain

**Appointment**
Patient reference (nullable when the booking originated from a lead not yet converted), lead reference, doctor, operatory, branch, start datetime, end datetime, duration, appointment type (consultation, treatment, follow-up, emergency, recall, lab trial), treatment/procedure references, chief complaint, status, source (walk-in, phone, online booking, portal, WhatsApp, recall campaign, lead conversion), booked-by, confirmation state and timestamp, check-in timestamp, treatment start timestamp, completion timestamp, cancellation timestamp with reason and by-whom, no-show flag, reminder delivery records, notes, colour override, recurrence group reference, and the treatment plan line items this appointment is intended to deliver.

**Status lifecycle:** `scheduled → confirmed → checked_in → in_progress → completed`, with `cancelled` and `no_show` as terminal branches. Transitions are validated in the service layer; an appointment cannot go from `scheduled` straight to `completed` without passing through check-in, because that check-in timestamp is what your wait-time analytics depend on.

**Waitlist** — patient or lead, desired treatment, preferred doctor, preferred date range and time-of-day preference, urgency, contact attempts, status, and expiry.

**Availability rules** are derived, not stored: a slot is offered only if the operatory is free, the doctor is working and not on leave, the requested procedure duration plus buffer fits, the date is not a clinic holiday, and the slot is not within the clinic's minimum lead time for online booking.

**Blocked time** — resource reference, start, end, reason (leave, conference, maintenance, personal), recurring rule, created-by.

### 2.4 Clinical domain

**DentalChart** — one active chart per patient. Numbering system, dentition type, and a map of tooth records. Each tooth record holds: tooth number, presence status (present, missing, unerupted, extracted with date and reason, impacted), whole-tooth conditions, per-surface condition entries (surface, condition type, severity, diagnosed date, diagnosing doctor, associated note), existing restorations with material and date, endodontic status, prosthetic status (crown, bridge abutment, bridge pontic, implant with system and date, veneer), mobility grade, and periapical findings. Chart changes append to a **ChartHistory** collection rather than overwriting — you must be able to reconstruct what the mouth looked like on any past date, both clinically and for medico-legal defence.

**PerioChart** — patient, exam date, examining doctor, and per-tooth six-site measurements: probing depth, gingival margin, bleeding on probing, suppuration, plaque, plus per-tooth mobility and furcation. Stores computed attachment loss, and summary indices (bleeding percentage, plaque percentage, pocket-depth distribution). Multiple charts per patient over time, compared in the UI.

**ClinicalNote** — patient, appointment, doctor, note date, chief complaint, history of present illness, clinical examination findings, investigations advised, diagnosis (with tooth references), procedures performed (referencing catalogue entries and teeth), anaesthesia used, materials used with batch numbers where regulated, complications, post-operative instructions, advice, next visit plan, attachments, a signed/locked flag with lock timestamp, and an amendments array. **Notes lock after a configurable window (default 24 hours) and thereafter accept only appended amendments carrying their own author and timestamp.** Overwriting a clinical note silently is indefensible if it ever reaches a consumer forum.

**Prescription** — patient, doctor, date, linked appointment, medication lines (drug name, strength, form, dosage, frequency, duration, route, timing relative to food, quantity, instructions), general advice, follow-up date, doctor signature reference, and a generated PDF key. Include a drug interaction and allergy cross-check against the patient's medical history at creation time — a warning, not a block.

**ConsentForm** — patient, template reference, procedure, rendered content snapshot (store the actual text presented, not just a template pointer, because templates change), signature image or OTP-verified acceptance record, witness, signed timestamp, IP address, and PDF key.

### 2.5 Treatment & revenue domain

This is where the product earns its price. Model it carefully.

**Procedure (Service Catalogue)** — code, name, patient-friendly name, category (preventive, restorative, endodontic, periodontal, oral surgery, prosthodontic, orthodontic, pedodontic, implant, cosmetic), description for the public site, default duration, default price, price variants by tier (standard/premium/luxury) and by material, tax applicability, whether it is tooth-specific and whether it is surface-specific, default consumables consumed (driving inventory deduction), typical number of sittings, default recall interval on completion, requires-consent flag, requires-lab-work flag, public visibility flag, and display order.

**TreatmentPlan** — patient, created-by doctor, plan date, title, clinical summary, phases (each with name, sequence, description, target timeframe), and line items. Plan-level fields: subtotal, discount (amount or percentage with a reason and approving user), tax, total, accepted total, completed total, status (draft, presented, partially accepted, accepted, declined, completed, expired), presented timestamp, decision timestamp, decision channel (in-clinic, portal, WhatsApp), validity expiry date, notes, and a generated PDF key.

**TreatmentPlanItem** — the atomic revenue unit and the row in your recovery worklist.
Plan reference, phase reference, procedure reference, tooth number(s), surfaces, quantity, unit price, discount, line total, priority (urgent, recommended, elective), sequence, clinical justification, **status** (proposed, accepted, declined, scheduled, in_progress, completed, cancelled), decision timestamp and reason, scheduled appointment reference, completing appointment reference, completion date, performing doctor, invoice line reference, and a follow-up sub-document (next follow-up date, contact attempt count, last contact date, last contact outcome, assigned staff member, snooze-until date).

**Why item-level status is the whole design.** A plan is not accepted or rejected as a unit — patients accept the root canal and defer the crown. Tracking status per item is what lets you compute a truthful case-acceptance rate and, more importantly, generate the unscheduled-treatment worklist. If you model acceptance at the plan level you have built the same blunt tool every competitor already sells.

**Derived revenue metrics** (computed, never stored on the plan):
- *Case acceptance rate* = accepted item value ÷ presented item value, sliceable by doctor, procedure category and time period.
- *Scheduling rate* = value of accepted items that reached scheduled or beyond ÷ total accepted value.
- *Unscheduled treatment value* = sum of line totals for items in `accepted` or `proposed` status, on non-expired non-declined plans, with no linked future appointment.
- *Recoverable pipeline* = unscheduled value filtered to plans younger than a configurable staleness window.

**Recall** — patient, recall type (hygiene, ortho adjustment, implant review, post-op check, denture review, custom), source (auto-generated from a completed procedure, or manual), due date, interval, priority, status (pending, contacted, scheduled, completed, declined, lapsed), contact attempt history, linked appointment when booked, assigned staff, and notes. Auto-created by a completion hook using the procedure's default recall interval.

### 2.6 Billing domain

**Invoice** — invoice number (sequential per clinic per financial year, with a configurable prefix), patient, family-group billing reference, date, due date, line items, subtotal, discount with reason and approver, taxable amount, tax breakdown, total, amount paid (a computed projection, not an authoritative field), balance, status, linked appointments, linked treatment plan, notes, terms, PDF key, and dispatch records (sent via WhatsApp/email, timestamps).

**InvoiceLineItem** — procedure reference or free-text description, tooth references, quantity, unit price, discount, tax rate, line total, performing doctor (this is what enables doctor-wise production reporting), and treatment plan item reference.

**Payment** — invoice reference (nullable for advances), patient, amount, date, mode (cash, UPI, card, netbanking, cheque, bank transfer, online gateway, wallet, insurance), reference number, gateway transaction identifiers, gateway order identifier, gateway signature, status (pending, success, failed, refunded, partially refunded), received-by user, receipt number, receipt PDF key, notes, and reconciliation flag.

**InstalmentPlan** — patient, treatment plan or invoice reference, total amount, down payment, number of instalments, schedule entries (sequence, due date, amount, status, linked payment, reminder records), status, and notes. Overdue instalments feed both the receivables report and an automation rule.

**Expense** — date, category, vendor, description, amount, tax, payment mode, paid-by, attachment, recurring flag. Needed for a truthful profitability report; without expenses your analytics only tell half a story and the owner knows it.

**Refund** — payment reference, amount, reason, approved-by, mode, status, gateway refund identifier, date.

### 2.7 Growth domain

**Lead** — name, phone, alternate phone, email, source (website form, cost calculator, online booking abandonment, phone call, walk-in, Google, Instagram, Facebook, referral, third-party listing, campaign), source detail and UTM parameters, treatment interest, estimated value, calculator payload snapshot, stage, assigned-to, priority, first response timestamp, activity list, notes, next follow-up date, converted patient reference, conversion date, lost reason, and tags.

**Time-to-first-contact** is derived from creation timestamp to the first outbound activity and must be exposed in the list response — it is the metric that most directly predicts conversion, and putting it on screen changes staff behaviour.

**LeadActivity** — lead reference, type (call, WhatsApp, email, SMS, note, stage change, appointment booked), direction, content, outcome, staff member, timestamp, duration for calls.

**CostEstimate** — every calculator run, converted or not. Session identifier, treatment category, all input selections, computed range (low and high), component breakdown, EMI options shown, whether the visitor converted to a lead, referrer and UTM data, device, and timestamp. Anonymous runs are retained for analytics with no personal data attached until conversion.

**Campaign** — name, type (recall, reactivation, unscheduled recovery, promotional, review request, birthday, festival), channel, target segment definition (a stored filter query), message template, scheduling (immediate, scheduled, recurring), status, and per-recipient delivery records with sent/delivered/read/replied/converted outcomes plus attributed revenue.

**Review** — patient, appointment, request sent timestamp and channel, internal rating and feedback, whether the patient was routed to a public platform, public platform (Google, Practo, Justdial), public review link, response status. **The routing rule matters:** ask for a private rating first; route only satisfied patients (typically 4+) to the public platform and route dissatisfied patients into an internal service-recovery workflow. Review requests sent within 24 hours of a visit convert dramatically better than later ones, so this is queued at completion, not batched weekly.

### 2.8 Communication domain

**MessageTemplate** — name, channel, category, WhatsApp template name and language and approval status where applicable, body with named variables, header and footer, button definitions, the variable schema, active flag, and usage count.

**Conversation** — patient or lead reference, channel, external thread identifier, assigned staff, status (open, pending, resolved), last message timestamp, unread count, session-window expiry timestamp (for WhatsApp's 24-hour rule), and tags.

**Message** — conversation, direction, channel, template reference when templated, rendered content, attachments, external message identifier, status (queued, sent, delivered, read, failed) with per-status timestamps, failure code and reason, sent-by (user or system with the triggering automation), and cost where the channel charges per message.

**AutomationRule** — name, trigger event (appointment booked, appointment reminder due at N hours before, appointment completed, no-show recorded, treatment plan presented, plan item deferred, invoice overdue, instalment due, recall due, birthday, lead created, lead idle for N days), conditions (a stored filter expression), delay, channel, template, target audience, active flag, quiet-hours respect flag, and execution statistics. **Quiet hours are mandatory** — a clinic that WhatsApps a patient at 6am gets reported, and Meta's quality rating is unforgiving.

**Notification** — in-app, for staff. Recipient, type, title, body, link, read flag, priority.

### 2.9 Operations domain

**LabCase** — patient, doctor, lab (supplier reference), work type, teeth, shade, material, impression date, sent date, expected return date, actual return date, trial appointments, status (impression taken, sent to lab, in progress, trial, remake required, received, fitted, cancelled), cost, invoice reference, lab prescription document, remake reason, and notes.

**InventoryItem** — name, category, SKU, unit, current stock, reorder level, reorder quantity, unit cost, selling price when billable, supplier, batch records (batch number, expiry, quantity, cost), storage location, is-consumable flag, and linked procedures for auto-deduction.

**StockMovement** — item, batch, type (purchase, consumption, adjustment, return, expiry write-off, transfer), quantity, reference document, performed-by, reason, resulting balance.

**PurchaseOrder** — supplier, order date, expected date, line items, totals, status, received records, invoice reference.

**Supplier** — name, type (dental supplies, lab, equipment, pharmacy), contact details, GSTIN, payment terms, rating, notes.

**Attendance** — staff, date, check-in, check-out, hours, status, notes.

**AuditLog** — actor, action, resource type, resource identifier, patient reference when applicable, before and after snapshots for sensitive changes, IP address, user agent, timestamp, and outcome. Retained for the statutory period; never deleted by application logic.

### 2.10 Indexing strategy

Every collection: compound index on `clinicId` plus its primary lookup field. Specifically —
Patient on clinic+phone (unique), clinic+patientNumber (unique), and a text index over name and phone for search.
Appointment on clinic+startDatetime, clinic+doctor+startDatetime, clinic+operatory+startDatetime (this one backs conflict detection and must be fast), clinic+patient+startDatetime, clinic+status+startDatetime.
TreatmentPlanItem on clinic+status+followUpDate and clinic+patient — the recovery worklist query lives here and will be your slowest endpoint if you skip this.
Invoice on clinic+status+dueDate and clinic+patient.
Payment on clinic+date and clinic+invoice.
Lead on clinic+stage+nextFollowUp and clinic+phone.
Recall on clinic+status+dueDate.
Message on conversation+createdAt.
AuditLog on clinic+createdAt and clinic+resourceType+resourceId.

---

## PART 3 — AUTHENTICATION & AUTHORISATION

### 3.1 Chosen model

Three entry paths, one session system.

**Email OTP over SMTP** — primary for staff and patients. The user submits an email; the server generates a six-digit code, stores only its hash with a 10-minute expiry, and dispatches it via the queue through SMTP. Verification consumes the token atomically. Rate limits: 3 requests per email per 15 minutes, 5 verification attempts per token, 10 requests per IP per hour. On a fresh email for an unregistered patient in the booking flow, verification implies registration.

**Google OAuth** — authorisation-code flow with PKCE. On callback, match on verified email. If a user exists with that email, link the Google provider to the existing account rather than creating a duplicate — this is the single most common bug in mixed-auth systems. If no user exists, create one only if self-registration is permitted for that surface (patients yes, staff no — staff accounts are invited by an admin).

**Password** — optional fallback, available to staff who prefer it. Argon2id hashing. Not offered to patients at all; OTP is simpler and eliminates a whole class of support burden.

### 3.2 Tokens

Short-lived access token (15 minutes) carrying user id, clinic id, role, permission set version, and session id. Long-lived refresh token (30 days) stored hashed server-side, rotated on every use, with reuse detection that revokes the entire session family on a replay. Access tokens go in memory on the client; refresh tokens in an httpOnly, secure, SameSite-strict cookie. Patients and staff use separate token audiences so a patient token can never address a Console endpoint.

### 3.3 Middleware chain

Order matters: request id → logger → CORS → helmet → body parse → rate limit → authenticate → resolve tenant → authorise (RBAC) → validate payload → controller → audit → error handler.

The tenant middleware attaches `clinicId` to the request from the token, and the repository layer injects it into every query automatically. **No service method should ever accept a raw filter that could omit clinic scoping.** In single-tenant deployment this is redundant; the day you consolidate, it is the only thing preventing a cross-clinic data leak.

### 3.4 RBAC matrix

Resources: patient, medical_history, appointment, chart, clinical_note, prescription, treatment_plan, invoice, payment, refund, expense, lead, campaign, message, inventory, lab_case, staff, settings, analytics, audit_log.
Actions: create, read, update, delete, export, approve.

| Role | Summary of grants |
|---|---|
| **Owner** | Everything, including audit log, settings, financial exports, discount approval above threshold. |
| **Admin** | Everything except audit log deletion, subscription settings and owner-level financial exports. |
| **Doctor** | Full clinical create/read/update. Read patients and appointments. Create treatment plans and prescriptions. Read own performance analytics only. No settings, no refunds, discount only up to a configured limit. |
| **Receptionist** | Patients create/read/update. Appointments full. Invoices create/read, payments create. Leads and messages full. Read-only on clinical summary — **cannot read full clinical notes.** No analytics beyond today's operational counts. |
| **Assistant** | Read appointments and patient basics. Update chart and inventory consumption. No financial access at all. |
| **Accountant** | Full financial read plus payment and expense create. Read patient identity and invoice data only, no clinical data. |
| **Lab Technician** | Lab cases only, plus the minimum patient identifiers needed. |
| **Patient (portal)** | Own records only, enforced by an ownership check independent of role — never trust the identifier in the request path. |

Sensitive actions require re-authentication or a second factor regardless of role: deleting a patient, issuing a refund above a threshold, exporting bulk patient data, and changing payment gateway credentials.

---

## PART 4 — API ENDPOINTS

Base path `/api/v1`. Conventions: list endpoints accept `page`, `limit`, `sort`, `order`, `search`, plus resource-specific filters, and return a pagination block. All datetimes are ISO 8601 in UTC; the client renders in Asia/Kolkata. All money is integer paise.

### 4.1 Auth

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/otp/request` | Send an OTP to an email for a given purpose |
| POST | `/auth/otp/verify` | Verify code, issue tokens, create or link account |
| POST | `/auth/google` | Exchange authorisation code, issue tokens |
| POST | `/auth/login` | Password login (staff fallback) |
| POST | `/auth/refresh` | Rotate refresh token, issue access token |
| POST | `/auth/logout` | Revoke current session |
| POST | `/auth/logout-all` | Revoke every session for the user |
| GET | `/auth/me` | Current user, role, effective permissions, clinic context |
| PATCH | `/auth/me` | Update own profile |
| POST | `/auth/password/set` | Set or change password |
| GET | `/auth/sessions` | List active sessions |
| DELETE | `/auth/sessions/:id` | Revoke a specific session |

### 4.2 Clinic & settings

| Method | Path | Purpose |
|---|---|---|
| GET | `/clinic` | Full clinic config — cached aggressively, drives frontend theming |
| PATCH | `/clinic` | Update clinic profile |
| PATCH | `/clinic/branding` | Logo, colours, fonts |
| GET/PATCH | `/clinic/working-hours` | Weekly schedule and breaks |
| GET/POST/PATCH/DELETE | `/clinic/holidays` | Holiday calendar |
| GET/POST/PATCH/DELETE | `/clinic/branches` | Branch management |
| GET/POST/PATCH/DELETE | `/clinic/operatories` | Chair management |
| GET/PATCH | `/clinic/features` | Feature flags |
| GET/PATCH | `/clinic/integrations` | Integration credential references |
| GET/POST/PATCH/DELETE | `/procedures` | Service catalogue and price book |
| GET | `/procedures/public` | Public-facing services for the Site |
| POST | `/procedures/bulk-price-update` | Apply a percentage or absolute price change across a category |
| GET/POST/PATCH/DELETE | `/plan-templates` | Reusable treatment plan templates |
| GET/POST/PATCH/DELETE | `/consent-templates` | Consent form templates |

### 4.3 Users & roles

`GET/POST /users`, `GET/PATCH/DELETE /users/:id`, `POST /users/invite`, `POST /users/:id/activate`, `POST /users/:id/deactivate`, `GET/PATCH /users/:id/permissions`, `GET/PATCH /users/:id/schedule`, `GET/POST /users/:id/leave`, `GET/POST /attendance`, `GET /users/:id/performance`.

### 4.4 Patients

| Method | Path | Purpose |
|---|---|---|
| GET | `/patients` | List with search, filters (status, doctor, tag, recall due, has balance, last visit range), pagination |
| POST | `/patients` | Create; auto-generates patient number |
| GET | `/patients/:id` | Full record including medical alerts array, balance, next appointment |
| PATCH | `/patients/:id` | Update |
| DELETE | `/patients/:id` | Soft delete, requires elevated permission |
| GET | `/patients/search` | Fast typeahead by name, phone or patient number |
| POST | `/patients/check-duplicate` | Phone and name match before creation |
| POST | `/patients/merge` | Merge duplicate records, reassigning all children |
| GET | `/patients/:id/timeline` | Unified chronological activity stream |
| GET | `/patients/:id/summary` | Header-bar payload: alerts, balance, last/next visit, recall |
| GET/PUT | `/patients/:id/medical-history` | Versioned medical history |
| GET/POST | `/patients/:id/documents` | Document list and upload |
| DELETE | `/documents/:id` | Remove a document |
| GET/POST/PATCH/DELETE | `/patients/:id/notes` | Administrative (non-clinical) notes |
| GET/POST | `/family-groups` | Family grouping |
| POST | `/patients/:id/portal-access` | Enable or disable portal access |
| GET | `/patients/:id/ledger` | Full financial ledger |
| POST | `/patients/export` | Bulk export, permission-gated and audited |

### 4.5 Appointments

| Method | Path | Purpose |
|---|---|---|
| GET | `/appointments` | List with date range, doctor, operatory, status, patient, branch filters |
| GET | `/appointments/calendar` | Calendar-optimised payload: appointments plus resource definitions, working hours, blocked time and holidays for the range, in one request |
| POST | `/appointments` | Create with conflict validation |
| GET | `/appointments/:id` | Detail |
| PATCH | `/appointments/:id` | Update |
| POST | `/appointments/:id/reschedule` | Move, with an optional notify flag |
| POST | `/appointments/:id/confirm` | Mark confirmed |
| POST | `/appointments/:id/check-in` | Record arrival |
| POST | `/appointments/:id/start` | Move to in-progress |
| POST | `/appointments/:id/complete` | Complete; triggers recall generation, invoice draft, review request and inventory deduction |
| POST | `/appointments/:id/cancel` | Cancel with a required reason |
| POST | `/appointments/:id/no-show` | Mark no-show; triggers follow-up automation |
| GET | `/appointments/availability` | Available slots for a doctor/procedure/date range — the booking engine |
| GET | `/appointments/today` | Today's operational list |
| GET | `/appointments/queue` | Checked-in patients awaiting treatment, ordered with wait times |
| POST | `/appointments/bulk-remind` | Send reminders to a filtered set |
| GET/POST/PATCH/DELETE | `/waitlist` | Waitlist management |
| POST | `/waitlist/:id/schedule` | Convert a waitlist entry into an appointment |
| GET/POST/DELETE | `/blocked-time` | Resource blocking |

**Conflict rule enforced server-side:** an operatory cannot host two overlapping non-cancelled appointments. A doctor may overlap across different operatories only if the clinic enables that. Attempted conflicts return a specific conflict error code carrying the conflicting appointment so the UI can offer a resolution rather than a dead end.

### 4.6 Clinical

| Method | Path | Purpose |
|---|---|---|
| GET | `/patients/:id/chart` | Current dental chart |
| PUT | `/patients/:id/chart/tooth/:toothNumber` | Update a tooth's conditions and surfaces |
| POST | `/patients/:id/chart/bulk-update` | Apply a condition across several selected teeth |
| GET | `/patients/:id/chart/history` | Chart change log, optionally as of a date |
| GET/POST | `/patients/:id/perio-charts` | Periodontal charting |
| GET | `/perio-charts/:id/comparison` | Compare two exams |
| GET/POST | `/patients/:id/clinical-notes` | Clinical notes |
| PATCH | `/clinical-notes/:id` | Edit within the lock window |
| POST | `/clinical-notes/:id/amend` | Append an amendment after locking |
| POST | `/clinical-notes/:id/sign` | Sign and lock |
| GET/POST | `/patients/:id/prescriptions` | Prescriptions |
| GET | `/prescriptions/:id/pdf` | Rendered PDF |
| POST | `/prescriptions/:id/send` | Deliver via WhatsApp or email |
| GET | `/drugs/search` | Drug master typeahead |
| POST | `/prescriptions/interaction-check` | Allergy and interaction warnings |
| GET/POST | `/patients/:id/consents` | Consent forms |
| POST | `/consents/:id/sign` | Capture signature or OTP acceptance |

### 4.7 Treatment plans — the revenue core

| Method | Path | Purpose |
|---|---|---|
| GET | `/treatment-plans` | List with status, doctor, value band, date filters |
| POST | `/treatment-plans` | Create |
| GET | `/treatment-plans/:id` | Full plan with phases and items |
| PATCH | `/treatment-plans/:id` | Update plan-level fields |
| DELETE | `/treatment-plans/:id` | Soft delete |
| POST | `/treatment-plans/from-template` | Instantiate from a template |
| POST | `/treatment-plans/:id/items` | Add a line item |
| PATCH | `/treatment-plan-items/:id` | Update a line item |
| DELETE | `/treatment-plan-items/:id` | Remove a line item |
| POST | `/treatment-plans/:id/reorder` | Reorder phases and items |
| POST | `/treatment-plans/:id/present` | Mark as presented; stamps the presentation timestamp that all acceptance analytics measure from |
| POST | `/treatment-plans/:id/decision` | Record per-item accept/decline/defer decisions in one call, with deferral reasons and follow-up dates |
| POST | `/treatment-plan-items/:id/schedule` | Link an item to a new or existing appointment |
| POST | `/treatment-plan-items/:id/complete` | Mark completed; feeds invoicing and recall |
| GET | `/treatment-plans/:id/pdf` | Patient-facing PDF |
| POST | `/treatment-plans/:id/send` | Send to the patient for remote acceptance |
| GET | `/public/treatment-plans/:token` | Tokenised patient-facing plan view (no login) |
| POST | `/public/treatment-plans/:token/accept` | Remote acceptance, OTP-verified |

**Unscheduled treatment recovery**

| Method | Path | Purpose |
|---|---|---|
| GET | `/revenue/unscheduled` | The worklist. Filters: category, value band, plan age, priority, doctor, last-contact recency, follow-up due, assigned staff. Sorted by value descending within follow-up-due by default. Returns item rows with patient context, value, days since planned, contact history and next action |
| GET | `/revenue/unscheduled/summary` | Aggregate: total value, patient count, value by category, ageing distribution, recovered value over the trailing 30 days, recovery rate |
| POST | `/revenue/unscheduled/:itemId/contact` | Log a contact attempt with channel and outcome |
| POST | `/revenue/unscheduled/:itemId/snooze` | Defer with a date and reason |
| POST | `/revenue/unscheduled/:itemId/decline` | Mark permanently declined with a reason |
| POST | `/revenue/unscheduled/:itemId/assign` | Assign to a staff member |
| POST | `/revenue/unscheduled/campaign` | Launch a templated recovery campaign against the current filter set |
| GET | `/revenue/case-acceptance` | Acceptance rate by doctor, procedure, category and period |
| GET | `/revenue/pending-payments` | Outstanding receivables with ageing |

**Recalls:** `GET /recalls` (filters: type, due range, overdue band, status, patient value), `GET /recalls/summary`, `POST /recalls` (manual), `PATCH /recalls/:id`, `POST /recalls/:id/contact`, `POST /recalls/:id/schedule`, `POST /recalls/bulk-campaign`, `POST /recalls/generate` (a maintenance job endpoint that backfills missing recalls).

### 4.8 Billing

| Method | Path | Purpose |
|---|---|---|
| GET | `/invoices` | List with status, ageing, date, doctor, patient filters |
| POST | `/invoices` | Create |
| POST | `/invoices/from-appointment/:id` | Generate from completed procedures |
| POST | `/invoices/from-plan/:id` | Generate from accepted plan items |
| GET | `/invoices/:id` | Detail with payments and computed balance |
| PATCH | `/invoices/:id` | Update while unpaid |
| POST | `/invoices/:id/cancel` | Cancel with reason |
| GET | `/invoices/:id/pdf` | PDF |
| POST | `/invoices/:id/send` | WhatsApp or email dispatch |
| GET | `/payments` | Payment ledger |
| POST | `/payments` | Record an offline payment |
| GET | `/payments/:id/receipt` | Receipt PDF |
| POST | `/payments/:id/refund` | Refund, permission-gated |
| POST | `/payments/create-order` | Create a gateway order for online payment |
| POST | `/payments/verify` | Verify a gateway signature after checkout |
| POST | `/payments/payment-link` | Generate and send a hosted payment link |
| GET | `/payments/daily-summary` | Close-of-day reconciliation by mode |
| GET/POST/PATCH | `/instalment-plans` | Instalment schedules |
| POST | `/instalment-plans/:id/remind` | Send an instalment reminder |
| GET/POST/PATCH/DELETE | `/expenses` | Expense tracking |

### 4.9 Growth

**Leads:** `GET /leads` (filters: stage, source, assigned, value band, follow-up overdue, date range), `POST /leads`, `GET/PATCH/DELETE /leads/:id`, `POST /leads/:id/stage`, `POST /leads/:id/assign`, `POST /leads/:id/activities`, `POST /leads/:id/convert` (creates a patient, carrying history across), `POST /leads/:id/lose` (reason required), `GET /leads/summary` (pipeline value, conversion by source, average time-to-first-contact), `POST /leads/bulk-assign`, `POST /leads/import`.

**Cost calculator:** `GET /public/calculator/config` (categories, options and tiers — no raw price book exposed), `POST /public/calculator/estimate` (server-side computation returning a range and breakdown), `POST /public/calculator/capture` (converts an estimate into a lead), `GET /analytics/calculator` (what visitors are pricing, and conversion by treatment).

**Campaigns:** `GET/POST /campaigns`, `GET/PATCH /campaigns/:id`, `POST /campaigns/:id/preview-audience` (count and sample before sending — never let a user fire blind at 2,000 patients), `POST /campaigns/:id/send`, `POST /campaigns/:id/schedule`, `POST /campaigns/:id/cancel`, `GET /campaigns/:id/results`.

**Reviews:** `POST /reviews/request`, `GET /reviews`, `GET /public/reviews/:token` (the private rating capture page), `POST /public/reviews/:token/submit` (routes satisfied patients to the public platform, dissatisfied into service recovery), `GET /reviews/summary`.

### 4.10 Communications

`GET /conversations`, `GET /conversations/:id/messages`, `POST /conversations/:id/messages`, `POST /conversations/:id/assign`, `POST /conversations/:id/resolve`, `POST /messages/send` (ad-hoc to a patient or lead), `GET/POST/PATCH/DELETE /templates`, `POST /templates/:id/submit-approval` (WhatsApp template submission), `GET/POST/PATCH/DELETE /automation-rules`, `POST /automation-rules/:id/toggle`, `GET /automation-rules/:id/logs`, `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`.

### 4.11 Operations

**Lab:** `GET/POST /lab-cases`, `GET/PATCH /lab-cases/:id`, `POST /lab-cases/:id/status`, `GET /lab-cases/due`, `GET /lab-cases/overdue`.
**Inventory:** `GET/POST /inventory`, `GET/PATCH/DELETE /inventory/:id`, `POST /inventory/:id/adjust`, `GET /inventory/low-stock`, `GET /inventory/expiring`, `GET /inventory/movements`, `GET/POST /purchase-orders`, `POST /purchase-orders/:id/receive`, `GET/POST/PATCH /suppliers`.

### 4.12 Analytics

A consistent contract: every analytics endpoint accepts a date range, a comparison-period flag, and a grouping granularity, and returns series data plus totals plus period-over-period deltas.

`GET /analytics/dashboard` (role-aware payload), `/analytics/revenue`, `/analytics/collections`, `/analytics/appointments`, `/analytics/patients`, `/analytics/retention`, `/analytics/treatments`, `/analytics/case-acceptance`, `/analytics/doctors`, `/analytics/chair-utilisation`, `/analytics/marketing`, `/analytics/leads`, `/analytics/revenue-at-risk` (the dashboard panel: unscheduled value, overdue recalls, receivables ageing), `POST /analytics/export`.

### 4.13 Public site

`GET /public/clinic` (branding, hours, contact, structured-data payload), `/public/doctors`, `/public/doctors/:slug`, `/public/services`, `/public/services/:slug`, `/public/gallery`, `/public/testimonials`, `/public/blog`, `/public/blog/:slug`, `/public/faqs`, `POST /public/contact`, `POST /public/appointment-request`, `GET /public/availability`, `POST /public/booking` (OTP-verified), `GET /public/booking/:reference`.

All public endpoints are rate-limited by IP, protected by a bot check on write operations, and return no data that could enumerate patients.

### 4.14 Patient Portal

A separate token audience. **Every endpoint here derives the patient identity from the token and ignores any identifier in the path** — the most common vulnerability in patient portals is trusting a client-supplied patient id.

| Method | Path | Purpose |
|---|---|---|
| GET | `/portal/me` | Profile and clinic context |
| PATCH | `/portal/me` | Update own contact details and communication preferences |
| GET | `/portal/dashboard` | Next appointment, outstanding balance, pending plan decisions, due recalls |
| GET | `/portal/appointments` | Upcoming and past |
| POST | `/portal/appointments` | Self-book from available slots |
| POST | `/portal/appointments/:id/reschedule` | Within the clinic's policy window |
| POST | `/portal/appointments/:id/cancel` | Within the policy window; outside it, creates a request for reception |
| GET | `/portal/records` | Visit history, prescriptions, reports |
| GET | `/portal/documents` | Own documents, served via short-lived presigned URLs |
| GET | `/portal/treatment-plans` | Own plans |
| POST | `/portal/treatment-plans/:id/decision` | Remote per-item acceptance — the at-home conversion path |
| GET | `/portal/invoices` | Own invoices |
| POST | `/portal/invoices/:id/pay` | Initiate online payment |
| GET | `/portal/instalments` | Own schedule |
| GET/POST | `/portal/messages` | Conversation with the clinic |
| GET/POST | `/portal/forms` | Pre-visit medical history and consent forms |
| POST | `/portal/consent/:id/sign` | Sign remotely |

### 4.15 Content management (public site)

The Site is a sales surface the clinic must be able to edit without calling you. Without this, every content tweak becomes a support ticket and your margin evaporates.

`GET/POST/PATCH/DELETE /content/pages`, `/content/blog`, `/content/faqs`, `/content/testimonials`, `/content/gallery` (with a consent check enforced before any clinical photograph can be published), `/content/banners`; plus `PATCH /content/seo/:pageKey` for per-page meta title, description, Open Graph image and structured-data overrides, and `POST /content/media` for image upload with automatic format conversion and responsive size generation.

### 4.16 Webhooks

`POST /webhooks/payment` — gateway events (payment captured, failed, refunded, link paid). Signature-verified, idempotent by event id, and **the sole authority on payment status**. The browser's redirect is a UI hint, nothing more.
`POST /webhooks/whatsapp` — inbound messages and delivery status callbacks. Signature-verified, idempotent, updates message status and opens or extends the conversation session window.
`GET /webhooks/whatsapp` — Meta's verification challenge.

---

## PART 5 — INTEGRATIONS

### 5.1 Email (SMTP)

Transactional sending via a configured SMTP provider, with the clinic's own sender domain (SPF, DKIM and DMARC configured at sale time — put this in your onboarding checklist, because unauthenticated clinic mail lands in spam and the clinic will blame your software).
Emails: OTP codes, booking confirmation, appointment reminder, invoice, receipt, treatment plan, prescription, staff invitation, password reset, recall notice, review request, and a daily owner summary.
All sends are queued with exponential-backoff retry, three attempts, then dead-lettered with an alert. Bounce and complaint handling marks the patient's email invalid so campaigns stop targeting it.

### 5.2 Google OAuth

Standard authorisation-code flow with PKCE and state validation. Requested scopes: profile and email only. Account linking on verified-email match. Consider Google Calendar sync for doctors as a later addition, but do not couple it to authentication.

### 5.3 Payments

Use a gateway with strong Indian coverage — Razorpay is the pragmatic default (UPI, cards, netbanking, wallets, EMI, payment links, subscriptions).

Flows to implement:
- **Order-based checkout** — server creates an order, client opens hosted checkout, server verifies the returned signature, webhook confirms authoritatively.
- **Payment links** — for remote collection over WhatsApp; this is how most instalments will actually be paid.
- **Refunds** — full and partial, permission-gated, audited.
- **EMI display** — surface the gateway's no-cost-EMI options on the treatment plan presentation. Financing visibly presented measurably lifts case acceptance on high-value treatment, which is exactly the ₹40,000-implant conversation.

Rules: never trust client-reported payment success; make webhook processing idempotent on event id; reconcile daily against the gateway's settlement report; store gateway identifiers on every payment for dispute resolution.

### 5.4 WhatsApp Business Cloud API

The highest-ROI integration in the product — open rates above 90% against roughly 20% for SMS, and reminder automation reduces no-shows materially.

Implement: template management and approval submission, template message sending with variable substitution, free-form replies only within the 24-hour customer service window, media messages (invoices, prescriptions, plan PDFs, before/after images), interactive button and list messages for confirmations, inbound message webhook feeding the unified inbox, and delivery status tracking.

Operational rules that will bite you if ignored: templates need Meta approval before use, so seed and submit them during onboarding rather than at go-live; free-form messages outside the session window fail, so the UI must know the window state; respect quiet hours; honour opt-out and record it; monitor the number's quality rating, since aggressive marketing gets a clinic's number throttled and the clinic will hold you responsible.

Message set to seed: appointment confirmation, reminder at 24 hours and at 2 hours, reschedule notice, cancellation notice, post-treatment care instructions, review request, invoice and receipt delivery, payment link, instalment due, recall due, unscheduled treatment follow-up, birthday, lead first response, and treatment plan delivery.

### 5.5 File storage

S3-compatible object storage. Uploads use presigned URLs so large X-ray files never traverse the API server. Server-side encryption at rest. Access is exclusively through short-lived presigned download URLs generated after a permission check — a permanently public bucket URL for a patient's radiograph is a data breach waiting to happen. Image thumbnails generated asynchronously.

### 5.6 Future-facing: ABDM / ABHA

Not required for v1, but design so it is not a rewrite: keep an optional ABHA field on the patient, ensure clinical records can be projected into a FHIR R4 representation, and model consent as a first-class artefact with purpose, duration, data scope and revocability. Government-scheme-empanelled facilities face compliance expectations tightening through 2027, so "ABDM-ready architecture" is a credible line in your sales conversation even before you implement it.

---

## PART 6 — BACKGROUND JOBS

**Queues:** `email`, `whatsapp`, `pdf`, `analytics`, `maintenance`. Backed by Redis with a persistent job store, exponential backoff, dead-letter handling and per-queue concurrency limits.

**Scheduled jobs:**

| Cadence | Job | Purpose |
|---|---|---|
| Every 15 min | Reminder dispatcher | Queue appointment reminders due in the window, respecting quiet hours |
| Every 15 min | Automation rule evaluator | Evaluate time-based triggers and enqueue messages |
| Hourly | Payment reconciliation | Poll for pending gateway payments unresolved by webhook |
| Daily 06:00 | Recall generator | Create recalls falling due, refresh the recall worklist |
| Daily 07:00 | Owner daily digest | Yesterday's collection, today's schedule, revenue at risk |
| Daily 08:00 | Follow-up worklist refresh | Recompute unscheduled treatment ageing and due follow-ups |
| Daily 09:00 | Overdue instalment reminders | Notify patients with instalments past due |
| Daily 10:00 | Birthday greetings | Templated goodwill messages |
| Daily 20:00 | Inventory alerts | Low stock and near-expiry notifications |
| Daily 23:00 | Analytics materialisation | Roll up daily aggregates into summary documents |
| Daily 23:30 | Patient lifetime value refresh | Recompute LTV snapshots |
| Weekly | Lapsed patient detection | Flag patients past their expected return interval for reactivation |
| Weekly | Owner weekly report | Emailed performance summary |
| Nightly | Database backup verification | Confirm the backup completed and is restorable |
| Monthly | Data retention sweep | Purge expired anonymous calculator sessions and stale OTP records |

**Event-driven jobs:** appointment completed → generate recall, draft invoice, deduct inventory, queue review request. Appointment no-show → create follow-up task, trigger automation. Treatment plan presented → schedule a follow-up if no decision within N days. Plan item deferred → enter the recovery worklist with the stated follow-up date. Invoice overdue → trigger reminder sequence. Lead created → notify assigned staff immediately and start a time-to-first-contact timer.

---

## PART 7 — SECURITY, COMPLIANCE & OPERATIONS

**Transport and storage.** TLS 1.3 everywhere. AES-256 at rest for the database and object storage. Application-level encryption for the most sensitive fields (identity numbers, ABHA). Secrets in a managed secrets store, never in environment files committed anywhere.

**DPDP Act alignment.** India's Digital Personal Data Protection Act 2023, with rules phasing in through 2027, governs this data. Build in: explicit granular consent capture with purpose and duration, a consent withdrawal path, patient rights endpoints (access own data, request correction, request erasure subject to statutory medical-record retention), documented retention periods per data category, breach notification procedure, and a complete access audit trail. Medical records in India are commonly retained for three years minimum from the last entry, longer where litigation is possible — retention policy must be configurable, not hardcoded.

**Access control hygiene.** Role-based restriction so reception cannot read clinical notes; ownership checks on every patient-scoped endpoint independent of role; audit logging on every read of clinical data, not merely writes; session revocation on role change; and rate limiting per user and per IP.

**Input handling.** Schema validation on every endpoint before the controller runs. Sanitise all string input against NoSQL operator injection. Validate file uploads by content type and magic bytes, not extension. Cap request and file sizes.

**Observability.** Structured JSON logs with a request id threaded through every layer, with patient identifiers redacted. Error tracking with alerting. Metrics on request latency, error rate, queue depth and job failure rate. A health endpoint checking database, Redis and queue connectivity. Alert thresholds on payment webhook failures and WhatsApp send failures — these are the two failure modes a clinic notices within minutes.

**Backups.** Automated daily database backup with a 30-day retention, point-in-time recovery enabled, object storage versioning, and — non-negotiable — a **quarterly restore drill**. An unverified backup is a rumour.

**Testing.** Unit tests on every service method containing business logic; integration tests on every endpoint covering the happy path, the permission-denied path and the validation-failure path; and dedicated test suites for the three areas where bugs are most expensive: appointment conflict detection, invoice and payment arithmetic, and the treatment plan status state machine.

---

## PART 8 — WIRING: FRONTEND TO BACKEND

How the two documents meet.

### 8.1 Boot sequence

On application load: read the refresh token cookie and attempt a silent refresh; on success fetch the current user and the clinic config in parallel; apply branding tokens from the clinic config to CSS custom properties before first paint to avoid a flash of unbranded content; hydrate the permission set; register the router with feature-flag-filtered routes. On refresh failure, render the public Site or redirect to login depending on the requested route.

### 8.2 Screen-to-endpoint map

| Screen | Primary calls | Notes |
|---|---|---|
| Site Home | `/public/clinic`, `/public/services`, `/public/doctors`, `/public/testimonials`, `/reviews/summary` | Cached with a long TTL; served statically where possible |
| Cost Calculator | `/public/calculator/config`, `/public/calculator/estimate`, `/public/calculator/capture` | Estimation is server-side so the price book never reaches the browser |
| Online Booking | `/public/availability`, `/auth/otp/request`, `/auth/otp/verify`, `/public/booking` | Availability re-fetched on every date change; slot held briefly during OTP entry |
| Console Dashboard | `/analytics/dashboard`, `/analytics/revenue-at-risk`, `/appointments/today` | One role-aware call plus the risk panel; refetch on window focus |
| Calendar | `/appointments/calendar` | A single request returning appointments, resources, working hours and blocks for the range. Refetch on range change; optimistic update on drag; invalidate on any mutation |
| Patient list | `/patients` | Server-driven pagination, sort and filter, mirrored into the URL |
| Patient record | `/patients/:id/summary` then per-tab lazy loads | Header bar loads first and independently so medical alerts appear immediately |
| Clinical tab | `/patients/:id/chart`, `/patients/:id/clinical-notes` | Tooth updates are optimistic; chart history loaded on demand |
| Treatment plan builder | `/treatment-plans/:id`, `/procedures`, item CRUD endpoints | Procedure catalogue cached for the session; totals recomputed server-side on every mutation so the displayed figure is always authoritative |
| Plan presentation | `/treatment-plans/:id`, `/treatment-plans/:id/decision` | Decisions submitted as one batched call carrying every item's outcome |
| Unscheduled recovery | `/revenue/unscheduled`, `/revenue/unscheduled/summary`, contact and snooze actions | Summary and list fetched in parallel; row actions invalidate both |
| Recalls | `/recalls`, `/recalls/summary`, bulk campaign | Same pattern as recovery |
| Leads board | `/leads`, `/leads/summary`, `/leads/:id/stage` | Stage drag is optimistic with rollback on failure |
| Inbox | `/conversations`, `/conversations/:id/messages`, send endpoints | Polling at a short interval, or websockets if you add them; session-window state comes from the conversation payload |
| Invoice detail | `/invoices/:id`, `/payments` | Balance always read from the server response, never computed client-side |
| Online payment | `/payments/create-order`, hosted checkout, `/payments/verify` | UI shows a confirming state and settles on the server's webhook-derived status, polling briefly if needed |
| Analytics | `/analytics/*` | Every request carries range and comparison flag; responses cached by key |

### 8.3 Contract discipline

Define the shared type contracts once, in a location both sides consume — ideally generated from the backend validation schemas so they cannot drift. Enums (appointment status, plan item status, payment mode, lead stage, tooth condition, recall type, user role) must be defined **once** on the backend and imported by the frontend. Two divergent copies of an enum is the most reliable way to ship a bug that only appears in production.

Every list response uses the same pagination block. Every error uses the same envelope. Every money field is integer paise. Every datetime is UTC ISO 8601. If you hold those four lines, wiring is mechanical.

### 8.4 Seed data for the demo clinic

Your sales motion depends on this, so treat it as a deliverable, not a fixture. Generate roughly 18 months of coherent history: about 400 patients with realistic Indian names and Pune-plausible addresses and age distribution; 2,000 appointments across all statuses with a believable no-show rate near 10%; treatment plans distributed across every acceptance state with a case acceptance rate near 55%; invoices in every payment state including partial payments and live instalment plans; an **unscheduled treatment backlog worth ₹8–15 lakh** across 60–80 patients; 150 leads spread across pipeline stages and sources; message history; and populated inventory and lab cases.

The demo narrative writes itself from there: open the dashboard, point at the revenue-at-risk figure, click into the recovery worklist, and say — *this is money you have already diagnosed and already earned the right to, sitting uncollected, and right now you have no way to see it.* That sentence, backed by a real-looking number on a real-looking screen, is the product.
