# Implementation Plan:

## Overview

Convert all 182 stub modal dialogs across 6 priority tiers into fully functional components using the standard wiring pattern: React Hook Form + Zod + useMutation + apiRequest + toast + cache invalidation. The foundation task establishes reusable utilities and a canonical reference, then each tier is implemented independently.

## Tasks

- [x] 1. Create shared utility `src/lib/modal-helpers.ts` with `mapFieldErrors(error, form)` for mapping 422 field errors to React Hook Form and `getMutationToastHandlers(toast, queryClient, keys, onClose, form)` for standardized success/error handling
- [x] 2. Create reference implementation by wiring `src/pages/retail/management/components/device-control/RegisterModal.tsx` as the canonical example with full React Hook Form + Zod + useMutation + toast + cache invalidation
- [x] 3. Create coverage audit script `scripts/audit-modal-wiring.ts` that scans all 182 stub modal files and reports which ones have `useForm`, `useMutation`, and `zodResolver`
- [x] 4. Wire Tier 1 POS payment modals (3): `CashierPOS.tsx` line 727, `pos/Cashier.tsx` line 392, `pos/ElectronicPaymentModal.tsx` line 78 — payment completion with amount, method, and transaction submission
- [x] 5. Wire Tier 1 shift management modals (5): `staff/Shifts.tsx` lines 521/576/690, `EditShiftModal.tsx` line 80, `ShiftGovernanceModal.tsx` line 38 — shift CRUD with employee, time range, role, cash count
- [x] 6. Wire Tier 1 store and staff modals (6): `RegisterStoreDialog.tsx` line 175, `RoleModificationModal.tsx` line 57, `StaffDetailsModal.tsx` line 27, `ScheduleGrid.tsx` line 523, `CreatePromoModal.tsx` line 62, `AuditTrailModal.tsx` line 28
- [x] 7. Wire Tier 1 inventory management modals (12): `InventoryVisibility.tsx` lines 1261/1352, `Inventory.tsx` lines 805/954/1092/1115/1196, `AnomalyCompletionDialog.tsx`, `InventoryMovementDialog.tsx`, `InventoryStockEditDialog.tsx`, `ProductDetailEditDialog.tsx`, `ReportFilterDialog.tsx`
- [x] 8. Wire Tier 1 device and channel modals (11): `DeviceModal.tsx`, `DiscoveryModal.tsx`, `SensorModal.tsx`, `ChannelDetailDialog.tsx`, `ChannelProfilePanel.tsx`, `CreateChannelDialog.tsx`, `ManageConnectorDialog.tsx`, `RegisterEcommerceBranchDialog.tsx`, `CCTVConnectorModal.tsx`, `CCTVViewerModal.tsx`, `RetailCustomerActivity.tsx`
- [x] 9. Wire Tier 1 remaining retail modals (8): `History.tsx` line 399, `Sales.tsx` line 410, `OrderDetailModal.tsx`, `ItemDetailModal.tsx`, `TransferTrackingModal.tsx`
- [x] 10. Wire Tier 2 finance asset management modals (9): `Assets.tsx` — asset create, edit, disposal, depreciation, revaluation, transfer, maintenance, import, and detail view
- [x] 11. Wire Tier 2 finance ledger and treasury modals (9): `LedgerCore.tsx` (5) — journal entry create/post/reverse, account detail, reconciliation; `TreasuryMap.tsx` (4) — source create/edit, transfer, reconciliation
- [x] 12. Wire Tier 2 finance remaining modals (24): `MoneyDesk.tsx` (4), `PayFlow.tsx` (3), `FinanceDialogs.tsx` (3), `PolicyManager.tsx` (2), `PayableDesk.tsx` (2), `ReceivableDesk.tsx` (2), `FinanceDocs.tsx` (2), `InvoiceCapture.tsx` (2), AuditVault/ClosePeriod/DrillDown/InvitePartner (4)
- [x] 13. Wire Tier 3 HR module modals (27): `TalentFlow.tsx` (4), `PeopleCore.tsx` (4), `OrgMap.tsx` (3), `FlowGate.tsx` (3), `RosterGrid.tsx` (3), `Cases.tsx` (2), and remaining singles (8)
- [x] 14. Wire Tier 4 procurement modals (11): `SupplierDesk.tsx` (5), `PurchaseRequestDesk.tsx` (3), `PoReleaseDesk.tsx` (1), `ContractDesk.tsx` (1), `SupplierPortalDesk.tsx` (1)
- [x] 15. Wire Tier 5 shared component modals (14): `ImportDialog.tsx`, `ExportSettingsDialog.tsx`, `CategoryManager.tsx`, `ModuleModal.tsx`, `NotificationCenter.tsx`, `PostekPrintModal.tsx`, `StockOpnameSummaryModal.tsx`, `UnknownBarcodeDialog.tsx`, `UnresolvedBarcodesModal.tsx`, `WatermarkConfigDialog.tsx`, `command.tsx`, `sidebar.tsx`
- [x] 16. Wire Tier 6 inventory module modals (14): item detail, transfer, batch operation, stock adjustment, stock count, reorder point, category assign, image upload, location assign, bundle config, variant create, price update, supplier link, archive
- [x] 17. Wire Tier 6 sales, marketing and comms modals (15): Sales (7) — lead/opportunity/quote/order/timeline/task/incentive; Marketing (4) — campaign/funnel/appointment/omnichannel; Comms (4) — bulletin/mail/chat/channel
- [x] 18. Wire Tier 6 IT, portal and miscellaneous modals (14): IT (3), Portal (3), Auth (1), Settings (2), Tools (1), Payment (1), Logs (1), Audit (1), Admin (1)
- [x] 19. Write property-based tests for Zod schema validation using fast-check — generate valid/invalid inputs for representative schemas from each tier and verify parse behavior
- [x] 20. Write integration tests for 5 representative modals (1 per tier) verifying full flow: form fill, submit, API call with correct endpoint/method, cache invalidation, and modal close
- [x] 21. Run coverage audit script and verify all 182 modals report `useForm`, `useMutation`, and `zodResolver` present; fix any gaps
- [x] 22. Run accessibility audit (axe-core) on 5 representative modals verifying aria-labelledby, focus trapping, and aria-describedby on error fields

## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Foundation",
      "tasks": [1, 2, 3],
      "description": "Shared utilities, reference implementation, and audit script"
    },
    {
      "name": "Tier 1 - Retail Operations",
      "tasks": [4, 5, 6, 7, 8, 9],
      "dependsOn": [1, 2],
      "description": "Critical POS and store management modals (45 total)"
    },
    {
      "name": "Tier 2 - Finance",
      "tasks": [10, 11, 12],
      "dependsOn": [1, 2],
      "description": "Finance module modals (42 total)"
    },
    {
      "name": "Tier 3 - HR",
      "tasks": [13],
      "dependsOn": [1, 2],
      "description": "HR module modals (27 total)"
    },
    {
      "name": "Tier 4 - Procurement",
      "tasks": [14],
      "dependsOn": [1, 2],
      "description": "Procurement module modals (11 total)"
    },
    {
      "name": "Tier 5 - Shared Components",
      "tasks": [15],
      "dependsOn": [1, 2],
      "description": "Shared component modals (14 total)"
    },
    {
      "name": "Tier 6 - Other Modules",
      "tasks": [16, 17, 18],
      "dependsOn": [1, 2],
      "description": "Remaining module modals (43 total)"
    },
    {
      "name": "Testing and Validation",
      "tasks": [19, 20, 21, 22],
      "dependsOn": [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
      "description": "Property tests, integration tests, coverage audit, accessibility audit"
    }
  ]
}
```

Tasks 1-3 are foundational and must be completed first. Tasks 4-18 (all tier work) can be executed in parallel after the foundation is in place, but are recommended in tier order for priority. Tasks 19-22 (testing/validation) depend on at least some tier work being complete.

## Notes

- Each modal is independently implementable — no modal depends on another modal being wired
- The CashPaymentModal already has UI and logic (received amount, keypad) but calls `onConfirm` callback instead of an API — it needs mutation wiring
- The EditShiftModal has form fields but uses local state instead of React Hook Form — it needs refactoring to the standard pattern
- Procurement module already has schemas (`src/modules/procurement/schemas.ts`) and hooks (`src/modules/procurement/hooks.ts`) that can be referenced as working examples
- The CreateStoreDialog is already fully wired (not a stub) and serves as an existing reference implementation in the codebase
- Backend API endpoints are verified to exist for most operations; any missing endpoints should be flagged during implementation
- Estimated effort: 30-90 minutes per modal depending on complexity, 120-200 hours total
