# Implementation Plan: Offline Sync

## Overview

This plan implements an offline-first synchronization system for the Zenvix multi-location retail platform. The implementation follows a layered approach: first establishing shared types and database schema, then building the core backend services (Sync Engine, Conflict Resolver, Inventory Ledger), followed by the frontend offline infrastructure (Offline Store, Connectivity Monitor, Encryption), and finally wiring everything together with Socket.IO real-time notifications and the Ecommerce Channel Guard.

## Tasks

- [ ] 1. Set up project structure, shared types, and database schema
  - [-] 1.1 Create shared TypeScript interfaces and types for the offline-sync module
    - Create `backend/src/support/sync/types/operation-envelope.ts` with `OperationEnvelope`, `EnvelopeStatus`, `OperationType`, `VectorClock` interfaces
    - Create `backend/src/support/sync/types/sync-response.ts` with `BatchSyncResponse`, `EnvelopeResult`, `SyncError` interfaces
    - Create `backend/src/support/sync/types/conflict.ts` with `RecordState`, `ConflictResult`, `ResolutionStrategy`, `ResolvedValue`, `ConflictAuditEntry` interfaces
    - Create `backend/src/support/sync/types/health.ts` with `SyncHealthMetrics`, `ReconciliationReport` interfaces
    - Create `src/lib/offline-store/types.ts` with client-side `OperationEnvelope`, `OfflineStoreConfig`, `IntegrityReport` interfaces
    - Create `src/lib/connectivity/types.ts` with `ConnectivityConfig`, `ConnectivityStatus`, `SyncResult` interfaces
    - _Requirements: 1.1, 1.2, 1.6, 3.1, 3.2, 4.1_

  - [-] 1.2 Create Prisma schema extensions and database migration for sync tables
    - Add `sync_operation_log` model with idempotency key unique constraint, tenant/location indexes
    - Add `sync_inventory_ledger` model with product/location composite index
    - Add `sync_conflict_log` model with manual review partial index
    - Add `sync_sessions` model with location/timestamp descending index
    - Add `sync_ecommerce_reserve` model with reserve percentage range constraint (5–50%)
    - Add `sync_reconciliation_flags` model with open flags partial index
    - Generate and apply the migration
    - _Requirements: 3.6, 4.7, 5.2, 7.1, 7.3, 9.6_

- [ ] 2. Implement Sync Engine core processing
  - [~] 2.1 Implement structural validation for Operation_Envelopes
    - Create `backend/src/support/sync/sync-validation.service.ts`
    - Validate presence and type correctness of: idempotency key, tenant_id, branch_id, location_id, timestamp, sequence_number, operation payload
    - Return field-specific error reasons for invalid envelopes
    - Validate tenant_id matches authenticated session tenant (integrate with TenantContext middleware)
    - _Requirements: 3.2, 3.9, 10.2, 10.3_

  - [~] 2.2 Write property test for structural validation (Property 5)
    - **Property 5: Structural Validation Completeness**
    - Generate arbitrary OperationEnvelopes with randomly missing/malformed fields using fast-check
    - Assert rejection with correct field-specific error for every invalid envelope
    - Assert valid envelopes pass validation
    - **Validates: Requirements 3.2, 3.9**

  - [~] 2.3 Implement idempotency checking service
    - Create `backend/src/support/sync/idempotency.service.ts`
    - Check idempotency key uniqueness against `sync_operation_log` table per tenant
    - Return 'acknowledged' for duplicate keys without re-processing
    - _Requirements: 3.3, 9.2_

  - [~] 2.4 Write property test for idempotent processing (Property 6)
    - **Property 6: Idempotent Processing**
    - Submit the same valid envelope N times (N ≥ 1), assert exactly one DB mutation
    - Assert all subsequent submissions return 'acknowledged' without side effects
    - **Validates: Requirements 3.3, 9.2**

  - [~] 2.5 Implement batch processing logic in SyncEngineService
    - Create `backend/src/support/sync/sync-engine.service.ts` implementing `ISyncEngine`
    - Accept batches of up to 100 envelopes ordered by sequence number
    - Process each operation in its own database transaction
    - Continue processing remaining operations when one fails
    - Record error reasons for failed operations
    - Return per-envelope status (acknowledged/failed with reason)
    - Create sync session records tracking operations received/applied/failed
    - _Requirements: 3.1, 3.4, 3.5, 3.6_

  - [~] 2.6 Write property test for independent batch processing (Property 7)
    - **Property 7: Independent Batch Processing**
    - Generate batches mixing valid and invalid envelopes
    - Assert valid operations commit independently of failures
    - Assert failed operations have error reasons recorded
    - Assert batch continues to completion regardless of individual failures
    - **Validates: Requirements 3.4, 3.5**

