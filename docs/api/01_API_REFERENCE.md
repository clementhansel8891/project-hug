# Zenvix API Reference

> Complete endpoint catalog, grouped by controller. All paths are prefixed with
> `/v1`. See `00_CONVENTIONS.md` for headers, auth, and response shapes.

## Controller Index

| Prefix | Module | File |
|--------|--------|------|
| `auth`, `auth/company` | Authentication & onboarding | core/auth |
| `finance`, `finance/ar`, `finance/dashboard` | Finance / ledger / AR | core/finance |
| `hr`, `hr/time`, `hr/attendance`, `hr/leaves`, `hr/payroll`, `hr/scheduling`, `hr/recruitment`, `hr/compliance` | Human resources | core/hr |
| `procurement` | Procurement / purchasing | core/procurement |
| `inventory`, `inventory/edge` | Inventory | core/inventory |
| `sales`, `sales/operational`, `sales/management` | Sales / CRM | core/sales |
| `marketing` | Marketing | core/marketing |
| `payment`, `payment/webhook`, `admin/payments` | Payments | core/payment |
| `it` | IT operations | core/it |
| `it-settings` | IT settings & devices | core/it-settings |
| `pricing` | Pricing engine | core/pricing |
| `incentives` | Sales incentives | core/incentives |
| `settings` | Tenant settings | core/settings |
| `admin` | Admin dashboard & requests | core/admin |
| `workflow` | Workflow routing | core/workflow + shared/workflow |
| `retail`, `retail/public`, `retail/events` | Retail / POS / e-commerce | modules/retail |
| `warehouse` | Warehouse bins | modules/warehouse |
| `reporting` | Async report jobs | shared/reporting |
| `comms` | Bulletin / mail / chat / notifications | shared/comms |
| `audit` | Audit log & chain | shared/audit |
| `events` | Domain events | shared/events |
| `logs` | System logs | shared/logger |
| `intelligence` | Search / intelligence | support/intelligence |
| `sync` | Offline sync | support/sync |

---

