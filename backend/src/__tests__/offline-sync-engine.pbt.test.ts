/**
 * Property-Based Tests for Sync Engine Structural Validation.
 *
 * Uses fast-check (fc.assert / fc.property) with vitest.
 * Each property runs a minimum of 100 iterations.
 *
 * // Feature: offline-sync, Property 5: Structural Validation Completeness
 *
 * **Validates: Requirements 3.2, 3.9**
 *
 * For any Operation_Envelope, if any required field (idempotency key, tenant_id,
 * branch_id, location_id, timestamp, sequence number, operation payload) is missing
 * or has an incorrect type, the Sync_Engine SHALL reject the envelope with an error
 * reason identifying the specific invalid field, without modifying the database.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { SyncValidationService, ValidationResult } from '../support/sync/sync-validation.service';
import { TenantContext } from '../gateway/tenant-context.interface';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const service = new SyncValidationService();

/** Generates a valid UUID v4 string */
const uuidV4Arb = fc.uuid().filter((u) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(u));

/** Generates a valid ISO 8601 timestamp using integer milliseconds to avoid invalid date issues */
const isoTimestampArb = fc.integer({
  min: new Date('2020-01-01T00:00:00.000Z').getTime(),
  max: new Date('2030-12-31T23:59:59.999Z').getTime(),
}).map((ms) => new Date(ms).toISOString());

/** Generates a non-empty string */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

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

/** Generates a valid OperationEnvelope as a Record<string, unknown> */
const validEnvelopeArb = fc.tuple(
  uuidV4Arb,
  nonEmptyStringArb,
  nonEmptyStringArb, // tenantId
  nonEmptyStringArb, // branchId
  nonEmptyStringArb, // locationId
  fc.integer({ min: 1, max: 100000 }), // sequenceNumber
  nonEmptyStringArb, // sessionId
  isoTimestampArb,
  vectorClockArb,
  fc.constantFrom(...VALID_OPERATION_TYPES),
  payloadArb,
  fc.constantFrom(...VALID_STATUSES),
).map(([id, idempotencyKey, tenantId, branchId, locationId, sequenceNumber, sessionId, timestamp, vectorClock, operationType, payload, status]) => ({
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
}));

/** Creates a TenantContext that matches the given tenantId */
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

// ─── Required fields that the property targets ───────────────────────────────

const REQUIRED_FIELDS = [
  'id',
  'idempotencyKey',
  'tenantId',
  'branchId',
  'locationId',
  'sequenceNumber',
  'sessionId',
  'timestamp',
  'vectorClock',
  'operationType',
  'payload',
  'status',
] as const;

// ─── Corruption strategies ───────────────────────────────────────────────────

type CorruptionType = 'missing' | 'null' | 'wrong_type' | 'empty_string' | 'invalid_value';

/** Generates an arbitrary corruption for a given field */
function corruptField(field: string, corruptionType: CorruptionType): unknown {
  switch (corruptionType) {
    case 'missing':
      return undefined; // Will be deleted from the envelope
    case 'null':
      return null;
    case 'wrong_type':
      // Return a type that is wrong for every field
      switch (field) {
        case 'id':
        case 'idempotencyKey':
        case 'tenantId':
        case 'branchId':
        case 'locationId':
        case 'sessionId':
        case 'timestamp':
        case 'operationType':
        case 'status':
          return 12345; // number instead of string
        case 'sequenceNumber':
          return 'not-a-number'; // string instead of number
        case 'vectorClock':
          return 'not-an-object'; // string instead of object
        case 'payload':
          return 'not-an-object'; // string instead of object
        default:
          return 12345;
      }
    case 'empty_string':
      // Only relevant for string fields
      switch (field) {
        case 'idempotencyKey':
        case 'tenantId':
        case 'branchId':
        case 'locationId':
        case 'sessionId':
          return '   '; // whitespace-only string
        case 'id':
          return 'not-a-uuid'; // invalid UUID format
        case 'timestamp':
          return 'not-a-date'; // invalid ISO 8601
        case 'operationType':
          return 'invalid_operation'; // not in enum
        case 'status':
          return 'invalid_status'; // not in enum
        case 'sequenceNumber':
          return 0; // not a positive integer
        case 'vectorClock':
          return { key: -1 }; // negative value
        case 'payload':
          return {}; // empty object
        default:
          return '';
      }
    case 'invalid_value':
      switch (field) {
        case 'id':
          return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'; // looks like UUID but isn't v4
        case 'sequenceNumber':
          return -5; // negative number
        case 'timestamp':
          return '2024-13-45T99:99:99Z'; // impossible date
        case 'operationType':
          return 'delete_everything'; // not a valid type
        case 'status':
          return 'completed'; // not a valid status
        case 'vectorClock':
          return [1, 2, 3]; // array instead of object
        case 'payload':
          return [1, 2, 3]; // array instead of object
        default:
          return '   '; // whitespace
      }
    default:
      return undefined;
  }
}

