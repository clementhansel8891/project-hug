# Full App Coverage Map — Every Page, Every Wired Interaction

> Exhaustive page-by-page map across **Core, Retail, and Procurement** (and all
> other modules), built from a full scan of `src/pages/**`. For each module:
> route-level pages, their wired (API-backed) interactions, and the modals that
> write data.
>
> **Scope note:** this lists the **testable, wired** interactions. Dead buttons,
> stubs, orphaned modals, and endpoint mismatches are catalogued separately in
> **[06_GAPS_AND_STUBS.md](./06_GAPS_AND_STUBS.md)** — read that before writing
> tests so you don't target non-functional controls.

## Page count by area (route-level pages, excluding sub-components/modals)

| Area | Pages | Modals/Dialogs |
|------|-------|----------------|
| Finance | 23 | 8 dialogs |
| HR | 19 | 37 modals |
| Inventory (core) | 10 | 22 dialogs |
| Warehouse | 8 | — |
| Sales | 14 | 9 modals |
| Marketing | 18 | 13 modals |
| Procurement | 9 | inline dialogs |
| Payment | 8 | 1 modal |
| IT | 8 | 9 modals |
| Retail Management | ~22 | ~30 modals/panels |
| Retail Operational | 11 | POS sub-modals |
| Core platform (admin/comms/audit/logs/settings/tools/portal/workflow/etc.) | ~25 | ~12 modals |

---

## FINANCE (`/core/finance/*`)

