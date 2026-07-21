# DentalOS — Backend

Node + Express + TypeScript + Mongoose + Redis, implementing `docs/backend-spec.md`.

## Architecture

Layered per spec Part 0: **Route → Middleware → Validator → Controller → Service → Model**.
Controllers only translate HTTP; services hold all business logic and are the only
layer that orchestrates across collections. Money is integer **paise** everywhere.
Every collection is `clinicId`-scoped and soft-deleted. Every response uses one
envelope; every error carries a machine-readable code.

```
src/
  config/      env, constants, logger, db, redis
  shared/      enums (single source of truth), errors, envelope, http types
  utils/       money, pagination, ids
  models/      Mongoose schemas + base-fields plugin
  middleware/  requestId, rateLimit, errorHandler, notFound, (auth/tenant/rbac/validate)
  modules/     one folder per domain (health, auth, patients, …)
  routes.ts    API router aggregator, mounted at API_PREFIX
  app.ts       Express assembly + middleware chain
  index.ts     entry: connect stores (degraded-tolerant) → listen → graceful shutdown
```

## Running

```bash
cp .env.example .env      # sensible dev defaults; MONGO_URI / REDIS_URL optional
npm install
npm run dev               # tsx watch
# or
npm run build && npm start
```

The server **boots without MongoDB or Redis** (degraded mode) so health checks
and route wiring can be exercised without infrastructure. `GET /readyz` reports
dependency status; data endpoints return a clear 503 until the database is up.

## Seed & verify (require a reachable MongoDB)

```bash
npm run seed        # seeds the Meher Dental Care demo clinic into MONGO_URI
npm run verify      # spins up an in-memory Mongo, seeds, and exercises the
                    # services + HTTP layer end-to-end (needs egress to
                    # fastdl.mongodb.org to fetch the mongod binary once)
```

The seed generates coherent history — patients, appointments across statuses,
treatment plans across every acceptance state, invoices/payments, ~50 leads,
inventory and lab cases — and deliberately builds an **unscheduled treatment
backlog worth ≈₹8–15 lakh** (the demo money shot). Owner login for the seeded
clinic: `owner@meherdental.in` / `password123` (or OTP). Set `SEED_SCALE=5` for
the full spec volume (~400 patients).

## Health

- `GET /healthz` — liveness
- `GET /readyz` — readiness + dependency status (mongo, redis)
- `GET /api/v1/` — API version

## Implemented vs. remaining

**Data model — complete.** Every collection in spec Part 2 has a Mongoose schema
with the Part 2.10 indexing strategy (`src/models`).

**Implemented endpoint modules:** auth (OTP/password/refresh/sessions/RBAC),
clinic & settings, patients, appointments (conflict rule + status state machine),
treatment plans + item-level decisions + the unscheduled-recovery worklist,
billing (invoices/payments/receivables/expenses + gateway checkout), leads,
recalls, analytics (dashboard + revenue-at-risk), public site + cost calculator,
patient portal. Plus jobs/scheduler, integration services (payment/whatsapp/
storage/email), and signature-verified idempotent webhooks.

**Remaining endpoint modules** (schemas exist; routes are the next slice):
users & roles admin, clinical CRUD (chart / notes / prescriptions / consents),
operations CRUD (inventory / lab / suppliers / purchase-orders), communications
(conversations / messages / templates / automation rules), content management,
and the long tail of analytics reports. These follow the exact patterns already
established (validator → controller → service, tenant-scoped, audited).

## Conventions (spec 8.3)

- **Enums** are defined once in `src/shared/enums.ts` — the frontend imports these.
- **Pagination** block is identical on every list response.
- **Money** is always integer paise.
- **Datetimes** are UTC ISO 8601; the client renders in Asia/Kolkata.
