/**
 * Property-Based Tests for Offline Store — Integrity Verification Accuracy
 *
 * Uses fast-check (fc.assert / fc.asyncProperty) with vitest.
 * Each property runs a minimum of 100 iterations.
 *
 * // Feature: offline-sync, Property 16: Integrity Verification Accuracy
 *
 * **Validates: Requirements 9.1, 9.7**
 */

import 'fake-indexeddb/auto';
import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { OfflineStoreService } from '@/lib/offline-store/offline-store.service';
import type { OfflineStoreConfig, OperationType } from '@/lib/offline-store/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

let tenantCounter = 0;

function makeConfig(overrides: Partial<OfflineStoreConfig> = {}): OfflineStoreConfig {
  return {
    tenantId: `integrity-pbt-${++tenantCounter}-${Date.now()}`,
    branchId: 'branch-1',
    locationId: 'location-1',
    offlineToleranceThreshold: 2000,
    retentionDays: 7,
    ...overrides,
  };
}

/**
 * Writes an envelope object directly to IndexedDB, bypassing enqueue validation.
 */
function writeDirectToDb(db: IDBDatabase, envelope: Record<string, unknown>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('operations', 'readwrite');
    const objStore = tx.objectStore('operations');
    objStore.add(envelope);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(`Failed to write envelope: ${tx.error?.message}`));
  });
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

const operationTypes: OperationType[] = [
  'pos_transaction',
  'inventory_adjustment',
  'stock_movement',
  'stock_deduction',
  'price_update',
  'customer_update',
];

const arbOperationType = fc.constantFrom(...operationTypes);

/** Generates a valid operation input for enqueue (no id, sequenceNumber, status, createdAt) */
const arbValidOperation = fc.record({
  idempotencyKey: fc.uuid(),
  tenantId: fc.constant('tenant-1'),
  branchId: fc.constant('branch-1'),
  locationId: fc.constant('location-1'),
  sessionId: fc.uuid(),
  timestamp: fc.constant(new Date().toISOString()),
  vectorClock: fc.constant({ 'location-1': 1 }),
  operationType: arbOperationType,
  payload: fc.constant({ amount: 100 }),
  retryCount: fc.constant(0),
});

/**
 * Generates a corrupt envelope template: missing or empty idempotencyKey.
 * The `id` will be overwritten before writing to ensure uniqueness.
 */
const arbCorruptEnvelope = fc.record({
  idempotencyKey: fc.constantFrom('', '   '),
  tenantId: fc.constant('tenant-1'),
  branchId: fc.constant('branch-1'),
  locationId: fc.constant('location-1'),
  sequenceNumber: fc.integer({ min: 1, max: 10000 }),
  sessionId: fc.uuid(),
  timestamp: fc.constant(new Date().toISOString()),
  vectorClock: fc.constant({ 'location-1': 1 }),
  operationType: arbOperationType,
  payload: fc.constant({ amount: 50 }),
  status: fc.constantFrom('pending', 'syncing', 'acknowledged', 'failed'),
  retryCount: fc.constant(0),
  createdAt: fc.constant(new Date().toISOString()),
});

/**
 * Generates a recoverable envelope template: valid idempotencyKey but invalid status.
 * The `id` will be overwritten before writing to ensure uniqueness.
 */
const arbRecoverableEnvelope = fc.record({
  idempotencyKey: fc.uuid(),
  tenantId: fc.constant('tenant-1'),
  branchId: fc.constant('branch-1'),
  locationId: fc.constant('location-1'),
  sequenceNumber: fc.integer({ min: 1, max: 10000 }),
  sessionId: fc.uuid(),
  timestamp: fc.constant(new Date().toISOString()),
  vectorClock: fc.constant({ 'location-1': 1 }),
  operationType: arbOperationType,
  payload: fc.constant({ amount: 75 }),
  status: fc.constantFrom('bogus', 'invalid', 'unknown', 'corrupted'),
  retryCount: fc.constant(0),
  createdAt: fc.constant(new Date().toISOString()),
});

/**
 * Stamps each envelope with a unique id. For envelopes with valid idempotencyKey
 * (recoverable), also stamps a unique idempotencyKey to avoid unique index violations.
 * For corrupt envelopes (empty/whitespace key), removes the idempotencyKey entirely
 * so IndexedDB won't index it (undefined values are excluded from unique indexes).
 */