- [~] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Conflict Resolver
  - [~] 4.1 Implement Vector Clock comparison and conflict detection
    - Create `backend/src/support/sync/conflict-resolver.service.ts` implementing `IConflictResolver`
    - Implement component-wise vector clock comparison for partial ordering
    - Classify relationships: no conflict (one dominates or equal), concurrent write (neither dominates)
    - Map conflict type to resolution strategy based on operation type and field
    - _Requirements: 4.1_

  - [~] 4.2 Write property test for vector clock conflict detection (Property 8)
    - **Property 8: Vector Clock Conflict Detection**
    - Generate arbitrary pairs of vector clocks
    - Assert correct classification: no_conflict when one dominates, concurrent_write when neither dominates
    - Verify classification is based solely on component-wise comparison
    - **Validates: Requirements 4.1**

  - [~] 4.3 Implement Last-Writer-Wins resolution strategy
    - Implement LWW for non-deduction inventory operations, non-quantity fields, and pricing fields
    - Use operation timestamp for winner selection
    - Use lexicographic Location_Node identifier as deterministic tiebreaker for equal timestamps
    - Generate conflict audit log entries for every resolved conflict
    - _Requirements: 4.2, 4.4, 4.5, 4.7_

  - [~] 4.4 Write property test for LWW determinism (Property 9)
    - **Property 9: Last-Writer-Wins Determinism**
    - Generate pairs of concurrent operations with random timestamps and location IDs
    - Assert the same winner is selected regardless of processing order
    - Assert lexicographic tiebreaker for identical timestamps
    - **Validates: Requirements 4.2, 4.4, 4.5**

  - [~] 4.5 Implement Additive Merge resolution strategy for stock deductions
    - Implement additive merge summing all deductions against last sync base quantity
    - Ensure result is identical regardless of processing order (commutativity)
    - Generate conflict audit log entries
    - _Requirements: 4.3, 4.7_

  - [~] 4.6 Write property test for additive merge commutativity (Property 10)
    - **Property 10: Additive Merge Commutativity**
    - Generate sets of concurrent stock deductions from multiple locations
    - Assert final quantity = base - sum(all deductions) regardless of processing order
    - Shuffle deductions and verify same result
    - **Validates: Requirements 4.3**

  - [~] 4.7 Write property test for conflict audit completeness (Property 11)
    - **Property 11: Conflict Audit Completeness**
    - For every automatically resolved conflict, assert audit log contains: original values, conflicting values, resolution strategy, final resulting value
    - **Validates: Requirements 4.7**

  - [~] 4.8 Implement unresolvable conflict flagging
    - Detect concurrent deletion + modification scenarios
    - Flag for manual review, store both versions
    - Create notification for store manager within 60 seconds
    - _Requirements: 4.6_

