# Confirmed Bug Tracker — Frontend ↔ Backend Wiring

> Source: live-backend probe (see `07_ENDPOINT_VERIFICATION.md`). Each row is a
> UI control wired to a backend route that fails (404 route missing, or 500
> server error) — i.e. the feature cannot work. Categorized by fix type.

## 📊 Status summary

| State | Count | Bugs |
|-------|-------|------|
| ✅ **FIXED & verified in prod** | 15 | #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15 |
| 🟦 **NOT A BUG** (probe used wrong method) | 1 | #17 |
| ⚪ **DEFERRED** (needs multipart/file to test) | 1 | #16 |
| ❌ **OPEN** | 0 | — |
| ⚪ **DEFERRED** (needs multipart/file to test) | 1 | #16 |
| **Total tracked** | 17 | |

Legend — **Category**:
- **BUILD-BE** — backend route + (often) DB table does not exist; needs building.
- **REPOINT-FE** — backend has an equivalent route; fix is to change the frontend path.
- **VERIFY** — route exists (500/needs confirmation); re-test with valid body.

## Bug table

| # | Status | Module | UI control | Endpoint (frontend) | Category | Fix approach / resolution |
|---|--------|--------|-----------|---------------------|----------|---------------------------|
| 1 | ✅ FIXED | IT | CreateTicketModal | POST /v1/it/tickets | BUILD-BE | Built `it_tickets` table + routes. Probe → 201 |
| 2 | ✅ FIXED | IT | IncidentReportModal | POST /v1/it/incidents | BUILD-BE | Built `it_incidents` table + routes. Probe → 201 |
| 3 | ✅ FIXED | IT | EscalationModal | POST /v1/it/tickets/escalate | BUILD-BE | Ticket escalate route. Probe → 201 |
| 4 | ✅ FIXED | IT | ResolutionModal | POST /v1/it/tickets/resolve | BUILD-BE | Ticket resolve route. Probe → 201 |
| 5 | ✅ FIXED | IT | SLAConfigModal | POST /v1/it/sla-config | BUILD-BE | Built `it_sla_configs` table + routes. Probe → 201/200 |
| 6 | ✅ FIXED | Sales | CreateOrderModal | POST /v1/sales/orders | BUILD-BE | Added POST route delegating to atomic close-won: closes opportunity WON + creates order + audit/outbox/incentive. Probe → 201 |
| 7 | ✅ FIXED | Sales | IncentiveConfigModal | POST /v1/sales/incentives/plans | BUILD-BE | Added tenant-scoped bridge route (sales ctrl, with guards) → creates plan + default GLOBAL rule via IncentivesService. Probe → 201 |
| 8 | ✅ FIXED | Finance | LedgerCore "Create Journal Entry" | POST /v1/finance/journal-entries | BUILD-BE | Added route → canonical `createJournal`/validate-and-post (balanced double-entry, resolves GL accounts, binds OPEN period). Also fixed DTO toString-transform bug + unbalanced→400. Probe → 201 POSTED, unbalanced 400, single-line 400 |
| 9 | ✅ FIXED | Finance | PayableDesk "mark paid" | PATCH /v1/finance/payables/:id/paid | BUILD-BE | Added route + service + repo: posts LIAB-AP/ASSET-CASH settlement journal, flips status to PAID atomically, idempotent. Probe → 200 PAID |
| 10 | ✅ FIXED | HR | payroll modal | POST /v1/hr/payroll/runs | REPOINT-FE | Added `payroll/runs` alias → canonical `payroll-runs` handler. Probe → 201 |
| 11 | ✅ FIXED | HR | workflow modals | POST /v1/hr/workflows | REPOINT-FE | Added `hr/workflows` bridge → shared WorkflowService.createRequest (maker_dept=HR). Also fixed WorkflowService hardcoded-id PK bug. Probe → 201 ×2 distinct |
| 12 | ✅ FIXED | HR | roster assign modal | POST /v1/hr/roster/assignments | REPOINT-FE | Added `hr/roster/assignments` + SchedulingService.createAssignment (location derived from employee). Probe → 201 |
| 13 | ✅ FIXED | HR | talent modals | POST /v1/hr/talent/candidates | BUILD-BE | Added candidate advance/reject (+GET profile) on existing `candidates` table via HrRecruitmentService. Probe → advance 201, reject 201, terminal 400 |
| 14 | ✅ FIXED | HR | (payroll-runs service) | POST /v1/hr/payroll-runs | VERIFY | camelCase/snake_case both accepted + date validation; was 500. Probe → 201 |
| 15 | ✅ FIXED | Marketing | OmnichannelConfigModal | POST /v1/marketing/omnichannel/config | BUILD-BE | New `marketing_omnichannel_configs` table + migration + upsert route (per tenant+channel). Probe → 201, upsert no-dup, GET 200 |
| 16 | ⚪ DEFERRED | Marketing | (asset upload service) | POST /v1/marketing/assets/upload | VERIFY | exists; returns 500 on empty probe; needs multipart/file to confirm |
| 17 | 🟦 NOT A BUG | Retail | AnomalyCompletionDialog | PATCH /v1/inventory/items/:id/complete | — | Route exists as **PATCH** (`completeAnomalyItem`) and works. Doc-07 probe wrongly used POST → 404. Live PATCH probe → 200 (update applied). False alarm |

