import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { EventEmitter } from 'events';
import { PrismaService } from '../../persistence/prisma.service';
import { SyncValidationService, ValidationResult } from './sync-validation.service';
import { IdempotencyService } from './idempotency.service';
import { TenantContext } from '../../gateway/tenant-context.interface';
import {
  OperationEnvelope,
  BatchSyncResponse,
  EnvelopeResult,
  SyncHealthMetrics,
  ReconciliationReport,
} from './types';
import { randomUUID } from 'crypto';

/**
 * Maximum number of envelopes allowed in a single batch.
 */
const MAX_BATCH_SIZE = 100;

/**
 * Sync Engine Service
 *
 * Processes batches of Operation_Envelopes from offline locations.
 * Each operation is processed in its own database transaction so that
 * a failure in one does not roll back others.
 *
 * Requirements: 3.1, 3.4, 3.5, 3.6
 */
@Injectable()
export class SyncEngineService {
  private readonly logger = new Logger(SyncEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: SyncValidationService,
    private readonly idempotencyService: IdempotencyService,
    @Optional() @Inject('SYNC_EVENT_EMITTER') private readonly eventEmitter?: EventEmitter,
  ) {}

  /**
   * Processes a batch of up to 100 Operation_Envelopes.
   *
   * - Envelopes are processed in sequence number order.
   * - Each operation runs in its own database transaction.
   * - Failed operations do NOT prevent remaining operations from processing.
   * - A sync session record is created at the start and updated on completion.
   *
   * @param batch - Array of Operation_Envelopes (max 100, ordered by sequenceNumber)
   * @param tenantContext - The authenticated tenant context
   * @returns BatchSyncResponse with per-envelope results
   */
  async processBatch(
    batch: OperationEnvelope[],
    tenantContext: TenantContext,
  ): Promise<BatchSyncResponse> {
    const batchId = randomUUID();
    const startTime = Date.now();

    // Enforce max batch size
    if (batch.length > MAX_BATCH_SIZE) {
      batch = batch.slice(0, MAX_BATCH_SIZE);
    }

    // Sort by sequence number to ensure ordered processing
    const sortedBatch = [...batch].sort(
      (a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0),
    );

    // Create sync session record
    const locationId = tenantContext.location_id ?? sortedBatch[0]?.locationId ?? 'unknown';
    const session = await this.createSyncSession(tenantContext.tenant_id, locationId, sortedBatch.length);

    const results: EnvelopeResult[] = [];
    let appliedCount = 0;
    let failedCount = 0;

    // Process each envelope independently
    for (const envelope of sortedBatch) {
      const result = await this.processEnvelope(envelope, tenantContext);
      results.push(result);

      if (result.status === 'acknowledged') {
        appliedCount++;
      } else {
        failedCount++;
      }
    }

    // Update sync session with final counts
    const latencyMs = Date.now() - startTime;
    await this.completeSyncSession(session.id, appliedCount, failedCount, latencyMs);

    // Emit sync_batch_completed event for Socket.IO gateway integration
    this.eventEmitter?.emit('sync_batch_completed', {
      batchId,
      tenantId: tenantContext.tenant_id,
      locationId,
      operationsApplied: appliedCount,
      operationsFailed: failedCount,
      processedAt: new Date().toISOString(),
    });

    return {
      batchId,
      processedAt: new Date().toISOString(),
      results,
    };
  }