- [ ] 5. Implement Inventory Ledger and Multi-Location Consistency
  - [~] 5.1 Implement per-product per-location inventory ledger
    - Create `backend/src/support/sync/inventory-ledger.service.ts`
    - Record all movements (sales, intake, transfers, adjustments) with source envelope reference
    - Calculate running balance per entry
    - Serialize inventory updates per product with row-level locks
    - Abort on lock timeout (>30s) with concurrency timeout reason
    - _Requirements: 7.1, 7.4, 7.5_

  - [~] 5.2 Write property test for inventory ledger completeness (Property 14)
    - **Property 14: Inventory Ledger Completeness**
    - For any inventory movement processed, assert a corresponding ledger entry exists with product_id, location_id, movement type, quantity change, and envelope reference
    - **Validates: Requirements 7.1**

  - [~] 5.3 Implement aggregate inventory reconciliation
    - Recalculate aggregate inventory position across all locations after sync
    - Detect discrepancies exceeding configured tolerance (default: 0 units)
    - Create reconciliation flag records with product, affected locations, expected/actual totals
    - Notify inventory manager via application notification system
    - _Requirements: 7.2, 7.3_

  - [~] 5.4 Write property test for aggregate inventory consistency (Property 15)
    - **Property 15: Aggregate Inventory Consistency**
    - After sync, assert aggregate = sum of all per-location balances
    - When sum differs from expected by more than tolerance, assert reconciliation flag is created
    - **Validates: Requirements 7.2, 7.3**

  - [~] 5.5 Implement inventory reconciliation report endpoint
    - Create endpoint exposing per-location stock levels, pending unsynced quantities, and last sync timestamps
    - Estimate pending quantities for locations whose last sync exceeds 2× heartbeat interval
    - _Requirements: 7.6_

- [~] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement Ecommerce Channel Guard
  - [~] 7.1 Implement ecommerce safety stock reservation logic
    - Create `backend/src/modules/retail/ecommerce-channel.guard.ts` implementing `IEcommerceChannelGuard`
    - Validate stock availability accounting for configured reserve percentage (default: 20%, range: 5–50%)
    - Reject orders when available quantity minus reserved threshold falls below zero
    - Reject physical deductions during sync that would breach ecommerce reservation
    - Flag rejected physical deductions for manager review
    - _Requirements: 5.2, 5.3_

  - [~] 7.2 Write property test for ecommerce safety stock enforcement (Property 12)
    - **Property 12: Ecommerce Safety Stock Enforcement**
    - Generate arbitrary orders and physical deductions against shared inventory
    - Assert rejection when available minus reserved would fall below zero
    - Assert ecommerce orders validated at submission, physical at sync resolution
    - **Validates: Requirements 5.2, 5.3**

  - [~] 7.3 Implement ecommerce direct-write bypass and real-time stock updates
    - Ensure ecommerce orders process directly against central DB without Sync_Queue
    - Emit Socket.IO stock level updates to ecommerce channel after physical location syncs
    - Implement maintenance mode after 2 consecutive DB timeouts (5s each)
    - Implement automatic recovery and order resumption within 5 seconds of restored connectivity
    - _Requirements: 5.1, 5.4, 5.5, 5.6_

