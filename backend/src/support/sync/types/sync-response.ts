/**
 * Result status for an individual envelope within a batch sync response.
 */
export interface EnvelopeResult {
  idempotencyKey: string;
  status: 'acknowledged' | 'failed';
  reason?: string;
}

/**
 * Response returned by the Sync Engine after processing a batch of Operation_Envelopes.
 */
export interface BatchSyncResponse {
  batchId: string;
  processedAt: string;
  results: EnvelopeResult[];
}

/**
 * Describes a sync error for a specific envelope.
 */
export interface SyncError {
  envelopeId: string;
  idempotencyKey: string;
  reason: string;
}