  /**
   * Process a single envelope in its own database transaction.
   * Returns acknowledged on success or duplicate, failed with reason on error.
   */
  private async processEnvelope(
    envelope: OperationEnvelope,
    tenantContext: TenantContext,
  ): Promise<EnvelopeResult> {
    const idempotencyKey = envelope?.idempotencyKey ?? '';

    try {
      // Step 1: Structural validation
      const validationResult: ValidationResult = this.validationService.validate(
        envelope as unknown as Record<string, unknown>,
        tenantContext,
      );

      if (!validationResult.valid) {
        const errorReason = validationResult.errors
          .map((e) => `${e.field}: ${e.reason}`)
          .join('; ');

        this.logger.warn(
          `Envelope validation failed: key=${idempotencyKey}, errors=${errorReason}`,
        );

        return {
          idempotencyKey,
          status: 'failed',
          reason: errorReason,
        };
      }

      // Step 2: Idempotency check
      const idempotencyCheck = await this.idempotencyService.check(
        envelope.tenantId,
        envelope.idempotencyKey,
      );

      if (idempotencyCheck.isDuplicate) {
        this.logger.debug(
          `Duplicate envelope acknowledged without re-processing: key=${envelope.idempotencyKey}`,
        );
        return {
          idempotencyKey: envelope.idempotencyKey,
          status: 'acknowledged',
        };
      }

      // Step 3: Process in its own database transaction
      await this.prisma.$transaction(async (tx) => {
        await tx.sync_operation_log.create({
          data: {
            tenant_id: envelope.tenantId,
            branch_id: envelope.branchId,
            location_id: envelope.locationId,
            idempotency_key: envelope.idempotencyKey,
            sequence_number: envelope.sequenceNumber,
            session_id: envelope.sessionId,
            operation_type: envelope.operationType,
            payload: envelope.payload as object,
            vector_clock: envelope.vectorClock as object,
            status: 'applied',
            received_at: new Date(),
            applied_at: new Date(),
          },
        });
      });

      return {
        idempotencyKey: envelope.idempotencyKey,
        status: 'acknowledged',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown processing error';

      this.logger.error(
        `Failed to process envelope: key=${idempotencyKey}, error=${errorMessage}`,
      );

      // Attempt to record the failure in the operation log
      await this.recordFailure(envelope, errorMessage).catch((recordErr) => {
        this.logger.error(
          `Failed to record failure for envelope: key=${idempotencyKey}, recordError=${recordErr}`,
        );
      });

      return {
        idempotencyKey,
        status: 'failed',
        reason: errorMessage,
      };
    }
  }

  /**
   * Records a failed operation in the sync_operation_log with its error reason.
   */
  private async recordFailure(
    envelope: OperationEnvelope,
    errorReason: string,
  ): Promise<void> {
    // Only attempt to record if we have minimum required fields
    if (!envelope?.tenantId || !envelope?.idempotencyKey) {
      return;
    }

    try {
      await this.prisma.sync_operation_log.create({
        data: {
          tenant_id: envelope.tenantId,
          branch_id: envelope.branchId ?? 'unknown',
          location_id: envelope.locationId ?? 'unknown',
          idempotency_key: envelope.idempotencyKey,
          sequence_number: envelope.sequenceNumber ?? 0,
          session_id: envelope.sessionId ?? 'unknown',
          operation_type: envelope.operationType ?? 'unknown',
          payload: (envelope.payload as object) ?? {},
          vector_clock: (envelope.vectorClock as object) ?? {},
          status: 'failed',
          error_reason: errorReason,
          received_at: new Date(),
        },
      });
    } catch (err) {
      // If recording fails (e.g., duplicate idempotency key), just log
      this.logger.warn(
        `Could not record failure for envelope key=${envelope.idempotencyKey}: ${err}`,
      );
    }
  }

  /**
   * Creates a sync session record to track batch processing.
   */
  private async createSyncSession(
    tenantId: string,
    locationId: string,
    operationsReceived: number,
  ) {
    return this.prisma.sync_sessions.create({
      data: {
        tenant_id: tenantId,
        location_id: locationId,
        operations_received: operationsReceived,
        status: 'in_progress',
      },
    });
  }

  /**
   * Updates a sync session record with final processing results.
   */
  private async completeSyncSession(
    sessionId: string,
    operationsApplied: number,
    operationsFailed: number,
    latencyMs: number,
  ): Promise<void> {
    await this.prisma.sync_sessions.update({
      where: { id: sessionId },
      data: {
        completed_at: new Date(),
        operations_applied: operationsApplied,
        operations_failed: operationsFailed,
        latency_ms: latencyMs,
        status: 'completed',
      },
    });
  }

  /**
   * Retrieves sync health metrics for a specific location.
   *
   * Returns last sync timestamp, pending/failed operation counts,
   * and average sync latency over a rolling 60-minute window.
   *
   * @param locationId - The location to get metrics for
   * @returns SyncHealthMetrics
   */
  async getHealthMetrics(locationId: string): Promise<SyncHealthMetrics> {
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Get the last completed sync session for this location
    const lastSession = await this.prisma.sync_sessions.findFirst({
      where: {
        location_id: locationId,
        status: 'completed',
      },
      orderBy: { completed_at: 'desc' },
      select: { completed_at: true },
    });

    // Count pending operations for this location
    const pendingCount = await this.prisma.sync_operation_log.count({
      where: {
        location_id: locationId,
        status: 'received',
      },
    });

    // Count failed operations for this location
    const failedCount = await this.prisma.sync_operation_log.count({
      where: {
        location_id: locationId,
        status: 'failed',
      },
    });

    // Calculate average latency from sessions in the last 60 minutes
    const recentSessions = await this.prisma.sync_sessions.findMany({
      where: {
        location_id: locationId,
        status: 'completed',
        completed_at: { gte: sixtyMinutesAgo },
        latency_ms: { not: null },
      },
      select: { latency_ms: true },
    });

    const averageLatency =
      recentSessions.length > 0
        ? Math.round(
            recentSessions.reduce((sum, s) => sum + (s.latency_ms ?? 0), 0) /
              recentSessions.length,
          )
        : 0;

    return {
      locationId,
      lastSyncTimestamp: lastSession?.completed_at?.toISOString() ?? null,
      pendingOperationCount: pendingCount,
      failedOperationCount: failedCount,
      averageSyncLatencyMs: averageLatency,
    };
  }

  /**
   * Generates a reconciliation report for a tenant showing per-location
   * sync status and any open reconciliation flags.
   *
   * @param tenantId - The tenant to generate the report for
   * @returns ReconciliationReport
   */
  async getReconciliationReport(tenantId: string): Promise<ReconciliationReport> {
    // Get all locations with their last sync session
    const locations = await this.prisma.sync_sessions.findMany({
      where: { tenant_id: tenantId },
      distinct: ['location_id'],
      orderBy: { started_at: 'desc' },
      select: {
        location_id: true,
        completed_at: true,
      },
    });

    const locationStatuses = await Promise.all(
      locations.map(async (loc) => {
        const pendingCount = await this.prisma.sync_operation_log.count({
          where: {
            tenant_id: tenantId,
            location_id: loc.location_id,
            status: 'received',
          },
        });

        return {
          locationId: loc.location_id,
          lastSyncTimestamp: loc.completed_at?.toISOString() ?? null,
          pendingOperationCount: pendingCount,
          estimatedUnsyncedQuantity: pendingCount,
        };
      }),
    );

    // Get open reconciliation flags
    const flags = await this.prisma.sync_reconciliation_flags.findMany({
      where: {
        tenant_id: tenantId,
        resolved_at: null,
      },
    });

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      locations: locationStatuses,
      reconciliationFlags: flags.map((f) => ({
        productId: f.product_id,
        affectedLocations: f.affected_locations,
        expectedTotal: Number(f.expected_total),
        actualTotal: Number(f.actual_total),
        discrepancy: Number(f.discrepancy),
        flaggedAt: f.flagged_at.toISOString(),
      })),
    };
  }
}
