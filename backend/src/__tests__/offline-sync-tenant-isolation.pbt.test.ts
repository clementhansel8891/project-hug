/**
 * Property-Based Tests for Tenant Data Isolation.
 *
 * Uses fast-check (fc.assert / fc.property) with vitest.
 * Each property runs a minimum of 100 iterations.
 *
 * // Feature: offline-sync, Property 18: Tenant Data Isolation
 *
 * **Validates: Requirements 10.2, 10.3**
 *
 * For any Operation_Envelope, the Sync_Engine SHALL reject envelopes whose
 * tenant_id does not match the authenticated session's tenant_id, emit a
 * security event, and accept envelopes with matching tenant_id.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { EventEmitter } from 'events';
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

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a valid UUID v4 string */
const uuidV4Arb = fc.uuid().filter((u) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(u),
);

/** Generates a non-empty string */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/** Generates a valid ISO 8601 timestamp */
const isoTimestampArb = fc.integer({
  min: Date.parse('2020-01-01'),
  max: Date.parse('2030-12-31'),
}).map((ms) => new Date(ms).toISOString());

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a valid Operation_Envelope with the specified tenantId.
 * All other fields are structurally valid so that tenant validation is
 * the only possible failure mode.
 */
function buildValidEnvelope(tenantId: string): Record<string, unknown> {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    idempotencyKey: 'idem-key-001',
    tenantId,
    branchId: 'branch-001',
    locationId: 'location-001',
    sequenceNumber: 1,
    sessionId: 'session-001',
    timestamp: '2024-06-15T10:30:00.000Z',
    vectorClock: { node1: 1 },
    operationType: 'pos_transaction',
    payload: { amount: 100 },
    status: 'pending',
  };
}

/** Creates a TenantContext for the given tenant_id */
function makeTenantContext(tenantId: string, userId?: string): TenantContext {
  return {
    tenant_id: tenantId,
    company_id: 'company-1',
    branch_id: 'branch-1',
    location_id: 'location-1',
    user_id: userId ?? 'user-1',
    role: 'admin',
  };
}

/** Generates a full valid envelope arbitrary with a specific tenantId */
function validEnvelopeWithTenantArb(tenantId: string) {
  return fc.tuple(
    uuidV4Arb,
    nonEmptyStringArb,
    nonEmptyStringArb, // branchId
    nonEmptyStringArb, // locationId
    fc.integer({ min: 1, max: 100000 }),
    nonEmptyStringArb, // sessionId
    isoTimestampArb,
    vectorClockArb,
    fc.constantFrom(...VALID_OPERATION_TYPES),
    payloadArb,
    fc.constantFrom(...VALID_STATUSES),
  ).map(([id, idempotencyKey, branchId, locationId, sequenceNumber, sessionId, timestamp, vectorClock, operationType, payload, status]) => ({
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
}

/** Generates a pair of distinct non-empty tenant IDs */
const distinctTenantPairArb = fc.tuple(
  nonEmptyStringArb,
  nonEmptyStringArb,
).filter(([a, b]) => a !== b);

// ─── Property 18: Tenant Data Isolation ──────────────────────────────────────

describe('Property 18: Tenant Data Isolation', () => {
  /**
   * **Validates: Requirements 10.2, 10.3**
   */

  const service = new SyncValidationService();

  test('Sync_Engine rejects envelopes with mismatched tenant_id', () => {
    fc.assert(
      fc.property(
        distinctTenantPairArb,
        uuidV4Arb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        fc.integer({ min: 1, max: 100000 }),
        nonEmptyStringArb,
        isoTimestampArb,
        vectorClockArb,
        fc.constantFrom(...VALID_OPERATION_TYPES),
        payloadArb,
        fc.constantFrom(...VALID_STATUSES),
        ([envelopeTenantId, contextTenantId], id, idempotencyKey, branchId, locationId, sequenceNumber, sessionId, timestamp, vectorClock, operationType, payload, status) => {
          // Envelope has tenant-A, context has tenant-B
          const envelope: Record<string, unknown> = {
            id,
            idempotencyKey,
            tenantId: envelopeTenantId,
            branchId,
            locationId,
            sequenceNumber,
            sessionId,
            timestamp,
            vectorClock,
            operationType,
            payload,
            status,
          };

          const tenantContext = makeTenantContext(contextTenantId);
          const result: ValidationResult = service.validate(envelope, tenantContext);

          // Must be rejected
          expect(result.valid).toBe(false);
          if (!result.valid) {
            // Must have a tenantId error
            const tenantErrors = result.errors.filter((e) => e.field === 'tenantId');
            expect(tenantErrors.length).toBeGreaterThan(0);
            // Error reason must indicate security violation or mismatch
            const hasSecurityMessage = tenantErrors.some(
              (e) =>
                e.reason.toLowerCase().includes('security violation') ||
                e.reason.toLowerCase().includes('does not match'),
            );
            expect(hasSecurityMessage).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('Matching tenant_id passes tenant validation', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        uuidV4Arb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        fc.integer({ min: 1, max: 100000 }),
        nonEmptyStringArb,
        isoTimestampArb,
        vectorClockArb,
        fc.constantFrom(...VALID_OPERATION_TYPES),
        payloadArb,
        fc.constantFrom(...VALID_STATUSES),
        (tenantId, id, idempotencyKey, branchId, locationId, sequenceNumber, sessionId, timestamp, vectorClock, operationType, payload, status) => {
          // Envelope and context share the same tenant_id
          const envelope: Record<string, unknown> = {
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
          };

          const tenantContext = makeTenantContext(tenantId);
          const result: ValidationResult = service.validate(envelope, tenantContext);

          // With all valid fields and matching tenant, it must pass
          expect(result.valid).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('Security event emitted on tenant mismatch', () => {
    fc.assert(
      fc.property(
        distinctTenantPairArb,
        nonEmptyStringArb,
        ([envelopeTenantId, contextTenantId], userId) => {
          const emitter = new EventEmitter();
          const serviceWithEmitter = new SyncValidationService(emitter);

          // Collect emitted events
          const emittedEvents: Array<{
            envelopeTenantId: string;
            authenticatedTenantId: string;
            userId: string;
            timestamp: string;
          }> = [];

          emitter.on('security_tenant_mismatch', (event) => {
            emittedEvents.push(event);
          });

          // Build a valid envelope with mismatched tenant
          const envelope = buildValidEnvelope(envelopeTenantId);
          const tenantContext = makeTenantContext(contextTenantId, userId);

          serviceWithEmitter.validate(envelope, tenantContext);

          // Exactly one security event should have been emitted
          expect(emittedEvents).toHaveLength(1);

          const event = emittedEvents[0];
          // Event must contain correct fields
          expect(event.envelopeTenantId).toBe(envelopeTenantId);
          expect(event.authenticatedTenantId).toBe(contextTenantId);
          expect(event.userId).toBe(userId);
          // Timestamp must be a valid ISO string
          expect(typeof event.timestamp).toBe('string');
          expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
        },
      ),
      { numRuns: 100 },
    );
  });
});