// ─── Generators for corrupted envelopes ──────────────────────────────────────

/** Arbitrary that generates a valid envelope then corrupts exactly one required field */
const singleFieldCorruptionArb = fc.tuple(
  validEnvelopeArb,
  fc.constantFrom(...REQUIRED_FIELDS),
  fc.constantFrom<CorruptionType>('missing', 'null', 'wrong_type', 'empty_string', 'invalid_value'),
).map(([envelope, field, corruptionType]) => {
  const corrupted = { ...envelope } as Record<string, unknown>;
  const corruptedValue = corruptField(field, corruptionType);
  if (corruptionType === 'missing') {
    delete corrupted[field];
  } else {
    corrupted[field] = corruptedValue;
  }
  return { envelope: corrupted, corruptedField: field, corruptionType };
});

/** Arbitrary that generates a valid envelope then corrupts multiple fields */
const multiFieldCorruptionArb = fc.tuple(
  validEnvelopeArb,
  fc.subarray([...REQUIRED_FIELDS], { minLength: 2, maxLength: 5 }),
  fc.constantFrom<CorruptionType>('missing', 'null', 'wrong_type'),
).map(([envelope, fields, corruptionType]) => {
  const corrupted = { ...envelope } as Record<string, unknown>;
  for (const field of fields) {
    const corruptedValue = corruptField(field, corruptionType);
    if (corruptionType === 'missing') {
      delete corrupted[field];
    } else {
      corrupted[field] = corruptedValue;
    }
  }
  return { envelope: corrupted, corruptedFields: fields, corruptionType };
});

// ─── Property 5: Structural Validation Completeness ──────────────────────────
// Feature: offline-sync, Property 5: Structural Validation Completeness

