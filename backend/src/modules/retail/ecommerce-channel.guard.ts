import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { EventEmitter } from 'events';
import { PrismaService } from '../../persistence/prisma.service';

export interface StockValidation {
  available: boolean;
  currentStock: number;
  reservedForEcommerce: number;
  effectiveAvailable: number;
  reason?: string;
}

export interface StockUpdateParams {
  tenantId: string;
  productId: string;
  newStock: number;
  locationId: string;
}

export interface IEcommerceChannelGuard {
  /**
   * Validate whether a given quantity can be fulfilled from available stock
   * after accounting for the ecommerce reserve threshold.
   */
  validateStock(productId: string, quantity: number, tenantId: string): Promise<StockValidation>;

  /**
   * Get the configured reserve percentage for a product (default: 20%).
   */
  getReservePercentage(productId: string, tenantId: string): Promise<number>;

  /**
   * Validate a physical deduction during sync — rejects if it would breach
   * the ecommerce reservation.
   */
  validatePhysicalDeduction(params: {
    productId: string;
    quantity: number;
    tenantId: string;
    locationId: string;
    envelopeId: string;
  }): Promise<StockValidation & { flaggedForReview: boolean }>;

  /**
   * Returns whether the guard is currently in maintenance mode.
   */
  isInMaintenanceMode(): boolean;

  /**
   * Returns the current consecutive timeout count.
   */
  getConsecutiveTimeouts(): number;

  /**
   * Attempts a lightweight DB query to check recovery.
   * If successful, exits maintenance mode.
   */
  checkRecovery(): Promise<boolean>;

  /**
   * Emits a stock_level_update event for Socket.IO integration.
   */
  emitStockUpdate(params: StockUpdateParams): void;
}

/**
 * Raw result from the total stock aggregation query.
 */
interface TotalStockRow {
  total_stock: number | string;
}

/**
 * Raw result from the reserve percentage query.
 */
interface ReserveRow {
  reserve_percentage: number | string;
}

/** Timeout threshold in milliseconds for DB queries */
const DB_TIMEOUT_MS = 5000;

/** Number of consecutive timeouts before entering maintenance mode */
const MAINTENANCE_THRESHOLD = 2;

/**
 * Ecommerce Channel Guard
 *
 * Validates stock availability accounting for configured reserve percentages,
 * rejecting orders that would breach ecommerce reservations. Physical deductions
 * during sync are flagged for manager review when they would breach the reserve.
 *
 * Includes maintenance mode after consecutive DB timeouts and Socket.IO stock
 * update emission for real-time notifications.
 */
@Injectable()
export class EcommerceChannelGuard implements IEcommerceChannelGuard {
  private readonly logger = new Logger(EcommerceChannelGuard.name);

  private static readonly DEFAULT_RESERVE_PERCENTAGE = 20;

  // Maintenance mode state
  private consecutiveTimeouts: number = 0;
  private maintenanceMode: boolean = false;
  private maintenanceModeEnteredAt: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject('STOCK_EVENT_EMITTER') private readonly eventEmitter?: EventEmitter,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // Maintenance Mode
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Returns whether the guard is currently in maintenance mode.
   */
  isInMaintenanceMode(): boolean {
    return this.maintenanceMode;
  }

  /**
   * Returns the current consecutive timeout count.
   */
  getConsecutiveTimeouts(): number {
    return this.consecutiveTimeouts;
  }

