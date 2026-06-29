# Zenvix App Flows & Data Relationships

> How data moves across modules. Each flow is a candidate end-to-end test that
> verifies real business behavior (not just page rendering). Use these as the
> blueprint for functional tests.

## Entity Relationship Overview

```
tenant ─┬─ company ─┬─ locations (stores / warehouses / branches / HQ)
        │           ├─ departments ── employees ── users
        │           └─ money_sources
        │
        ├─ item_masters (products) ── stock_levels (per location)
        │                          └─ stock_movements (audit of every change)
        │
        ├─ suppliers ── supplier_products ── procurement_requisitions
        │                                 └─ draft_pos ── final_pos
        │
        ├─ retail_shifts ── retail_orders ── retail_order_items
        │                └─ retail_cash_movements
        │
        ├─ sales_leads ── sales_opportunities ── sales_orders ── sales_quotes
        │
        ├─ finance_chart_of_accounts ── finance_ledger ── finance_journal_*
        │                            └─ payments / payables / receivables
        │
        ├─ hr_payroll_runs ── payroll_lines ── (→ finance ledger on disbursement)
        │
        ├─ workflow_requests (FlowGate: approvals routed across departments)
        ├─ sys_report_jobs (async report generation)
        ├─ audit_logs (immutable hash-chained trail of every mutation)
        └─ domain_events (event bus: emitted by every module)
```

## Universal invariants (assert in any flow)

1. **Tenant isolation** — every record carries `tenant_id`; cross-tenant reads
   return empty/404. A valid token + wrong `x-tenant-id` is rejected.
2. **Audit trail** — every mutating action appends to `audit_logs`; the hash
   chain stays valid (`GET /audit/verify-chain` → ok).
3. **Domain events** — significant mutations emit a `domain_event`
   (`GET /events` grows).
4. **RBAC** — privileged actions (reports, finance posting, admin) reject
   STAFF/SPG with 401/403.

---

## FLOW 1 — Retail Sale (POS) → Inventory → Finance

The headline flow. A cashier sells a product; stock drops and revenue is recorded.

```
1. Cashier opens shift
   POST /retail/shifts/open { store_id, opening_cash, terminal_id }
   → shift.status = OPEN ; GET /retail/shifts/active returns it

2. Cashier loads catalog
   GET /retail/products?locationId=<store> → product list (with stock)

3. (capture baseline) GET /retail/inventory/stats → note on-hand for SKU

4. Cashier rings up sale
   POST /retail/checkout {
     store_id, terminal_id, shift_id,
     items: [{ product_id, name, quantity, unit_price }],
     payment_method: "cash", payment_received, grand_total, currency
   }  (+ correlationId for idempotency)
   → order created, status PAID

5. VERIFY cross-module effects:
   a. Stock decreased by quantity sold  → GET /retail/inventory/stats (delta)
   b. Order appears                      → GET /retail/orders (new order id)
   c. Finance sees revenue              → GET /finance/payments includes the order
   d. Audit grew                         → GET /audit/logs
   e. Domain event emitted               → GET /events

6. Cashier closes shift
   PUT /retail/shifts/:id/close { actual_cash, closing_note, compliance_note }
   → reconciliation sealed; variance computed (expected vs actual cash)
```

**Idempotency test:** repeating step 4 with the same `correlationId` must NOT
create a second order or double-deduct stock.

**Edge cases:** checkout without an open shift → blocked (fiscal gate);
quantity exceeding stock → rejected or back-order; insufficient `payment_received`
→ 400.

---

## FLOW 2 — Procurement → Inventory Intake → Finance Payable

Buying stock from a supplier and receiving it into inventory.

```
1. Create supplier (if needed)
   POST /procurement/suppliers { name, ... }

2. Raise requisition
   POST /procurement/requisitions { title, requesterDept, branchCode, amount,
                                    requester_id, category, budgetClass }
   → status PENDING_REQUESTER_HOD

3. Approve requester HOD
   PUT /procurement/requisitions/:id/approve-requester-hod
   → APPROVED_REQUESTER_HOD

4. Build draft PO
   POST /procurement/draft-pos { requisitionId, supplierId, supplierBranchId,
                                 contractType, lineItems:[{productSku,quantity,unitPrice}] }

5. Procurement HOD approves draft + confirm supplier quote
   PUT /procurement/draft-pos/:id/approve
   PUT /procurement/draft-pos/:id/confirm-quote { quoteReference }

6. Final approval + release
   PUT /procurement/requisitions/:id/approve-final
   POST /procurement/purchase-orders/release { requisitionId }
   → final PO status RELEASED

7. VERIFY: released PO appears in inventory receiving queue
   GET /inventory/procurement-receipts  (or /retail receiving queue)

8. Receive goods → stock increases
   POST /inventory/procurement-receipts/:id/process
        { final_po_id, location_id, items:[{sku, quantity, unit_cost}] }
   → stock_levels +quantity at location ; PO marked RECEIVED

9. VERIFY cross-module:
   a. Stock increased        → GET /inventory/balances
   b. Movement logged        → GET /inventory/movements (INBOUND)
   c. Payable created        → GET /finance/payables (supplier owed)
   d. Supplier rating updated → POST /procurement/receipts metrics
```

