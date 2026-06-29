# Gaps, Stubs & Endpoint Mismatches

> Discovered during the full `src/pages/**` scan. This is the **test-scoping
> filter**: do NOT write functional/business tests against dead or stubbed
> controls (they will never produce a real effect), and treat the endpoint
> mismatches as **likely bugs to verify** against the live backend.

## Legend
- **DEAD** — button/control rendered with no `onClick` / no handler.
- **STUB** — handler exists but only does local state / `toast` / `alert` /
  `setTimeout`; no API call.
- **LOCAL-ONLY** — client-side compute/export, never persisted to server.
- **ORPHANED** — modal/component built & exported but never rendered by any page.
- **MISMATCH** — frontend path differs from the service-layer/backend route
  (may 404 or hit a different handler).
- **BUG** — code-level defect found while mapping.

---

## A. Dead buttons (no handler) — skip in tests

| Page | Control |
|------|---------|
| Dashboard | "CONNECT NOW" |
| Admin | 3 dangerous actions are hard-disabled (Disable tenant / Rotate keys / Purge logs) |
| Settings | "ADD ROLE", "SATELLITE LOGS", "REMOTE ACCESS"; Industry Sector select (no onValueChange) |
| ComplianceCommand | **every** button (Export Report, Lock Session, Filter, Access T+90) |
| LogisticsControlCenter | OPTIMIZE ROUTES, VIEW GLOBAL HEATMAP, MAINTENANCE, SCALE NODE, INITIALIZE WORKFLOW DESIGNER |
| ModuleHub | "DOWNLOAD AUDIT REPORT" |
| MyPulse | Doc Vault download icons; "Access Full Attendance Telemetry" |
| Reports | Manage/Edit/Create schedule (disabled "Not available yet") |
| AuditHub / LogHub | per-row Info icon (disabled) |
| SalesIntelligenceEngine | GENERATE INSIGHTS, RUN MONTE CARLO SIM, EXTRACT PATTERN REPORT, INITIALIZE DRAFT, MANAGE TEMPLATES |
| ManagerDesk | Board Analysis, INITIATE COACHING PROTOCOL |
| ForecastDesk | EXPORT TELEMETRY |
| PipelineBoard | Escalate Deal |
| IncentiveDesk | plan EDIT |
| CreativeLibrary | delete asset |
| ITDashboard | System Console |
| SystemHealth | Global Config, Download Compliance Report |
| TopologyMap | Provision Node, Access Remote Shell, View Audit Log |
| RoleGovernance | Policy History, Create Custom Role, Decommission Role, View Audit Trail, Commit Security State |
| TechShop | Filter |
| ProcurementInsights | View Handoff Ledger |
| InventoryStockHub | row-dropdown ops (Quick Adjustment/Transfer/Logs/Discontinue) |
| InventoryDashboard | View Logistics Map |
| InventoryInsights | Approve / Dismiss |
| IotEventFeed | View Audit Records |
| WarehouseManagement | Create Bin, Print Label, Stock Move |
| InventoryAdjustments | Reject |
| CreateStoreDialog (retail) | "+ PROVISION NEW PHYSICAL LOCATION" option |
| StoreGovernanceModule (retail) | "Initiate Node Freeze Protocol" |

---

## B. Stubs (toast/alert/local-only, no API) — not functionally testable

