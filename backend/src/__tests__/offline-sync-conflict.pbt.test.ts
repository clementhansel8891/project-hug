/**
 * Property-Based Tests for Conflict Resolver — Vector Clock Conflict Detection.
 *
 * Uses fast-check (fc.assert / fc.property) with vitest.
 * Each property runs a minimum of 100 iterations.
 *
 * // Feature: offline-sync, Property 8: Vector Clock Conflict Detection
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 *
 * For any two vector clocks, the ConflictResolverService SHALL correctly determine
 * their causal relationship (equal, a_dominates, b_dominates, concurrent) using
 * component-wise partial ordering, and SHALL detect conflicts when concurrent
 * writes are identified.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { ConflictResolverService } from '../support/sync/conflict-resolver.service';
import { VectorClock, OperationEnvelope, RecordState } from '../support/sync/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_OPERATION_TYPES = [
  'pos_transaction',
  'inventory_adjustment',
  'stock_movement',
  'stock_deduction',
  'price_update',
  'customer_update',
] as const;

// ─── Service Instance ────────────────────────────────────────────────────────

const service = new ConflictResolverService();

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Safe key generator that avoids Object.prototype property names (valueOf, toString, etc.)
 * which would cause spurious failures when accessing clock[key] on plain objects.
 */
const safeKeyArb = fc.stringMatching(/^[a-z][a-z0-9_]{0,9}$/).filter(
  (s) => !['valueOf', 'toString', 'constructor', 'hasOwnProperty', 'isPrototypeOf',
    'propertyIsEnumerable', 'toLocaleString', '__proto__', '__defineGetter__',
    '__defineSetter__', '__lookupGetter__', '__lookupSetter__'].includes(s),
);

/** Generates a valid vector clock: dictionary with 1-5 safe string keys and integer values (0-100) */
const vectorClockArb = fc.dictionary(
  safeKeyArb,
  fc.integer({ min: 0, max: 100 }),
  { minKeys: 1, maxKeys: 5 },
);

/** Generates a valid ISO 8601 timestamp */
const isoTimestampArb = fc.integer({
  min: new Date('2020-01-01T00:00:00.000Z').getTime(),
  max: new Date('2030-12-31T23:59:59.999Z').getTime(),
}).map((ms) => new Date(ms).toISOString());

/** Generates a non-empty string */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);

/** Generates a valid UUID v4 string */
const uuidV4Arb = fc.uuid().filter((u) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(u));

/** Generates a minimal valid OperationEnvelope */
const operationEnvelopeArb = fc.tuple(
  uuidV4Arb,
  nonEmptyStringArb,
  nonEmptyStringArb,
  nonEmptyStringArb,
  nonEmptyStringArb,
  fc.integer({ min: 1, max: 100000 }),
  nonEmptyStringArb,
  isoTimestampArb,
  vectorClockArb,
  fc.constantFrom(...VALID_OPERATION_TYPES),
).map(([id, tenantId, branchId, locationId, sessionId, sequenceNumber, idempotencyKey, timestamp, vectorClock, operationType]) => ({
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
  payload: { someField: 'value' },
  status: 'pending' as const,
  retryCount: 0,
  createdAt: timestamp,
} satisfies OperationEnvelope));

// ─── Property 8: Vector Clock Conflict Detection ─────────────────────────────
// Feature: offline-sync, Property 8: Vector Clock Conflict Detection