## auth

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` (201) |
| POST | `/auth/register` | self-service signup `{ email, password, first_name, last_name }` |
| POST | `/auth/company/provision` | onboarding: create tenant+company (see auth/company) |

---

## finance  `@Controller('finance')` — guards: TenantGuard, RolesGuard

### Chart of Accounts
| Method | Path | Roles | Body / Notes |
|--------|------|-------|--------------|
| GET | `/finance/coa` | any | list chart of accounts |
| POST | `/finance/coa` | ADMIN, OWNER | `{ accountCode, name, accountType: ASSET\|LIABILITY\|EQUITY\|REVENUE\|EXPENSE, normalBalance: DEBIT\|CREDIT, category? }` |
| PATCH | `/finance/coa/:id` | ADMIN, OWNER | update COA |

### Ledger & Journals
| Method | Path | Notes |
|--------|------|-------|
| GET | `/finance/ledger` | ledger entries (the canonical "view ledger") |
| POST | `/finance/ledger/process-event` | event-sourced posting (ADMIN/OWNER/SUPERADMIN) |
| POST | `/finance/journals/:id/reverse` | `{ reason }` reverse a journal |

> **Note:** There is **no** `POST /finance/journal-entries` on the live backend.
> The frontend `LedgerCore` posts to `/v1/finance/journal-entries` which is not
> wired — journal creation on the server is via the ledger event engine. Tests
> should use `/finance/coa` + `/finance/ledger` as the verified finance surface.

### Fiscal periods
| GET `/finance/fiscal-years` · GET `/finance/periods` · POST `/finance/fiscal-periods/:id/lock` · `/close` · `/reopen` |

### Posting rules
| GET `/finance/posting-rules` · POST `/finance/posting-rules` · POST `/finance/posting-rules/:id/activate` |

### Money & treasury
| Method | Path | Notes |
|--------|------|-------|
| GET | `/finance/money-sources` | funding sources |
| PATCH | `/finance/money-sources/:id` | update source |
| GET | `/finance/treasury/sources` · `/treasury/transfers` | treasury |
| POST | `/finance/treasury/transfers` | create transfer |
| POST | `/finance/treasury/reconcile` | `{ sourceId, amount }` |
| PATCH | `/finance/treasury/sources/:id/limits` | `{ minLimit, maxLimit }` |

### Payments / AR / AP
| GET `/finance/payments` · GET `/finance/invoices` · GET `/finance/payables` · GET `/finance/receivables` · GET `/finance/inbox` · GET `/finance/alerts` |
| POST `/finance/payment-requests` · PATCH `/finance/payments/:id/status` |
| POST `/finance/payments` (used by MoneyDesk create-payment) |

### Payroll / assets / capex / loans
| GET `/finance/payroll/entries` · `/payroll/estimate` · POST `/finance/payroll/execute` |
| GET/POST `/finance/assets` (+ `/:id/capitalize`, `/depreciation`, `/disposal`, `/impairment`, `/revaluation`, `/status`) |
| GET/POST `/finance/capex/requests` (+ `/:id/approve`, `/reject`) · POST `/finance/capex/budgets` |
| GET/POST `/finance/loans` · GET `/finance/loans/my` · PATCH `/finance/loans/:id/approve` |
| GET/POST `/finance/audit-log` · GET/POST `/finance/payslip/templates` |

### AR sub-controller `@Controller('finance/ar')`
Customer/invoice/credit-memo management (see ar.controller.ts).

---

## inventory  `@Controller('inventory')`

### Items
| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/inventory/dashboard` | | KPI summary |
| GET | `/inventory/items` | | list (paginated) |
| GET | `/inventory/items/lookup` | | quick lookup |
| GET | `/inventory/items/:id` | | detail |
| POST | `/inventory/items` | MANAGER | create item |
| PATCH | `/inventory/items/:id` | | update |
| DELETE | `/inventory/items/:id` | MANAGER | delete |
| POST | `/inventory/items/batch-json` | MANAGER | bulk create |
| POST | `/inventory/items/import` | | CSV import (file) |
| GET | `/inventory/items/export` | | export |
| GET | `/inventory/items/template` | | import template |
| GET | `/inventory/items/pending` | | approval queue |
| PUT | `/inventory/items/:id/approve` · `/reject` | | approve new item |