| Page | Control / behavior |
|------|--------------------|
| TaxCompliance | entire page is `alert()`-driven |
| FinancialOperationsDesk | Batch Invoice, Authorize Revenue Bump, Escalate, routing buttons |
| BudgetPlanning | Create Fiscal Plan / Submit Item / category buttons (local/alert) |
| PayslipStudio | "Preview PDF" |
| WhiteLabelSettings | **entire page** — Save is `setTimeout(1000)`+toast; Upload/Reset/Verify DNS local |
| Settings | integration buttons (PROTOCOL LOGS / ESTABLISH LINK / CONFIGURE) toast-only; taxes inputs not persisted |
| RequestAssign | "Save routing" → `alert(...)`; whole page on static array |
| RequestTrack | static array, no API |
| Admin | "Generate audit report" (client CSV), "Open"/"View full audit trail" toast+nav |
| Operations | "Export daily log" (hardcoded CSV), Review/checklist toast-only |
| DataArchives | "Create Archive" dead, Download = toast-only |
| ModuleHub | ExternalLink details = toast |
| PresentationTool | "Local Export" → `alert()` |
| CalculatorTool / ExportTool | fully client-side, no persistence |
| AutomationLab (marketing) | fully simulated (setTimeout) |
| StrategyControlDesk (marketing) | AUTHORIZE/REJECT mutate local state only |
| Customer360 (marketing) | static mock |
| RoleGovernance (IT) | INITIAL_ROLES const + capability switches local only |
| AccountDesk (IT) | Auto-provision switch local |
| TechShop (IT) | static ESTELAGEA_HARDWARE catalog |
| SystemHealth/TopologyMap (IT) | telemetry/KPIs/utilization simulated |
| ProcurementInsights | Integration Health panel |
| GrowthTrajectory / RiskMatrix | most data hardcoded (only one live chart) |
| HR PulseDesk | New Pulse, View Talent Heatmap |
| HR SchedulingStudio | Apply Global Filter, shift-category buttons |
| HR DepartmentAttendanceStudio | Filter/Calendar/Export icons; "Adjust" = toast |
| BufferCollisionSensor (retail pricing) | display-only |
| Store*Module ×6 (retail) | local config only (persist via Layout "Save Config") |

---

## C. Orphaned modals (built but never rendered) — exclude from UI tests

| Modal | Intended write |
|-------|----------------|
| settings/GeneralSettingsModal | PUT /v1/settings/general |
| settings/NotificationPreferencesModal | PUT /v1/settings/notifications |
| tools/ToolConfigModal | POST/PUT /v1/tools |
| portal/PageCreateModal | POST /v1/portal/pages |
| portal/WidgetConfigModal | POST/PUT /v1/portal/widgets |
| portal/PortalSettingsModal | PUT /v1/portal/settings |
| payment/PaymentMethodConfigModal | POST /v1/payment/providers |
| it/EscalationModal | POST /v1/it/tickets/escalate |
| it/ResolutionModal | POST /v1/it/tickets/resolve |
| it/SLAConfigModal | POST /v1/it/sla-config |

> These endpoints may still be testable at the **API level** even though no UI
> renders the modal.

---

## D. Endpoint mismatches & `/v1` prefix inconsistencies — VERIFIED

> **UPDATE — verified against live backend, see [07_ENDPOINT_VERIFICATION.md](./07_ENDPOINT_VERIFICATION.md).**
> The "missing `/v1`" subsection below is **RETRACTED**: `apiClient.ts` has a
> runtime normalizer that auto-prepends `/v1`, so those service strings are
> cosmetic, not bugs. The **path/verb mismatch** subsection is CONFIRMED — 15
> routes 404 even with `/v1` (real bugs). See doc 07 for the verified list.

### ~~Missing `/v1` prefix~~ (RETRACTED — apiClient normalizes, not a bug)
| Area | Paths called without `/v1` |
|------|----------------------------|
| Payment mutations | all `/payment/*` (transactions create/approve/route/execute/settle/reject, refunds, disputes, providers, devices, dashboard) — lists DO use `/v1/payment/*` |
| Comms | all `/comms/*` (bulletin, chat, mail, categories) |
| Explorer/Tools | all `/explorer/*` |
| License | `/license/my-modules`, `/license/toggle/:code` |
| Audit | `/audit/logs` (but `/v1/audit/export`, `/v1/audit/verify-chain` use /v1) |
| Settings roles | `/settings/roles` |
| Reporting archives | `/reporting/archives` |
| Retail (some) | TransferTrackingModal `/inventory/transfers/...`; CCTVViewer `/retail/cctv/:id/footage`; ecommerceHubService `/retail/ecommerce-hub/*` |