  /**
   * Attempts a lightweight DB query to check if connectivity is restored.
   * If successful, exits maintenance mode and resets timeout counter.
   * Returns true if recovery was successful, false otherwise.
   */
  async checkRecovery(): Promise<boolean> {
    try {
      await this.executeWithTimeout(
        this.prisma.$queryRaw`SELECT 1`,
        DB_TIMEOUT_MS,
      );

      if (this.maintenanceMode) {
        this.maintenanceMode = false;
        this.consecutiveTimeouts = 0;
        this.logger.log(
          `Ecommerce channel guard recovered from maintenance mode. ` +
            `Was in maintenance since: ${this.maintenanceModeEnteredAt?.toISOString() ?? 'unknown'}`,
        );
        this.maintenanceModeEnteredAt = null;
      }

      return true;
    } catch {
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Stock Update Emission
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Emits a stock_level_update event for downstream Socket.IO integration.
   * No-op if no event emitter is configured.
   */
  emitStockUpdate(params: StockUpdateParams): void {
    this.eventEmitter?.emit('stock_level_update', params);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Validate Stock
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Validate whether a given quantity can be fulfilled from available stock
   * after accounting for the ecommerce reserve threshold.
   *
   * Calculates total stock across all locations using the latest running_balance
   * per location, then applies the reserve percentage to determine effective
   * available stock.
   *
   * Returns a maintenance mode response if the guard is in maintenance mode.
   */
  async validateStock(
    productId: string,
    quantity: number,
    tenantId: string,
  ): Promise<StockValidation> {
    if (this.maintenanceMode) {
      return {
        available: false,
        currentStock: 0,
        reservedForEcommerce: 0,
        effectiveAvailable: 0,
        reason: 'Ecommerce channel in maintenance mode due to database connectivity issues',
      };
    }

    try {
      const currentStock = await this.getTotalStock(tenantId, productId);
      const reservePercentage = await this.getReservePercentage(productId, tenantId);

      // Reset consecutive timeouts on success
      this.consecutiveTimeouts = 0;

      const reservedForEcommerce = currentStock * (reservePercentage / 100);
      const effectiveAvailable = currentStock - reservedForEcommerce;
      const available = effectiveAvailable >= quantity;

      const result: StockValidation = {
        available,
        currentStock,
        reservedForEcommerce,
        effectiveAvailable,
      };

      if (!available) {
        result.reason =
          `Insufficient stock: requested ${quantity}, but only ${effectiveAvailable.toFixed(2)} ` +
          `available after reserving ${reservePercentage}% (${reservedForEcommerce.toFixed(2)}) for ecommerce`;
      }

      return result;
    } catch (error) {
      this.handleTimeoutError(error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Get Reserve Percentage
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get the configured reserve percentage for a product.
   * Returns the default (20%) if no record exists for the tenant+product.
   */
  async getReservePercentage(productId: string, tenantId: string): Promise<number> {
    const rows = await this.executeWithTimeout(
      this.prisma.$queryRaw<ReserveRow[]>`
        SELECT reserve_percentage FROM sync_ecommerce_reserve
        WHERE tenant_id = ${tenantId} AND product_id = ${productId}
        LIMIT 1
      `,
      DB_TIMEOUT_MS,
    );

    if (rows.length === 0) {
      return EcommerceChannelGuard.DEFAULT_RESERVE_PERCENTAGE;
    }

    return Number(rows[0].reserve_percentage);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Validate Physical Deduction
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Validate a physical deduction during sync. Uses the same stock validation
   * logic but additionally flags rejected deductions for manager review and
   * logs the envelope ID for traceability.
   */
  async validatePhysicalDeduction(params: {
    productId: string;
    quantity: number;
    tenantId: string;
    locationId: string;
    envelopeId: string;
  }): Promise<StockValidation & { flaggedForReview: boolean }> {
    const { productId, quantity, tenantId, locationId, envelopeId } = params;

    const validation = await this.validateStock(productId, quantity, tenantId);
    const flaggedForReview = !validation.available;

    if (flaggedForReview) {
      this.logger.warn(
        `Physical deduction REJECTED — would breach ecommerce reserve. ` +
          `envelopeId=${envelopeId}, product=${productId}, location=${locationId}, ` +
          `requested=${quantity}, effectiveAvailable=${validation.effectiveAvailable.toFixed(2)}, ` +
          `reserved=${validation.reservedForEcommerce.toFixed(2)}. Flagged for manager review.`,
      );
    }

    return {
      ...validation,
      flaggedForReview,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get total stock for a product across all locations by summing the latest
   * running_balance per location from the inventory ledger.
   */
  private async getTotalStock(tenantId: string, productId: string): Promise<number> {
    const rows = await this.executeWithTimeout(
      this.prisma.$queryRaw<TotalStockRow[]>`
        SELECT COALESCE(SUM(running_balance), 0) as total_stock
        FROM (
          SELECT DISTINCT ON (location_id) running_balance
          FROM sync_inventory_ledger
          WHERE tenant_id = ${tenantId} AND product_id = ${productId}
          ORDER BY location_id, created_at DESC
        ) latest_balances
      `,
      DB_TIMEOUT_MS,
    );

    if (rows.length === 0) {
      return 0;
    }

    return Number(rows[0].total_stock);
  }

  /**
   * Execute a promise with a timeout. Rejects with a timeout error if the
   * promise does not resolve within the specified duration.
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Database query timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutHandle!);
      return result;
    } catch (error) {
      clearTimeout(timeoutHandle!);
      throw error;
    }
  }

  /**
   * Handles a timeout error by incrementing the consecutive timeout counter
   * and entering maintenance mode if the threshold is reached.
   */
  private handleTimeoutError(error: unknown): void {
    const isTimeout =
      error instanceof Error &&
      error.message.includes('timed out');

    if (isTimeout) {
      this.consecutiveTimeouts++;
      this.logger.warn(
        `Database timeout detected (consecutive: ${this.consecutiveTimeouts}/${MAINTENANCE_THRESHOLD})`,
      );

      if (this.consecutiveTimeouts >= MAINTENANCE_THRESHOLD && !this.maintenanceMode) {
        this.maintenanceMode = true;
        this.maintenanceModeEnteredAt = new Date();
        this.logger.warn(
          `Ecommerce channel guard entering MAINTENANCE MODE after ${this.consecutiveTimeouts} ` +
            `consecutive database timeouts. Stock validation will return unavailable until recovery.`,
        );
      }
    }
  }
}