### Stock movements & balances
| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/inventory/balances` | | stock on hand |
| GET | `/inventory/movements` | | movement log |
| POST | `/inventory/intake` | SUPERVISOR | add stock |
| POST | `/inventory/transfer` | SUPERVISOR | move stock |
| POST | `/inventory/consume` | SUPERVISOR | deduct stock |
| POST | `/inventory/reserve` · `/release` · `/confirm-reservation` | SUPERVISOR | financial-grade reservation |
| POST | `/inventory/transfer/initiate` · `/complete` | SUPERVISOR | 2-step transfer |

### Adjustments (approval-gated)
| Method | Path | Role | Body |
|--------|------|------|------|
| GET | `/inventory/adjustments` | | list |
| POST | `/inventory/adjustments` | | `{ item_id, location_id, requested_delta, reason, department_id? }` |
| PUT | `/inventory/adjustments/:id/approve` | MANAGER | applies delta to stock |

### Stock transfers (lifecycle)
| GET `/inventory/stock-transfers` · `/:id` · POST `/inventory/stock-transfers` (SUPERVISOR) |
| PUT `/inventory/stock-transfers/:id/pick` · `/ship` · `/receive` (SUPERVISOR) |

### Audit cycles, alerts, scans
| GET/POST `/inventory/audit-cycles` · POST `/inventory/audit/initiate` · POST `/inventory/audit/:id/items` |
| GET `/inventory/alerts` · PUT `/inventory/alerts/:id/status` |
| POST `/inventory/scans/low-stock` · `/scans/expiry` (SUPERVISOR) |

### Procurement receipt integration
| Method | Path | Notes |
|--------|------|-------|
| GET | `/inventory/procurement-receipts` | receipt queue (released POs) |
| POST | `/inventory/procurement-receipts/:id/process` | `{ final_po_id, location_id, items: [{sku, quantity, unit_cost}] }` → adds stock |

### Categories
| GET/POST `/inventory/categories` · PUT/DELETE `/inventory/categories/:id` · PATCH `/inventory/items/:id/category` |

---

## procurement  `@Controller('procurement')`

### Suppliers
| GET/POST `/procurement/suppliers` (POST: ADMIN, MANAGER) |
| GET/POST `/procurement/branches` · GET `/procurement/supplier-products` · POST `/procurement/supplier-products/upsert` |
| GET `/procurement/recommendations` · GET/POST `/procurement/categories` (`/categories/upsert`, DELETE `/categories/:id`) |

### Requisitions → PO pipeline (the core flow)
| Method | Path | Role | Stage |
|--------|------|------|-------|
| GET | `/procurement/requisitions` | | list |
| POST | `/procurement/requisitions` | ADMIN, MANAGER, MEMBER | `{ title, description, requesterDept, branchCode, amount, category?, budgetClass?, contractRequired? }` → PENDING_REQUESTER_HOD |
| PUT | `/procurement/requisitions/:id/approve-requester-hod` | ADMIN, MANAGER | → APPROVED_REQUESTER_HOD |
| PUT | `/procurement/requisitions/:id/approve-final` | ADMIN, MANAGER | → FINAL_APPROVED |
| GET | `/procurement/draft-pos` | | list draft POs |
| POST | `/procurement/draft-pos` | ADMIN, MANAGER | `{ requisitionId, supplierId, supplierBranchId, contractType, lineItems[] }` |
| PUT | `/procurement/draft-pos/:id/approve` | ADMIN, MANAGER | Procurement HOD gate |
| PUT | `/procurement/draft-pos/:id/confirm-quote` | ADMIN, MANAGER | `{ quoteReference, quoteNotes }` |
| GET | `/procurement/purchase-orders` | | final POs |
| POST | `/procurement/purchase-orders/release` | ADMIN, MANAGER | release PO (→ appears in inventory receiving) |
| POST | `/procurement/purchase-orders/:id/process-receipt` | ADMIN, MANAGER | record goods receipt |
| POST | `/procurement/receipts` | ADMIN, MANAGER | rating-engine receipt metrics |

### Contracts / risk / portal / audit
| GET/POST `/procurement/contracts` · PUT `/:id/approve-legal` · `/:id/sign` |
| GET/POST `/procurement/risk-signals` · PUT `/:id/status` · POST `/procurement/risk-scan` |
| GET/POST `/procurement/portal-messages` · GET/POST `/procurement/audit-events` · GET `/procurement/spend-insights` · GET `/procurement/overview` |

---

## sales  `@Controller('sales')`

### Dashboards & analytics
| GET `/sales/dashboard` · `/manager-metrics` · `/executive-forecast` · `/nba` · `/forecast` · `/analytics` · `/audit-events` |

### Leads
| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/sales/leads` | | list |
| POST | `/sales/leads` | ADMIN, MANAGER, MEMBER | `{ company_name, contact_name, email, source, status, potential_value }` |
| PUT | `/sales/leads/:id/status` | ADMIN, MANAGER, MEMBER | NEW→CONTACTED→QUALIFIED |
| POST | `/sales/leads/:id/convert` | ADMIN, MANAGER, MEMBER | lead → opportunity |
| POST | `/sales/leads/sync-marketing` | ADMIN, MANAGER | import marketing lead |

