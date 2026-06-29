import { describe, test, expect } from 'vitest';
import { ConflictResolverService } from './conflict-resolver.service';
import {
  OperationEnvelope,
  VectorClock,
  RecordState,
} from './types';

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function buildEnvelope(overrides: Partial<OperationEnvelope> = {}): OperationEnvelope {
  return {
    id: 'env-001',
    idempotencyKey: 'idem-001',
    tenantId: 'tenant-1',
    branchId: 'branch-1',
    locationId: 'loc-A',
    sequenceNumber: 1,
    sessionId: 'session-001',
    timestamp: '2024-06-15T10:00:00.000Z',
    vectorClock: { 'loc-A': 1 },
    operationType: 'inventory_adjustment',
    payload: { quantity: 50 },
    status: 'pending',
    retryCount: 0,
    createdAt: '2024-06-15T10:00:00.000Z',
    ...overrides,
  };
}

function buildRecordState(overrides: Partial<RecordState> = {}): RecordState {
  return {
    recordId: 'record-001',
    vectorClock: { 'loc-A': 1 },
    currentValues: { quantity: 100 },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════

describe('ConflictResolverService', () => {
  const service = new ConflictResolverService();

  // ─────────────────────────────────────────────────────────────────────
  // 1. No conflict when incoming vector clock dominates current state
  // ─────────────────────────────────────────────────────────────────────
  describe('no conflict when incoming dominates', () => {
    test('returns no_conflict when envelope clock is strictly ahead', () => {
      const envelope = buildEnvelope({ vectorClock: { 'loc-A': 3 } });
      const state = buildRecordState({ vectorClock: { 'loc-A': 2 } });

      const result = service.detectConflict(envelope, state);
      expect(result).toEqual({ type: 'no_conflict' });
    });

    test('returns no_conflict when current dominates (b_dominates)', () => {
      const envelope = buildEnvelope({ vectorClock: { 'loc-A': 1 } });
      const state = buildRecordState({ vectorClock: { 'loc-A': 3 } });

      const result = service.detectConflict(envelope, state);
      expect(result).toEqual({ type: 'no_conflict' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 2. No conflict when clocks are equal
  // ─────────────────────────────────────────────────────────────────────
  describe('no conflict when clocks are equal', () => {
    test('returns no_conflict for identical vector clocks', () => {
      const clock: VectorClock = { 'loc-A': 2, 'loc-B': 3 };
      const envelope = buildEnvelope({ vectorClock: clock });
      const state = buildRecordState({ vectorClock: { ...clock } });

      const result = service.detectConflict(envelope, state);
      expect(result).toEqual({ type: 'no_conflict' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 3. Concurrent write detected when clocks are concurrent
  // ─────────────────────────────────────────────────────────────────────
  describe('concurrent write detection', () => {
    test('detects concurrent_write when neither clock dominates', () => {
      const envelope = buildEnvelope({
        vectorClock: { 'loc-A': 2, 'loc-B': 1 },
      });
      const state = buildRecordState({
        vectorClock: { 'loc-A': 1, 'loc-B': 2 },
        currentValues: { quantity: 100 },
      });

      const result = service.detectConflict(envelope, state);
      expect(result.type).toBe('concurrent_write');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 4. Correct strategy assignment
  // ─────────────────────────────────────────────────────────────────────
  describe('strategy assignment', () => {
    test('stock_deduction gets additive_merge strategy', () => {
      const envelope = buildEnvelope({
        operationType: 'stock_deduction',
        vectorClock: { 'loc-A': 2, 'loc-B': 1 },
      });
      const state = buildRecordState({
        vectorClock: { 'loc-A': 1, 'loc-B': 2 },
        currentValues: { quantity: 100 },
      });

      const result = service.detectConflict(envelope, state);
      expect(result).toMatchObject({
        type: 'concurrent_write',
        strategy: 'additive_merge',
      });
    });

    test('inventory_adjustment gets last_writer_wins strategy', () => {
      const envelope = buildEnvelope({
        operationType: 'inventory_adjustment',
        vectorClock: { 'loc-A': 2, 'loc-B': 1 },
      });
      const state = buildRecordState({
        vectorClock: { 'loc-A': 1, 'loc-B': 2 },
        currentValues: { quantity: 100 },
      });

      const result = service.detectConflict(envelope, state);
      expect(result).toMatchObject({
        type: 'concurrent_write',
        strategy: 'last_writer_wins',
      });
    });

    test('price_update gets last_writer_wins strategy', () => {
      const envelope = buildEnvelope({
        operationType: 'price_update',
        vectorClock: { 'loc-A': 2, 'loc-B': 1 },
      });
      const state = buildRecordState({
        vectorClock: { 'loc-A': 1, 'loc-B': 2 },
        currentValues: { price: 9.99 },
      });

      const result = service.detectConflict(envelope, state);
      expect(result).toMatchObject({
        type: 'concurrent_write',
        strategy: 'last_writer_wins',
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 5. Unresolvable conflict: concurrent deletion + modification
  // ─────────────────────────────────────────────────────────────────────
  describe('unresolvable conflict detection', () => {
    test('returns unresolvable when current state is deleted and envelope modifies', () => {
      const envelope = buildEnvelope({
        vectorClock: { 'loc-A': 2, 'loc-B': 1 },
        payload: { quantity: 50 }, // modification, not deletion
      });
      const state = buildRecordState({
        vectorClock: { 'loc-A': 1, 'loc-B': 2 },
        currentValues: { _deleted: true, quantity: 0 },
      });

      const result = service.detectConflict(envelope, state);
      expect(result.type).toBe('unresolvable');
      expect(result).toHaveProperty('reason');
      expect((result as { type: 'unresolvable'; reason: string }).reason).toContain(
        'deletion',
      );
    });

    test('returns unresolvable when envelope is a deletion and current is active', () => {
      const envelope = buildEnvelope({
        vectorClock: { 'loc-A': 2, 'loc-B': 1 },
        payload: { _deleted: true },
      });
      const state = buildRecordState({
        vectorClock: { 'loc-A': 1, 'loc-B': 2 },
        currentValues: { quantity: 100 },
      });

      const result = service.detectConflict(envelope, state);
      expect(result.type).toBe('unresolvable');
      expect((result as { type: 'unresolvable'; reason: string }).reason).toContain(
        'deletion',
      );
    });

    test('does NOT return unresolvable when both sides are active modifications', () => {
      const envelope = buildEnvelope({
        vectorClock: { 'loc-A': 2, 'loc-B': 1 },
        payload: { quantity: 50 },
      });
      const state = buildRecordState({
        vectorClock: { 'loc-A': 1, 'loc-B': 2 },
        currentValues: { quantity: 100 },
      });

      const result = service.detectConflict(envelope, state);
      expect(result.type).not.toBe('unresolvable');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 6. LWW resolution: later timestamp wins; lexicographic tiebreaker
  // ─────────────────────────────────────────────────────────────────────
  describe('Last-Writer-Wins resolution', () => {
    test('later timestamp wins', () => {
      const envelope = buildEnvelope({
        timestamp: '2024-06-15T12:00:00.000Z',
        locationId: 'loc-A',
        vectorClock: { 'loc-A': 2, 'loc-B': 1 },
        payload: { quantity: 75 },
      });
      const state = buildRecordState({
        vectorClock: { 'loc-A': 1, 'loc-B': 2 },
        currentValues: {
          quantity: 100,
          _timestamp: '2024-06-15T11:00:00.000Z',
          _locationId: 'loc-B',
        },
      });

      const conflict = service.detectConflict(envelope, state) as {
        type: 'concurrent_write';
        strategy: 'last_writer_wins';
        field: string;
      };
      const resolved = service.resolve(conflict, envelope, state);

      // Incoming is later → its value wins
      expect(resolved.finalValue.quantity).toBe(75);
    });

    test('earlier timestamp loses', () => {
      const envelope = buildEnvelope({
        timestamp: '2024-06-15T10:00:00.000Z',
        locationId: 'loc-A',
        vectorClock: { 'loc-A': 2, 'loc-B': 1 },
        payload: { quantity: 75 },
      });
      const state = buildRecordState({
        vectorClock: { 'loc-A': 1, 'loc-B': 2 },
        currentValues: {
          quantity: 100,
          _timestamp: '2024-06-15T11:00:00.000Z',
          _locationId: 'loc-B',
        },
      });

      const conflict = service.detectConflict(envelope, state) as {
        type: 'concurrent_write';
        strategy: 'last_writer_wins';
        field: string;
      };
      const resolved = service.resolve(conflict, envelope, state);

      // Current is later → its value stays
      expect(resolved.finalValue.quantity).toBe(100);
    });

    test('lexicographic tiebreaker on equal timestamps: higher location wins', () => {
      const envelope = buildEnvelope({
        timestamp: '2024-06-15T11:00:00.000Z',
        locationId: 'loc-B', // B > A lexicographically
        vectorClock: { 'loc-A': 1, 'loc-B': 2 },
        payload: { quantity: 60 },
      });
      const state = buildRecordState({
        vectorClock: { 'loc-A': 2, 'loc-B': 1 },
        currentValues: {
          quantity: 100,
          _timestamp: '2024-06-15T11:00:00.000Z',
          _locationId: 'loc-A',
        },
      });

      const conflict = service.detectConflict(envelope, state) as {
        type: 'concurrent_write';
        strategy: 'last_writer_wins';
        field: string;
      };
      const resolved = service.resolve(conflict, envelope, state);

      // loc-B > loc-A → incoming wins
      expect(resolved.finalValue.quantity).toBe(60);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 7. Additive merge resolution: deduction subtracted from balance
  // ─────────────────────────────────────────────────────────────────────
  describe('Additive Merge resolution', () => {
    test('deduction is subtracted from current balance', () => {
      const envelope = buildEnvelope({
        operationType: 'stock_deduction',
        vectorClock: { 'loc-A': 2, 'loc-B': 1 },
        payload: { quantity: 5 },
      });
      const state = buildRecordState({
        vectorClock: { 'loc-A': 1, 'loc-B': 2 },
        currentValues: { quantity: 100 },
        lastSyncBaseQuantity: 120,
      });

      const conflict = service.detectConflict(envelope, state) as {
        type: 'concurrent_write';
        strategy: 'additive_merge';
        field: string;
      };
      const resolved = service.resolve(conflict, envelope, state);

      // currentBalance(100) - abs(deduction(5)) = 95
      expect(resolved.finalValue.quantity).toBe(95);
    });

    test('negative deduction value is treated as absolute', () => {
      const envelope = buildEnvelope({
        operationType: 'stock_deduction',
        vectorClock: { 'loc-A': 2, 'loc-B': 1 },
        payload: { quantity: -8 },
      });
      const state = buildRecordState({
        vectorClock: { 'loc-A': 1, 'loc-B': 2 },
        currentValues: { quantity: 50 },
        lastSyncBaseQuantity: 80,
      });

      const conflict = service.detectConflict(envelope, state) as {
        type: 'concurrent_write';
        strategy: 'additive_merge';
        field: string;
      };
      const resolved = service.resolve(conflict, envelope, state);

      // 50 - abs(-8) = 42
      expect(resolved.finalValue.quantity).toBe(42);
    });

    test('audit entry records the correct values', () => {
      const envelope = buildEnvelope({
        operationType: 'stock_deduction',
        vectorClock: { 'loc-A': 2, 'loc-B': 1 },
        payload: { quantity: 10 },
        locationId: 'loc-A',
      });
      const state = buildRecordState({
        recordId: 'rec-xyz',
        vectorClock: { 'loc-A': 1, 'loc-B': 2 },
        currentValues: { quantity: 100 },
        lastSyncBaseQuantity: 120,
      });

      const conflict = service.detectConflict(envelope, state) as {
        type: 'concurrent_write';
        strategy: 'additive_merge';
        field: string;
      };
      const resolved = service.resolve(conflict, envelope, state);

      expect(resolved.auditEntry.recordId).toBe('rec-xyz');
      expect(resolved.auditEntry.strategy).toBe('additive_merge');
      expect(resolved.auditEntry.sourceLocationId).toBe('loc-A');
      expect(resolved.auditEntry.originalValues).toEqual({ quantity: 100 });
      expect(resolved.auditEntry.finalValues).toEqual({ quantity: 90 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 8. Vector clock merge: component-wise max
  // ─────────────────────────────────────────────────────────────────────
  describe('Vector clock merge', () => {
    test('merges by taking component-wise max', () => {
      const a: VectorClock = { 'loc-A': 3, 'loc-B': 1, 'loc-C': 5 };
      const b: VectorClock = { 'loc-A': 2, 'loc-B': 4, 'loc-D': 2 };

      const merged = service.mergeVectorClocks(a, b);

      expect(merged).toEqual({
        'loc-A': 3,
        'loc-B': 4,
        'loc-C': 5,
        'loc-D': 2,
      });
    });

    test('missing keys default to 0 during merge', () => {
      const a: VectorClock = { 'loc-A': 5 };
      const b: VectorClock = { 'loc-B': 3 };

      const merged = service.mergeVectorClocks(a, b);

      expect(merged).toEqual({ 'loc-A': 5, 'loc-B': 3 });
    });

    test('resolution result includes merged vector clock', () => {
      const envelope = buildEnvelope({
        vectorClock: { 'loc-A': 3, 'loc-B': 1 },
        timestamp: '2024-06-15T12:00:00.000Z',
      });
      const state = buildRecordState({
        vectorClock: { 'loc-A': 1, 'loc-B': 4 },
        currentValues: {
          quantity: 100,
          _timestamp: '2024-06-15T11:00:00.000Z',
          _locationId: 'loc-B',
        },
      });

      const conflict = service.detectConflict(envelope, state) as {
        type: 'concurrent_write';
        strategy: 'last_writer_wins';
        field: string;
      };
      const resolved = service.resolve(conflict, envelope, state);

      expect(resolved.mergedVectorClock).toEqual({
        'loc-A': 3,
        'loc-B': 4,
      });
    });
  });
});