- [ ] 8. Implement Offline Store (Frontend)
  - [~] 8.1 Implement IndexedDB initialization and tenant-scoped database management
    - Create `src/lib/offline-store/offline-store.service.ts` implementing `IOfflineStore`
    - Create tenant-scoped IndexedDB database (`zenvix_offline_{tenantId}`)
    - Define object stores: operations, products, prices, customers, metadata
    - Create indexes: by-status, by-sequence, by-idempotency, by-updated, by-sku, by-accessed
    - Handle tenant switch by closing previous DB and opening new tenant DB
    - _Requirements: 10.1, 10.6_

  - [~] 8.2 Implement Operation_Envelope enqueueing with monotonic sequence numbers
    - Implement `enqueue()` method generating UUID, assigning monotonic sequence number per session
    - Persist envelope with status 'pending' within 100ms
    - Enforce offline_tolerance_threshold (default: 500, range: 100–2000)
    - Allow read-only operations when threshold exceeded
    - Block new writes when IndexedDB quota exceeded
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

  - [~] 8.3 Write property tests for envelope persistence and sequence ordering (Properties 1, 2, 3)
    - **Property 1: Envelope Persistence Invariant** — Assert persisted envelopes have valid UUID key, correct tenant/branch/location, ISO timestamp, full payload, status 'pending'
    - **Property 2: Monotonic Sequence Ordering** — Assert strictly increasing sequence numbers per session, starting at 1, no reuse
    - **Property 3: Threshold Lockout with Read Fallback** — Assert writes rejected at threshold, reads still succeed from cache
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.6, 1.7**

  - [~] 8.4 Implement read cache with delta sync and read-your-writes consistency
    - Implement local cache for full product catalog, active price lists, 500 most recent customers
    - Implement delta sync on startup (only changed records since last sync)
    - Serve locally modified versions until server acknowledges modifications
    - Replace local version with server-confirmed version after acknowledgment
    - Return cache-miss indication for records not in local cache
    - Store cache metadata (last sync timestamp, record versions)
    - Serve stale cache with age notification if initial sync fails
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [~] 8.5 Write property test for read-your-writes consistency (Property 13)
    - **Property 13: Read-Your-Writes Consistency**
    - Modify records locally, assert reads return local version
    - After sync acknowledgment, assert reads return server-confirmed version
    - **Validates: Requirements 6.6**

  - [~] 8.6 Implement integrity verification on startup
    - Validate all Operation_Envelopes have valid status, sequence number, and idempotency key
    - Count and categorize entries as valid, corrupt, or recovered
    - Quarantine corrupt entries without valid idempotency keys
    - Report integrity results to operator
    - _Requirements: 9.1, 9.7_

  - [~] 8.7 Write property test for integrity verification accuracy (Property 16)
    - **Property 16: Integrity Verification Accuracy**
    - Generate stores with mix of valid and corrupt envelopes (missing status, sequence, or key)
    - Assert correct categorization and sum of categories equals total entries
    - **Validates: Requirements 9.7**

- [ ] 9. Implement Encryption Service
  - [~] 9.1 Implement tenant-specific encryption for local data
    - Create `src/lib/offline-store/encryption.service.ts` implementing `IEncryptionService`
    - Derive AES-GCM key from auth token + tenant_id using PBKDF2
    - Implement encrypt/decrypt for Operation_Envelope payloads
    - Handle key rotation on token refresh
    - Restrict access to cached data on session expiry until re-authentication
    - _Requirements: 10.4, 10.5_

  - [~] 9.2 Write property test for encryption round-trip (Property 19)
    - **Property 19: Encryption Round-Trip**
    - Generate arbitrary payloads, encrypt then decrypt with same key, assert identical result
    - Encrypt with tenant A's key, attempt decrypt with tenant B's key, assert failure
    - **Validates: Requirements 10.4**

- [~] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement Connectivity Monitor and Sync Orchestration
  - [~] 11.1 Implement connectivity detection with dual-signal state machine
    - Create `src/lib/connectivity/connectivity-monitor.service.ts` implementing `IConnectivityMonitor`
    - Use Navigator.onLine API + periodic heartbeat to Sync_Engine health endpoint
    - Require 2 consecutive failed heartbeats before declaring offline (heartbeat timeout: 3s)
    - Require both Navigator.onLine=true AND successful heartbeat before declaring online
    - Emit offline/online events, display persistent offline indicator
    - Configurable heartbeat interval (default: 10s, range: 5–60s)
    - _Requirements: 2.1, 2.4, 2.5, 8.1, 8.2_

  - [~] 11.2 Write property test for dual-signal state machine (Property 4)
    - **Property 4: Dual-Signal Connectivity State Machine**
    - Generate arbitrary sequences of heartbeat results and Navigator.onLine states
    - Assert offline only after 2 consecutive failures
    - Assert online only when both signals agree
    - Assert no offline transition on single failure
    - **Validates: Requirements 2.1, 2.5**

  - [~] 11.3 Implement batch sync orchestration with retry logic
    - Initiate sync within 5 seconds of connectivity restoration
    - Upload batches of up to 50 operations at configurable interval (default: 30s, range: 10–120s)
    - Implement exponential backoff retry (5s, 10s, 20s) × 3 on failure
    - Mark batch as failed after 5 consecutive retries, exclude from auto-sync
    - Reset operations to pending on mid-batch interruption
    - Mark acknowledged operations, retain for 7 days before purge
    - _Requirements: 2.2, 2.3, 2.6, 9.3, 9.4, 9.5_

  - [~] 11.4 Implement sync status display and manual retry
    - Display persistent status indicator: online, syncing, pending, offline
    - Show pending operation count, update within 3 seconds of queue changes
    - Display persistent failure notifications with manual retry action
    - Show retry attempt counter on repeated failures
    - Update status within 2 seconds of state transitions
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_

