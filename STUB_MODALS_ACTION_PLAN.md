# Stub Modals — Action Plan

**Total stub modals remaining: 182** (after removing FnB/Farming/Clinic)  
**Date:** 2026-06-27

## What "Stub" Means

Each modal listed below opens a Dialog/Sheet/Popover but:
- Has NO form fields or content inside (empty modal body)
- Has NO submit handler (no API call)
- Has NO cancel/close handler
- Users click a button → see an empty dialog → can only close it

## Priority Tiers

### TIER 1 — Critical for Retail Operations (45 modals)

These block the POS and store management workflows:

| File | Line | Purpose | Type |
|------|------|---------|------|
| `pages/retail/operational/CashierPOS.tsx` | 727 | Payment completion dialog | Dialog |
| `pages/retail/operational/pos/Cashier.tsx` | 392 | POS payment dialog | Dialog |
| `pages/retail/operational/pos/CashPaymentModal.tsx` | 57 | Cash payment processing | Dialog |
| `pages/retail/operational/pos/ElectronicPaymentModal.tsx` | 78 | Card/electronic payment | Dialog |
| `pages/retail/operational/staff/Shifts.tsx` | 521 | Shift management | Dialog |
| `pages/retail/operational/staff/Shifts.tsx` | 576 | Shift detail | Dialog |
| `pages/retail/operational/staff/Shifts.tsx` | 690 | Shift close | Dialog |
| `pages/retail/operational/sales/History.tsx` | 399 | Sales history detail | Dialog |
| `pages/retail/operational/sales/Sales.tsx` | 410 | Sale detail | Dialog |
| `pages/retail/management/store-profile/CreateStoreDialog.tsx` | 174 | Register new store | Dialog |
| `pages/retail/management/modals/RegisterStoreDialog.tsx` | 175 | Register store | Dialog |
| `pages/retail/management/modals/OrderDetailModal.tsx` | 81 | Order detail view | Dialog |
| `pages/retail/management/modals/ItemDetailModal.tsx` | 83 | Item detail view | Dialog |
| `pages/retail/management/modals/TransferTrackingModal.tsx` | 104 | Transfer tracking | Dialog |
| `pages/retail/management/shift-control/components/EditShiftModal.tsx` | 80 | Edit shift | Dialog |
| `pages/retail/management/shift-control/components/ShiftGovernanceModal.tsx` | 38 | Shift governance | Dialog |
| `pages/retail/management/shift-control/components/ScheduleGrid.tsx` | 523 | Schedule popover | Popover |
| `pages/retail/management/staff-assignments/components/RoleModificationModal.tsx` | 57 | Modify staff role | Dialog |
| `pages/retail/management/staff-assignments/components/StaffDetailsModal.tsx` | 27 | Staff detail | Dialog |
| `pages/retail/management/pricing-promo-desk/components/CreatePromoModal.tsx` | 62 | Create promotion | Dialog |
| `pages/retail/management/pricing-promo-desk/components/AuditTrailModal.tsx` | 28 | View audit trail | Dialog |
| `pages/retail/management/InventoryVisibility.tsx` | 1261 | Inventory visibility | Dialog |
| `pages/retail/management/InventoryVisibility.tsx` | 1352 | Inventory visibility | Dialog |
| `pages/retail/management/RetailCustomerActivity.tsx` | 181 | Customer activity | Dialog |
| `pages/retail/management/inventory/Inventory.tsx` | 805 | Inventory action | Dialog |
| `pages/retail/management/inventory/Inventory.tsx` | 954 | Inventory action | Dialog |
| `pages/retail/management/inventory/Inventory.tsx` | 1092 | Inventory action | Dialog |
| `pages/retail/management/inventory/Inventory.tsx` | 1115 | Inventory action | Dialog |
| `pages/retail/management/inventory/Inventory.tsx` | 1196 | Inventory action | Dialog |
| `pages/retail/management/components/inventory/modals/AnomalyCompletionDialog.tsx` | 118 | Resolve anomaly | Dialog |
| `pages/retail/management/components/inventory/modals/InventoryMovementDialog.tsx` | 897 | Record movement | Dialog |
| `pages/retail/management/components/inventory/modals/InventoryStockEditDialog.tsx` | 73 | Edit stock | Dialog |
| `pages/retail/management/components/inventory/modals/ProductDetailEditDialog.tsx` | 105 | Edit product | Dialog |
| `pages/retail/management/components/inventory/reporting/ReportFilterDialog.tsx` | 78 | Filter report | Dialog |
| `pages/retail/management/components/device-control/DeviceModal.tsx` | 33 | Device control | Dialog |
| `pages/retail/management/components/device-control/DiscoveryModal.tsx` | 29 | Device discovery | Dialog |
| `pages/retail/management/components/device-control/RegisterModal.tsx` | 63 | Register device | Dialog |
| `pages/retail/management/components/device-control/SensorModal.tsx` | 33 | Sensor config | Dialog |
| `pages/retail/management/components/channels/ChannelDetailDialog.tsx` | 105 | Channel detail | Dialog |
| `pages/retail/management/components/channels/ChannelProfilePanel.tsx` | 664 | Channel confirm | AlertDialog |
| `pages/retail/management/components/channels/CreateChannelDialog.tsx` | 262 | Create channel | Dialog |
| `pages/retail/management/components/channels/ManageConnectorDialog.tsx` | 156 | Manage connector | Dialog |
| `pages/retail/management/components/channels/RegisterEcommerceBranchDialog.tsx` | 153 | Register e-com | Dialog |
| `pages/retail/management/components/cctv/CCTVConnectorModal.tsx` | 158 | CCTV connector | Dialog |
| `pages/retail/management/components/cctv/CCTVViewerModal.tsx` | 601 | CCTV viewer | Dialog |