> Note: the `apiClient` may auto-resolve missing `/v1`. Confirm against the live
> server — if it doesn't, every one of these is a broken call.

### Path/verb mismatches (frontend ≠ service/backend)
| Page | Frontend call | Service/backend expects |
|------|---------------|--------------------------|
| LedgerCore | POST /v1/finance/journal-entries | **not wired** — backend uses /finance/ledger/process-event |
| PayableDesk | PATCH /v1/finance/payables/:id/paid | service: POST /finance/payables/:id/mark-paid |
| ClosePeriodStudio | both /v1/finance/periods/:id/close AND /fiscal-periods/:id/lock | pick one |
| HR promote/transfer modals | POST | service: PATCH |
| HR payroll modals | /v1/hr/payroll/runs | service: /v1/hr/payroll-runs |
| HR workflow modals | /v1/hr/workflows | workflowService: /v1/workflow/* |
| HR roster modals | /v1/hr/roster/* | schedulingService: /v1/hr/scheduling/* |
| HR talent modals | /v1/hr/talent/* | **no backing service** |
| PaymentMethodConfigModal | POST /v1/payment/providers | service: /payment/providers/:id/status (no /v1) |
| IT modals | /v1/it/tickets, /incidents, /tickets/escalate, /tickets/resolve, /sla-config | **none exist in itService; write-only, no GET** |
| UploadAssetModal (mktg) | POST /v1/marketing/assets | service uploadAsset: /v1/marketing/assets/upload; also no real file input |
| AnomalyCompletionDialog (retail) | PATCH /v1/inventory/items/:id/complete | expected /v1/retail/inventory |
| ChannelDetailDialog (retail) | dual-write: PATCH /v1/retail/channels/:id AND PUT /retail/ecommerce-hub/channels/:id | one source of truth |
| DeviceModal/SensorModal (retail) | /kernel/iot/* | non-retail kernel namespace |

### HR services that omit `/v1`
leave approve/reject, legal markSigned/requestRenewal, caseService get/update/assign, recruitment requisitions, performance cycles/reviews, training complete/complianceReview.

---

## E. Code-level bugs found

| File | Bug |
|------|-----|
| tools/Explorer.tsx | calls `moveFolder(...)` and `listRecycleBin(...)` that are **not imported** → runtime ReferenceError on folder-drag & recycle view; `moveFolder` also called with inconsistent args |
| comms/BulletinHub.tsx | `fetchCategories` deps array references undefined `newPost.category` |
| PaymentExecutionHub / ProviderRoutingDesk / DeviceRoutingDesk | service calls **not awaited** inside try/catch → API rejections uncaught, success toast fires regardless |
| /core/bulletin | ErrorBoundary crash observed in human-e2e run (separate from above) |
| Security.tsx | `handleDownloadReport` defined but **bound to no button** (dead code) |

### Client-side stub services (return fake data, never hit API)
recruitmentService.advanceCandidate/rejectCandidate/scheduleInterview,
performanceService.runCalibration, trainingService.exportCompliance,
staffService.importStaff, attendanceService.validateAccess.

### Defined-but-unused service methods (no UI surfaces them)
- Inventory: recordIntake, recordDeduction, updateAlertStatus, requestProcurement, createWarehouseBin, assignStockToBin, recordIotScan, batchDeleteItems, anomaly/history endpoints
- Sales: syncLeadFromMarketing, listTasks, createTask, markTaskDone
- Marketing: handoffLeadToSales
- Finance: getTaxReport

---

## How to use this in test planning

1. **Functional/business tests** → only target controls in `05_FULL_COVERAGE_MAP.md`
   that are NOT listed in sections A–C here.
2. **API-contract tests** → hit the section-D paths directly to confirm which
   are real vs 404 (this turns "documented" into "verified" and finds bugs).
3. **Regression guards** → the section-E bugs are concrete tickets; add a test
   that fails until each is fixed.
4. **Don't chase ghosts** — if a Playwright test clicks a section-A/B control and
   "nothing happens", that's expected, not a test failure.