describe('Property 8: Vector Clock Conflict Detection', () => {
  // ═══════════════════════════════════════════════════════════════════════
  // compareVectorClocks properties
  // ═══════════════════════════════════════════════════════════════════════

  test('equal clocks return "equal"', () => {
    fc.assert(
      fc.property(vectorClockArb, (clock) => {
        const result = service.compareVectorClocks(clock, clock);
        expect(result).toBe('equal');
      }),
      { numRuns: 100 },
    );
  });

  test('A dominates B correctly when A has at least one component greater and none less', () => {
    fc.assert(
      fc.property(
        vectorClockArb,
        fc.integer({ min: 0, max: 4 }),
        (clockA, keyIndex) => {
          const keys = Object.keys(clockA);
          if (keys.length === 0) return; // skip empty (shouldn't happen with minKeys:1)

          // Create B by decreasing at least one component of A
          const clockB: VectorClock = { ...clockA };
          const targetKey = keys[keyIndex % keys.length];
          // Only decrease if value > 0, otherwise set to 0 and bump A
          if (clockA[targetKey] > 0) {
            clockB[targetKey] = clockA[targetKey] - 1;
          } else {
            // A's value is 0, so bump A to ensure A > B for this key
            clockA[targetKey] = 1;
            clockB[targetKey] = 0;
          }

          const result = service.compareVectorClocks(clockA, clockB);
          expect(result).toBe('a_dominates');
        },
      ),
      { numRuns: 100 },
    );
  });

  test('B dominates A correctly when B has at least one component greater and none less', () => {
    fc.assert(
      fc.property(
        vectorClockArb,
        fc.integer({ min: 0, max: 4 }),
        (clockB, keyIndex) => {
          const keys = Object.keys(clockB);
          if (keys.length === 0) return;

          // Create A by decreasing at least one component of B
          const clockA: VectorClock = { ...clockB };
          const targetKey = keys[keyIndex % keys.length];
          if (clockB[targetKey] > 0) {
            clockA[targetKey] = clockB[targetKey] - 1;
          } else {
            // B's value is 0, so bump B to ensure B > A for this key
            clockB[targetKey] = 1;
            clockA[targetKey] = 0;
          }

          const result = service.compareVectorClocks(clockA, clockB);
          expect(result).toBe('b_dominates');
        },
      ),
      { numRuns: 100 },
    );
  });

  test('concurrent clocks detected when A has at least one component greater and B has at least one component greater', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0),
          fc.integer({ min: 0, max: 100 }),
          { minKeys: 2, maxKeys: 5 },
        ),
        fc.integer({ min: 0, max: 4 }),
        fc.integer({ min: 0, max: 4 }),
        (baseClock, idxA, idxB) => {
          const keys = Object.keys(baseClock);
          if (keys.length < 2) return;

          // Pick two distinct keys
          const keyForA = keys[idxA % keys.length];
          let keyForB = keys[idxB % keys.length];
          if (keyForA === keyForB) {
            keyForB = keys[(idxB + 1) % keys.length];
          }
          if (keyForA === keyForB) return; // still same key, skip

          // Create clockA where keyForA is greater and clockB where keyForB is greater
          const clockA: VectorClock = { ...baseClock };
          const clockB: VectorClock = { ...baseClock };

          clockA[keyForA] = baseClock[keyForA] + 1;
          clockB[keyForA] = baseClock[keyForA]; // B is lower on keyForA

          clockB[keyForB] = baseClock[keyForB] + 1;
          clockA[keyForB] = baseClock[keyForB]; // A is lower on keyForB

          const result = service.compareVectorClocks(clockA, clockB);
          expect(result).toBe('concurrent');
        },
      ),
      { numRuns: 100 },
    );
  });

  test('symmetry: if compareVectorClocks(a, b) = "a_dominates", then compareVectorClocks(b, a) = "b_dominates"', () => {
    fc.assert(
      fc.property(
        vectorClockArb,
        fc.integer({ min: 0, max: 4 }),
        (clockA, keyIndex) => {
          const keys = Object.keys(clockA);
          if (keys.length === 0) return;

          // Create B by decreasing at least one component to guarantee a_dominates
          const clockB: VectorClock = { ...clockA };
          const targetKey = keys[keyIndex % keys.length];
          if (clockA[targetKey] > 0) {
            clockB[targetKey] = clockA[targetKey] - 1;
          } else {
            clockA[targetKey] = 1;
            clockB[targetKey] = 0;
          }

          const forwardResult = service.compareVectorClocks(clockA, clockB);
          expect(forwardResult).toBe('a_dominates');

          const reverseResult = service.compareVectorClocks(clockB, clockA);
          expect(reverseResult).toBe('b_dominates');
        },
      ),
      { numRuns: 100 },
    );
  });

  test('missing keys treated as 0: clocks with disjoint keys and values > 0 are concurrent', () => {
    fc.assert(
      fc.property(
        safeKeyArb,
        safeKeyArb,
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (key1, key2, val1, val2) => {
          // Ensure keys are different to get truly disjoint clocks
          if (key1 === key2) return;

          const clockA: VectorClock = { [key1]: val1 };
          const clockB: VectorClock = { [key2]: val2 };

          // Each clock has a key the other doesn't with value > 0
          // Missing keys are treated as 0, so A > B on key1 and B > A on key2
          const result = service.compareVectorClocks(clockA, clockB);
          expect(result).toBe('concurrent');
        },
      ),
      { numRuns: 100 },
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // detectConflict properties
  // ═══════════════════════════════════════════════════════════════════════

  test('no conflict when incoming envelope dominates current state', () => {
    fc.assert(
      fc.property(
        operationEnvelopeArb,
        fc.integer({ min: 0, max: 4 }),
        (envelope, keyIndex) => {
          const keys = Object.keys(envelope.vectorClock);
          if (keys.length === 0) return;

          // Create a current state whose clock is dominated by the envelope's clock
          const stateVectorClock: VectorClock = { ...envelope.vectorClock };
          const targetKey = keys[keyIndex % keys.length];
          if (envelope.vectorClock[targetKey] > 0) {
            stateVectorClock[targetKey] = envelope.vectorClock[targetKey] - 1;
          } else {
            // Bump envelope clock to ensure it dominates
            envelope.vectorClock[targetKey] = 1;
            stateVectorClock[targetKey] = 0;
          }

          const currentState: RecordState = {
            recordId: 'record-1',
            vectorClock: stateVectorClock,
            currentValues: { someField: 'existing' },
          };

          const result = service.detectConflict(envelope, currentState);
          expect(result.type).toBe('no_conflict');
        },
      ),
      { numRuns: 100 },
    );
  });

  test('concurrent write detected when neither clock dominates', () => {
    fc.assert(
      fc.property(
        operationEnvelopeArb,
        safeKeyArb,
        fc.integer({ min: 1, max: 100 }),
        (envelope, extraKey, extraVal) => {
          // Ensure the extra key doesn't already exist in the envelope's vector clock
          const envelopeKeys = Object.keys(envelope.vectorClock);
          if (envelopeKeys.includes(extraKey)) return;

          // Create a state clock that has a key the envelope doesn't (state > envelope on extraKey)
          // and is missing at least one of the envelope's keys (envelope > state on that key)
          const stateVectorClock: VectorClock = { ...envelope.vectorClock };

          // Add extra key only to state (state > envelope on this key)
          stateVectorClock[extraKey] = extraVal;

          // Make envelope higher on one of its existing keys (envelope > state on this key)
          const envelopeKey = envelopeKeys[0];
          if (envelopeKey) {
            envelope.vectorClock[envelopeKey] = (envelope.vectorClock[envelopeKey] ?? 0) + 1;
          } else {
            return; // skip if no keys (shouldn't happen with minKeys:1)
          }

          const currentState: RecordState = {
            recordId: 'record-1',
            vectorClock: stateVectorClock,
            currentValues: { someField: 'existing' },
          };

          const result = service.detectConflict(envelope, currentState);
          expect(result.type).toBe('concurrent_write');
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ─── Property 9: Last-Writer-Wins Determinism ────────────────────────────────
// Feature: offline-sync, Task 4.4

describe('Property 9: Last-Writer-Wins Determinism', () => {
  test('LWW produces the same winner regardless of processing order', () => {
    fc.assert(
      fc.property(
        operationEnvelopeArb,
        operationEnvelopeArb,
        (envelopeA, envelopeB) => {
          // Ensure envelopes have different timestamps for a clear winner
          // and different locationIds for identity
          if (envelopeA.timestamp === envelopeB.timestamp && envelopeA.locationId === envelopeB.locationId) return;

          // Force concurrent vector clocks by giving each a unique key the other doesn't have
          const uniqueKeyA = `__loc_a_${envelopeA.locationId.slice(0, 5)}`;
          const uniqueKeyB = `__loc_b_${envelopeB.locationId.slice(0, 5)}`;
          envelopeA.vectorClock = { ...envelopeA.vectorClock, [uniqueKeyA]: 1 };
          envelopeB.vectorClock = { ...envelopeB.vectorClock, [uniqueKeyB]: 1 };
          // Ensure the other envelope doesn't have this key (or has 0)
          delete envelopeB.vectorClock[uniqueKeyA];
          delete envelopeA.vectorClock[uniqueKeyB];

          // Make both non-deduction so LWW is selected
          envelopeA.operationType = 'price_update';
          envelopeB.operationType = 'price_update';

          // Resolve A against state-built-from-B
          const stateFromB: RecordState = {
            recordId: 'record-lww-det',
            vectorClock: { ...envelopeB.vectorClock },
            currentValues: {
              ...envelopeB.payload,
              _timestamp: envelopeB.timestamp,
              _locationId: envelopeB.locationId,
            },
          };

          const resultAvsB = service.resolveLastWriterWins(envelopeA, stateFromB);

          // Resolve B against state-built-from-A
          const stateFromA: RecordState = {
            recordId: 'record-lww-det',
            vectorClock: { ...envelopeA.vectorClock },
            currentValues: {
              ...envelopeA.payload,
              _timestamp: envelopeA.timestamp,
              _locationId: envelopeA.locationId,
            },
          };

          const resultBvsA = service.resolveLastWriterWins(envelopeB, stateFromA);

          // Determinism: same final _timestamp and _locationId regardless of order
          expect(resultAvsB.finalValue._timestamp).toBe(resultBvsA.finalValue._timestamp);
          expect(resultAvsB.finalValue._locationId).toBe(resultBvsA.finalValue._locationId);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('Lexicographic tiebreaker is deterministic for equal timestamps', () => {
    fc.assert(
      fc.property(
        operationEnvelopeArb,
        operationEnvelopeArb,
        isoTimestampArb,
        (envelopeA, envelopeB, sharedTimestamp) => {
          // Force identical timestamps
          envelopeA.timestamp = sharedTimestamp;
          envelopeB.timestamp = sharedTimestamp;

          // Ensure different locationIds for a meaningful tiebreaker
          if (envelopeA.locationId === envelopeB.locationId) return;

          // Make both non-deduction so LWW is selected
          envelopeA.operationType = 'inventory_adjustment';
          envelopeB.operationType = 'inventory_adjustment';

          // Determine expected winner by lexicographic location comparison
          const expectedWinnerLocationId =
            envelopeA.locationId > envelopeB.locationId
              ? envelopeA.locationId
              : envelopeB.locationId;

          // Resolve A against state-built-from-B
          const stateFromB: RecordState = {
            recordId: 'record-lex-tie',
            vectorClock: { ...envelopeB.vectorClock },
            currentValues: {
              ...envelopeB.payload,
              _timestamp: envelopeB.timestamp,
              _locationId: envelopeB.locationId,
            },
          };

          const result = service.resolveLastWriterWins(envelopeA, stateFromB);

          // The lexicographically higher locationId always wins
          expect(result.finalValue._locationId).toBe(expectedWinnerLocationId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 10: Additive Merge Commutativity ───────────────────────────────
// Feature: offline-sync, Task 4.6

describe('Property 10: Additive Merge Commutativity', () => {
  test('Additive merge is commutative — same result regardless of deduction order', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 1000 }),
        fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 2, maxLength: 5 }),
        fc.array(fc.integer({ min: 0, max: 10000 }), { minLength: 5, maxLength: 5 }),
        (baseQuantity, deductions, seeds) => {
          // Build a shuffled version using a seeded Fisher-Yates shuffle
          const shuffled = [...deductions];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = seeds[i % seeds.length] % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }

          // Apply deductions in original order
          let stateOriginal: RecordState = {
            recordId: 'record-additive',
            vectorClock: { loc1: 1 },
            currentValues: { quantity: baseQuantity },
            lastSyncBaseQuantity: baseQuantity,
          };

          for (let i = 0; i < deductions.length; i++) {
            const envelope: OperationEnvelope = {
              id: `env-orig-${i}`,
              idempotencyKey: `idem-orig-${i}`,
              tenantId: 'tenant-1',
              branchId: 'branch-1',
              locationId: `location-${i}`,
              sequenceNumber: i + 1,
              sessionId: 'session-1',
              timestamp: new Date(Date.now() + i * 1000).toISOString(),
              vectorClock: { [`location-${i}`]: 1 },
              operationType: 'stock_deduction',
              payload: { quantity: deductions[i] },
              status: 'pending',
              retryCount: 0,
              createdAt: new Date().toISOString(),
            };

            const resolved = service.resolveAdditiveMerge(envelope, stateOriginal);
            stateOriginal = {
              ...stateOriginal,
              vectorClock: resolved.mergedVectorClock,
              currentValues: resolved.finalValue,
            };
          }

          // Apply deductions in shuffled order
          let stateShuffled: RecordState = {
            recordId: 'record-additive',
            vectorClock: { loc1: 1 },
            currentValues: { quantity: baseQuantity },
            lastSyncBaseQuantity: baseQuantity,
          };

          for (let i = 0; i < shuffled.length; i++) {
            const envelope: OperationEnvelope = {
              id: `env-shuf-${i}`,
              idempotencyKey: `idem-shuf-${i}`,
              tenantId: 'tenant-1',
              branchId: 'branch-1',
              locationId: `location-${i}`,
              sequenceNumber: i + 1,
              sessionId: 'session-2',
              timestamp: new Date(Date.now() + i * 1000).toISOString(),
              vectorClock: { [`location-${i}`]: 1 },
              operationType: 'stock_deduction',
              payload: { quantity: shuffled[i] },
              status: 'pending',
              retryCount: 0,
              createdAt: new Date().toISOString(),
            };

            const resolved = service.resolveAdditiveMerge(envelope, stateShuffled);
            stateShuffled = {
              ...stateShuffled,
              vectorClock: resolved.mergedVectorClock,
              currentValues: resolved.finalValue,
            };
          }

          // Final quantity must be the same regardless of order
          expect(stateOriginal.currentValues.quantity).toBe(stateShuffled.currentValues.quantity);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('Final quantity equals base minus sum of all deductions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 1000 }),
        fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 2, maxLength: 5 }),
        (baseQuantity, deductions) => {
          let currentState: RecordState = {
            recordId: 'record-sum-check',
            vectorClock: { loc1: 1 },
            currentValues: { quantity: baseQuantity },
            lastSyncBaseQuantity: baseQuantity,
          };

          for (let i = 0; i < deductions.length; i++) {
            const envelope: OperationEnvelope = {
              id: `env-sum-${i}`,
              idempotencyKey: `idem-sum-${i}`,
              tenantId: 'tenant-1',
              branchId: 'branch-1',
              locationId: `location-${i}`,
              sequenceNumber: i + 1,
              sessionId: 'session-1',
              timestamp: new Date(Date.now() + i * 1000).toISOString(),
              vectorClock: { [`location-${i}`]: 1 },
              operationType: 'stock_deduction',
              payload: { quantity: deductions[i] },
              status: 'pending',
              retryCount: 0,
              createdAt: new Date().toISOString(),
            };

            const resolved = service.resolveAdditiveMerge(envelope, currentState);
            currentState = {
              ...currentState,
              vectorClock: resolved.mergedVectorClock,
              currentValues: resolved.finalValue,
            };
          }

          const sumOfDeductions = deductions.reduce((acc, d) => acc + Math.abs(d), 0);
          const expectedFinal = baseQuantity - sumOfDeductions;

          expect(currentState.currentValues.quantity).toBe(expectedFinal);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 11: Conflict Audit Completeness ────────────────────────────────
// Feature: offline-sync, Task 4.7

describe('Property 11: Conflict Audit Completeness', () => {
  test('Every resolved conflict produces an audit entry with all required fields', () => {
    fc.assert(
      fc.property(
        operationEnvelopeArb,
        operationEnvelopeArb,
        fc.constantFrom<'last_writer_wins' | 'additive_merge'>('last_writer_wins', 'additive_merge'),
        (envelopeA, envelopeB, strategy) => {
          // Configure envelope operation type based on strategy
          if (strategy === 'additive_merge') {
            envelopeA.operationType = 'stock_deduction';
            envelopeA.payload = { quantity: 5 };
          } else {
            envelopeA.operationType = 'price_update';
          }

          // Build current state from envelopeB
          const currentState: RecordState = {
            recordId: `record-audit-${envelopeB.id}`,
            vectorClock: { ...envelopeB.vectorClock },
            currentValues: {
              ...envelopeB.payload,
              _timestamp: envelopeB.timestamp,
              _locationId: envelopeB.locationId,
              quantity: 100,
            },
            lastSyncBaseQuantity: 100,
          };

          // Force concurrent clocks
          const uniqueKeyA = `__audit_loc_a`;
          const uniqueKeyB = `__audit_loc_b`;
          envelopeA.vectorClock = { ...envelopeA.vectorClock, [uniqueKeyA]: 1 };
          currentState.vectorClock = { ...currentState.vectorClock, [uniqueKeyB]: 1 };
          delete envelopeA.vectorClock[uniqueKeyB];
          delete currentState.vectorClock[uniqueKeyA];

          // Create a conflict result
          const conflict: ConflictResult & { type: 'concurrent_write' } = {
            type: 'concurrent_write',
            strategy,
            field: strategy === 'additive_merge' ? 'quantity' : 'price',
          };

          // Resolve the conflict
          const resolved = service.resolve(conflict, envelopeA, currentState);

          // Assert all required audit fields exist
          const audit = resolved.auditEntry;
          expect(audit).toBeDefined();
          expect(audit.recordId).toBe(currentState.recordId);
          expect(audit.originalValues).toBeDefined();
          expect(typeof audit.originalValues).toBe('object');
          expect(audit.conflictingValues).toBeDefined();
          expect(typeof audit.conflictingValues).toBe('object');
          expect(audit.strategy).toBe(strategy);
          expect(audit.finalValues).toBeDefined();
          expect(typeof audit.finalValues).toBe('object');
          expect(audit.resolvedAt).toBeDefined();
          // Validate ISO 8601 timestamp format
          expect(new Date(audit.resolvedAt).toISOString()).toBe(audit.resolvedAt);
          expect(audit.sourceLocationId).toBe(envelopeA.locationId);
        },
      ),
      { numRuns: 100 },
    );
  });
});