### Opportunities (pipeline)
| GET `/sales/opportunities` · `/sales/pipeline` (grouped by stage) |
| POST `/sales/opportunities` · PUT `/:id/stage` (move stage) · PUT `/:id/close` (close won/lost) |
| Stages: NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → CLOSED_WON / CLOSED_LOST |

### Quotes / orders / tasks / timeline
| GET/POST `/sales/quotes` · PUT `/:id/submit` · `/:id/decision` · `/:id/send` |
| GET `/sales/orders` (read-only; orders originate from won opps/retail) |
| GET/POST `/sales/tasks` · PUT `/:id/done` · GET/POST `/sales/timeline` |
| GET `/sales/alerts` · PUT `/:id/ack` · POST `/sales/sla-sweep` |

---

## retail  `@Controller('retail')` — `@RequiredModule("retail")`

### Catalog & inventory (store-facing)
| GET `/retail/products` (paginated, `?q=&locationId=&pageSize=`) · GET `/retail/products/:id` · PATCH `/retail/products/:id` · GET `/retail/products/next-sku` |
| GET `/retail/inventory/stats` · `/inventory/status` · GET `/retail/categories` |
| GET `/retail/stores` · `/stores/:id` · POST/PUT/DELETE `/retail/stores` |

### Shifts (fiscal session) — the POS gate
| Method | Path | Notes |
|--------|------|-------|
| GET | `/retail/shifts/active` | current open shift for terminal |
| POST | `/retail/shifts/open` | `{ store_id, opening_cash, terminal_id }` → opens shift |
| GET | `/retail/shifts` · `/shifts/:id` | list / detail |
| PUT | `/retail/shifts/:id/close` | `{ actual_cash, explanation, closing_note, compliance_note }` |
| POST | `/retail/shifts/:id/reconcile` | reconcile cash variance |
| POST | `/retail/shifts/:id/cash-movement` | `{ amount, type: CASH_IN\|CASH_OUT }` |

### Sales / checkout (POS)
| Method | Path | Notes |
|--------|------|-------|
| POST | `/retail/checkout` | **THE SALE**. `{ store_id, terminal_id, items:[{product_id,name,quantity,unit_price,discount?,taxRate?}], payment_method, payment_received, grand_total, shift_id, currency, notes? }`. Deducts stock + records order atomically. Send `correlationId` for idempotency. |
| GET | `/retail/orders` · `/orders/:id` | order history |
| POST | `/retail/orders` | create order (non-POS path) |
| POST | `/retail/orders/:id/payment` | take payment on existing order |
| POST | `/retail/orders/:id/return` | process return/refund |
| POST | `/retail/orders/:id/void` · `/cancel` | reverse order |
| GET | `/retail/orders/:id/print` | receipt |

### Inventory ops (retail-side)
| POST `/retail/inventory/opname` (stock count) · `/inventory/receive` (goods in) · `/inventory/sync` |

### Promotions / channels / devices
| GET `/retail/promotions` · PUT `/retail/promotions/:id` |
| GET/POST `/retail/channels` · PUT/DELETE `/retail/channels/:id` · POST `/:id/sync` · `/rotate-credentials` · `/revoke-credentials` |
| GET/POST `/retail/devices` · `/cctvs` · `/sensors` · POST `/retail/devices/:id/ping` · `/devices/scan` |

### Customers / analytics / governance
| GET `/retail/customers` · `/analytics/ecommerce` · `/audit/export` · `/dashboard/export` · `/governance/audit-log` |

### Public storefront `@Controller('retail/public')` — no tenant header
Customer-facing catalog/cart/checkout via channel credentials (`retail/public/auth`, `retail/public/products`, etc.).

---

## hr  `@Controller('hr')` (+ sub-controllers)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/hr/employees` | list (`?projection=staff` for `{id,name,role}`) |
| GET | `/hr/employees/:id` | detail |
| GET | `/hr/employees/export` | Excel export (route declared **before** `:id`) |
| POST | `/hr/employees` · PUT `/hr/employees/:id` · DELETE | CRUD |
| GET | `/hr/departments` | departments |
| GET/POST | `/hr/employees/:id/compensation` | comp |