---

## FLOW 3 — Sales Lead → Opportunity → Order

CRM pipeline from cold lead to closed deal.

```
1. Capture lead
   POST /sales/leads { company_name, contact_name, email, source, status:"NEW", potential_value }

2. Progress lead
   PUT /sales/leads/:id/status  NEW → CONTACTED → QUALIFIED

3. Convert qualified lead → opportunity
   POST /sales/leads/:id/convert
   → opportunity created in NEW stage

4. Move through pipeline
   PUT /sales/opportunities/:id/stage  NEW→…→NEGOTIATION
   GET /sales/pipeline → opportunity sits in correct stage column

5. Close won → creates sales order
   PUT /sales/opportunities/:id/close { outcome:"WON" }
   → GET /sales/orders shows new order

6. VERIFY:
   a. Order has inventoryCheck (AVAILABLE/UNAVAILABLE) ← reads stock
   b. Order can hand off to finance (invoice) → /finance/invoices
   c. Pipeline aggregate value reflects the closed deal
```

---

## FLOW 4 — HR Payroll → Finance Ledger

Running payroll and posting it to the general ledger.

```
1. Lock attendance for period
   (PayCycleStudio "Lock Attendance" → hr/payroll lock)

2. Create payroll run
   POST hr/payroll run { periodStart, periodEnd }  → status DRAFT

3. Estimate / variance check
   GET /finance/payroll/estimate?period=YYYY-MM   (department totals)

4. Submit to FlowGate (approval routing)
   → workflow_request created (entityType PAYROLL)

5. Finance approves
   PUT workflow approve  (FlowGate Decision Center)

6. Confirm disbursement → posts to GL
   payroll confirm-disbursement
   → finance ledger entries created ; payables/bank export available

7. VERIFY:
   a. Payroll run status → DISBURSED
   b. Ledger has payroll posting → GET /finance/ledger
   c. Workflow request → APPROVED
```

---

## FLOW 5 — Approval Routing (FlowGate) — cross-department

Generic multi-step approval used by payroll, leave, contracts, procurement.

```
1. Initiator creates a flow route (entityType, destinationDept, steps)
2. Request enters target dept inbox  → GET workflow inbox
3. Approver acts                     → approve / reject / return with notes
4. Each step transition is audited   → audit_logs + workflow steps[]
5. Terminal state (APPROVED/REJECTED) triggers the entity's side-effect
   (e.g. payroll disbursement, leave balance change, contract activation)
```

---

## FLOW 6 — Inventory Adjustment (approval-gated)

Correcting stock with a manager sign-off.

```
1. Staff requests adjustment
   POST /inventory/adjustments { item_id, location_id, requested_delta, reason }
   → status PENDING_APPROVAL

2. Manager approves
   PUT /inventory/adjustments/:id/approve   (role: MANAGER)
   → delta applied to stock_levels ; movement logged

3. VERIFY: stock changed by exactly requested_delta ; audit entry exists
```

---

## FLOW 7 — Async Reporting

Generating an operational/financial report.

```
1. POST /reporting/generate { report_type, format:"PDF" }  (ADMIN/OWNER)
   → { job_id, status:"PENDING" }
2. Poll GET /reporting/:id/status  → PENDING→PROCESSING→COMPLETED
3. GET /reporting/:id/download  → file
4. RBAC: STAFF calling generate → 401/403
```

---

## Data dependency matrix (what reads/writes what)

| Action | Writes | Reads / Triggers |
|--------|--------|------------------|
| POS checkout | retail_orders, order_items, stock_movements(-), cash | products, shift, promotions → emits event, audit, finance payment |
| Goods receipt | stock_movements(+), stock_levels | final_po → updates payable, supplier rating |
| Inventory adjustment (approved) | stock_levels, stock_movements | — → audit |
| Lead convert | sales_opportunities | sales_leads |
| Opportunity close-won | sales_orders | opportunity, stock (inventoryCheck) |
| Payroll disburse | finance_ledger, payables | payroll_run, workflow approval |
| Journal/COA | finance_chart_of_accounts, ledger | — → audit |
| Any mutation | audit_logs (hash chain), domain_events | — |

---

## Test design guidance

For each flow above, a functional test should:

1. **Arrange** — authenticate with a role that can perform the action; capture
   baseline counts (stock, orders, ledger, audit).
2. **Act** — perform the real API calls in sequence (or drive the UI buttons:
   open shift → add to cart → checkout → close shift).
3. **Assert effects, not just 200s** — verify the *downstream* record changed:
   stock delta equals quantity, order exists, payable created, audit grew.
4. **Assert invariants** — tenant isolation, audit chain validity, RBAC denial
   for the wrong role.
5. **Assert edge cases** — idempotent retry, insufficient stock/cash, missing
   required fields → correct 4xx (not 500).

This separates *"the page loaded"* (smoke) from *"the business operation
actually worked and propagated"* (functional).
