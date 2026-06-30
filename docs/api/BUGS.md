# Confirmed Bug Tracker — Frontend ↔ Backend Wiring

> Source: live-backend probe (see `07_ENDPOINT_VERIFICATION.md`). Each row is a
> UI control wired to a backend route that fails (404 route missing, or 500
> server error) — i.e. the feature cannot work. Categorized by fix type.

## 📊 Status summary

| State | Count | Bugs |
|-------|-------|------|
| ✅ **FIXED & verified in prod** | 27 | #1–#16, #18, #19, #20–#28 |
| 🟦 **NOT A BUG** (probe used wrong method / by design) | 1 | #17 |
| ❌ **OPEN** | 0 | — |
| ⚪ **DEFERRED** (needs multipart/file to test) | 1 | #16 |
| **Total tracked** | 28 | |

> #18–#19 found during core-flow production verification (schedule / departments
> / branch / office / login-logout / POS / attendance).
> #20–#28 found during the payroll ↔ attendance/leave/holiday/absence + export
> pass. See the sections at the end of this file.

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
| 16 | ✅ FIXED | Marketing | (asset upload service) | POST /v1/marketing/assets/upload | VERIFY | Verified with a real multipart PNG → 201 (asset registered, blob stored). Added missing-file guard (was 500 on empty → now 400). Probe → 201 |
| 17 | 🟦 NOT A BUG | Retail | AnomalyCompletionDialog | PATCH /v1/inventory/items/:id/complete | — | Route exists as **PATCH** (`completeAnomalyItem`) and works. Doc-07 probe wrongly used POST → 404. Live PATCH probe → 200 (update applied). False alarm |

## 🔧 Remaining items

None — all 17 tracked rows are resolved (16 fixed + verified, 1 confirmed not-a-bug).

## 📎 File-upload endpoint audit (this pass)

All multipart upload endpoints were exercised live with a real PNG and an
empty (no-file) request:

| Endpoint | With file | No file | Notes |
|----------|-----------|---------|-------|
| POST /marketing/assets/upload | **201** | **400** | #16; added missing-file guard |
| POST /explorer/files/upload | **201** | **400** | guard + pipe fix |
| POST /inventory/items/:id/images | **201** | 400 (pre-existing) | fixed 500 from `cacheHelper.invalidate` (see below) |
| POST /inventory/items/import | (CSV path) | 400 | pre-existing guard |
| POST /hr/employees/import | (CSV path) | 400 | added missing-file guard |

Two latent bugs found & fixed while auditing:
- **inventory image upload 500** — `uploadImage`/`setPrimaryImage` called
  `cacheHelper.invalidate(request)`, which does not exist (the method is
  `invalidateAll()`). The image saved but the response 500'd. Fixed both.
- **GlobalValidationPipe 500 on empty body** — a request with no body made the
  pipe call `validate(undefined)` → "Cannot read properties of undefined". Now
  normalizes null/undefined to `{}`, so missing-body requests get a clean 400
  app-wide instead of a 500.

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

