/**
 * Property-Based Tests for Sync Engine Independent Batch Processing.
 *
 * Uses fast-check (fc.assert / fc.asyncProperty) with vitest.
 * Each property runs a minimum of 100 iterations.
 *
 * // Feature: offline-sync, Property 7: Independent Batch Processing
 *
 * **Validates: Requirements 3.4, 3.5**
 *
 * For any batch of Operation_Envelopes mixing valid and invalid entries:
 * - Valid operations commit independently of failures
 * - Failed operations have error reasons recorded
 * - Batch continues to completion regardless of individual failures
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { SyncValidationService } from '../support/sync/sync-validation.service';
import { IdempotencyService } from '../support/sync/idempotency.service';
import { SyncEngineService } from '../support/sync/sync-engine.service';
import { TenantContext } from '../gateway/tenant-context.interface';
import { OperationEnvelope, BatchSyncResponse, EnvelopeResult } from '../support/sync/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_OPERATION_TYPES = [
  'pos_transaction',
  'inventory_adjustment',
  'stock_movement',
  'stock_deduction',
  'price_update',
  'customer_update',
] as const;

const VALID_STATUSES = ['pending', 'syncing', 'acknowledged', 'failed'] as const;

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a valid UUID v4 string */
const uuidV4Arb = fc
  .uuid()
  .filter((u) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(u),
  );

/** Generates a valid ISO 8601 timestamp */
const isoTimestampArb = fc
  .integer({
    min: new Date('2020-01-01T00:00:00.000Z').getTime(),
    max: new Date('2030-12-31T23:59:59.999Z').getTime(),
  })
  .map((ms) => new Date(ms).toISOString());

/** Generates a non-empty string */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

/** Generates a valid vector clock */
const vectorClockArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  fc.integer({ min: 0, max: 1000 }),
  { minKeys: 1, maxKeys: 5 },
);

/** Generates a valid non-empty payload object */
const payloadArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  { minKeys: 1, maxKeys: 5 },
);

/** Generates a valid OperationEnvelope */
function validEnvelopeArb(tenantId: string, sequenceNumber: number) {
  return fc
    .tuple(
      uuidV4Arb,
      uuidV4Arb,
      nonEmptyStringArb, // branchId
      nonEmptyStringArb, // locationId
      nonEmptyStringArb, // sessionId
      isoTimestampArb,
      vectorClockArb,
      fc.constantFrom(...VALID_OPERATION_TYPES),
      payloadArb,
      fc.constantFrom(...VALID_STATUSES),
    )
    .map(
      ([
        id,
        idempotencyKey,
        branchId,
        locationId,
        sessionId,
        timestamp,
        vectorClock,
        operationType,
        payload,
        status,
      ]) =>
        ({
          id,
          idempotencyKey,
          tenantId,
          branchId,
          locationId,
          sequenceNumber,
          sessionId,
          timestamp,
          vectorClock,
          operationType,
          payload,
          status,
          retryCount: 0,
          createdAt: new Date().toISOString(),
        }) as OperationEnvelope,
    );
}

/** Generates an invalid OperationEnvelope (missing or malformed required fields) */
function invalidEnvelopeArb(tenantId: string, sequenceNumber: number) {
  return fc
    .tuple(
      fc.constantFrom(
        'missing_id',
        'missing_idempotencyKey',
        'bad_sequenceNumber',
        'missing_payload',
        'bad_operationType',
        'empty_branchId',
      ),
      uuidV4Arb,
      nonEmptyStringArb,
      isoTimestampArb,
      vectorClockArb,
      payloadArb,
    )
    .map(([corruptionType, uuid, sessionId, timestamp, vectorClock, payload]) => {
      const base: Record<string, unknown> = {
        id: uuid,
        idempotencyKey: uuid,
        tenantId,
        branchId: 'branch-1',
        locationId: 'location-1',
        sequenceNumber,
        sessionId,
        timestamp,
        vectorClock,
        operationType: 'pos_transaction',
        payload,
        status: 'pending',
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };

      switch (corruptionType) {
        case 'missing_id':
          delete base.id;
          break;
        case 'missing_idempotencyKey':
          delete base.idempotencyKey;
          break;
        case 'bad_sequenceNumber':
          base.sequenceNumber = -1;
          break;
        case 'missing_payload':
          delete base.payload;
          break;
        case 'bad_operationType':
          base.operationType = 'invalid_type';
          break;
        case 'empty_branchId':
          base.branchId = '   ';
          break;
      }

      return base as unknown as OperationEnvelope;
    });
}

// ─── Mock Infrastructure ─────────────────────────────────────────────────────

/**
 * Creates a mock PrismaService that tracks DB mutations accurately.
 * Records which envelopes were applied vs failed.
 */
