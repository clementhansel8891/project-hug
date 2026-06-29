/**
 * Property-Based Tests for Offline Store — Envelope Persistence & Sequence Ordering
 *
 * Uses fast-check (fc.assert / fc.property) with vitest.
 * Each property runs a minimum of 100 iterations.
 *
 * // Feature: offline-sync, Property 1: Envelope Persistence Invariant
 * // Feature: offline-sync, Property 2: Monotonic Sequence Ordering
 * // Feature: offline-sync, Property 3: Threshold Lockout with Read Fallback
 *
 * **Validates: Requirements 1.1, 1.2, 1.4, 1.6, 1.7**
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { OfflineStoreService } from '@/lib/offline-store/offline-store.service';
import type { OfflineStoreConfig, OperationType } from '@/lib/offline-store/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

let tenantCounter = 0;

function makeConfig(overrides: Partial<OfflineStoreConfig> = {}): OfflineStoreConfig {
  return {
    tenantId: `pbt-tenant-${++tenantCounter}-${Date.now()}`,
    branchId: 'branch-pbt',
    locationId: 'location-pbt',
    offlineToleranceThreshold: 500,
    retentionDays: 7,
    ...overrides,
  };
}

// UUID v4 regex
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ISO 8601 regex (simplified — matches common ISO date-time strings)
const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// ─── Arbitraries ────────────────────────────────────────────────────────────

const operationTypes: OperationType[] = [
  'pos_transaction',
  'inventory_adjustment',
  'stock_movement',
  'stock_deduction',
  'price_update',
  'customer_update',
];

/** Generate a non-empty alphanumeric string for IDs */
const arbId = () =>
  fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0);

/** Generate an arbitrary operation type */
const arbOperationType = () => fc.constantFrom(...operationTypes);

/** Generate an arbitrary payload object */
const arbPayload = () =>
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z_]\w*$/.test(s)),
    fc.oneof(
      fc.string({ maxLength: 100 }),
      fc.integer(),
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.boolean()
    ),
    { minKeys: 1, maxKeys: 10 }
  );

/** Generate an arbitrary vector clock */
const arbVectorClock = () =>
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    fc.integer({ min: 1, max: 1000 }),
    { minKeys: 1, maxKeys: 5 }
  );

/** Generate a valid ISO timestamp string without relying on fc.date() edge cases */
const arbIsoTimestamp = () =>
  fc
    .record({
      year: fc.integer({ min: 2020, max: 2030 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 28 }),
      hour: fc.integer({ min: 0, max: 23 }),
      minute: fc.integer({ min: 0, max: 59 }),
      second: fc.integer({ min: 0, max: 59 }),
    })
    .map(({ year, month, day, hour, minute, second }) => {
      const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      return d.toISOString();
    });

/** Generate a complete valid operation input (without id, sequenceNumber, status, createdAt) */
const arbOperation = (tenantId: string, branchId: string, locationId: string) =>
  fc.record({
    idempotencyKey: fc.uuid(),
    tenantId: fc.constant(tenantId),
    branchId: fc.constant(branchId),
    locationId: fc.constant(locationId),
    sessionId: fc.uuid(),
    timestamp: arbIsoTimestamp(),
    vectorClock: arbVectorClock(),
    operationType: arbOperationType(),
    payload: arbPayload(),
    retryCount: fc.constant(0),
  });

// ─── Property 1: Envelope Persistence Invariant ─────────────────────────────