### TIER 2 — Finance Module (42 modals)

| File | Count | Key dialogs |
|------|-------|-------------|
| `pages/core/finance/Assets.tsx` | 9 | Asset CRUD, disposal, depreciation, revaluation |
| `pages/core/finance/LedgerCore.tsx` | 5 | Journal entry, posting, reversal |
| `pages/core/finance/TreasuryMap.tsx` | 4 | Source management, transfers |
| `pages/core/finance/MoneyDesk.tsx` | 4 | Money source operations |
| `pages/core/finance/PayFlow.tsx` | 3 | Payment processing |
| `pages/core/finance/components/FinanceDialogs.tsx` | 3 | Shared finance dialogs |
| `pages/core/finance/PolicyManager.tsx` | 2 | Policy CRUD |
| `pages/core/finance/PayableDesk.tsx` | 2 | Payable actions |
| `pages/core/finance/ReceivableDesk.tsx` | 2 | Receivable actions |
| `pages/core/finance/FinanceDocs.tsx` | 2 | Document management |
| `pages/core/finance/InvoiceCapture.tsx` | 2 | Invoice capture |
| Others | 4 | AuditVault, ClosePeriod, DrillDown, InvitePartner |

### TIER 3 — HR Module (27 modals)

| File | Count | Key dialogs |
|------|-------|-------------|
| `pages/core/HR/TalentFlow.tsx` | 4 | Talent management |
| `pages/core/HR/PeopleCore.tsx` | 4 | Employee CRUD |
| `pages/core/HR/OrgMap.tsx` | 3 | Org structure |
| `pages/core/HR/FlowGate.tsx` | 3 | Workflow gates |
| `pages/core/HR/RosterGrid.tsx` | 3 | Roster management |
| Others | 10 | Cases, SkillTrack, VaultSpace, LexBoard, etc. |

### TIER 4 — Procurement (11 modals)

| File | Count | Key dialogs |
|------|-------|-------------|
| `pages/core/procurement/SupplierDesk.tsx` | 5 | Supplier CRUD |
| `pages/core/procurement/PurchaseRequestDesk.tsx` | 3 | PR creation |
| `pages/core/procurement/PoReleaseDesk.tsx` | 1 | PO release |
| `pages/core/procurement/ContractDesk.tsx` | 1 | Contract view |
| `pages/core/procurement/SupplierPortalDesk.tsx` | 1 | Portal message |

### TIER 5 — Shared Components (14 modals)

| File | Purpose |
|------|---------|
| `components/shared/ImportDialog.tsx` | Bulk import |
| `components/shared/ExportSettingsDialog.tsx` | Export config |
| `components/shared/CategoryManager.tsx` | Category CRUD |
| `components/shared/ModuleModal.tsx` | Module info |
| `components/shared/NotificationCenter.tsx` | Notifications |
| `components/shared/PostekPrintModal.tsx` | Label printing |
| `components/shared/StockOpnameSummaryModal.tsx` | Stock summary |
| `components/shared/UnknownBarcodeDialog.tsx` | Unknown barcode |
| `components/shared/UnresolvedBarcodesModal.tsx` (x2) | Unresolved barcodes |
| `components/shared/WatermarkConfigDialog.tsx` | Watermark config |
| `components/ui/command.tsx` | Command palette |
| `components/ui/sidebar.tsx` | Sidebar dialog |

### TIER 6 — Other Modules (43 modals)

- **Inventory** (14): Item detail, transfers, batch operations, adjustments
- **Sales** (7): Lead, opportunity, quote, order, timeline, incentives
- **Marketing** (4): Campaign, funnel, appointment, omnichannel
- **Comms** (4): Bulletin, mail, chat
- **IT** (3): Account, device, topology
- **Portal** (3): MyPulse self-service
- **Others** (8): Auth, settings, tools, payment, logs, audit, admin

---

## Recommended Approach

Each stub modal needs:
1. Form fields with proper validation (React Hook Form + Zod)
2. Submit handler calling the corresponding backend API
3. Loading/error states
4. Toast notification on success/failure
5. Cache invalidation after mutation

**Estimated effort per modal:** 30-90 minutes depending on complexity
**Total estimated effort:** 120-200 hours (3-5 weeks full-time)

Start with Tier 1 (retail POS operations) — these block the primary use case.