function createMockPrisma() {
  const appliedKeys = new Map<string, object>();
  const failedKeys = new Map<string, string>();
  let sessionCount = 0;

  return {
    $transaction: async (fn: (tx: any) => Promise<void>) => {
      const tx = {
        sync_operation_log: {
          create: async (args: { data: Record<string, unknown> }) => {
            const key = args.data.idempotency_key as string;
            if (args.data.status === 'applied') {
              appliedKeys.set(key, args.data);
            } else if (args.data.status === 'failed') {
              failedKeys.set(key, args.data.error_reason as string);
            }
            return args.data;
          },
        },
      };
      await fn(tx);
    },
    sync_operation_log: {
      findUnique: async (args: any) => {
        const { tenant_id, idempotency_key } = args.where.uq_idempotency;
        const compositeKey = `${tenant_id}::${idempotency_key}`;
        if (appliedKeys.has(idempotency_key)) {
          return { status: 'applied' };
        }
        return null;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const key = args.data.idempotency_key as string;
        if (args.data.status === 'failed') {
          failedKeys.set(key, args.data.error_reason as string ?? 'unknown');
        }
        return args.data;
      },
    },
    sync_sessions: {
      create: async (args: { data: Record<string, unknown> }) => {
        sessionCount++;
        return { id: `session-${sessionCount}`, ...args.data };
      },
      update: async () => ({}),
    },
    // Expose internal state for assertions
    _getAppliedKeys: () => appliedKeys,
    _getFailedKeys: () => failedKeys,
    _getSessionCount: () => sessionCount,
  };
}

function makeTenantContext(tenantId: string): TenantContext {
  return {
    tenant_id: tenantId,
    company_id: 'company-1',
    branch_id: 'branch-1',
    location_id: 'location-1',
    user_id: 'user-1',
    role: 'admin',
  };
}

// ─── Property 7: Independent Batch Processing ────────────────────────────────

