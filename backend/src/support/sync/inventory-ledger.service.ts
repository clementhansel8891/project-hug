import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Result of aggregate inventory reconciliation for a product.
 */
export interface ReconciliationResult {
  productId: string;
  expectedTotal: number;
  actualTotal: number;
  discrepancy: number;
  withinTolerance: boolean;
  flagCreated: boolean;
  locationBalances: LocationBalance[];
}

/**
 * Per-location inventory balance snapshot.
 */
export interface LocationBalance {
  locationId: string;
  balance: number;
  lastMovementAt: string | null;
}

/**
 * A single inventory ledger entry representing an inventory movement.
 */
export interface LedgerEntry {
  id: string;
  tenantId: string;
  productId: string;
  locationId: string;
  movementType: string;
  quantityChange: number;
  runningBalance: number;
  operationEnvelopeId: string | null;
  vectorClock: Record<string, number>;
  createdAt: string;
}

/**
 * Interface for the Inventory Ledger service.
 */
export interface IInventoryLedger {
  /**
   * Record an inventory movement (sale, intake, transfer, adjustment, deduction)
   * and calculate the running balance for the given product+location.
   */
  recordMovement(params: {
    tenantId: string;
    productId: string;
    locationId: string;
    movementType: string;
    quantityChange: number;
    envelopeId?: string;
    vectorClock: Record<string, number>;
  }): Promise<LedgerEntry>;

  /**
   * Get the current balance for a product at a specific location.
   */
  getBalance(tenantId: string, productId: string, locationId: string): Promise<number>;

  /**
   * Get movement history for a product at a specific location.
   */
  getMovementHistory(
    tenantId: string,
    productId: string,
    locationId: string,
    limit?: number,
  ): Promise<LedgerEntry[]>;
}

/**
 * Raw ledger row from the database query result.
 */
interface RawLedgerRow {
  id: string;
  tenant_id: string;
  product_id: string;
  location_id: string;
  movement_type: string;
  quantity_change: Prisma.Decimal | string | number;
  running_balance: Prisma.Decimal | string | number;
  operation_envelope_id: string | null;
  vector_clock: Record<string, number>;
  created_at: Date | string;
}