- **Marketing asset upload (#16)** — *FIXED & VERIFIED IN PRODUCTION.* The route
  existed but had only been probed with an empty body (→500). Verified with a
  real multipart PNG: `POST /marketing/assets/upload` → 201 (asset row created,
  blob written to `storage/marketing/assets`, `url` returned). Added a
  missing-file guard (→400). While auditing all upload endpoints, also fixed:
  (1) `POST /inventory/items/:id/images` and `.../primary` 500'd on success
  because they called the non-existent `cacheHelper.invalidate(request)` →
  changed to `invalidateAll()`; (2) `GlobalValidationPipe` 500'd on any
  bodyless request (`validate(undefined)`) → now normalizes to `{}` so missing
  bodies return 400 app-wide; (3) added missing-file guards to
  `/hr/employees/import` and `/explorer/files/upload`. Commits `c7f72c76`,
  `85f24e41` + deploy. All upload endpoints probed live: with-file → 201,
  no-file → 400.

## 🔎 Core-flow production verification (real employees, tenant `tnt-3rlhko`)

End-to-end live verification of the operational flows requested: schedule,
departments, branch, office, login/logout, POS open/close, and attendance.
Result: **16/16 checks pass** (`tmp` probe, since removed). Two real bugs were
found and fixed during this pass:

| # | Status | Module | Flow | Root cause | Fix |
|---|--------|--------|------|-----------|-----|
| 18 | ✅ FIXED & verified | HR | Employee self-service clock-in/out (MyPulse) | Frontend `attendanceService` sent camelCase `employeeId` + `reason` and used the **auth `user_id`** as the identifier. Backend `ClockInDto` expects snake_case `employee_id` + `notes`, and the canonical service looks up the **employees-table id** (≠ user id). With validation whitelisting, `employee_id` arrived empty → real employees could never clock in. | `attendanceService.clockIn/clockOut` now send `employee_id` (the real `record.employee.id`), `location_id`, and `notes`; `MyPulse` passes the resolved employee id and surfaces backend error detail. |
| 19 | ✅ FIXED & verified | HR | Same-day re-clock-in | After clock-out, a second clock-in the **same day** tried to `create` a second `hr_attendance_records` row, violating the `(tenant_id, employee_id, date)` unique constraint → unhandled **P2002 → 500**. | `TimeAndAttendanceService.clock_in` adds a same-day record guard returning a clear **400** ("attendance already recorded for today; re-clock-in same day not supported"), matching the one-record-per-day model. |

**Verified working (no change needed):**
- **Login** — `POST /v1/auth/login` → 200 (token returned).
- **Logout** — core auth is **stateless JWT**; logout discards the token
  client-side (`AuthContext`/`identity context`). There is no server logout
  route by design, so the earlier `POST /auth/logout` 404 is expected, not a
  bug. (`/auth/me` confirms the held token stays valid until discarded.)
- **Departments** — `GET/POST /v1/hr/departments` → 200/201, correctly scoped
  to the active tenant (no cross-tenant leak).
- **Branch / Office** — `GET/POST /v1/settings/locations` → 200/201 for both
  `branch` and `office` types.
- **Schedule** — `GET /v1/hr/scheduling/shifts`, `/assignments`, and
  `/assignments/template` (xlsx) → 200.
- **POS open/close** — `POST /v1/retail/shifts/open` → 201,
  `PUT /v1/retail/shifts/:id/close` → 200.
- **Attendance guards** — open double-clock-in → 400; same-day re-clock-in →
  400 (#19 fix); clock-in → 201; clock-out → 201.

### ⚠️ Reliability observations (not blocking the flows above)

- **Prisma connection-pool exhaustion** — production logs showed recurring
  `P2024` ("Timed out fetching a new connection from the connection pool",
  default limit ~9) from concurrent cron jobs + a heavy
  `retail/public/products?pageSize=10000` query, intermittently turning valid
  requests into 500s under load. Mitigated by adding
  `connection_limit=25&pool_timeout=20` to `DATABASE_URL`.
- **Event-delivery handler failures** — every domain event publish logs
  `event_deliveries.update() … Record to update not found` /
  `INITIAL_DELIVERY_TRIGGER_FAILED: Cannot read properties of null`. This does
  **not** fail the HTTP request (clock-in still returns 201) but means
  downstream event-driven handlers (insights/automation) are not completing.
  Pre-existing, system-wide, and outside the scope of this flow verification —
  flagged for a dedicated follow-up.

## 🧮 Payroll ↔ attendance/leave/holiday/absence + export pass

Goal: each attendance must feed payroll (including holidays, leaves, absences),
payroll must run and export properly, and all exports must generate real
human-readable files. Verified live on `tnt-3rlhko` (payroll probe 14/14,
report-builder probe PASS).

| # | Status | Area | Root cause | Fix |
|---|--------|------|-----------|-----|
| 20 | ✅ FIXED & verified | Payroll engine | Attendance was filtered by `status:'APPROVED'`, which clock-in never writes (it sets present/late/unscheduled) — so hours/overtime/lateness always computed to **0** and attendance never reached payroll. Leaves, holidays, and absences were never queried. | `payroll-engine.service.ts` now counts every non-rejected attendance record; integrates approved `leave_requests` (paid vs unpaid by type), `hr_holidays` (paid non-working days), and infers unpaid **absence** from scheduled `hr_work_shifts` days with no attendance/leave/holiday. Per-day daily-rate deductions for absence + unpaid leave. Full day-accounting in `breakdown_json`. |
| 21 | ✅ FIXED & verified | Payroll persistence | `calculatePayroll` used `upsert({ where:{ id: uuidv4() } })` (random id never matches → can never update, risks duplicate lines) and wrote a non-existent `total_work_hours` column → **PrismaClientValidationError 500**. The whole calculate path was broken. | Idempotent find-by-(tenant,run,employee) then update/create; dropped the invalid column. |
| 22 | ✅ FIXED & verified | Payslip PDF | Did not show leave/holiday/absence. | Added an "Attendance & Days" section + absence and unpaid-leave deduction lines. |
| 23 | ✅ FIXED & verified | Payroll bank file | Minimal CSV (`Employee ID,Net Pay,Status`), no employee/bank details. | Real RFC-4180 CSV: employee code/name, bank name/account (from `payroll_profiles`), payment method, net pay, currency + TOTAL trailer. |
| 24 | ✅ FIXED & verified | Payroll register export | `GET /hr/payroll-runs/:id/export` was a one-line stub and its status check (`!== "approved"`) never matched the stored `APPROVED`, so it always 400'd. | Full per-employee CSV with day-accounting + all earnings/deductions; status check accepts approved-or-later. |
| 25 | ✅ FIXED & verified | Generic report builder | `reporting-worker.service.ts` wrote hardcoded "Sample Report Entry" mock data into every report. | Generates from caller-supplied `payload.headers`/`rows` (or `payload.data`) — the user's real data — with a metadata fallback (never fake samples). |
| 26 | ✅ FIXED & verified | Report download | `GET /reporting/:id/download` returned JSON, not the file: it returned a `StreamableFile` which the global response interceptor serialized, and the endpoint also had a `CacheInterceptor` that cached the stream object. The file existed on disk but never reached the client. | Removed `CacheInterceptor` from download/status; read the file and `res.end(buffer)` with proper headers (matching the working audit export). Also write EXCEL as `.xlsx` (was `.excel`). |
| 27 | ✅ FIXED | Reporting frontend | `reportingService` called `/v1/reports/*` but the controller is `@Controller('reporting')` → every report call 404'd. | Path corrected to `/v1/reporting/*`. |
| 28 | ✅ FIXED | Retail exports | `/retail/audit/export`, `/retail/dashboard/export`, and returns export returned a raw string (wrapped to JSON by the global interceptor → not a downloadable file); `returns/export` was also missing its `@Get` route decorator. | Stream CSV with Content-Type/Content-Disposition; added the missing route. |

### Payroll model notes
- Daily rate basis = rostered working-day count when scheduling is used, else a
  standard monthly divisor (22). When a tenant does not roster shifts, no
  absence is inferred and salaried base is paid in full.
- Unpaid leave `type` values (case-insensitive): unpaid, unpaid_leave,
  leave_without_pay, lwp, no_pay, nopay, absent. All other types are paid leave.
- Holidays and paid leave are paid in full (no deduction); absence and unpaid
  leave are deducted at the daily rate; lateness/overtime use an hourly rate
  (base/160).

### ⚠️ Export items intentionally left (documented, not bugs to fix here)
- **Finance dashboard export** (`/finance/dashboard/export`) returns
  `{ reportData, watermark+HMAC signature, exportId }` JSON by design — it pairs
  with `/verify-export` for export-integrity verification and client-side
  rendering, not a server-generated file. Changing it would break that flow.
- **HR compliance export** (`/hr/compliance/export`) returns CSV/XML as a string
  and Excel/PDF as base64 inside JSON — a deliberate envelope the frontend
  decodes.
- **Retail ops inventory export** (`/retail/operations/inventory/export`) is a
  no-op "queued" stub; the UI only toasts. Left as a known stub (needs a
  product decision + frontend download wiring).
- Several **client-side-only** frontend "exports" build CSVs from local state
  (e.g. ExportTool, SpreadsheetTool, StockReportTab simulation) — out of scope.