Sub-controllers: `hr/attendance`, `hr/leaves`, `hr/payroll`, `hr/scheduling`,
`hr/recruitment`, `hr/compliance`, `hr/time`, `hr/time/device`.

Workflow approvals (FlowGate) go through `workflow` / `shared/workflow`.

---

## comms  `@Controller('comms')`

| Bulletin | GET/POST `/comms/bulletin` · GET `/:id` · PATCH/DELETE `/:id` · POST `/:id/react` · `/:id/comment` · GET/POST `/comms/bulletin-categories` |
| Mail | GET `/comms/mail/messages?folder=inbox\|sent\|drafts\|trash` · GET `/comms/mail/accounts` · POST `/comms/mail/send` (`{ to\|toAddresses, subject, body\|bodyText }`) · PATCH `/comms/mail/:id/star` · `/read` · `/restore` · DELETE `/comms/mail/:id` |
| Chat | GET `/comms/chat/rooms` · GET `/comms/chat/rooms/:roomId/messages` · POST `/comms/chat/rooms` |
| Notifications | GET `/comms/notifications` · `/notifications/counts` · PATCH `/notifications/:id/read` · POST `/notifications/read-all` |

---

## reporting  `@Controller('reporting')` — guards: RolesGuard

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/reporting/archives` | | completed reports |
| POST | `/reporting/generate` | ADMIN, OWNER | `{ report_type, format: PDF\|XLSX, payload? }` → `{ job_id, status }` |
| GET | `/reporting/:id/status` | | poll job |
| GET | `/reporting/:id/download` | | download file |
| POST | `/reporting/:id/retry` | | retry failed |

---

## it-settings  `@Controller('it-settings')`

| GET/POST `/it-settings/devices` · PUT `/it-settings/devices/:id/status` |
| GET `/it-settings/settings` · GET `/it-settings/settings/:key` · PUT `/it-settings/settings/:key` (`{ value, category?, isPublic?, description? }`) |
| GET/POST `/it-settings/provisioning/requests` |

---

## it  `@Controller('it')` — `@RequiredModule("it")`

| GET `/it/overview` · `/it/devices` · POST `/it/devices` · GET `/it/provisioning` · POST `/it/provisioning` |
| GET `/it/system-health` · `/it/topology` · `/it/monitoring/stats` · `/it/monitoring/logs` |

---

## warehouse  `@Controller('warehouse')`

| GET `/warehouse/bins?locationId=<loc>` · POST `/warehouse/bins?locationId=<loc>` (`{ code, zone?, aisle?, rack?, level?, capacity? }` — **no `name` field**) |
| GET `/warehouse/bins/:binId/stock` · POST `/warehouse/bins/:binId/assign` |

---

## admin  `@Controller('admin')`

| GET `/admin/dashboard` · `/dashboard/tactical` · `/admin/modules` · `/admin/audit-events` · `/admin/audit/integrity-status` · `/admin/sync/status` · `/admin/iot/devices` |
| POST `/admin/requests` · PUT `/admin/requests/:id/resolve` |

---

## settings  `@Controller('settings')`

| GET/PUT `/settings/profile` · GET/PUT `/settings/preferences` · GET `/settings/roles` · GET/POST `/settings/locations` |

---

## audit · events · logs

| `audit` | GET `/audit/logs` · `/audit/verify-chain` · `/audit/anchors/public` |
| `events` | GET `/events` · `/events/failed` |
| `logs` | GET `/logs` |

---

## Cross-cutting

| `workflow` | GET `/workflow/list` · `/workflow/test-routing` · approve/reject inbox items |
| `pricing` | GET `/pricing/quote?skuId=&location_id=` |
| `intelligence` | search & insight endpoints |
| `sync` | offline sync push/pull |
