# Confirmed Bug Tracker — Frontend ↔ Backend Wiring

> Source: live-backend probe (see `07_ENDPOINT_VERIFICATION.md`). Each row is a
> UI control wired to a backend route that returns 404 (route missing) — i.e.
> the feature cannot work. Categorized by fix type.

## Categories
- **BUILD-BE** — backend route + (often) DB table does not exist; needs building.
- **REPOINT-FE** — backend has an equivalent route; fix is to change the frontend path.
- **VERIFY** — route exists (500 on empty probe); re-test with valid body.

| # | Module | UI control | Endpoint (frontend) | Status | Category | Fix approach |
|---|--------|-----------|---------------------|--------|----------|--------------|
| 1 | IT | CreateTicketModal | POST /v1/it/tickets | 404 | BUILD-BE | New it_tickets table + routes |
| 2 | IT | IncidentReportModal | POST /v1/it/incidents | 404 | BUILD-BE | New it_incidents table + routes |
| 3 | IT | EscalationModal | POST /v1/it/tickets/escalate | 404 | BUILD-BE | Ticket escalate route |
| 4 | IT | ResolutionModal | POST /v1/it/tickets/resolve | 404 | BUILD-BE | Ticket resolve route |
| 5 | IT | SLAConfigModal | POST /v1/it/sla-config | 404 | BUILD-BE | New it_sla_configs table + routes |
| 6 | Sales | CreateOrderModal | POST /v1/sales/orders | 404 | BUILD-BE or REPOINT | Sales orders come from close-won; either add POST or repoint modal to close-won flow |
| 7 | Sales | IncentiveConfigModal | POST /v1/sales/incentives/plans | 404 | VERIFY/BUILD | incentivesService targets this; confirm controller |
| 8 | Finance | LedgerCore "Create Journal Entry" | POST /v1/finance/journal-entries | 404 | REPOINT-FE | Backend is event-sourced: use POST /finance/ledger/process-event (architecture mismatch — needs design) |
| 9 | Finance | PayableDesk "mark paid" | PATCH /v1/finance/payables/:id/paid | ✅ FIXED | DONE | Added route + service + repo: posts LIAB-AP/ASSET-CASH settlement journal, flips status to PAID atomically, idempotent |
| 10 | HR | payroll modal | POST /v1/hr/payroll/runs | 404 | REPOINT-FE | service path /v1/hr/payroll-runs exists (see #14) |
| 11 | HR | workflow modals | POST /v1/hr/workflows | 404 | REPOINT-FE | use workflowService /v1/workflow/* sub-routes |
| 12 | HR | roster assign modal | POST /v1/hr/roster/assign | 404 | REPOINT-FE | use /v1/hr/scheduling/* |
| 13 | HR | talent modals | POST /v1/hr/talent/candidates | 404 | BUILD-BE | no recruitment write routes |
| 14 | HR | (payroll-runs service) | POST /v1/hr/payroll-runs | ✅ FIXED | DONE | camelCase/snake_case both accepted + date validation; was 500 |
| 15 | Marketing | OmnichannelConfigModal | POST /v1/marketing/omnichannel/config | 404 | BUILD-BE | no omnichannel config route |
| 16 | Marketing | (asset upload service) | POST /v1/marketing/assets/upload | 500 | VERIFY | exists; needs multipart |
| 17 | Retail | AnomalyCompletionDialog | POST /v1/inventory/items/:id/complete | 404 | REPOINT-FE | wrong namespace; likely /v1/retail/inventory |

## Priority order (by user impact × effort)

1. **IT ticketing (#1–5)** — entire ITSM UI dead; 3 tables + routes. **DONE.**
2. **PayableDesk mark-paid (#9)** — finance AP can't mark invoices paid. **DONE.**
3. **Sales CreateOrder (#6)** — repoint to close-won or add POST.
4. **HR repoints (#10–12)** — change frontend paths to existing routes.
5. **Marketing omnichannel (#15)**, **talent (#13)** — lower traffic.
6. **Finance journal (#8)** — needs design decision (event-sourced vs direct).

## Status log
- 2026-06: bugs confirmed via live probe.
- IT ticketing (#1–5): **FIXED & VERIFIED IN PRODUCTION**. Built `it_tickets`,
  `it_incidents`, `it_sla_configs` tables + migration `20260629140000_add_it_ticketing`
  + service + controller routes. Live probe: POST /it/tickets→201 (priority
  auto-computed), GET→200, PATCH /:id→200, escalate→201, resolve→201,
  incidents→201, sla-config POST→201/GET→200. Commit `ce6eb517` + deploy.
- HR payroll-runs (#14): re-probed with valid `{periodStart, periodEnd}` body →
  still **HTTP 500**. Root cause: frontend `payrollService` sends **camelCase**
  (`periodStart`/`periodEnd`) but the controller + repo only read snake_case, so
  `new Date(undefined)` → Invalid Date → Prisma 500. **FIXED & VERIFIED IN
  PRODUCTION**: controller now accepts both casings and validates dates
  (missing/invalid/end-before-start → 400 instead of 500); repo hardened to read
  both. Live probe: camelCase→201, snake_case→201, empty→400, invalid date→400,
  end<start→400. Commit `b4dbc8c4` + deploy.
- Marketing assets/upload (#16): not re-probed (requires multipart/file).
- PayableDesk mark-paid (#9): **FIXED & VERIFIED IN PRODUCTION**. Added
  `PATCH /finance/payables/:id/paid` (controller + service + repo + mock). Marks
  the payable PAID and posts the settlement journal (debit LIAB-AP / credit
  ASSET-CASH) atomically; idempotent (re-calling a PAID bill returns 200 without
  double-posting); unknown id → 404. Live probe: insert→mark-paid→200 PAID, DB
  status=PAID, journal `PAYPD-*` POSTED, second call no new journal. Commit
  `6af5874a` + deploy.

## Remaining open bugs (priority order)
1. Sales CreateOrder (#6) — repoint to close-won or add POST.
2. HR repoints (#10–12).
3. Marketing omnichannel (#15), talent (#13).
4. Finance journal (#8) — design decision.
