/**
 * Sync health metrics for a single Location_Node.
 */
export interface SyncHealthMetrics {
  locationId: string;
  lastSyncTimestamp: string | null;
  pendingOperationCount: number;
  failedOperationCount: number;
  /** Rolling 60-minute window average */
  averageSyncLatencyMs: number;
}

/**
 * Sync status for a single location within a reconciliation report.
 */
export interface LocationSyncStatus {
  locationId: string;
  lastSyncTimestamp: string | null;
  pendingOperationCount: number;
  /** Estimated unsynced quantity based on heartbeat threshold */
  estimatedUnsyncedQuantity: number;
}

/**
 * A reconciliation flag raised when inventory discrepancy is detected.
 */
export interface ReconciliationFlag {
  productId: string;
  affectedLocations: string[];
  expectedTotal: number;
  actualTotal: number;
  discrepancy: number;
  flaggedAt: string;
}

/**
 * Inventory reconciliation report for a tenant, showing per-location sync status
 * and any discrepancy flags.
 */
export interface ReconciliationReport {
  tenantId: string;
  generatedAt: string;
  locations: LocationSyncStatus[];
  reconciliationFlags: ReconciliationFlag[];
}