describe('Property 7: Independent Batch Processing', () => {
  /**
   * **Validates: Requirements 3.4, 3.5**
   */

  test('valid operations commit independently of failures in the same batch', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate batch size: 2–10 valid + 1–5 invalid
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 1, max: 5 }),
        async (validCount, invalidCount) => {
          const tenantId = `tenant-batch-${Date.now()}-${Math.random()}`;
          const tenantContext = makeTenantContext(tenantId);
          const mockPrisma = createMockPrisma();

          const validationService = new SyncValidationService();
          const idempotencyService = new IdempotencyService(mockPrisma as any);
          const syncEngine = new SyncEngineService(
            mockPrisma as any,
            validationService,
            idempotencyService,
          );

          // Generate valid envelopes
          const validEnvelopes: OperationEnvelope[] = [];
          for (let i = 0; i < validCount; i++) {
            const envelope = fc.sample(validEnvelopeArb(tenantId, i + 1), 1)[0];
            validEnvelopes.push(envelope);
          }

          // Generate invalid envelopes
          const invalidEnvelopes: OperationEnvelope[] = [];
          for (let i = 0; i < invalidCount; i++) {
            const envelope = fc.sample(
              invalidEnvelopeArb(tenantId, validCount + i + 1),
              1,
            )[0];
            invalidEnvelopes.push(envelope);
          }

          // Interleave valid and invalid envelopes
          const batch = [...validEnvelopes, ...invalidEnvelopes];
          // Shuffle to ensure order independence
          for (let i = batch.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [batch[i], batch[j]] = [batch[j], batch[i]];
          }

          const response: BatchSyncResponse = await syncEngine.processBatch(
            batch,
            tenantContext,
          );

          // All envelopes in the batch should have a result
          expect(response.results.length).toBe(batch.length);

          // Valid envelopes should be acknowledged
          const acknowledgedResults = response.results.filter(
            (r) => r.status === 'acknowledged',
          );
          expect(acknowledgedResults.length).toBe(validCount);

          // Invalid envelopes should be failed
          const failedResults = response.results.filter(
            (r) => r.status === 'failed',
          );
          expect(failedResults.length).toBe(invalidCount);

          // Valid operations were committed to the DB
          const appliedKeys = mockPrisma._getAppliedKeys();
          expect(appliedKeys.size).toBe(validCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('failed operations have error reasons recorded', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 8 }),
        async (invalidCount) => {
          const tenantId = `tenant-fail-${Date.now()}-${Math.random()}`;
          const tenantContext = makeTenantContext(tenantId);
          const mockPrisma = createMockPrisma();

          const validationService = new SyncValidationService();
          const idempotencyService = new IdempotencyService(mockPrisma as any);
          const syncEngine = new SyncEngineService(
            mockPrisma as any,
            validationService,
            idempotencyService,
          );

          // Generate only invalid envelopes
          const invalidEnvelopes: OperationEnvelope[] = [];
          for (let i = 0; i < invalidCount; i++) {
            const envelope = fc.sample(invalidEnvelopeArb(tenantId, i + 1), 1)[0];
            invalidEnvelopes.push(envelope);
          }

          const response = await syncEngine.processBatch(
            invalidEnvelopes,
            tenantContext,
          );

          // All should be failed
          expect(response.results.length).toBe(invalidCount);
          for (const result of response.results) {
            expect(result.status).toBe('failed');
            // Each failed result must have a non-empty reason
            expect(result.reason).toBeDefined();
            expect(typeof result.reason).toBe('string');
            expect(result.reason!.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('batch continues to completion regardless of individual failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate pattern: [valid, invalid, valid, invalid, ...] to ensure failures mid-batch
        fc.integer({ min: 3, max: 15 }),
        async (totalSize) => {
          const tenantId = `tenant-continue-${Date.now()}-${Math.random()}`;
          const tenantContext = makeTenantContext(tenantId);
          const mockPrisma = createMockPrisma();

          const validationService = new SyncValidationService();
          const idempotencyService = new IdempotencyService(mockPrisma as any);
          const syncEngine = new SyncEngineService(
            mockPrisma as any,
            validationService,
            idempotencyService,
          );

          // Create alternating valid/invalid batch
          const batch: OperationEnvelope[] = [];
          let expectedValid = 0;
          let expectedInvalid = 0;

          for (let i = 0; i < totalSize; i++) {
            if (i % 2 === 0) {
              // Valid
              const envelope = fc.sample(validEnvelopeArb(tenantId, i + 1), 1)[0];
              batch.push(envelope);
              expectedValid++;
            } else {
              // Invalid
              const envelope = fc.sample(
                invalidEnvelopeArb(tenantId, i + 1),
                1,
              )[0];
              batch.push(envelope);
              expectedInvalid++;
            }
          }

          const response = await syncEngine.processBatch(batch, tenantContext);

          // CRITICAL: Every envelope in the batch must have a result
          // This proves the batch completed fully without short-circuiting
          expect(response.results.length).toBe(totalSize);

          // Count acknowledged and failed
          const acknowledged = response.results.filter(
            (r) => r.status === 'acknowledged',
          ).length;
          const failed = response.results.filter(
            (r) => r.status === 'failed',
          ).length;

          // Must match expected counts
          expect(acknowledged).toBe(expectedValid);
          expect(failed).toBe(expectedInvalid);

          // Sum must equal total
          expect(acknowledged + failed).toBe(totalSize);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('batch response always has a batchId and processedAt timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (batchSize) => {
          const tenantId = `tenant-meta-${Date.now()}-${Math.random()}`;
          const tenantContext = makeTenantContext(tenantId);
          const mockPrisma = createMockPrisma();

          const validationService = new SyncValidationService();
          const idempotencyService = new IdempotencyService(mockPrisma as any);
          const syncEngine = new SyncEngineService(
            mockPrisma as any,
            validationService,
            idempotencyService,
          );

          const batch: OperationEnvelope[] = [];
          for (let i = 0; i < batchSize; i++) {
            const envelope = fc.sample(validEnvelopeArb(tenantId, i + 1), 1)[0];
            batch.push(envelope);
          }

          const response = await syncEngine.processBatch(batch, tenantContext);

          // Response metadata
          expect(response.batchId).toBeDefined();
          expect(typeof response.batchId).toBe('string');
          expect(response.batchId.length).toBeGreaterThan(0);

          expect(response.processedAt).toBeDefined();
          expect(new Date(response.processedAt).toISOString()).toBe(
            response.processedAt,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  test('batch size enforcement: batches larger than 100 are truncated', async () => {
    const tenantId = `tenant-truncate-${Date.now()}`;
    const tenantContext = makeTenantContext(tenantId);
    const mockPrisma = createMockPrisma();

    const validationService = new SyncValidationService();
    const idempotencyService = new IdempotencyService(mockPrisma as any);
    const syncEngine = new SyncEngineService(
      mockPrisma as any,
      validationService,
      idempotencyService,
    );

    // Generate 110 valid envelopes
    const batch: OperationEnvelope[] = [];
    for (let i = 0; i < 110; i++) {
      const envelope = fc.sample(validEnvelopeArb(tenantId, i + 1), 1)[0];
      batch.push(envelope);
    }

    const response = await syncEngine.processBatch(batch, tenantContext);

    // Only 100 should be processed (max batch size)
    expect(response.results.length).toBe(100);
  });
});
