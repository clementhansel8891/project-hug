import { Injectable, Logger } from '@nestjs/common';
import {
  OperationEnvelope,
  VectorClock,
  RecordState,
  ConflictResult,
  ResolutionStrategy,
  ResolvedValue,
  ConflictAuditEntry,
} from './types';

/**
 * Interface for the Conflict Resolver service.
 */
export interface IConflictResolver {
  /**
   * Detect whether an incoming operation conflicts with the current record state
   * using vector clock comparison.
   */
  detectConflict(
    envelope: OperationEnvelope,
    currentState: RecordState,
  ): ConflictResult;

  /**
   * Resolve a detected conflict using the appropriate strategy.
   */
  resolve(
    conflict: ConflictResult & { type: 'concurrent_write' },
    envelope: OperationEnvelope,
    currentState: RecordState,
  ): ResolvedValue;
}

/**
 * Possible vector clock comparison outcomes.
 */
export type VectorClockRelation =
  | 'equal'
  | 'a_dominates'
  | 'b_dominates'
  | 'concurrent';

/**
 * Conflict Resolver Service
 *
 * Detects and resolves concurrent modifications using vector clocks.
 * Implements component-wise vector clock comparison for partial ordering,
 * and applies resolution strategies based on operation type:
 *
 * - **Last-Writer-Wins (LWW)**: for non-deduction inventory operations,
 *   non-quantity fields, pricing fields. Uses timestamp for winner selection
 *   with lexicographic location ID as deterministic tiebreaker.
 *
 * - **Additive Merge**: for stock deductions. Sums all deductions against
 *   the last sync base quantity, producing an identical result regardless
 *   of processing order (commutative).
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */
@Injectable()
export class ConflictResolverService implements IConflictResolver {
  private readonly logger = new Logger(ConflictResolverService.name);

  // ═══════════════════════════════════════════════════════════════════════
  // Vector Clock Comparison
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Compare two vector clocks using component-wise partial ordering.
   *
   * - 'equal': All components are identical
   * - 'a_dominates': A ≥ B for all components AND A > B for at least one
   * - 'b_dominates': B ≥ A for all components AND B > A for at least one
   * - 'concurrent': Neither dominates (conflict exists)
   */
  compareVectorClocks(a: VectorClock, b: VectorClock): VectorClockRelation {
    // Collect all keys from both clocks
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

    let aHasGreater = false;
    let bHasGreater = false;

    for (const key of allKeys) {
      const aVal = a[key] ?? 0;
      const bVal = b[key] ?? 0;

      if (aVal > bVal) {
        aHasGreater = true;
      } else if (bVal > aVal) {
        bHasGreater = true;
      }

      // Early exit: if both have a greater component, they're concurrent
      if (aHasGreater && bHasGreater) {
        return 'concurrent';
      }
    }

    if (!aHasGreater && !bHasGreater) return 'equal';
    if (aHasGreater && !bHasGreater) return 'a_dominates';
    if (!aHasGreater && bHasGreater) return 'b_dominates';

    // Should not reach here, but satisfies TypeScript
    return 'concurrent';
  }

  /**
   * Merge two vector clocks by taking the component-wise maximum.
   */
  mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
    const merged: VectorClock = {};
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

    for (const key of allKeys) {
      merged[key] = Math.max(a[key] ?? 0, b[key] ?? 0);
    }