describe('Property 1: Envelope Persistence Invariant', () => {
  let store: OfflineStoreService;
  let config: OfflineStoreConfig;

  beforeEach(async () => {
    store = new OfflineStoreService();
    config = makeConfig();
    await store.initialize(config);
  });

  afterEach(async () => {
    await store.close();
  });

  test('persisted envelopes have valid UUID key, correct tenant/branch/location, ISO timestamp, full payload, and status pending', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbOperation(config.tenantId, config.branchId, config.locationId),
        async (operation) => {
          const envelope = await store.enqueue(operation);

          // Valid UUID v4 for the id
          expect(envelope.id).toMatch(UUID_V4_REGEX);

          // Correct tenant/branch/location context
          expect(envelope.tenantId).toBe(config.tenantId);
          expect(envelope.branchId).toBe(config.branchId);
          expect(envelope.locationId).toBe(config.locationId);

          // ISO 8601 timestamp in createdAt
          expect(envelope.createdAt).toMatch(ISO_TIMESTAMP_REGEX);
          // Verify it's a parseable date
          expect(new Date(envelope.createdAt).toISOString()).toBe(envelope.createdAt);

          // Full original payload preserved
          expect(envelope.payload).toEqual(operation.payload);

          // Status is 'pending'
          expect(envelope.status).toBe('pending');

          // Idempotency key preserved
          expect(envelope.idempotencyKey).toBe(operation.idempotencyKey);

          // Verify persistence in IndexedDB by reading back
          const db = store.getDb();
          const persisted = await new Promise<any>((resolve) => {
            const tx = db.transaction('operations', 'readonly');
            const objStore = tx.objectStore('operations');
            const request = objStore.get(envelope.id);
            request.onsuccess = () => resolve(request.result);
          });

          expect(persisted).toBeDefined();
          expect(persisted.id).toBe(envelope.id);
          expect(persisted.tenantId).toBe(config.tenantId);
          expect(persisted.branchId).toBe(config.branchId);
          expect(persisted.locationId).toBe(config.locationId);
          expect(persisted.payload).toEqual(operation.payload);
          expect(persisted.status).toBe('pending');
          expect(persisted.createdAt).toMatch(ISO_TIMESTAMP_REGEX);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 2: Monotonic Sequence Ordering ────────────────────────────────

describe('Property 2: Monotonic Sequence Ordering', () => {
  let store: OfflineStoreService;
  let config: OfflineStoreConfig;

  beforeEach(async () => {
    store = new OfflineStoreService();
    config = makeConfig({ offlineToleranceThreshold: 2000 });
    await store.initialize(config);
  });

  afterEach(async () => {
    await store.close();
  });

  test('sequence numbers are strictly increasing per session, starting at 1, no reuse', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a batch size between 2 and 50 operations
        fc.integer({ min: 2, max: 50 }),
        async (batchSize) => {
          // Create a fresh store for each run to isolate session counters
          const localStore = new OfflineStoreService();
          const localConfig = makeConfig({ offlineToleranceThreshold: 2000 });
          await localStore.initialize(localConfig);

          const sequenceNumbers: number[] = [];

          for (let i = 0; i < batchSize; i++) {
            const envelope = await localStore.enqueue({
              idempotencyKey: crypto.randomUUID(),
              tenantId: localConfig.tenantId,
              branchId: localConfig.branchId,
              locationId: localConfig.locationId,
              sessionId: 'session-pbt',
              timestamp: new Date().toISOString(),
              vectorClock: { 'location-pbt': i + 1 },
              operationType: 'pos_transaction',
              payload: { item: i },
              retryCount: 0,
            });
            sequenceNumbers.push(envelope.sequenceNumber);
          }

          // First sequence number is 1
          expect(sequenceNumbers[0]).toBe(1);

          // All sequence numbers are strictly increasing
          for (let i = 1; i < sequenceNumbers.length; i++) {
            expect(sequenceNumbers[i]).toBeGreaterThan(sequenceNumbers[i - 1]);
          }

          // No reuse — all unique
          const uniqueSet = new Set(sequenceNumbers);
          expect(uniqueSet.size).toBe(sequenceNumbers.length);

          // Each increment is exactly +1 (strict monotonic)
          for (let i = 1; i < sequenceNumbers.length; i++) {
            expect(sequenceNumbers[i]).toBe(sequenceNumbers[i - 1] + 1);
          }

          await localStore.close();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 3: Threshold Lockout with Read Fallback ───────────────────────

describe('Property 3: Threshold Lockout with Read Fallback', () => {
  test(
    'writes rejected at threshold, reads still succeed from cache',
    async () => {
      const THRESHOLD = 100;

      await fc.assert(
        fc.asyncProperty(
          // Generate an arbitrary operation type to vary the enqueue payload
          arbOperationType(),
          arbPayload(),
          async (opType, payload) => {
            const store = new OfflineStoreService();
            const config = makeConfig({ offlineToleranceThreshold: THRESHOLD });
            await store.initialize(config);

            // Fill to threshold
            for (let i = 0; i < THRESHOLD; i++) {
              await store.enqueue({
                idempotencyKey: crypto.randomUUID(),
                tenantId: config.tenantId,
                branchId: config.branchId,
                locationId: config.locationId,
                sessionId: 'session-threshold',
                timestamp: new Date().toISOString(),
                vectorClock: { 'location-pbt': i + 1 },
                operationType: 'pos_transaction',
                payload: { txn: i },
                retryCount: 0,
              });
            }

            // Verify pending count equals threshold
            const pendingCount = await store.getPendingCount();
            expect(pendingCount).toBe(THRESHOLD);

            // Write operation MUST be rejected (with varied operation type/payload)
            await expect(
              store.enqueue({
                idempotencyKey: crypto.randomUUID(),
                tenantId: config.tenantId,
                branchId: config.branchId,
                locationId: config.locationId,
                sessionId: 'session-threshold',
                timestamp: new Date().toISOString(),
                vectorClock: { 'location-pbt': THRESHOLD + 1 },
                operationType: opType,
                payload,
                retryCount: 0,
              })
            ).rejects.toThrow(/queue is full/i);

            // Read operations MUST still succeed
            const batch = await store.getBatch(10);
            expect(batch.length).toBeGreaterThan(0);
            expect(batch.length).toBeLessThanOrEqual(10);

            const count = await store.getPendingCount();
            expect(count).toBe(THRESHOLD);

            await store.close();
          }
        ),
        { numRuns: 100 }
      );
    },
    120_000
  );
});
