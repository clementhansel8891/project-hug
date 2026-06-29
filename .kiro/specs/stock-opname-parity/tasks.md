# Implementation Plan: Stock Opname Parity

## Overview

This plan implements unregistered-item handling parity for Retail_Opname, matching Core_Opname's
behavior. Work begins with refactoring `UnresolvedBarcodesModal` to support Quick Register
(non-blocking stub creation) and Anomaly categorization, then adds session persistence to survive
page reloads, integrates the same flow into Retail_Opname (operational scanner and management tab),
and finally adds Anomaly management features (browser, completion flow) and role-gated void/approval
workflow for anomaly items and abandoned audit cycles. Property-based tests (fast-check + Vitest,
≥100 iterations) validate correctness properties defined in the design. Each task references its
traceability to requirements.

## Tasks

- [ ] 1. Refactor `UnresolvedBarcodesModal.tsx` for Quick Register and Anomaly handling
  - [ ] 1.1 Add Quick Register button and handler
    - Implement `handleQuickRegisterIncomplete()` that creates incomplete items without user input
    - Items created with `status: "incomplete"` and category mapped to Anomaly
    - On success, remove barcodes from unresolved list; on failure, keep them and show error toast
    - _Requirements: 1.1, 1.2, 1.5, 3.1, 3.4_
    - **Property 3: Quick Register creates items with anomaly flag**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

  - [ ] 1.2 Ensure modal close never leaves page locked
    - Verify `onOpenChange` callback properly closes dialog without leaving `pointer-events: none`
    - Test close via close button, overlay click, Escape key, and Quick Register success
    - _Requirements: 3.1, 3.3, 3.4_
    - **Property 1: Modal close never leaves page locked**
    - **Validates: Requirements 3, 3.1, 3.3, 3.4**

  - [ ] 1.3 Add Anomaly category indicator and visual feedback
    - Display "Anomaly" category label when items are Quick Registered
    - Show toast message explaining items are in Anomaly category for later completion
    - _Requirements: 1.3, 1.4_