| Page | Key wired interactions | Endpoints |
|------|------------------------|-----------|
| CFODashboard | load metrics, drill-down modal, global filter bar | /finance/dashboard/* |
| MoneyDesk | Create Payment Request; Approve/Reject; source limits | POST /v1/finance/payments; PATCH /v1/finance/payments/:id/status; PATCH /v1/finance/treasury/sources/:id/limits |
| LedgerCore | view journals/invoices/payroll tabs; Create Journal (⚠ unwired endpoint); Run Payroll posting; reconciliation | GET /v1/finance/ledger; POST /v1/finance/payroll/execute |
| TreasuryMap | transfers, reconcile (role-gated isHighLevelRole) | POST /v1/finance/treasury/transfers, /reconcile |
| PayFlow | payment execution queue | /v1/finance/payments |
| ReceivableDesk | AR invoices, record receipt | /v1/finance/ar/*, /receivables |
| PayableDesk | AP, mark-paid (⚠ path mismatch) | /v1/finance/payables/:id/paid |
| ClosePeriodStudio | lock/close/reopen period (⚠ dual endpoints) | /v1/finance/periods/:id/close, /fiscal-periods/:id/lock |
| AuditVault | finance audit view | /v1/finance/audit-log |
| FinanceInsights | insights read | /finance/dashboard/* |
| InvoiceCapture | capture invoice | /v1/finance/invoices |
| Assets | create/capitalize/depreciate/dispose/impair/revalue/status | /v1/finance/assets/* |
| PolicyManager | Set Budget (role-gated canManageFiscal) | /v1/finance/capex/budgets, /policies |
| JVDesk + dialogs | invite partner, log expense, approve/reject expense, generate settlement, bulk permissions | /v1/finance/jv/* (most fully wired finance area) |
| JVItems | reads inventory, not finance | /v1/inventory/* |
| JVPnLReport | P&L report | /v1/finance/jv/* |
| PayslipStudio | payslip templates (Preview PDF = stub) | /v1/finance/payslip/templates |
| FinanceDocs | docs list | /v1/finance/documents |
| BudgetPlanning | ⚠ mostly local/alert stubs | — |
| TaxCompliance | ⚠ entirely alert()-driven stub | — |
| ReconciliationDesk | reconcile | /finance/reconciliation/* |
| FinancialOperationsDesk | ⚠ action buttons are stubs | — |

UI role gates exist only in MoneyDesk, TreasuryMap, PolicyManager. All others rely on session auth.

---

## HR (`/core/hr/*`)

| Page | Key wired interactions | Endpoints |
|------|------------------------|-----------|
| PulseDesk | attendance dashboard (New Pulse/Heatmap = dead) | hr services |
| RosterGrid | employee directory, open create/edit | GET /v1/hr/employees |
| PeopleCore | employee 360; transfer/promote/suspend/terminate/edit → modals | hr workflow |
| OrgMap | org chart | orgService |
| VaultSpace | documents, create vault doc | documentService |
| FlowGate | approve/reject/return workflows; new flow route | workflowService /v1/workflow/* |
| TalentFlow | recruitment; advance/reject candidate, schedule interview (⚠ client stubs) | hr/talent/* (no backing service) |
| SkillTrack | training assign/bulk-assign | trainingService |
| GrowthCycle | performance review cycles, launch cycle | performanceService |
| PayCycleStudio | create run, lock attendance, variance check, submit→approve→bank export→**confirm disbursement** (role-gated financeAllowed) | payrollService → posts to GL |
| SchedulingStudio | shift templates, assign staff (some static buttons) | schedulingService |
| DepartmentScheduleStudio / DepartmentAttendanceStudio | dept schedule/attendance (gated canManagePersonnel; "Adjust" = toast only) | hr/scheduling, /attendance |
| LexBoard | legal contracts | legalService |
| InsightLayer / Insights | HR analytics (Insights = re-export) | analyticsService |
| Cases/CaseDesk + CaseDetail | create/resolve case | caseService |

**37 modals** all write via `useModuleMutation(path, method)` — see 06 for the path-mismatch list (modal paths differ from service paths in several cases).

---

## INVENTORY (`/core/inventory/*`) + WAREHOUSE

| Page | Key wired interactions | Endpoints |
|------|------------------------|-----------|
| InventoryDashboard | KPIs (View Logistics Map = dead) | /v1/inventory/dashboard |
| InventoryStockHub | list/search/filter; New Item; import/export; (row dropdown ops = stubs) | /v1/inventory/items* |
| InventoryReceiving | receipt queue; **process goods receipt** | POST /v1/inventory/procurement-receipts/:id/process |
| InventoryAdjustments | New Request; **Approve & Apply**; (Reject = stub) | POST /v1/inventory/adjustments; PUT /:id/approve |
| TransferDesk | create transfer; pick/ship/receive lifecycle | /v1/inventory/stock-transfers* |
| InventoryStockOpname | stock count session | /v1/inventory/audit* |
| InventoryAuditLog | audit cycles | /v1/inventory/audit-cycles |
| InventoryInsights | analytics (Approve/Dismiss = stubs) | read |
| IotEventFeed | IoT events (View Audit = dead) | /v1/inventory/iot/events |
| **22 dialogs** | CreateItem, Adjustment, BatchIntake, BatchTransfer, Bundle, CategoryAssign, CourierDispatch, CreateTransfer, ImageUpload, Analytics, ItemDetails, JobMonitor, LocationAssign, PriceUpdate, ReorderPoint, StockCount, SupplierLink, Transfer, TransferManifest, VariantCreate, FutureIntegration | via useInventoryQueries hooks → inventoryService |
| **Warehouse** | Only WarehouseManagement (bins) is live; **6 of 8 warehouse pages are static UI** (Hierarchy, Receiving, Picking, Packing, OccupancyTrends, Audit) | GET/POST /v1/warehouse/bins |

---

## SALES (`/core/sales/*`)

| Page | Key wired interactions | Endpoints |
|------|------------------------|-----------|
| LeadDesk | Inject Lead; Log Contact; Qualify; Convert to Opp | POST /v1/sales/leads; PUT /:id/status; POST /:id/convert |
| PipelineBoard | move opp stage (dropdown) | PUT /v1/sales/opportunities/:id/stage |
| OpportunityDesk | manage opps | /v1/sales/opportunities |
| QuoteDesk | create/submit/decide/send quote (inline dialog) | /v1/sales/quotes* |
| SalesOrderDesk | Convert Opportunity → close won (creates order); inline dialog | PUT /v1/sales/opportunities/:id/close; POST /v1/sales/orders |
| TimelineDesk | add timeline event (inline dialog) | POST /v1/sales/timeline |
| ManagerDesk | metrics (Board Analysis/Coaching = dead) | /v1/sales/manager-metrics |
| ForecastDesk | forecast read (Export = dead) | /v1/sales/forecast |
| SalesAuditLog | read-only audit | /v1/sales/audit-events |
| SalesIntelligenceEngine | ⚠ all 5 buttons dead | — |
| Incentives/IncentiveDesk | incentive plans (uses incentivesService; Edit = dead) | /v1/sales/incentives/* |
| SalesOverview / SalesDashboard | read dashboards | /v1/sales/dashboard |

Modals: CreateLead, ConvertLead, CreateOrder, CreateQuotation, QuoteAction, CloseOpportunity, CreateSalesTask, CreateTimelineEvent, IncentiveConfig.
**No RBAC anywhere in sales.** Unused services: syncLeadFromMarketing, listTasks/createTask/markTaskDone.

---

## MARKETING (`/core/marketing/*`)

| Page | Key wired interactions | Endpoints |
|------|------------------------|-----------|
| MarketingDashboard | metrics (most cards navigate to /automation) | /v1/marketing/dashboard |
| CampaignDesk | create campaign, update status | POST /v1/marketing/campaigns; PUT /:id/status |
| ExecutionDesk | schedule + run execution | POST /v1/marketing/executions; PUT /:id/run |
| LeadCaptureDesk | capture lead, mark handoff-ready | POST /v1/marketing/leads; PUT /:id/handoff-ready |
| NurtureStudio | create workflow, update status | /v1/marketing/workflows* |
| FunnelBuilderDesk | create/update funnel (EditFunnelStep = local only) | /v1/marketing/funnels* |
| OmnichannelInbox | send message; omnichannel config (RUN AUTOMATION/VIP = toast) | POST /v1/marketing/messages/send; /omnichannel/config |
| ConnectedAccountsDesk | connect (OAuth), status, settings, sync, delete | /v1/marketing/accounts*, /oauth/authorize/* |
| CreativeLibrary | upload/update asset (delete = dead; upload has no file input) | /v1/marketing/assets* |
| AppointmentDesk | create appointment (inline dialog) | POST /v1/marketing/appointments |
| Customer360Desk | contact profile read | /v1/marketing/customers/:id/profile |
| MarketingAlerts | acknowledge, health sweep | PUT /v1/marketing/alerts/:id/ack; POST /health-sweep |
| AutomationLab | ⚠ fully simulated (setTimeout) | — |
| StrategyControlDesk | ⚠ local-only authorize/reject | — |
| Customer360 | ⚠ static mock | — |
| MarketingAnalytics / MarketingAuditLog | read-only | reads |

---

## PROCUREMENT (`/core/procurement/*`)

| Page | Key wired interactions | Endpoints |
|------|------------------------|-----------|
| PurchaseRequestDesk | **Create Requisition**; Approve Requester HOD; **Build Draft PO**; Final approvals (Requester/Proc/Finance HOD); Run Risk Scan | POST /v1/procurement/requisitions; PUT /:id/approve-requester-hod; POST /draft-pos; PUT /:id/approve-final; POST /risk-scan |
| PoReleaseDesk | Confirm Supplier Quote; **Release PO**; Record Receipt | PUT /v1/procurement/draft-pos/:id/confirm-quote; POST /purchase-orders/release; POST /receipts |
| SupplierDesk | create supplier, branches, products | POST /v1/procurement/suppliers, /branches, /supplier-products/upsert |
| SupplierPortalDesk | portal messages | /v1/procurement/portal-messages |
| ContractDesk | create/approve-legal/sign contract | /v1/procurement/contracts* |
| ProcurementRiskCenter | risk signals create/status | /v1/procurement/risk-signals* |
| ProcurementInsights | spend insights (View Handoff Ledger = dead; Integration Health = stub) | /v1/procurement/spend-insights |
| ProcurementWorkspaceLayout / ProcurementEntry | nav shells | — |

Service enforces `ensureTenant` (SUPERADMIN bypass, else tenant match).

---

## PAYMENT (`/core/payment/*`)

| Page | Key wired interactions | Endpoints |
|------|------------------------|-----------|
| PaymentDashboard | Create Payment (⚠ uses Finance's modal → /v1/finance/payments) | cross-module |
| PaymentExecutionHub | execute/approve/route/settle (⚠ no await in try/catch) | /payment/* (⚠ no /v1) |
| ProviderRoutingDesk | provider routing | /payment/providers/* |
| DeviceRoutingDesk | device routing | /payment/devices/* |
| RefundDesk | refunds | /payment/refunds/* |
| DisputeCenter | disputes | /payment/disputes/* |
| PaymentAuditVault | audit read | /v1/payment/* |
| PaymentMethodConfigModal | ⚠ orphaned (not rendered) | POST /v1/payment/providers |

⚠ Payment lists use `/v1/payment/*` but **all mutations use `/payment/*` without /v1** — systemic.

---

## IT (`/core/it/*`)

| Page | Key wired interactions | Endpoints |
|------|------------------------|-----------|
| ITDashboard | overview (System Console = dead; Security Feed = stub) | /v1/it/overview |
| AccountDesk | accounts (Auto-provision switch = stub) | itService |
| DeviceDesk | devices (role-filtered visibility) | /v1/it/devices |
| SystemHealth | health (Global Config / Compliance Report = dead; telemetry = stub) | /v1/it/system-health |
| TopologyMap | topology (Provision Node/Remote Shell/Audit = dead) | /v1/it/devices |
| RoleGovernance | ⚠ entirely local stub (all buttons dead) | — |
| TechShop | hardware catalog (static; Filter = dead) | — |
| Modals | CreateTicket, Incident, RegisterDevice, HardwareRequest, CreateProvisioning, EditProvisioning (wired); **Escalation/Resolution/SLAConfig = orphaned** | POST /v1/it/tickets, /incidents, /provisioning (write-only, no GET) |

---

## RETAIL

Fully documented in **[04_RETAIL_INTERACTIONS.md](./04_RETAIL_INTERACTIONS.md)** —
both Management (6 nav groups, ~22 pages) and Operational (11 pages) shells, plus
the ~30 management modals/panels mapped here:

| Modal group | Wired writers |
|-------------|---------------|
| modals/ | ItemDetailModal (DELETE items), OrderDetailModal (PATCH status/DELETE/refund), RegisterStoreDialog (POST stores), TransferTrackingModal (⚠ no /v1) |
| store-profile/ | CreateStoreDialog + StoreProfileLayout (createStore/updateStore); 6 Store*Module = local config, persist via Layout "Save Config" |
| pricing-promo-desk/ | CreatePromoModal (POST promotions); ApprovalMatrix (parent governance) |
| shift-control/ | EditShiftModal (PATCH/DELETE shifts), ShiftGovernanceModal (POST shifts/publish) |
| staff-assignments/ | RoleModificationModal (POST staff/roles), StaffDetailsModal (PATCH staff/:id) |
| channels/ | CreateChannel/ChannelDetail/ManageConnector/ChannelProductWizard/RegisterEcommerceBranch → ecommerceHubService /retail/ecommerce-hub/* (⚠ no /v1) |
| cctv/ | CCTVConnectorModal/Viewer (validate/register CCTV) |
| device-control/ | RegisterModal (POST devices/cctvs/sensors), DiscoveryModal; DeviceModal/SensorModal → /kernel/iot/* (⚠ non-retail namespace) |
| inventory mgmt modals | InventoryStockEditDialog/ProductDetailEditDialog (PATCH /v1/retail/inventory/:id), AnomalyCompletionDialog (⚠ /v1/inventory/items/:id/complete) |

---

## CORE PLATFORM

| Page | Wired interactions | Endpoints |
|------|--------------------|-----------|
| Dashboard / GrowthTrajectory / RiskMatrix | read admin metrics (much hardcoded) | GET /v1/admin/dashboard?period= |
| Admin | dashboard, invite admin, emergency request | GET /v1/admin/dashboard; POST /v1/admin/invitations, /admin/requests |
| adminWorkspace/RequestDesk | intake queue, submit request | GET/POST /v1/admin/requests |
| adminWorkspace/RequestAssign/Track | ⚠ static/local-only | — |
| audit/AuditHub | search logs, export (⚠ /audit/logs no /v1) | GET /audit/logs; POST /v1/audit/export |
| comms/BulletinHub | posts, react, comment, view, delete, categories | /comms/bulletin* (⚠ no /v1) |
| comms/ChatHub | channels, messages (5s poll), send | /comms/chat/* |
| comms/MailHub | folders, read, star, delete, restore, compose | /comms/mail/* |
| comms modals | BulletinCreate, ChatCreate, MailCompose, ChannelConfig | POST /comms/* |
| logs/LogHub | observability, search logs, export | GET /v1/logs; POST /v1/logs/export |
| settings/Settings | load profile/prefs/child-cos/roles; commit changes; register child company | GET/PUT /v1/settings/profile, /preferences; POST /v1/settings/child-companies |
| settings/WhiteLabelSettings | ⚠ entirely local (setTimeout save) | — |
| tools/Explorer | folders/files CRUD, upload, move, delete, restore, secure export (⚠ 2 un-imported fns = bug) | /explorer/* (⚠ no /v1) |
| tools/Document/Spreadsheet/Presentation | load/save to Explorer, client exports | /explorer/files* |
| tools/Calculator/Export | ⚠ local-only | — |
| WorkflowInbox | approval inbox (RBAC-gated WORKFLOW) | approve/reject |
| compliance/ComplianceCommand | ⚠ entirely static/dead | — |
| logistics/LogisticsControlCenter | load orders+nodes, poll (all action buttons dead) | sales orders + gateway nodes |
| license/ModuleHub | load licenses, toggle module | GET /license/my-modules; POST /license/toggle/:code (⚠ no /v1) |
| Security | logs+health+roles, verify chain, repair, manage roles | GET /v1/audit/logs, /verify-chain; POST /v1/audit/repair, /admin/requests |
| Reports | generate (PDF/XLS), poll status, download, regenerate | POST /v1/reports/generate; GET /v1/reports/:id/status, /download |
| DataArchives | load archives (Create/Download = stub) | GET /reporting/archives (⚠ no /v1) |
| Operations | it overview+sync+iot+health, launch bridge, export log (stub) | GET /v1/admin/sync/status, /iot/devices; POST /admin/requests |
| portal/MyPulse | employee 360, clock-in, loan request | attendance, loan services |
| portal modals | PageCreate/WidgetConfig/PortalSettings → ⚠ orphaned (no host) | /v1/portal/* |

---

**Compiled from a full `src/pages/**` scan via 7 parallel domain mappers.** The
companion doc **06_GAPS_AND_STUBS.md** lists every dead button, stub, orphaned
modal, and endpoint mismatch — the explicit "do not write functional tests
against these" list, plus likely-bug endpoints to verify.
