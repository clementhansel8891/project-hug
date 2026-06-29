import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';

/**
 * Result of checking an idempotency key against the sync_operation_log.
 */
export interface IdempotencyCheckResult {
  /** True if a record with this tenant_id + idempotency_key already exists */
  isDuplicate: boolean;
  /** Status of the existing record (only present when isDuplicate is true) */
  existingStatus?: string;
}

/**
 * Idempotency Service
 *
 * Checks whether an Operation_Envelope with the same tenant_id + idempotency_key
 * has already been processed, leveraging the `uq_idempotency` unique constraint
 * on the `sync_operation_log` table.
 *
 * When a duplicate is detected, the envelope should be returned as 'acknowledged'
 * without re-processing.
 *
 * Requirements: 3.3, 9.2
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks if an envelope with the given tenant_id and idempotency_key
   * already exists in the sync_operation_log table.
   *
   * @param tenantId - The tenant identifier
   * @param idempotencyKey - The unique idempotency key for the operation
   * @returns IdempotencyCheckResult indicating whether the key is a duplicate
   */
  async check(tenantId: string, idempotencyKey: string): Promise<IdempotencyCheckResult> {
    const existing = await this.prisma.sync_operation_log.findUnique({
      where: {
        uq_idempotency: {
          tenant_id: tenantId,
          idempotency_key: idempotencyKey,
        },
      },
      select: {
        status: true,
      },
    });

    if (existing) {
      this.logger.debug(
        `Duplicate idempotency key detected: tenant=${tenantId}, key=${idempotencyKey}, existingStatus=${existing.status}`,
      );
      return {
        isDuplicate: true,
        existingStatus: existing.status,
      };
    }

    return { isDuplicate: false };
  }
}
