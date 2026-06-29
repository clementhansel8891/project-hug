import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngineService } from './sync-engine.service';
import { OperationEnvelope } from './types';
import { TenantContext } from '../../gateway/tenant-context.interface';

/**
 * Unit tests for SyncEngineService.
 *
 * Validates Requirements 3.1, 3.4, 3.5, 3.6:
 * - Accept batches of up to 100 envelopes ordered by sequence number
 * - Process each operation in its own database transaction
 * - Continue processing remaining operations when one fails
 * - Record error reasons for failed operations
 * - Return per-envelope status (acknowledged/failed with reason)
 * - Create sync session records tracking operations received/applied/failed
 */

function createValidEnvelope(overrides: Partial<OperationEnvelope> = {}): OperationEnvelope {
  return {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    idempotencyKey: `key-${Math.random().toString(36).slice(2)}`,
    tenantId: 'tenant-123',
    branchId: 'branch-001',
    locationId: 'location-001',
    sequenceNumber: 1,
    sessionId: 'session-abc',
    timestamp: '2024-01-15T10:30:00.000Z',
    vectorClock: { 'location-001': 1 },
    operationType: 'pos_transaction',
    payload: { amount: 100, productId: 'prod-1' },
    status: 'syncing',
    retryCount: 0,
    createdAt: '2024-01-15T10:30:00.000Z',
    ...overrides,
  };
}

const tenantContext: TenantContext = {
  tenant_id: 'tenant-123',
  company_id: 'company-123',
  branch_id: 'branch-001',
  location_id: 'location-001',
};

// Mock PrismaService
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();
const mockSessionCreate = vi.fn();
const mockSessionUpdate = vi.fn();

const mockPrismaService = {
  sync_operation_log: {
    create: mockCreate,
    count: vi.fn().mockResolvedValue(0),
  },
  sync_sessions: {
    create: mockSessionCreate,
    update: mockSessionUpdate,
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  },
  sync_reconciliation_flags: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  $transaction: mockTransaction,
} as any;

// Mock ValidationService
const mockValidate = vi.fn();
const mockValidationService = {
  validate: mockValidate,
} as any;

// Mock IdempotencyService
const mockCheck = vi.fn();
const mockIdempotencyService = {
  check: mockCheck,
} as any;

