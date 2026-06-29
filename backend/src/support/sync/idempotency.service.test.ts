import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdempotencyService, IdempotencyCheckResult } from './idempotency.service';

/**
 * Unit tests for IdempotencyService.
 *
 * Validates Requirements 3.3 and 9.2:
 * - Duplicate idempotency keys return 'acknowledged' without re-processing
 * - New keys are correctly identified for processing
 */

// Mock PrismaService
const mockFindUnique = vi.fn();

const mockPrismaService = {
  sync_operation_log: {
    findUnique: mockFindUnique,
  },
} as any;

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IdempotencyService(mockPrismaService);
  });

  describe('check()', () => {
    it('should return isDuplicate: false when no existing record is found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await service.check('tenant-123', 'key-abc');

      expect(result).toEqual<IdempotencyCheckResult>({
        isDuplicate: false,
      });
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: {
          uq_idempotency: {
            tenant_id: 'tenant-123',
            idempotency_key: 'key-abc',
          },
        },
        select: { status: true },
      });
    });

    it('should return isDuplicate: true with existingStatus when record exists', async () => {
      mockFindUnique.mockResolvedValue({ status: 'applied' });

      const result = await service.check('tenant-456', 'key-xyz');

      expect(result).toEqual<IdempotencyCheckResult>({
        isDuplicate: true,
        existingStatus: 'applied',
      });
    });

    it('should return existingStatus "received" for a received record', async () => {
      mockFindUnique.mockResolvedValue({ status: 'received' });

      const result = await service.check('tenant-001', 'key-001');

      expect(result).toEqual<IdempotencyCheckResult>({
        isDuplicate: true,
        existingStatus: 'received',
      });
    });

    it('should return existingStatus "failed" for a failed record', async () => {
      mockFindUnique.mockResolvedValue({ status: 'failed' });

      const result = await service.check('tenant-001', 'key-failed');

      expect(result).toEqual<IdempotencyCheckResult>({
        isDuplicate: true,
        existingStatus: 'failed',
      });
    });

    it('should query using the uq_idempotency unique constraint', async () => {
      mockFindUnique.mockResolvedValue(null);

      await service.check('my-tenant', 'my-key');

      expect(mockFindUnique).toHaveBeenCalledTimes(1);
      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            uq_idempotency: {
              tenant_id: 'my-tenant',
              idempotency_key: 'my-key',
            },
          },
        }),
      );
    });

    it('should handle different tenants with the same idempotency key independently', async () => {
      // First call for tenant-A
      mockFindUnique.mockResolvedValueOnce({ status: 'applied' });
      // Second call for tenant-B
      mockFindUnique.mockResolvedValueOnce(null);

      const resultA = await service.check('tenant-A', 'shared-key');
      const resultB = await service.check('tenant-B', 'shared-key');

      expect(resultA.isDuplicate).toBe(true);
      expect(resultB.isDuplicate).toBe(false);
    });

    it('should not include existingStatus when key is new', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await service.check('tenant-x', 'new-key');

      expect(result.existingStatus).toBeUndefined();
    });
  });
});