    return merged;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Conflict Detection
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Detect whether an incoming operation conflicts with the current record state.
   *
   * - If the incoming vector clock dominates or equals the current state: no conflict.
   * - If the current state dominates: no conflict (incoming is outdated, will be LWW'd).
   * - If neither dominates (concurrent): conflict exists.
   *
   * For concurrent writes, determines the resolution strategy based on operation type.
   */
  detectConflict(
    envelope: OperationEnvelope,
    currentState: RecordState,
  ): ConflictResult {
    const relation = this.compareVectorClocks(
      envelope.vectorClock,
      currentState.vectorClock,
    );

    // No conflict cases
    if (relation === 'equal' || relation === 'a_dominates' || relation === 'b_dominates') {
      return { type: 'no_conflict' };
    }

    // Concurrent write — determine strategy
    const strategy = this.determineStrategy(envelope);
    const field = this.determinePrimaryField(envelope);

    // Check for unresolvable case: concurrent deletion + modification
    if (this.isUnresolvableConflict(envelope, currentState)) {
      return {
        type: 'unresolvable',
        reason: 'Concurrent deletion and modification detected — requires manual review',
      };
    }

    return {
      type: 'concurrent_write',
      strategy,
      field,
    };
  }

  /**
   * Determine the resolution strategy based on the operation type.
   *
   * - stock_deduction → additive_merge (commutative sum)
   * - All others → last_writer_wins
   */
  private determineStrategy(envelope: OperationEnvelope): ResolutionStrategy {
    if (envelope.operationType === 'stock_deduction') {
      return 'additive_merge';
    }
    return 'last_writer_wins';
  }

  /**
   * Determine the primary field being modified by this operation.
   */
  private determinePrimaryField(envelope: OperationEnvelope): string {
    switch (envelope.operationType) {
      case 'stock_deduction':
      case 'inventory_adjustment':
      case 'stock_movement':
        return 'quantity';
      case 'price_update':
        return 'price';
      case 'customer_update':
        return 'customer_data';
      case 'pos_transaction':
        return 'transaction';
      default:
        return 'unknown';
    }
  }

  /**
   * Detect unresolvable conflicts: concurrent deletion + modification.
   */
  private isUnresolvableConflict(
    envelope: OperationEnvelope,
    currentState: RecordState,
  ): boolean {
    // If the current state indicates deletion and the envelope is a modification
    const isCurrentDeleted = currentState.currentValues._deleted === true;
    const isEnvelopeDeletion = envelope.payload._deleted === true;

    // Concurrent deletion + modification
    if (isCurrentDeleted && !isEnvelopeDeletion) return true;
    if (!isCurrentDeleted && isEnvelopeDeletion) return true;

    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Conflict Resolution
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Resolve a detected conflict using the appropriate strategy.
   */
  resolve(
    conflict: ConflictResult & { type: 'concurrent_write' },
    envelope: OperationEnvelope,
    currentState: RecordState,
  ): ResolvedValue {
    switch (conflict.strategy) {
      case 'last_writer_wins':
        return this.resolveLastWriterWins(envelope, currentState);
      case 'additive_merge':
        return this.resolveAdditiveMerge(envelope, currentState);
      default:
        // Exhaustive check
        const _exhaustive: never = conflict.strategy;
        throw new Error(`Unknown resolution strategy: ${_exhaustive}`);
    }
  }

  /**
   * Last-Writer-Wins resolution.
   *
   * - Compares timestamps to select the winner.
   * - On equal timestamps, uses lexicographic comparison of location IDs as tiebreaker.
   * - Generates a conflict audit log entry.
   *
   * Requirements: 4.2, 4.4, 4.5
   */
  resolveLastWriterWins(
    envelope: OperationEnvelope,
    currentState: RecordState,
  ): ResolvedValue {
    const incomingTimestamp = new Date(envelope.timestamp).getTime();
    const currentTimestamp = currentState.currentValues._timestamp
      ? new Date(currentState.currentValues._timestamp as string).getTime()
      : 0;

    let winner: 'incoming' | 'current';

    if (incomingTimestamp > currentTimestamp) {
      winner = 'incoming';
    } else if (incomingTimestamp < currentTimestamp) {
      winner = 'current';
    } else {
      // Equal timestamps — lexicographic tiebreaker on location ID
      const incomingLocation = envelope.locationId;
      const currentLocation = (currentState.currentValues._locationId as string) ?? '';
      winner = incomingLocation > currentLocation ? 'incoming' : 'current';
    }

    const finalValue =
      winner === 'incoming'
        ? { ...currentState.currentValues, ...envelope.payload }
        : { ...currentState.currentValues };

    // Update metadata
    finalValue._timestamp = winner === 'incoming' ? envelope.timestamp : (currentState.currentValues._timestamp ?? '');
    finalValue._locationId = winner === 'incoming' ? envelope.locationId : (currentState.currentValues._locationId ?? '');

    const mergedVectorClock = this.mergeVectorClocks(
      envelope.vectorClock,
      currentState.vectorClock,
    );

    const auditEntry: ConflictAuditEntry = {
      recordId: currentState.recordId,
      conflictType: 'concurrent_write',
      originalValues: { ...currentState.currentValues },
      conflictingValues: { ...envelope.payload },
      strategy: 'last_writer_wins',
      finalValues: finalValue,
      resolvedAt: new Date().toISOString(),
      sourceLocationId: envelope.locationId,
    };

    return {
      finalValue,
      mergedVectorClock,
      auditEntry,
    };
  }

  /**
   * Additive Merge resolution for stock deductions.
   *
   * Sums all deductions against the last sync base quantity.
   * Result is identical regardless of processing order (commutativity).
   *
   * Final quantity = base - sum(all deductions)
   *
   * Requirements: 4.3
   */
  resolveAdditiveMerge(
    envelope: OperationEnvelope,
    currentState: RecordState,
  ): ResolvedValue {
    const baseQuantity = currentState.lastSyncBaseQuantity ?? 0;
    const incomingDeduction = (envelope.payload.quantity as number) ?? 0;

    // Current balance already reflects prior deductions from the base
    const currentBalance =
      (currentState.currentValues.quantity as number) ?? baseQuantity;

    // Apply this deduction additively: subtract from current balance
    const finalQuantity = currentBalance - Math.abs(incomingDeduction);

    const finalValue: Record<string, unknown> = {
      ...currentState.currentValues,
      quantity: finalQuantity,
      _lastDeductionEnvelopeId: envelope.id,
      _lastDeductionTimestamp: envelope.timestamp,
    };

    const mergedVectorClock = this.mergeVectorClocks(
      envelope.vectorClock,
      currentState.vectorClock,
    );

    const auditEntry: ConflictAuditEntry = {
      recordId: currentState.recordId,
      conflictType: 'concurrent_stock_deduction',
      originalValues: { quantity: currentBalance },
      conflictingValues: { quantity: incomingDeduction },
      strategy: 'additive_merge',
      finalValues: { quantity: finalQuantity },
      resolvedAt: new Date().toISOString(),
      sourceLocationId: envelope.locationId,
    };

    return {
      finalValue,
      mergedVectorClock,
      auditEntry,
    };
  }
}