- [ ] 12. Implement Socket.IO real-time notifications and tenant security wiring
  - [~] 12.1 Implement Socket.IO event emission after batch processing
    - Extend existing Socket.IO gateway to emit data change events after sync batch completion
    - Emit within 2 seconds of batch processing completion
    - Log notification failure without reversing committed operations
    - Broadcast stock level updates to ecommerce channel and other Location_Nodes
    - _Requirements: 3.7, 3.8, 5.4_

  - [~] 12.2 Implement tenant security validation and event logging
    - Validate tenant_id match on every incoming Operation_Envelope against authenticated session
    - Reject mismatched operations, log security event with mismatched IDs, user_id, timestamp, key
    - Verify valid tenant association on re-authentication before accepting sync batches
    - Reject batch if tenant association has been revoked
    - _Requirements: 10.2, 10.3, 10.7_

  - [~] 12.3 Write property test for tenant data isolation (Property 18)
    - **Property 18: Tenant Data Isolation**
    - Assert operations for tenant A never accessible when querying tenant B's store
    - Assert Sync_Engine rejects envelopes with mismatched tenant_id
    - Assert security event logged with correct identifiers
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [ ] 13. Implement round-trip data fidelity and Sync Engine health endpoint
  - [~] 13.1 Implement sync health metrics endpoint
    - Create endpoint at `GET /sync/health/:locationId`
    - Return last sync timestamp, pending/failed operation counts, average sync latency (60-min rolling window)
    - Expose dashboard data for sync health per Location_Node
    - _Requirements: 8.5_

  - [~] 13.2 Write property test for round-trip data fidelity (Property 17)
    - **Property 17: Round-Trip Data Fidelity**
    - Generate valid operation payloads, persist to Offline_Store, sync to Sync_Engine, read from DB
    - Assert business-critical fields (amount, quantity, product reference, timestamp, tenant_id, location_id) are identical to direct online submission
    - **Validates: Requirements 9.8**

- [~] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check + vitest
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout (NestJS backend, React frontend)
- All backend services integrate with the existing TenantContext middleware and Prisma ORM
- Socket.IO integration extends the existing gateway infrastructure
- IndexedDB testing uses `fake-indexeddb` package; encryption testing uses `@peculiar/webcrypto`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "8.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "8.2", "9.1"] },
    { "id": 3, "tasks": ["2.4", "2.5", "8.3", "8.4", "9.2"] },
    { "id": 4, "tasks": ["2.6", "4.1", "8.5", "8.6"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.5", "4.8", "8.7"] },
    { "id": 6, "tasks": ["4.4", "4.6", "4.7", "5.1"] },
    { "id": 7, "tasks": ["5.2", "5.3", "7.1"] },
    { "id": 8, "tasks": ["5.4", "5.5", "7.2", "7.3"] },
    { "id": 9, "tasks": ["11.1"] },
    { "id": 10, "tasks": ["11.2", "11.3"] },
    { "id": 11, "tasks": ["11.4", "12.1", "12.2"] },
    { "id": 12, "tasks": ["12.3", "13.1"] },
    { "id": 13, "tasks": ["13.2"] }
  ]
}
```