/**
 * Inventory Ledger Service
 *
 * Records all inventory movements (sales, intake, transfers, adjustments)
 * with source envelope reference and calculates running balance per entry.
 *
 * Uses row-level locks (SELECT FOR UPDATE) within interactive transactions
 * to serialize inventory updates per product+location, preventing race conditions
 * in concurrent sync operations.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
@Injectable()
export class InventoryLedgerService implements IInventoryLedger {
  private readonly logger = new Logger(InventoryLedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════
  // Record Movement
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Record an inventory movement with serialized access via row-level lock.
   *
   * Acquires a lock on the latest ledger entry for the given product+location,
   * calculates the new running balance, and inserts the new entry atomically.
   * Aborts with a concurrency timeout error if the lock cannot be acquired
   * within 30 seconds.
   */
  async recordMovement(params: {
    tenantId: string;
    productId: string;
    locationId: string;
    movementType: string;
    quantityChange: number;
    envelopeId?: string;
    vectorClock: Record<string, number>;
  }): Promise<LedgerEntry> {
    const { tenantId, productId, locationId, movementType, quantityChange, envelopeId, vectorClock } = params;

    try {
      const entry = await this.prisma.$transaction(
        async (tx) => {
          // Acquire row-level lock on the latest ledger entry for this product+location
          const lockedRows = await tx.$queryRaw<RawLedgerRow[]>`
            SELECT id, tenant_id, product_id, location_id, movement_type,
                   quantity_change, running_balance, operation_envelope_id,
                   vector_clock, created_at
            FROM sync_inventory_ledger
            WHERE tenant_id = ${tenantId}
              AND product_id = ${productId}
              AND location_id = ${locationId}
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE NOWAIT
          `;

          // Calculate running balance
          const previousBalance =
            lockedRows.length > 0 ? Number(lockedRows[0].running_balance) : 0;
          const newRunningBalance = previousBalance + quantityChange;

          // Generate new entry ID
          const id = randomUUID();
          const now = new Date();

          // Insert new ledger entry
          await tx.$queryRaw`
            INSERT INTO sync_inventory_ledger (
              id, tenant_id, product_id, location_id, movement_type,
              quantity_change, running_balance, operation_envelope_id,
              vector_clock, created_at
            ) VALUES (
              ${id}, ${tenantId}, ${productId}, ${locationId}, ${movementType},
              ${quantityChange}::DECIMAL(12,4), ${newRunningBalance}::DECIMAL(12,4),
              ${envelopeId ?? null},
              ${JSON.stringify(vectorClock)}::JSONB, ${now}
            )
          `;

          return {
            id,
            tenantId,
            productId,
            locationId,
            movementType,
            quantityChange,
            runningBalance: newRunningBalance,
            operationEnvelopeId: envelopeId ?? null,
            vectorClock,
            createdAt: now.toISOString(),
          } satisfies LedgerEntry;
        },
        { timeout: 30000 },
      );

      this.logger.log(
        `Recorded ${movementType} movement for product=${productId} location=${locationId}: ` +
          `change=${quantityChange}, balance=${entry.runningBalance}`,
      );

      return entry;
    } catch (error: unknown) {
      // Handle lock acquisition failure (Prisma P2034 or PostgreSQL lock_not_available)
      if (this.isLockTimeoutError(error)) {
        const message =
          `concurrency timeout: unable to acquire lock for product=${productId} ` +
          `location=${locationId} within 30s`;
        this.logger.error(message);
        throw new Error(message);
      }
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Get Balance
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get the current inventory balance for a product at a specific location.
   * Returns 0 if no ledger entries exist.
   */
  async getBalance(
    tenantId: string,
    productId: string,
    locationId: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<Pick<RawLedgerRow, 'running_balance'>[]>`
      SELECT running_balance
      FROM sync_inventory_ledger
      WHERE tenant_id = ${tenantId}
        AND product_id = ${productId}
        AND location_id = ${locationId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return 0;
    }

    return Number(rows[0].running_balance);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Get Movement History
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Retrieve movement history for a product at a location, ordered by most recent first.
   */
  async getMovementHistory(
    tenantId: string,
    productId: string,
    locationId: string,
    limit: number = 50,
  ): Promise<LedgerEntry[]> {
    const rows = await this.prisma.$queryRaw<RawLedgerRow[]>`
      SELECT id, tenant_id, product_id, location_id, movement_type,
             quantity_change, running_balance, operation_envelope_id,
             vector_clock, created_at
      FROM sync_inventory_ledger
      WHERE tenant_id = ${tenantId}
        AND product_id = ${productId}
        AND location_id = ${locationId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => this.mapRowToEntry(row));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Map a raw database row to a typed LedgerEntry.
   */
  private mapRowToEntry(row: RawLedgerRow): LedgerEntry {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      locationId: row.location_id,
      movementType: row.movement_type,
      quantityChange: Number(row.quantity_change),
      runningBalance: Number(row.running_balance),
      operationEnvelopeId: row.operation_envelope_id,
      vectorClock: row.vector_clock as Record<string, number>,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Aggregate Reconciliation
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Reconcile aggregate inventory across all locations for a given product.
   *
   * 1. Query all per-location balances for the product
   * 2. Sum them to get the actual aggregate
   * 3. Compare with the expected total (passed as parameter)
   * 4. If discrepancy exceeds tolerance, create a reconciliation flag record
   *
   * @returns ReconciliationResult with details
   */
  async reconcileProduct(params: {
    tenantId: string;
    productId: string;
    expectedTotal: number;
    tolerance?: number;
  }): Promise<ReconciliationResult> {
    const { tenantId, productId, expectedTotal, tolerance = 0 } = params;

    const locationBalances = await this.getLocationBalances(tenantId, productId);

    const actualTotal = locationBalances.reduce((sum, lb) => sum + lb.balance, 0);
    const discrepancy = Math.abs(expectedTotal - actualTotal);
    const withinTolerance = discrepancy <= tolerance;

    let flagCreated = false;

    if (!withinTolerance) {
      const flagId = randomUUID();
      const affectedLocations = locationBalances.map((lb) => lb.locationId);

      await this.prisma.$queryRaw`
        INSERT INTO sync_reconciliation_flags (id, tenant_id, product_id, affected_locations, expected_total, actual_total, discrepancy, flagged_at)
        VALUES (${flagId}, ${tenantId}, ${productId}, ${affectedLocations}, ${expectedTotal}::DECIMAL(12,4), ${actualTotal}::DECIMAL(12,4), ${discrepancy}::DECIMAL(12,4), NOW())
      `;

      flagCreated = true;

      this.logger.warn(
        `Reconciliation discrepancy for product=${productId}: expected=${expectedTotal}, actual=${actualTotal}, discrepancy=${discrepancy}`,
      );
    }

    return {
      productId,
      expectedTotal,
      actualTotal,
      discrepancy,
      withinTolerance,
      flagCreated,
      locationBalances,
    };
  }

  /**
   * Get all per-location balances for a product across all locations.
   */
  async getLocationBalances(tenantId: string, productId: string): Promise<LocationBalance[]> {
    const rows = await this.prisma.$queryRaw<
      { location_id: string; running_balance: Prisma.Decimal | string | number; created_at: Date | string }[]
    >`
      SELECT DISTINCT ON (location_id) location_id, running_balance, created_at
      FROM sync_inventory_ledger
      WHERE tenant_id = ${tenantId} AND product_id = ${productId}
      ORDER BY location_id, created_at DESC
    `;

    return rows.map((row) => ({
      locationId: row.location_id,
      balance: Number(row.running_balance),
      lastMovementAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at
            ? String(row.created_at)
            : null,
    }));
  }

  /**
   * Determine if an error is a lock timeout / concurrency error.
   * Handles Prisma P2034 (transaction conflict) and PostgreSQL 55P03 (lock_not_available).
   */
  private isLockTimeoutError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Prisma interactive transaction timeout
      if (message.includes('p2034') || message.includes('transaction')) {
        return true;
      }
      // PostgreSQL lock_not_available (NOWAIT)
      if (message.includes('could not obtain lock') || message.includes('lock_not_available') || message.includes('55p03')) {
        return true;
      }
    }
    // Check for Prisma error code property
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const prismaError = error as { code: string };
      if (prismaError.code === 'P2034') {
        return true;
      }
    }
    return false;
  }
}
