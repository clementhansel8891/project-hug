/**
 * Vector clock for causal ordering across locations.
 * Each entry maps a locationId to its logical counter.
 */
export interface VectorClock {
  [locationId: string]: number;
}

/**
 * Status lifecycle of an Operation_Envelope.
 */
export type EnvelopeStatus = 'pending' | 'syncing' | 'acknowledged' | 'failed';

/**
 * Supported operation types for offline mutations.
 */
export type OperationType =
  | 'pos_transaction'
  | 'inventory_adjustment'
  | 'stock_movement'
  | 'stock_deduction'
  | 'price_update'
  | 'customer_update';

/**
 * Structured wrapper around each offline operation containing the operation payload,
 * tenant context, timestamp, location origin, and a unique idempotency key.
 */
export interface OperationEnvelope {
  /** UUID v4 */
  id: string;
  /** Unique per operation — used for exactly-once delivery */
  idempotencyKey: string;
  tenantId: string;
  branchId: string;
  locationId: string;
  /** Monotonic per offline session, starting at 1 */
  sequenceNumber: number;
  /** Offline session identifier */
  sessionId: string;
  /** ISO 8601 from client clock */
  timestamp: string;
  /** Causal ordering */
  vectorClock: VectorClock;
  operationType: OperationType;
  payload: Record<string, unknown>;
  status: EnvelopeStatus;
  retryCount: number;
  createdAt: string;
  /** AES-GCM encrypted form (optional) */
  encryptedPayload?: ArrayBuffer;
}
