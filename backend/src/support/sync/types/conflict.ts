import { VectorClock } from './operation-envelope';

/**
 * Current state of a record in the central database, used for conflict detection.
 */
export interface RecordState {
  recordId: string;
  vectorClock: VectorClock;
  currentValues: Record<string, unknown>;
  /** Used for additive merge strategy on stock deductions */
  lastSyncBaseQuantity?: number;
}

/**
 * Result of conflict detection between an incoming operation and the current record state.
 */
export type ConflictResult =
  | { type: 'no_conflict' }
  | { type: 'concurrent_write'; strategy: ResolutionStrategy; field: string }
  | { type: 'unresolvable'; reason: string };

/**
 * Strategy used to resolve a detected conflict.
 */
export type ResolutionStrategy = 'last_writer_wins' | 'additive_merge';

/**
 * The resolved value after conflict resolution, including the merged vector clock
 * and an audit trail entry.
 */
export interface ResolvedValue {
  finalValue: Record<string, unknown>;
  mergedVectorClock: VectorClock;
  auditEntry: ConflictAuditEntry;
}

/**
 * Audit log entry generated for every resolved conflict.
 */
export interface ConflictAuditEntry {
  recordId: string;
  conflictType: string;
  originalValues: Record<string, unknown>;
  conflictingValues: Record<string, unknown>;
  strategy: ResolutionStrategy;
  finalValues: Record<string, unknown>;
  /** ISO 8601 timestamp of resolution */
  resolvedAt: string;
  sourceLocationId: string;
}
