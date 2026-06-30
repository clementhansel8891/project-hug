# Confirmed Bug Tracker — Frontend ↔ Backend Wiring

> Source: live-backend probe (see `07_ENDPOINT_VERIFICATION.md`). Each row is a
> UI control wired to a backend route that fails (404 route missing, or 500
> server error) — i.e. the feature cannot work. Categorized by fix type.

## 📊 Status summary

| State | Count | Bugs |
|-------|-------|------|
| ✅ **FIXED & verified in prod** | 8 | #1, #2, #3, #4, #5, #6, #9, #14 |
| ❌ **OPEN** | 8 | #7, #8, #10, #11, #12, #13, #15, #17 |
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
| 7 | ❌ OPEN | Sales | IncentiveConfigModal | POST /v1/sales/incentives/plans | VERIFY/BUILD | incentivesService targets this; confirm controller |
| 8 | ❌ OPEN | Finance | LedgerCore "Create Journal Entry" | POST /v1/finance/journal-entries | REPOINT-FE | Backend is event-sourced: use POST /finance/ledger/process-event (architecture mismatch — needs design) |
| 9 | ✅ FIXED | Finance | PayableDesk "mark paid" | PATCH /v1/finance/payables/:id/paid | BUILD-BE | Added route + service + repo: posts LIAB-AP/ASSET-CASH settlement journal, flips status to PAID atomically, idempotent. Probe → 200 PAID |
| 10 | ❌ OPEN | HR | payroll modal | POST /v1/hr/payroll/runs | REPOINT-FE | service path /v1/hr/payroll-runs exists (see #14) — repoint modal |
| 11 | ❌ OPEN | HR | workflow modals | POST /v1/hr/workflows | REPOINT-FE | use workflowService /v1/workflow/* sub-routes |
| 12 | ❌ OPEN | HR | roster assign modal | POST /v1/hr/roster/assign | REPOINT-FE | use /v1/hr/scheduling/* |
| 13 | ❌ OPEN | HR | talent modals | POST /v1/hr/talent/candidates | BUILD-BE | no recruitment write routes |
| 14 | ✅ FIXED | HR | (payroll-runs service) | POST /v1/hr/payroll-runs | VERIFY | camelCase/snake_case both accepted + date validation; was 500. Probe → 201 |
| 15 | ❌ OPEN | Marketing | OmnichannelConfigModal | POST /v1/marketing/omnichannel/config | BUILD-BE | no omnichannel config route |
| 16 | ⚪ DEFERRED | Marketing | (asset upload service) | POST /v1/marketing/assets/upload | VERIFY | exists; returns 500 on empty probe; needs multipart/file to confirm |
| 17 | ❌ OPEN | Retail | AnomalyCompletionDialog | POST /v1/inventory/items/:id/complete | REPOINT-FE | wrong namespace; likely /v1/retail/inventory |

## 🔧 Remaining open bugs — priority order

1. **Sales IncentiveConfig (#7)** — confirm/build incentives plans route. *(next)*
2. **HR repoints (#10–12)** — change frontend paths to existing routes.
3. **HR talent (#13)** — build recruitment write routes.
4. **Marketing omnichannel (#15)** — build config route.
5. **Retail anomaly complete (#17)** — repoint namespace.
6. **Finance journal (#8)** — needs design decision (event-sourced vs direct).
7. **Marketing asset upload (#16)** — re-probe with multipart payload.

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