function stampUniqueIds(envelopes: Record<string, unknown>[]): Record<string, unknown>[] {
  return envelopes.map((env) => {
    const stamped: Record<string, unknown> = {
      ...env,
      id: crypto.randomUUID(),
    };

    const key = env.idempotencyKey;
    if (typeof key === 'string' && key.trim().length > 0) {
      // Valid key (recoverable envelope) — ensure uniqueness for the unique index
      stamped.idempotencyKey = crypto.randomUUID();
    } else {
      // Invalid key (corrupt envelope) — delete it so it's undefined
      // This avoids unique index collisions on empty strings
      delete stamped.idempotencyKey;
    }

    return stamped;
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Property 16: Integrity Verification Accuracy', () => {
  test('Property 16.1: Correct categorization of valid envelopes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        fc.array(arbValidOperation, { minLength: 1, maxLength: 20 }),
        async (n, operations) => {
          const store = new OfflineStoreService();
          const config = makeConfig();
          await store.initialize(config);

          // Enqueue exactly n operations via the valid enqueue path
          // Override idempotencyKey with unique values to avoid unique index collisions during shrinking
          const toEnqueue = operations.slice(0, n);
          for (const op of toEnqueue) {
            await store.enqueue({ ...op, idempotencyKey: crypto.randomUUID() });
          }

          const report = await store.verifyIntegrity();

          expect(report.totalEnvelopes).toBe(toEnqueue.length);
          expect(report.validEnvelopes).toBe(toEnqueue.length);
          expect(report.corruptEnvelopes).toBe(0);
          expect(report.recoveredEnvelopes).toBe(0);

          await store.close();
        },
      ),
      { numRuns: 100 },
    );
  });

  test('Property 16.2: Correct categorization of corrupt envelopes (missing idempotencyKey)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbCorruptEnvelope, { minLength: 1, maxLength: 10 }),
        async (corruptEnvelopeTemplates) => {
          const store = new OfflineStoreService();
          const config = makeConfig();
          await store.initialize(config);

          const db = store.getDb();

          // Stamp unique IDs and write corrupt envelopes directly to bypass enqueue validation
          const envelopes = stampUniqueIds(corruptEnvelopeTemplates as unknown as Record<string, unknown>[]);
          for (const envelope of envelopes) {
            await writeDirectToDb(db, envelope);
          }

          const report = await store.verifyIntegrity();

          expect(report.totalEnvelopes).toBe(envelopes.length);
          expect(report.corruptEnvelopes).toBe(envelopes.length);
          expect(report.validEnvelopes).toBe(0);
          expect(report.recoveredEnvelopes).toBe(0);

          await store.close();
        },
      ),
      { numRuns: 100 },
    );
  });

  test('Property 16.3: Recovery of envelopes with invalid status but valid idempotencyKey', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbRecoverableEnvelope, { minLength: 1, maxLength: 10 }),
        async (recoverableEnvelopeTemplates) => {
          const store = new OfflineStoreService();
          const config = makeConfig();
          await store.initialize(config);

          const db = store.getDb();

          // Stamp unique IDs and write envelopes with invalid status but valid idempotencyKey
          const envelopes = stampUniqueIds(recoverableEnvelopeTemplates as unknown as Record<string, unknown>[]);
          for (const envelope of envelopes) {
            await writeDirectToDb(db, envelope);
          }

          const report = await store.verifyIntegrity();

          expect(report.totalEnvelopes).toBe(envelopes.length);
          expect(report.recoveredEnvelopes).toBe(envelopes.length);
          expect(report.corruptEnvelopes).toBe(0);
          expect(report.validEnvelopes).toBe(0);

          await store.close();
        },
      ),
      { numRuns: 100 },
    );
  });

  test('Property 16.4: Sum of categories equals total', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbValidOperation, { minLength: 0, maxLength: 5 }),
        fc.array(arbCorruptEnvelope, { minLength: 0, maxLength: 5 }),
        fc.array(arbRecoverableEnvelope, { minLength: 0, maxLength: 5 }),
        async (validOps, corruptEnvelopeTemplates, recoverableEnvelopeTemplates) => {
          // Ensure at least one envelope total
          if (validOps.length + corruptEnvelopeTemplates.length + recoverableEnvelopeTemplates.length === 0) {
            return; // Skip empty case
          }

          const store = new OfflineStoreService();
          const config = makeConfig();
          await store.initialize(config);

          const db = store.getDb();

          // Enqueue valid operations through normal path
          // Override idempotencyKey with unique values to avoid unique index collisions during shrinking
          for (const op of validOps) {
            await store.enqueue({ ...op, idempotencyKey: crypto.randomUUID() });
          }

          // Stamp unique IDs and write corrupt and recoverable envelopes directly
          const corruptEnvelopes = stampUniqueIds(corruptEnvelopeTemplates as unknown as Record<string, unknown>[]);
          const recoverableEnvelopes = stampUniqueIds(recoverableEnvelopeTemplates as unknown as Record<string, unknown>[]);

          for (const envelope of corruptEnvelopes) {
            await writeDirectToDb(db, envelope);
          }
          for (const envelope of recoverableEnvelopes) {
            await writeDirectToDb(db, envelope);
          }

          const report = await store.verifyIntegrity();

          // The fundamental invariant: all categories sum to total
          expect(report.totalEnvelopes).toBe(
            report.validEnvelopes + report.corruptEnvelopes + report.recoveredEnvelopes,
          );

          // Total should match what we wrote
          const expectedTotal = validOps.length + corruptEnvelopes.length + recoverableEnvelopes.length;
          expect(report.totalEnvelopes).toBe(expectedTotal);

          await store.close();
        },
      ),
      { numRuns: 100 },
    );
  });
});