describe('SyncEngineService', () => {
  let service: SyncEngineService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: validation passes
    mockValidate.mockReturnValue({ valid: true });

    // Default: no duplicates
    mockCheck.mockResolvedValue({ isDuplicate: false });

    // Default: transaction executes the callback
    mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
      return cb({
        sync_operation_log: { create: mockCreate },
      });
    });

    // Default: session creation returns an id
    mockSessionCreate.mockResolvedValue({ id: 'session-id-1' });
    mockSessionUpdate.mockResolvedValue({});
    mockCreate.mockResolvedValue({ id: 'op-log-id-1' });

    service = new SyncEngineService(
      mockPrismaService,
      mockValidationService,
      mockIdempotencyService,
    );
  });

  describe('processBatch()', () => {
    it('should return a BatchSyncResponse with batchId and processedAt', async () => {
      const batch = [createValidEnvelope()];
      const result = await service.processBatch(batch, tenantContext);

      expect(result.batchId).toBeDefined();
      expect(result.processedAt).toBeDefined();
      expect(new Date(result.processedAt).getTime()).not.toBeNaN();
      expect(result.results).toHaveLength(1);
    });

    it('should process envelopes in sequence number order', async () => {
      const processedKeys: string[] = [];
      mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        return cb({
          sync_operation_log: {
            create: vi.fn().mockImplementation((args: any) => {
              processedKeys.push(args.data.idempotency_key);
              return { id: 'op-log-id' };
            }),
          },
        });
      });

      const batch = [
        createValidEnvelope({ sequenceNumber: 3, idempotencyKey: 'key-3' }),
        createValidEnvelope({ sequenceNumber: 1, idempotencyKey: 'key-1' }),
        createValidEnvelope({ sequenceNumber: 2, idempotencyKey: 'key-2' }),
      ];

      await service.processBatch(batch, tenantContext);

      expect(processedKeys).toEqual(['key-1', 'key-2', 'key-3']);
    });

    it('should limit batch size to 100 envelopes', async () => {
      const batch = Array.from({ length: 120 }, (_, i) =>
        createValidEnvelope({ sequenceNumber: i + 1, idempotencyKey: `key-${i}` }),
      );

      const result = await service.processBatch(batch, tenantContext);

      expect(result.results).toHaveLength(100);
    });

    it('should return acknowledged for each successfully processed envelope', async () => {
      const batch = [
        createValidEnvelope({ idempotencyKey: 'key-a' }),
        createValidEnvelope({ sequenceNumber: 2, idempotencyKey: 'key-b' }),
      ];

      const result = await service.processBatch(batch, tenantContext);

      expect(result.results).toEqual([
        { idempotencyKey: 'key-a', status: 'acknowledged' },
        { idempotencyKey: 'key-b', status: 'acknowledged' },
      ]);
    });

    it('should return acknowledged for duplicate idempotency keys without re-processing', async () => {
      mockCheck.mockResolvedValue({ isDuplicate: true, existingStatus: 'applied' });

      const batch = [createValidEnvelope({ idempotencyKey: 'dup-key' })];
      const result = await service.processBatch(batch, tenantContext);

      expect(result.results[0]).toEqual({
        idempotencyKey: 'dup-key',
        status: 'acknowledged',
      });
      // Should NOT have called $transaction for a duplicate
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should return failed with reason when validation fails', async () => {
      mockValidate.mockReturnValue({
        valid: false,
        errors: [{ field: 'payload', reason: 'payload must not be empty' }],
      });

      const batch = [createValidEnvelope({ idempotencyKey: 'bad-key' })];
      const result = await service.processBatch(batch, tenantContext);

      expect(result.results[0]).toEqual({
        idempotencyKey: 'bad-key',
        status: 'failed',
        reason: 'payload: payload must not be empty',
      });
    });

    it('should continue processing remaining operations when one fails', async () => {
      // First envelope fails validation, second succeeds
      mockValidate
        .mockReturnValueOnce({
          valid: false,
          errors: [{ field: 'tenantId', reason: 'tenantId is required' }],
        })
        .mockReturnValueOnce({ valid: true })
        .mockReturnValueOnce({ valid: true });

      const batch = [
        createValidEnvelope({ sequenceNumber: 1, idempotencyKey: 'fail-key' }),
        createValidEnvelope({ sequenceNumber: 2, idempotencyKey: 'ok-key-1' }),
        createValidEnvelope({ sequenceNumber: 3, idempotencyKey: 'ok-key-2' }),
      ];

      const result = await service.processBatch(batch, tenantContext);

      expect(result.results).toHaveLength(3);
      expect(result.results[0].status).toBe('failed');
      expect(result.results[1].status).toBe('acknowledged');
      expect(result.results[2].status).toBe('acknowledged');
    });

    it('should continue processing when a database transaction fails', async () => {
      // First transaction throws, second succeeds
      mockTransaction
        .mockRejectedValueOnce(new Error('Unique constraint violation'))
        .mockImplementationOnce(async (cb: (tx: any) => Promise<any>) => {
          return cb({
            sync_operation_log: { create: mockCreate },
          });
        });

      const batch = [
        createValidEnvelope({ sequenceNumber: 1, idempotencyKey: 'tx-fail' }),
        createValidEnvelope({ sequenceNumber: 2, idempotencyKey: 'tx-ok' }),
      ];

      const result = await service.processBatch(batch, tenantContext);

      expect(result.results[0]).toEqual({
        idempotencyKey: 'tx-fail',
        status: 'failed',
        reason: 'Unique constraint violation',
      });
      expect(result.results[1]).toEqual({
        idempotencyKey: 'tx-ok',
        status: 'acknowledged',
      });
    });

    it('should record error reasons for failed operations', async () => {
      mockValidate.mockReturnValue({
        valid: false,
        errors: [
          { field: 'branchId', reason: 'branchId is required' },
          { field: 'sequenceNumber', reason: 'sequenceNumber must be a positive integer' },
        ],
      });

      const batch = [createValidEnvelope({ idempotencyKey: 'multi-err' })];
      const result = await service.processBatch(batch, tenantContext);

      expect(result.results[0].reason).toContain('branchId: branchId is required');
      expect(result.results[0].reason).toContain(
        'sequenceNumber: sequenceNumber must be a positive integer',
      );
    });

    it('should create a sync session at the start of batch processing', async () => {
      const batch = [createValidEnvelope()];
      await service.processBatch(batch, tenantContext);

      expect(mockSessionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: 'tenant-123',
          location_id: 'location-001',
          operations_received: 1,
          status: 'in_progress',
        }),
      });
    });

    it('should update the sync session with final counts on completion', async () => {
      const batch = [
        createValidEnvelope({ sequenceNumber: 1, idempotencyKey: 'key-1' }),
        createValidEnvelope({ sequenceNumber: 2, idempotencyKey: 'key-2' }),
      ];

      await service.processBatch(batch, tenantContext);

      expect(mockSessionUpdate).toHaveBeenCalledWith({
        where: { id: 'session-id-1' },
        data: expect.objectContaining({
          operations_applied: 2,
          operations_failed: 0,
          status: 'completed',
          completed_at: expect.any(Date),
          latency_ms: expect.any(Number),
        }),
      });
    });

    it('should track applied and failed counts accurately', async () => {
      // 2 pass, 1 fails validation
      mockValidate
        .mockReturnValueOnce({ valid: true })
        .mockReturnValueOnce({
          valid: false,
          errors: [{ field: 'payload', reason: 'payload is required' }],
        })
        .mockReturnValueOnce({ valid: true });

      const batch = [
        createValidEnvelope({ sequenceNumber: 1, idempotencyKey: 'k1' }),
        createValidEnvelope({ sequenceNumber: 2, idempotencyKey: 'k2' }),
        createValidEnvelope({ sequenceNumber: 3, idempotencyKey: 'k3' }),
      ];

      await service.processBatch(batch, tenantContext);

      expect(mockSessionUpdate).toHaveBeenCalledWith({
        where: { id: 'session-id-1' },
        data: expect.objectContaining({
          operations_applied: 2,
          operations_failed: 1,
        }),
      });
    });

    it('should process each envelope in its own transaction', async () => {
      const batch = [
        createValidEnvelope({ sequenceNumber: 1, idempotencyKey: 'ind-1' }),
        createValidEnvelope({ sequenceNumber: 2, idempotencyKey: 'ind-2' }),
        createValidEnvelope({ sequenceNumber: 3, idempotencyKey: 'ind-3' }),
      ];

      await service.processBatch(batch, tenantContext);

      // Each envelope gets its own $transaction call
      expect(mockTransaction).toHaveBeenCalledTimes(3);
    });

    it('should handle empty batch', async () => {
      const result = await service.processBatch([], tenantContext);

      expect(result.results).toHaveLength(0);
      expect(result.batchId).toBeDefined();
    });
  });

  describe('getHealthMetrics()', () => {
    it('should return metrics for a location', async () => {
      const result = await service.getHealthMetrics('location-001');

      expect(result).toEqual({
        locationId: 'location-001',
        lastSyncTimestamp: null,
        pendingOperationCount: 0,
        failedOperationCount: 0,
        averageSyncLatencyMs: 0,
      });
    });
  });
});