## 🔧 Remaining items

1. **Marketing asset upload (#16)** — `POST /marketing/assets/upload` exists but
   needs a multipart/file payload to verify; deferred (not a routing bug, requires
   a file fixture to exercise end-to-end).

## 📝 Resolution log (fixed bugs)

- **IT ticketing (#1–5)** — *FIXED & VERIFIED IN PRODUCTION.* Built `it_tickets`,
  `it_incidents`, `it_sla_configs` tables + migration `20260629140000_add_it_ticketing`
  + service + controller routes. Live probe: POST /it/tickets→201 (priority
  auto-computed), GET→200, PATCH /:id→200, escalate→201, resolve→201,
  incidents→201, sla-config POST→201/GET→200. Commit `ce6eb517` + deploy.
- **HR payroll-runs (#14)** — *FIXED & VERIFIED IN PRODUCTION.* Root cause:
  frontend `payrollService` sends **camelCase** (`periodStart`/`periodEnd`) but
  the controller + repo only read snake_case, so `new Date(undefined)` → Invalid
  Date → Prisma 500. Controller now accepts both casings and validates dates
  (missing/invalid/end-before-start → 400 instead of 500); repo hardened to read
  both. Live probe: camelCase→201, snake_case→201, empty→400, invalid date→400,
  end<start→400. Commit `b4dbc8c4` + deploy.
- **PayableDesk mark-paid (#9)** — *FIXED & VERIFIED IN PRODUCTION.* Added
  `PATCH /finance/payables/:id/paid` (controller + service + repo + mock). Marks
  the payable PAID and posts the settlement journal (debit LIAB-AP / credit
  ASSET-CASH) atomically; idempotent (re-calling a PAID bill returns 200 without
  double-posting); unknown id → 404. Live probe: insert→mark-paid→200 PAID, DB
  status=PAID, journal `PAYPD-*` POSTED, second call no new journal. Commit
  `6af5874a` + deploy.
- **Sales CreateOrder (#6)** — *FIXED & VERIFIED IN PRODUCTION.* Added
  `POST /sales/orders` (+ `CreateOrderDto`). The modal converts a won opportunity
  into a fulfillment order, so the route delegates to the existing atomic
  close-won pipeline: closes the opportunity as WON and creates the `sales_orders`
  row together with audit / outbox / incentive-engine events. `opportunityId`
  required; `paymentTerms`/`notes` accepted (not persisted — no columns).
  Live probe: create opp → POST orders → 201 (order DRAFT, opp CLOSED_WON),
  missing field → 400, bogus id → 404. Commit `e9eeaf3e` + deploy.
- **Sales IncentiveConfig (#7)** — *FIXED & VERIFIED IN PRODUCTION.* The
  IncentiveConfigModal posted to `/v1/sales/incentives/plans` (404) and sent no
  tenant_id; the bare `/incentives` controller also lacks tenant guards. Added a
  tenant-scoped bridge route `POST /sales/incentives/plans` on the sales
  controller (TenantGuard + RolesGuard) that derives tenant/company from context
  and creates the plan + a default GLOBAL `sales_incentive_rules` row (mapping the
  modal's reward type→base_type, value) via `IncentivesService`. SalesModule now
  imports IncentivesModule (no circular dep; container starts healthy). Live
  probe: POST → 201 (plan + PERCENTAGE rule value 5), missing name → 400, bad
  type → 400. Commit `c8640b71` + deploy.
- **HR repoints (#10, #11, #12)** — *FIXED & VERIFIED IN PRODUCTION.* The HR
  modals posted to HR-namespaced paths the backend didn't serve. Added bridge
  routes that delegate to existing services:
  - `POST /hr/payroll/runs` → canonical `payroll-runs` handler (201).
  - `POST /hr/workflows` → shared `WorkflowService.createRequest` (camelCase→
    snake_case map, maker_dept defaults to HR). **Also fixed a latent
    hardcoded-id PK bug** in WorkflowService (`createRequest` used a literal
    `id:'k0ctrl8m'` and the audit writes used literal ids → every 2nd request
    threw a unique-constraint 500; now `randomUUID()`). Probe: two requests →
    201 with distinct ids.
  - `POST /hr/roster/assignments` → new `SchedulingService.createAssignment`
    writing `schedule_assignments`, deriving the required `location_id` from the
    employee. Probe → 201 (location derived), bogus employee → 400.
  Commit `a00df408` + deploy.
- **HR talent (#13)** — *FIXED & VERIFIED IN PRODUCTION.* The AdvanceCandidate
  and RejectCandidate modals (`/hr/talent/candidates/advance` and `/reject`) had
  no backend route. Added `advanceCandidate` (ordered pipeline
  applied→screening→interview→offer→hired, terminal stages rejected with 400) and
  `rejectCandidate` (sets status, stores reason in metadata, idempotent) to
  `HrRecruitmentService`, plus controller routes + `GET /hr/candidates/:id`
  profile. Existing `GET/POST /hr/candidates` and hire route were already present.
  Live probe: GET profile → 200, advance → 201 (applied→screening), reject → 201
  (status rejected, reason persisted), advance-after-reject → 400. Commit
  `4b7dde55` + deploy.
- **Marketing omnichannel (#15)** — *FIXED & VERIFIED IN PRODUCTION.* The
  OmnichannelConfigModal posted to a non-existent route. Added a new
  `marketing_omnichannel_configs` table (migration `20260630000000_add_omnichannel_configs`,
  unique per tenant+channel) + `OmnichannelService.saveConfig` (upsert) /
  `getConfigs`, and routes `POST/GET /marketing/omnichannel/config` (tenant
  derived from context). Migration applied on deploy. Live probe: POST → 201,
  re-save same channel → 201 (in-place update, no duplicate), GET → 200 count 1,
  missing channel → 400. Commit `78ff1372` + deploy.
- **Retail anomaly complete (#17)** — *NOT A BUG (false alarm).* Doc-07's probe
  tested `POST /v1/inventory/items/:id/complete` and got 404, but the frontend
  AnomalyCompletionDialog uses **PATCH**, and `PATCH items/:id/complete`
  (`completeAnomalyItem`) already exists and handles the exact payload (name,
  category_id, base_price, auto-clears `is_anomaly` on category change). Live
  PATCH probe → 200 (update applied, then restored); POST → 404 (confirms the
  method mismatch). No code change required.
- **Finance journal (#8)** — *FIXED & VERIFIED IN PRODUCTION.* The LedgerCore
  "Create Journal Entry" modal posted to `/finance/journal-entries` (404). Rather
  than bypassing the accounting model, added a route that delegates to the
  existing `FinanceService.createJournal` → `validateAndCreateJournal` — the same
  canonical balanced double-entry posting routine used by payables/mark-paid
  (resolves/creates GL accounts by code, binds an OPEN fiscal period, posts as
  POSTED). The modal payload already matches `CreateJournalDto`. Two latent bugs
  surfaced and fixed: (1) the DTO's `@Transform(toString)` on debit/credit broke
  `@IsNumber` at the HTTP boundary; (2) unbalanced entries threw a plain Error
  (500) → now `BadRequestException` (400). Live probe: balanced → 201 POSTED
  (lines balanced), unbalanced → 400, single-line → 400. Commits `1e1e8676`,
  `fa3d9abb`, `4837b02a` + deploy.
