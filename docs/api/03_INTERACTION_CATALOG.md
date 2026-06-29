# Zenvix Interaction Catalog

> The complete inventory of **every possible user interaction** in the app, the
> exact trigger (button/form/menu), the service method it calls, the API
> endpoint, the data it writes, and **where that data surfaces elsewhere**.
>
> This is the backbone for functional tests. Each row is one testable
> interaction. Columns:
> - **Trigger** — what the human clicks/submits (UI page → control)
> - **Service** — frontend service method (`src/core/services/...`)
> - **API** — backend endpoint (prefix `/v1`)
> - **Writes** — data created/changed
> - **Surfaces in** — other modules/pages where the result becomes visible
> - **Role** — minimum role required

Legend for "Surfaces in": ⮕ = downstream effect to assert in a cross-module test.

---

## 1. AUTHENTICATION & ONBOARDING

| Trigger | Service | API | Writes | Surfaces in | Role |
|---------|---------|-----|--------|-------------|------|
| Login form → Initialize Access | authClient.login | POST /auth/login | session token | localStorage `ZENVIX_SESSION`; all pages | public |
| Register form → submit | authClient.register | POST /auth/register | user (no company) | redirect to onboarding | public |
| Onboarding wizard → Provision Cloud | companyService.provision | POST /auth/company/provision | tenant + company + HQ location + owner | ⮕ everything (tenant scope) | authed (no company) |
| Logout | — | client clears session | — | redirect /auth/login | any |

**Edge:** invalid creds → 401 stays on login with alert; expired token → redirect to login.

---

## 2. RETAIL — OPERATIONAL (POS / SPG)

> **Retail is the largest module — this section is a summary.** The exhaustive
> retail surface (both Management + Operational shells, 30+ pages, 6 backend
> controllers, storefront) lives in **[04_RETAIL_INTERACTIONS.md](./04_RETAIL_INTERACTIONS.md)**.

### Shift lifecycle (fiscal gate)
| Trigger | Service | API | Writes | Surfaces in | Role |
|---------|---------|-----|--------|-------------|------|
| Shift-Open → enter opening cash + acknowledge → Initialize Terminal | retailService.openShift | POST /retail/shifts/open | retail_shift (OPEN) | ⮕ POS unlocked; Shift list; cash baseline | SPG+ |
| (auto on POS load) | retailService.getActiveShift | GET /retail/shifts/active | — | gates POS access | SPG+ |
| Shift-Close → enter tender + notes → Seal & Commit | retailService.closeShift | PUT /retail/shifts/:id/close | shift CLOSED, variance | ⮕ Finance reconciliation; Audit ledger | SPG+ |
| Cash Movement terminal → record CASH_IN/OUT | retailService.recordCashMovement | POST /retail/shifts/:id/cash-movement | cash_movement | ⮕ shift expected cash | SPG+ |
| Reconcile | retailService.reconcileShift | POST /retail/shifts/:id/reconcile | reconciliation | ⮕ Audit | SPG+ |

### POS sale (CashierPOS)
| Trigger | Service | API | Writes | Surfaces in | Role |
|---------|---------|-----|--------|-------------|------|
| Product grid load / search / category filter | retailService.listInventory | GET /retail/products | — | catalog | SPG+ |
| Barcode scan (≥8 chars) | retailService.listInventory(q) | GET /retail/products?q= | — | adds to cart | SPG+ |
| Click product → add to cart | (local state) | — | cart item | cart panel | SPG+ |
| +/- quantity, remove, line discount | (local state) | — | cart totals | cart panel | SPG+ |
| Promotions auto-apply | retailService.listPromotions | GET /retail/promotions | — | discounts on cart | SPG+ |
| **Cart → Cash → Finalize Transaction** | apiRequest checkout (CashPaymentModal) | **POST /retail/checkout** | retail_order + items, stock_movement(−), cash | ⮕ **Inventory stock ↓**, Orders list, Finance payments, Audit, Domain events, receipt print | SPG+ |
| Cart → Card → electronic payment | ElectronicPaymentModal | POST /retail/checkout | same as above (electronic) | ⮕ same | SPG+ |
| Receiving terminal → confirm goods | retailService.receiveGoods | POST /retail/inventory/receive | stock_movement(+) | ⮕ Inventory balances | SPG+ |
| Stock Opname scanner → submit count | retailService.submitOpname | POST /retail/inventory/opname | adjustment | ⮕ Inventory adjustments | SPG+ |