- [ ] 2. Implement session persistence layer
  - [ ] 2.1 Define `OpnameSession` type and persistence API
    - Create `OpnameSession` interface with: `cycleId`, `locationId`, `entries`, `unresolvedBarcodes`, `anomalies`, `newItems`, `createdAt`, `lastUpdated`
    - Create `saveOpnameSession()`, `loadOpnameSession()`, `clearOpnameSession()` utility functions
    - Add error handling for localStorage operations (log but don't fail)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 2.2 Write property test for session persistence correctness
    - **Property 2: Session persistence survives reload**
    - **Validates: Requirements 4, 4.1, 4.2, 4.3, 4.4**
    - Generate arbitrary OpnameSession objects; save, reload, restore and assert equivalent data

- [x] 3. Integrate session persistence into Core_Opname
  - [ ] 3.1 Update `InventoryStockOpname.tsx`
    - Call `saveOpnameSession()` on every state change (scan, remove, unresolved modal)
    - Call `loadOpnameSession()` on component mount to restore if session exists
    - Call `clearOpnameSession()` on commit, cancel, or abort
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 3.2 Write integration test for session persistence
    - Start opname, scan some items, add unresolved barcode, close modal
    - Reload page, verify counts and unresolved barcodes restored
    - Commit, reload, verify session cleared
    - _Requirements: 4.1, 4.2, 4.4_
    - **Status: Completed - 11 integration tests passing**
    - **Test file: `src/__tests__/opname-session-integration.test.ts`**

- [ ] 4. Implement backend API changes
  - [ ] 4.1 Create "Anomaly" category endpoint
    - `POST /inventory/categories/anomaly` - idempotent category creation
    - Response returns category ID and `is_anomaly_category: true`
    - Test: Call twice, verify same ID returned
    - _Requirements: 2.1_

  - [ ] 4.2 Batch create incomplete items endpoint
    - `POST /inventory/items/batch-incomplete`
    - Request accepts array of `{ barcode, name }`
    - Response returns created items with `is_anomaly: true`, `status: "incomplete"`, anomaly category
    - Include proper error handling for partial failures
    - _Requirements: 1.1, 1.2_

  - [ ] 4.3 Mark items as anomalies endpoint
    - `POST /inventory/items/mark-anomalies`
    - Accepts `{ item_ids: string[], reason: string }`
    - Returns count of items marked
    - Log audit trail entry for each marking
    - _Requirements: 2.2_

  - [x] 4.4 Filter by anomaly flag
    - Update item listing endpoints to support `is_anomaly: true` filter
    - Update search endpoints to include anomaly items in results
    - _Requirements: 2.5_

- [ ] 5. Integrate Quick Register into Retail_Opname
  - [ ] 5.1 Update `StockOpnameScanner.tsx` (operational scanner)
    - Import and use `UnresolvedBarcodesModal` (currently inline "Invalid SKU" toast)
    - Remove inline "Invalid SKU" toast for unregistered scans
    - Add unregistered barcode to unresolved list instead of rejecting
    - On commit, open unresolved modal if any unresolved barcodes exist
    - Persist session state to localStorage
    - Ensure branch scoping is preserved (filter items to `activeStore?.id`)
    - _Requirements: 6.2, 6.3, 6.4, 7.1, 7.2_

  - [ ] 5.2 Update `InventoryVisibility.tsx` StockOpnameTab
    - Add unresolved barcodes handling for management Opname tab
    - Use same resolution flow as Core_Opname and operational scanner
    - Filter item lookups to `activeStore?.id` for branch-scoped operations
    - Persist session state to localStorage
    - _Requirements: 6.4, 7.1_

  - [ ] 5.3 Write integration tests for Retail opname
    - Test retail opname with Quick Register and branch scoping
    - Test session survives reload during active session
    - Test multiple users on different branches don't interfere
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2_

- [ ] 6. Implement Anomaly management features
  - [ ] 6.1 Create Anomaly browser/filter component
    - List items where `is_anomaly: true`
    - Filter by category = "Anomaly" (for items not yet updated)
    - Show incomplete status indicators
    - Include action to edit and complete item details
    - _Requirements: 2.3, 2.5_

  - [ ] 6.2 Implement completion flow
    - Edit incomplete item form (partial fields only: name, category, price, etc.)
    - On save, update item with required fields
    - Clear `is_anomaly` flag when category changes away from Anomaly
    - Remove from Anomaly category if category is updated
    - _Requirements: 2.3, 2.4_

  - [ ] 6.3 Write component tests for Anomaly management
    - Test filter by `is_anomaly: true` returns correct items
    - Test edit completion clears `is_anomaly` flag
    - Test item can be moved out of Anomaly category
    - _Requirements: 2.3, 2.4_

- [ ] 7. Implement role-gated void/approval workflow
  - [ ] 7.1 Void request endpoint
    - `POST /inventory/items/void-request` - submit void with reason
    - Accepts `{ item_id, reason, requested_by }`
    - Returns `{ approval_request_id, status: "pending" | "approved" }`
    - _Requirements: 8.1, 8.3_

  - [ ] 7.2 Approval workflow
    - For non-Owner/non-Superadmin users: create approval request
    - For Owner/Superadmin: apply void immediately (no separate approval step)
    - Add approval/rejection endpoints with audit trail
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 7.3 Abandoned audit cycle resolution
    - When session exists but audit cycle was not committed, flag as abandoned
    - Require Elevated_Role (Manager/HOD+) to void
    - Apply same approval workflow as item voids
    - _Requirements: 4.5, 8.7_

  - [ ] 7.4 Write integration tests for approval workflow
    - Test Owner/Superadmin voids apply immediately
    - Test non-Elevated_Role creates pending approval request
    - Test Elevated_Role approval/rejection updates state
    - Test audit trail records all actions
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 8. Property-based tests
  - [ ] 8.1 Write property test for modal close correctness
    - **Property 1: Modal close never leaves page locked**
    - **Validates: Requirements 3, 3.1, 3.3, 3.4**
    - Generate modal open/close sequences; assert `document.body` always has `pointer-events: auto`

  - [ ] 8.2 Write property test for session persistence
    - **Property 2: Session persistence survives reload**
    - **Validates: Requirements 4, 4.1, 4.2, 4.3, 4.4**
    - Generate arbitrary OpnameSession objects; save, reload, restore and assert equivalent data

  - [ ] 8.3 Write property test for Quick Register anomaly flagging
    - **Property 3: Quick Register creates items with anomaly flag**
    - **Validates: Requirements 1, 1.1, 1.2, 1.3, 1.4, 1.5**
    - Generate arbitrary barcode lists; assert created items have `is_anomaly: true`, anomaly category, status "incomplete"

- [ ] 9. Component tests
  - [ ] 9.1 Write component tests for UnresolvedBarcodesModal
    - Test Quick Register creates items correctly
    - Test modal close restores page interactivity
    - Test toggle select all works
    - _Requirements: 1.1, 1.2, 3.1, 3.4_

  - [ ] 9.2 Write component tests for StockOpnameScanner integration
    - Test unregistered scan adds to unresolved list
    - Test branch scoping filters items correctly
    - Test session persistence across reload
    - _Requirements: 6.2, 6.3, 7.1, 7.2_

  - [ ] 9.3 Write component tests for Anomaly browser
    - Test filter by `is_anomaly: true`
    - Test edit completion clears flag
    - Test category change moves item out of Anomaly
    - _Requirements: 2.3, 2.4_

  - [ ] 9.4 Write component tests for approval workflow
    - Test Owner voids apply immediately
    - Test non-Elevated_Role creates pending approval
    - Test approval/rejection audit trail
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 10. E2E tests
  - [ ] 10.1 Complete opname workflow with unresolved barcodes
    - Start opname, scan items (including unknown barcodes), resolve via Quick Register, commit
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 10.2 Retail opname branch scoping
    - Multiple branches scan same unknown barcode; verify items scoped to correct branch
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 10.3 Session survives reload
    - Start opname, scan items, add unresolved barcode, close modal, reload, verify counts restored
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 10.4 Concurrent sessions (no interference)
    - Two users on different branches opname simultaneously; verify no data leakage
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1_

  - [ ] 10.5 Role-gated void/approval workflow
    - Non-Elevated_Role requests void, Elevated_Role approves; verify audit trail and state update
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 11. Rollout
  - [ ] 11.1 Deploy backend changes first
    - Anomaly category endpoint
    - Batch create incomplete items endpoint
    - Mark anomalies endpoint
    - Void request and approval endpoints
    - _Requirements: 11.1, 11.2, 11.3, 11.9_

  - [ ] 11.2 Deploy frontend changes
    - UnresolvedBarcodesModal refactor
    - Session persistence in InventoryStockOpname.tsx
    - StockOpnameScanner integration
    - InventoryVisibility StockOpnameTab integration
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ] 11.3 Monitor and iterate
    - Track usage of Quick Register vs detailed registration
    - Collect feedback on anomaly workflow
    - Refine as needed
    - _Requirements: 11.10_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements clauses for traceability.
- Property-based tests use `fast-check` + Vitest (≥100 iterations) and each references its design
  Property number; all validate correctness properties from the design document.
- A phase is incomplete until every check in its Verification_Suite passes (Requirement 11.10).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "2.1", "2.2", "4.1", "4.2", "4.3", "4.4"] },
    { "id": 1, "tasks": ["3.1", "3.2", "5.1", "5.2", "5.3", "6.1", "6.2", "7.1", "7.2", "7.3"] },
    { "id": 2, "tasks": ["6.3", "7.4", "8.1", "8.2", "8.3", "9.1", "9.2", "9.3", "9.4"] },
    { "id": 3, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "11.1", "11.2"] },
    { "id": 4, "tasks": ["11.3"] }
  ]
}
```
