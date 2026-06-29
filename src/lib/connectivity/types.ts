/**
 * Configuration for the Connectivity Monitor service.
 */
export interface ConnectivityConfig {
  /** URL of the Sync Engine health endpoint for heartbeat checks */
  heartbeatUrl: string;
  /** Interval between heartbeat checks in ms. Default: 10000, range: 5000-60000 */
  heartbeatInterval: number;
  /** Maximum time to wait for heartbeat response in ms. Default: 3000 */
  heartbeatTimeout: number;
  /** Number of operations to include per sync batch. Default: 50 */
  batchSize: number;
  /** Interval between background sync batches in ms. Default: 30000, range: 10000-120000 */
  batchInterval: number;
  /** Maximum retry attempts for a failed sync cycle. Default: 3 */
  maxRetries: number;
}

/**
 * Current connectivity and sync status displayed to the user.
 */
export type ConnectivityStatus = 'online' | 'syncing' | 'pending' | 'offline';

/**
 * Describes a sync error for a specific envelope.
 */
export interface SyncError {
  envelopeId: string;
  idempotencyKey: string;
  reason: string;
}

/**
 * Result of a sync cycle, reporting success/failure counts and any errors.
 */
export interface SyncResult {
  success: boolean;
  acknowledged: number;
  failed: number;
  errors: SyncError[];
}