### Order management
| Trigger | Service | API | Writes | Surfaces in | Role |
|---------|---------|-----|--------|-------------|------|
| Order detail → take payment | retailService(processPayment) | POST /retail/orders/:id/payment | payment | ⮕ Finance | Admin |
| Refund/Return Desk → process return | retailService(processReturn) | POST /retail/orders/:id/return | return, stock(+) | ⮕ Inventory, Finance refund | Admin |
| Void order | retailService.voidOrder | POST /retail/orders/:id/void | order VOID | ⮕ reverses stock/finance | Admin |
| Cancel order | retailService.cancelOrder | POST /retail/orders/:id/cancel | order CANCELLED | ⮕ Orders list | Admin |
| Print receipt | — | GET /retail/orders/:id/print | — | printer | SPG+ |

**Edge cases:** checkout with no open shift → blocked; qty > stock → reject/backorder;
insufficient cash received → 400; duplicate `correlationId` → no double order.

---

## 3. RETAIL — MANAGEMENT

| Trigger | Service | API | Writes | Surfaces in | Role |
|---------|---------|-----|--------|-------------|------|
| Stores list / create / edit / delete | retailService.{list,create,update,delete}Store | GET/POST/PUT/DELETE /retail/stores | store | ⮕ POS store selector, locations | Admin |
| Inventory page (products + pagination) | retailService.listInventory | GET /retail/products | — | catalog | Admin |
| Update product | retailService(updateProduct) | PATCH /retail/products/:id | product | ⮕ POS catalog | Admin |
| Channels: create/sync/rotate/revoke creds | retailService channel methods | /retail/channels/* | channel | ⮕ e-commerce sync | Admin |
| Devices/CCTV/Sensors register & ping | retailService.{register*,pingDevice} | /retail/devices,/cctvs,/sensors | device | ⮕ IT topology | Admin |
| Promotions update | retailService(updatePromotion) | PUT /retail/promotions/:id | promotion | ⮕ POS auto-discount | Admin |
| Store dashboard / e-comm analytics | retailService.getEcommerceAnalytics | GET /retail/analytics/ecommerce | — | dashboard | Admin |
| Export audit / dashboard | — | GET /retail/audit/export, /dashboard/export | file | download | Admin |

---

## 4. INVENTORY (core)

| Trigger | Service | API | Writes | Surfaces in | Role |
|---------|---------|-----|--------|-------------|------|
| Stock Hub list / search / filter | inventoryService.listBalances | GET /inventory/balances | — | KPIs | any |
| Items list / lookup | inventoryService.{listItems,lookupItemByBarcode} | GET /inventory/items | — | catalog | any |
| New Item dialog → create | inventoryService.createItem | POST /inventory/items | item_master | ⮕ Retail catalog, POS | MANAGER |
| Batch JSON / CSV import | inventoryService(batch/import) | POST /inventory/items/batch-json, /items/import | items | ⮕ catalog | MANAGER |
| Approve / reject pending item | inventoryService(approve/reject) | PUT /inventory/items/:id/approve\|reject | item ACTIVE | ⮕ catalog | MANAGER |
| Export items | inventoryService(export) | GET /inventory/items/export | file | download | any |
| **Receiving Desk → confirm goods receipt** | inventoryService.processProcurementReceipt | POST /inventory/procurement-receipts/:id/process | stock(+), movement | ⮕ **balances ↑, PO RECEIVED, Finance payable** | any |
| Receipt queue load | inventoryService.listProcurementReceiptQueue | GET /inventory/procurement-receipts | — | queue (released POs) | any |
| **Adjustments → New Request** | inventoryService.requestAdjustment | POST /inventory/adjustments | adjustment PENDING | ⮕ approval queue | any |
| **Adjustments → Approve & Apply** | inventoryService.approveAdjustment | PUT /inventory/adjustments/:id/approve | stock ±delta, movement | ⮕ **balances change, Audit** | MANAGER |
| Intake / Consume / Transfer stock | inventoryService.{recordIntake,recordDeduction,recordTransfer} | POST /inventory/intake,consume,transfer | movement | ⮕ balances | SUPERVISOR |
| Reserve / Release / Confirm reservation | inventoryService(reserve/release/confirm) | POST /inventory/reserve,release,confirm-reservation | reservation | ⮕ available stock | SUPERVISOR |
| Transfer Desk → initiate/pick/ship/receive | inventoryService stock-transfer methods | PUT /inventory/stock-transfers/:id/{pick,ship,receive} | transfer lifecycle | ⮕ both locations' stock | SUPERVISOR |
| Audit cycle → start/initiate/count/close | inventoryService.{startAuditCycle,initiateAudit,createAuditItem,closeAuditCycle} | /inventory/audit* | audit cycle, variance | ⮕ adjustments, Audit | MANAGER |
| Alerts → set status | inventoryService.updateAlertStatus | PUT /inventory/alerts/:id/status | alert | dashboard | any |
| Low-stock / expiry scan | inventoryService.{runLowStockScan,runExpiryScan} | POST /inventory/scans/* | alerts | ⮕ alerts list | SUPERVISOR |
| Categories CRUD | inventoryService category methods | /inventory/categories | category | ⮕ item filters | any |

**Edge:** adjustment without required fields → 400; approve already-approved → 409/idempotent; negative stock guard.

---

## 5. PROCUREMENT

| Trigger | Service | API | Writes | Surfaces in | Role |
|---------|---------|-----|--------|-------------|------|
| Suppliers list / create | procurementService.{listSupplierMasters,createSupplier} | GET/POST /procurement/suppliers | supplier | ⮕ draft PO selector | MANAGER |
| Supplier branches / products | procurementService.* | /procurement/branches, /supplier-products | — | PO building | MANAGER |
| **Create Requisition** (dialog) | useCreateRequisition | POST /procurement/requisitions | requisition PENDING_REQUESTER_HOD | ⮕ requisition queue | MEMBER+ |
| Approve Requester HOD | useApproveRequesterHod | PUT /procurement/requisitions/:id/approve-requester-hod | → APPROVED_REQUESTER_HOD | ⮕ draft PO gate | MANAGER |
| **Build Draft PO** (dialog) | useBuildDraftPo | POST /procurement/draft-pos | draft PO | ⮕ Draft PO gate | MANAGER |
| Approve Draft (Procurement HOD) | useApproveDraftPo | PUT /procurement/draft-pos/:id/approve | draft approved | ⮕ quote gate | MANAGER |
| Confirm Supplier Quote | useConfirmSupplierQuote | PUT /procurement/draft-pos/:id/confirm-quote | quote ref → FINAL_APPROVAL_PENDING | ⮕ release gate | MANAGER |
| Final approval (Requester/Proc/Finance HOD) | useSetFinalApproval | PUT /procurement/requisitions/:id/approve-final | → FINAL_APPROVED | ⮕ release | MANAGER |
| **Release PO** | useReleasePurchaseOrder | POST /procurement/purchase-orders/release | final PO RELEASED | ⮕ **Inventory receiving queue, Finance payable** | MANAGER |
| Record Receipt (rating) | useRecordReceipt | POST /procurement/receipts | receipt metrics | ⮕ supplier rating | MANAGER |
| Process receipt | — | POST /procurement/purchase-orders/:id/process-receipt | stock(+) | ⮕ Inventory | MANAGER |
| Contracts: create/approve-legal/sign | procurementService contract methods | /procurement/contracts/* | contract | ⮕ PO governance | MANAGER |
| Run Risk Scan | useRunRiskScan | POST /procurement/risk-scan | risk signals | ⮕ risk center | MANAGER |
| Risk signals create / status | procurementService risk methods | /procurement/risk-signals | signal | risk center | MEMBER+ |
| Portal messages | procurementService.* | /procurement/portal-messages | message | supplier portal | MEMBER+ |

**Edge:** create requisition needs valid `requesterDept` (real dept id) + `requester_id` (real employee) → FK 400 if invalid; release before FINAL_APPROVED → blocked.

---

## 6. SALES (CRM)

| Trigger | Service | API | Writes | Surfaces in | Role |
|---------|---------|-----|--------|-------------|------|
| Lead Desk → Inject New Lead | salesService.createLead | POST /sales/leads | lead NEW | ⮕ lead pool | MEMBER+ |
| Lead row → Log Contact | salesService.updateLeadStatus | PUT /sales/leads/:id/status (CONTACTED) | lead | pipeline | MEMBER+ |
| Lead row → Qualify Node | salesService.updateLeadStatus | PUT .../status (QUALIFIED) | lead | enables convert | MEMBER+ |
| Lead row → Convert to Opp | salesService.convertLeadToOpportunity | POST /sales/leads/:id/convert | opportunity NEW | ⮕ Pipeline board | MEMBER+ |
| Sync lead from marketing | salesService.syncLeadFromMarketing | POST /sales/leads/sync-marketing | lead | lead pool | MANAGER |
| Pipeline card → move stage (dropdown) | salesService.moveOpportunityStage | PUT /sales/opportunities/:id/stage | opp stage | ⮕ pipeline columns, aggregate value | MEMBER+ |
| Create Quote | salesService.createQuote | POST /sales/quotes | quote | quotes list | MEMBER+ |
| Submit / Decide / Send quote | salesService.{submitQuoteForApproval,decideQuoteApproval,sendQuoteToCustomer} | PUT /sales/quotes/:id/{submit,decision,send} | quote status | ⮕ customer | MANAGER for decision |
| **Order Desk → Convert Opportunity (close won)** | salesService.closeWonOpportunity | PUT /sales/opportunities/:id/close (WON) | sales_order | ⮕ **Order Desk, inventoryCheck, Finance invoice** | MEMBER+ |
| Close lost | salesService.closeLostOpportunity | PUT .../close (LOST) | opp LOST | pipeline | MEMBER+ |
| Timeline event add | salesService.addTimelineEvent | POST /sales/timeline | event | timeline | MEMBER+ |
| Task create / mark done | salesService.{createTask,markTaskDone} | POST /sales/tasks, PUT /:id/done | task | tasks | MEMBER+ |
| Acknowledge alert | salesService.acknowledgeAlert | PUT /sales/alerts/:id/ack | alert | alerts | MEMBER+ |
| Run SLA sweep | salesService.runSlaSweep | POST /sales/sla-sweep | alerts | ⮕ delinquent leads | MANAGER |

**Edge:** lead status transition out of order (e.g. NEW→QUALIFIED skipping CONTACTED) — verify guard; convert non-qualified lead → blocked.

---

## 7. FINANCE

| Trigger | Service | API | Writes | Surfaces in | Role |
|---------|---------|-----|--------|-------------|------|
| Ledger Core → view journals/invoices/payroll | financeApiClient.{listJournals,listInvoices,getPayrollEntries} | GET /finance/ledger, /invoices | — | ledger | any |
| **Create COA entry** | financeService | POST /finance/coa | account | ⮕ ledger postings, JV | ADMIN/OWNER |
| Update COA | financeService | PATCH /finance/coa/:id | account | ledger | ADMIN/OWNER |
| Money Desk → Create Payment Request | apiRequest payment | POST /finance/payments | payment PENDING | ⮕ approvals tab | MANAGER+ |
| Approve / Reject payment | financeService.updatePaymentStatus | PATCH /finance/payments/:id/status | payment | ⮕ payments list, GL | ADMIN/OWNER |
| Source limits update | apiRequest limits | PATCH /finance/treasury/sources/:id/limits | thresholds | ⮕ threshold alerts | ADMIN/OWNER |
| Treasury transfer / reconcile | financeService treasury | POST /finance/treasury/transfers, /reconcile | transfer | ⮕ source balances | MANAGER+ |
| Payroll posting → Calculate Draft | financeApiClient.estimatePayroll | GET /finance/payroll/estimate | — | estimates | ADMIN/OWNER |
| Payroll posting → Run Payroll | financeApiClient.runPayroll | POST /finance/payroll/execute | ledger entries | ⮕ **GL, payables** | ADMIN/OWNER |
| Assets create/capitalize/depreciate/dispose | financeService asset methods | /finance/assets/* | asset events | asset register | ADMIN/OWNER |
| Capex request → create/approve/reject | financeService capex | /finance/capex/* | capex | budget | MANAGER+ |
| Loans apply/approve | loanService | /finance/loans | loan | ⮕ payables | MANAGER for approve |
| Reconciliation modal | — | (ledger reconcile) | match | ledger | ADMIN/OWNER |

**Caveat:** `POST /finance/journal-entries` (LedgerCore "Create Journal Entry" dialog)
is **not wired on the backend** — journal creation is via `/finance/ledger/process-event`.
Balance validation (debits=credits) happens client-side before submit.

---

## 8. HR

| Trigger | Service | API | Writes | Surfaces in | Role |
|---------|---------|-----|--------|-------------|------|
| Roster / People list | peopleService / hrService.getEmployees | GET /hr/employees | — | directory | any |
| Employee 360 (PeopleCore) | peopleService.getEmployee360 | GET /hr/employees/:id | — | profile | any |
| Add / edit / delete employee | hrService | POST/PUT/DELETE /hr/employees | employee | ⮕ payroll, scheduling | Admin |
| Export employees | hrService.exportEmployees | GET /hr/employees/export | Excel | download | any |
| Transfer dept / promote / suspend / terminate | peopleService workstream | hr workflow | workflow_request | ⮕ FlowGate | Admin |
| FlowGate → New Flow Route | workflowService (CreateFlowRouteModal) | workflow create | workflow | inbox | any |
| **FlowGate → Approve / Reject / Return** | workflowService.{approveRequest,rejectRequest} | workflow approve/reject | step transition | ⮕ entity side-effect (payroll/leave/etc.), Audit | approver role |
| PayCycle → Create Payroll Run | payrollService (CreatePayrollRunModal2) | hr/payroll run | payroll_run DRAFT | runs table | any |
| Lock Attendance | payrollService.lockAttendance | hr/payroll lock | locked period | payroll | any |
| Run Variance Check | payrollService.runVarianceCheck | hr/payroll variance | variance score | note | any |
| Submit to FlowGate | payrollService.submitForApproval | hr/payroll submit | workflow | ⮕ FlowGate | any |
| Approve payroll | payrollService.approvePayroll | hr/payroll approve | APPROVED | ⮕ disbursement | FINANCE role |
| Bank Export | payrollService.exportBankFile | hr/payroll export | CSV | download | FINANCE |
| **Confirm Disbursement** | payrollService.confirmDisbursement | hr/payroll disburse | DISBURSED | ⮕ **Finance GL** | FINANCE |
| Leave request / approve | leaveService | hr/leaves | leave | ⮕ FlowGate, balance | any/approver |
| Attendance record | attendanceService | hr/attendance | record | payroll | any |
| Scheduling assign | schedulingService | hr/scheduling | schedule | roster | Manager |
| Recruitment / training / cases / performance | respective services | hr/recruitment etc. | records | dashboards | varies |

---

## 9. PAYMENT

| Trigger | Service | API | Writes | Surfaces in | Role |
|---------|---------|-----|--------|-------------|------|
| Payment Execution Hub → execute | paymentService | POST /payment/* | transaction | ⮕ Finance, retail order | Admin |
| Provider/Device routing config | paymentService | /payment routing | config | execution | Admin |
| Refund Desk → refund | paymentService | /payment refund | refund | ⮕ Finance, order | Admin |
| Dispute Center → manage | paymentService | /payment dispute | dispute | audit | Admin |
| (provider) webhook | — | POST /payment/webhook | settlement | ⮕ payment status | provider (no auth) |
| Admin payments console | adminPayment | /admin/payments | — | oversight | Admin |

---

## 10. SUPPORTING MODULES

### Comms
| Bulletin: create/react/comment | comms: bulletinService | POST /comms/bulletin(+/:id/react,/comment) | post | feed | any |
| **Mail: send** | mailService.sendMail | POST /comms/mail/send | mail_message | ⮕ recipient inbox, notification | any |
| Mail: star/read/delete/restore | mailService | PATCH/DELETE /comms/mail/:id/* | mail flags | mailbox | any |
| Chat: create room / message | chatService | POST /comms/chat/rooms | room | chat | any |
| Notifications: read / read-all | notificationService | PATCH/POST /comms/notifications | read state | bell | any |

### IT-Settings
| Devices register / status | itSettingsService | POST /it-settings/devices, PUT /:id/status | device | IT topology | any |
| **Setting update** | itSettingsService | PUT /it-settings/settings/:key | setting (upsert) | ⮕ app theme/config | any |
| Provisioning request | itSettingsService | POST /it-settings/provisioning/requests | request (audit-backed) | provisioning list | any |

### IT
| Overview/devices/health/topology/monitoring | itService | GET /it/* | — | dashboards | requires `it` module (else 403) |
| Create device / provisioning | itService | POST /it/devices, /provisioning | device/request | IT dashboard | module-gated |

### Reporting
| **Generate report** | reportingService | POST /reporting/generate | sys_report_job PENDING | ⮕ archives, status poll | ADMIN/OWNER |
| Check status / download / retry | reportingService | GET /reporting/:id/{status,download}, POST /:id/retry | — | report | any (own) |

### Warehouse
| Bins list | — | GET /warehouse/bins?locationId= | — | bin map | any |
| **Create bin** | — | POST /warehouse/bins?locationId= | warehouse_bin | bin map | any |
| Assign stock to bin | — | POST /warehouse/bins/:binId/assign | bin_assignment | ⮕ Inventory | any |

### Admin / Settings
| Admin dashboard / modules / audit-events | adminService | GET /admin/* | — | admin console | Admin |
| Create / resolve admin request | adminService | POST /admin/requests, PUT /:id/resolve | request | ⮕ FlowGate | Admin |
| Settings: profile/preferences/locations | orgSettingsService | GET/PUT /settings/* | tenant config | ⮕ all pages | Admin |

### Audit / Events / Logs (read-only verification surfaces)
| Audit logs / verify chain / anchors | auditService | GET /audit/{logs,verify-chain,anchors/public} | — | compliance | Admin |
| Domain events / failed events | — | GET /events, /events/failed | — | ops | Admin |
| System logs | — | GET /logs | — | ops | Admin |

---

## Cross-module surfacing map (the "where data is used" index)

| When this happens... | ...this changes elsewhere |
|----------------------|---------------------------|
| POS checkout | Inventory balances ↓ · Retail orders · Finance payments · Audit · Events · Shift expected cash |
| Shift close | Finance reconciliation · Audit ledger |
| Goods receipt (procurement/inventory) | Inventory balances ↑ · Movements · PO→RECEIVED · Finance payable · Supplier rating |
| Inventory adjustment approved | Stock levels · Movements · Audit |
| PO released | Inventory receiving queue · Finance payable |
| Lead converted / opp won | Sales opportunity → order · Finance invoice · inventoryCheck |
| Payroll disbursed | Finance GL · Payables · Bank export |
| FlowGate approval | Entity side-effect (payroll/leave/contract) · Audit |
| Mail sent | Recipient inbox · Notification bell |
| IT setting changed | App theme/config across pages |
| Any mutation | audit_logs (hash chain) · domain_events |

---

## How to turn this into tests

Every row above is a **unit of interaction**. A functional test picks a row (or a
chain of rows = a flow from `02_APP_FLOWS.md`) and asserts:

1. The action succeeds for the **correct role** (2xx).
2. The action is **denied for the wrong role** (401/403).
3. The **"Writes"** column actually changed (read it back).
4. Every **"Surfaces in ⮕"** target reflects the change (cross-module assert).
5. **Edge cases** for that row return correct 4xx (not 500).

Test files can be organized one-per-module (matching sections 1–10) plus a
`cross-module.spec` per flow in `02_APP_FLOWS.md`.