describe('Property 5: Structural Validation Completeness', () => {
  /**
   * **Validates: Requirements 3.2, 3.9**
   */

  test('valid envelopes pass structural validation', () => {
    fc.assert(
      fc.property(validEnvelopeArb, (envelope) => {
        const tenantContext = makeTenantContext(envelope.tenantId);
        const result: ValidationResult = service.validate(
          envelope as Record<string, unknown>,
          tenantContext,
        );
        expect(result.valid).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  test('single corrupted field causes rejection with field-specific error', () => {
    fc.assert(
      fc.property(singleFieldCorruptionArb, ({ envelope, corruptedField }) => {
        // Use a tenant context that matches whatever tenantId is in the envelope
        // (if tenantId is corrupted, use a dummy; the validation will catch the structural issue first)
        const tenantId = typeof envelope.tenantId === 'string' && (envelope.tenantId as string).trim().length > 0
          ? envelope.tenantId as string
          : 'test-tenant-id';
        const tenantContext = makeTenantContext(tenantId);

        const result: ValidationResult = service.validate(envelope, tenantContext);

        // Must be invalid
        expect(result.valid).toBe(false);
        if (!result.valid) {
          // Must have at least one error
          expect(result.errors.length).toBeGreaterThan(0);
          // At least one error must reference the corrupted field
          const fieldErrors = result.errors.filter((e) => e.field === corruptedField);
          expect(fieldErrors.length).toBeGreaterThan(0);
          // Each error must have a non-empty reason
          for (const err of fieldErrors) {
            expect(err.reason.length).toBeGreaterThan(0);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  test('multiple corrupted fields causes rejection with errors for each corrupted field', () => {
    fc.assert(
      fc.property(multiFieldCorruptionArb, ({ envelope, corruptedFields }) => {
        const tenantId = typeof envelope.tenantId === 'string' && (envelope.tenantId as string).trim().length > 0
          ? envelope.tenantId as string
          : 'test-tenant-id';
        const tenantContext = makeTenantContext(tenantId);

        const result: ValidationResult = service.validate(envelope, tenantContext);

        // Must be invalid
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors.length).toBeGreaterThan(0);
          // Each corrupted field should have at least one error referencing it
          for (const field of corruptedFields) {
            const fieldErrors = result.errors.filter((e) => e.field === field);
            expect(fieldErrors.length).toBeGreaterThan(0);
            // Each error must have a non-empty reason string
            for (const err of fieldErrors) {
              expect(typeof err.reason).toBe('string');
              expect(err.reason.length).toBeGreaterThan(0);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  test('completely empty envelope is rejected with errors for all required fields', () => {
    fc.assert(
      fc.property(fc.constant({}), (envelope) => {
        const tenantContext = makeTenantContext('test-tenant');
        const result: ValidationResult = service.validate(envelope, tenantContext);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          // Should have errors for every required field
          const errorFields = new Set(result.errors.map((e) => e.field));
          for (const field of REQUIRED_FIELDS) {
            expect(errorFields.has(field)).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  test('envelope with all null fields is rejected with field-specific errors', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const allNullEnvelope: Record<string, unknown> = {};
        for (const field of REQUIRED_FIELDS) {
          allNullEnvelope[field] = null;
        }
        const tenantContext = makeTenantContext('test-tenant');
        const result: ValidationResult = service.validate(allNullEnvelope, tenantContext);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          const errorFields = new Set(result.errors.map((e) => e.field));
          for (const field of REQUIRED_FIELDS) {
            expect(errorFields.has(field)).toBe(true);
          }
          // Every error must have a non-empty reason
          for (const err of result.errors) {
            expect(err.reason.length).toBeGreaterThan(0);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  test('wrong-type values for all fields are rejected with type-specific errors', () => {
    const wrongTypeEnvelopeArb = validEnvelopeArb.map((envelope) => {
      const corrupted: Record<string, unknown> = {};
      // Assign wrong types to all fields
      corrupted.id = 12345;
      corrupted.idempotencyKey = 99;
      corrupted.tenantId = [];
      corrupted.branchId = true;
      corrupted.locationId = { nested: 'obj' };
      corrupted.sequenceNumber = 'not-a-number';
      corrupted.sessionId = 42;
      corrupted.timestamp = 12345;
      corrupted.vectorClock = 'not-an-object';
      corrupted.operationType = 999;
      corrupted.payload = 'not-an-object';
      corrupted.status = [];
      return corrupted;
    });

    fc.assert(
      fc.property(wrongTypeEnvelopeArb, (envelope) => {
        const tenantContext = makeTenantContext('test-tenant');
        const result: ValidationResult = service.validate(envelope, tenantContext);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          // Should identify type errors for multiple fields
          expect(result.errors.length).toBeGreaterThanOrEqual(REQUIRED_FIELDS.length);
          // Each error should have a descriptive reason
          for (const err of result.errors) {
            expect(typeof err.field).toBe('string');
            expect(err.field.length).toBeGreaterThan(0);
            expect(typeof err.reason).toBe('string');
            expect(err.reason.length).toBeGreaterThan(0);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});


// ─── Property 6: Idempotent Processing ───────────────────────────────────────
// Feature: offline-sync, Property 6: Idempotent Processing

/**
 * Property-Based Test for Idempotent Processing.
 *
 * **Validates: Requirements 3.3, 9.2**
 *
 * For any valid Operation_Envelope submitted N times (N ≥ 1) to the Sync_Engine,
 * exactly one database mutation SHALL be applied, and all subsequent submissions
 * with the same idempotency key SHALL return 'acknowledged' status without
 * re-processing.
 */

import { IdempotencyService, IdempotencyCheckResult } from '../support/sync/idempotency.service';
import { SyncEngineService } from '../support/sync/sync-engine.service';
import { OperationEnvelope as SyncOperationEnvelope } from '../support/sync/types';

describe('Property 6: Idempotent Processing', () => {
  /**
   * **Validates: Requirements 3.3, 9.2**
   */

  /** Generates an arbitrary submission count N (1-10) */
  const submissionCountArb = fc.integer({ min: 1, max: 10 });

  /**
   * Creates a mock PrismaService that simulates idempotency behavior:
   * - First call to findUnique returns null (new record)
   * - After the first submission is "applied", subsequent calls return the existing record
   */
  function createMockPrismaService() {
    const appliedKeys = new Map<string, string>(); // compositeKey -> status

    return {
      sync_operation_log: {
        findUnique: async (args: { where: { uq_idempotency: { tenant_id: string; idempotency_key: string } }; select: { status: boolean } }) => {
          const { tenant_id, idempotency_key } = args.where.uq_idempotency;
          const compositeKey = `${tenant_id}::${idempotency_key}`;

          if (appliedKeys.has(compositeKey)) {
            return { status: appliedKeys.get(compositeKey)! };
          }
          return null;
        },
      },
      /** Simulates applying an operation (recording in the DB) */
      _applyOperation(tenantId: string, idempotencyKey: string, status = 'applied') {
        const compositeKey = `${tenantId}::${idempotencyKey}`;
        appliedKeys.set(compositeKey, status);
      },
      /** Returns the number of unique operations applied */
      _getAppliedCount(): number {
        return appliedKeys.size;
      },
    };
  }

  test('submitting the same envelope N times results in exactly one non-duplicate check', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEnvelopeArb,
        submissionCountArb,
        async (envelope, submissionCount) => {
          const mockPrisma = createMockPrismaService();
          const idempotencyService = new IdempotencyService(mockPrisma as any);

          const results: IdempotencyCheckResult[] = [];

          for (let i = 0; i < submissionCount; i++) {
            const result = await idempotencyService.check(
              envelope.tenantId,
              envelope.idempotencyKey,
            );
            results.push(result);

            // Simulate: if not duplicate, we "apply" the operation to the DB
            if (!result.isDuplicate) {
              mockPrisma._applyOperation(envelope.tenantId, envelope.idempotencyKey);
            }
          }

          // Exactly one result should be non-duplicate (the first submission)
          const nonDuplicateResults = results.filter((r) => !r.isDuplicate);
          expect(nonDuplicateResults).toHaveLength(1);

          // All subsequent results (if any) should be duplicates
          const duplicateResults = results.filter((r) => r.isDuplicate);
          expect(duplicateResults).toHaveLength(submissionCount - 1);

          // Each duplicate should have an existingStatus
          for (const dup of duplicateResults) {
            expect(dup.existingStatus).toBeDefined();
            expect(typeof dup.existingStatus).toBe('string');
          }

          // Exactly one DB mutation was applied
          expect(mockPrisma._getAppliedCount()).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('different envelopes are processed independently without idempotency collision', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validEnvelopeArb, { minLength: 2, maxLength: 5 }),
        async (envelopes) => {
          // Ensure all envelopes have unique idempotency keys
          const uniqueEnvelopes = envelopes.reduce<typeof envelopes>((acc, env) => {
            const key = `${env.tenantId}::${env.idempotencyKey}`;
            if (!acc.some((e) => `${e.tenantId}::${e.idempotencyKey}` === key)) {
              acc.push(env);
            }
            return acc;
          }, []);

          // Need at least 2 unique envelopes
          if (uniqueEnvelopes.length < 2) return;

          const mockPrisma = createMockPrismaService();
          const idempotencyService = new IdempotencyService(mockPrisma as any);

          // Submit each unique envelope once
          for (const env of uniqueEnvelopes) {
            const result = await idempotencyService.check(env.tenantId, env.idempotencyKey);
            expect(result.isDuplicate).toBe(false);
            mockPrisma._applyOperation(env.tenantId, env.idempotencyKey);
          }

          // Each one should now be a duplicate
          for (const env of uniqueEnvelopes) {
            const result = await idempotencyService.check(env.tenantId, env.idempotencyKey);
            expect(result.isDuplicate).toBe(true);
            expect(result.existingStatus).toBeDefined();
          }

          // Total DB mutations equals number of unique envelopes
          expect(mockPrisma._getAppliedCount()).toBe(uniqueEnvelopes.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('first submission always returns isDuplicate=false regardless of envelope content', async () => {
    await fc.assert(
      fc.asyncProperty(validEnvelopeArb, async (envelope) => {
        const mockPrisma = createMockPrismaService();
        const idempotencyService = new IdempotencyService(mockPrisma as any);

        const result = await idempotencyService.check(
          envelope.tenantId,
          envelope.idempotencyKey,
        );

        expect(result.isDuplicate).toBe(false);
        expect(result.existingStatus).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  test('all subsequent submissions return acknowledged status without side effects', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEnvelopeArb,
        submissionCountArb.filter((n) => n >= 2),
        async (envelope, submissionCount) => {
          const mockPrisma = createMockPrismaService();
          const idempotencyService = new IdempotencyService(mockPrisma as any);

          // First submission - not duplicate
          const firstResult = await idempotencyService.check(
            envelope.tenantId,
            envelope.idempotencyKey,
          );
          expect(firstResult.isDuplicate).toBe(false);
          mockPrisma._applyOperation(envelope.tenantId, envelope.idempotencyKey, 'acknowledged');

          // Track apply count before subsequent submissions
          const applyCountBefore = mockPrisma._getAppliedCount();

          // Submit N-1 more times
          for (let i = 1; i < submissionCount; i++) {
            const result = await idempotencyService.check(
              envelope.tenantId,
              envelope.idempotencyKey,
            );

            // Must be duplicate
            expect(result.isDuplicate).toBe(true);
            // Must return 'acknowledged' as the existing status
            expect(result.existingStatus).toBe('acknowledged');
          }

          // No additional DB mutations occurred (no side effects)
          expect(mockPrisma._getAppliedCount()).toBe(applyCountBefore);
        },
      ),
      { numRuns: 100 },
    );
  });
});
