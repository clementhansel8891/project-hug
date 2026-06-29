/**
 * Property-Based Tests for Ecommerce Safety Stock Enforcement.
 *
 * Uses fast-check (fc.assert / fc.asyncProperty) with vitest.
 * Each property runs a minimum of 100 iterations.
 *
 * // Feature: offline-sync, Property 12: Ecommerce Safety Stock Enforcement
 *
 * **Validates:**
 * - Orders rejected when available minus reserved falls below zero
 * - Orders accepted when available minus reserved covers the request
 * - Default reserve percentage is 20% when no record exists
 * - Physical deductions flagged for review when they would breach reserve
 * - Physical deductions NOT flagged when within limits
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { EcommerceChannelGuard, StockValidation } from '../modules/retail/ecommerce-channel.guard';

// ─── Mock PrismaService ──────────────────────────────────────────────────────

/**
 * Creates a mock PrismaService that returns configurable total_stock and
 * reserve_percentage values based on the SQL query being executed.
 *
 * - Queries containing 'sync_inventory_ledger' (total stock): returns totalStock
 * - Queries containing 'sync_ecommerce_reserve': returns reservePercentage, or empty array for default
 */
function createMockPrisma(totalStock: number, reservePercentage: number | null) {
  return {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join('');
      if (query.includes('sync_ecommerce_reserve')) {
        return reservePercentage !== null ? [{ reserve_percentage: reservePercentage }] : [];
      }
      if (query.includes('sync_inventory_ledger') || query.includes('total_stock')) {
        return [{ total_stock: totalStock }];
      }
      return [];
    },
  };
}

// ─── Property 12: Ecommerce Safety Stock Enforcement ─────────────────────────
// Feature: offline-sync, Property 12: Ecommerce Safety Stock Enforcement

describe('Property 12: Ecommerce Safety Stock Enforcement', () => {
  // ═══════════════════════════════════════════════════════════════════════
  // Property 12.1: Orders rejected when available minus reserved falls below zero
  // ═══════════════════════════════════════════════════════════════════════

  test('Orders rejected when available minus reserved falls below zero', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 1000 }),
        fc.integer({ min: 5, max: 50 }),
        async (currentStock, reservePercentage) => {
          const effectiveAvailable = currentStock * (1 - reservePercentage / 100);
          // requestedQuantity must exceed effectiveAvailable
          const requestedQuantity = Math.ceil(effectiveAvailable) + 1;

          const mockPrisma = createMockPrisma(currentStock, reservePercentage);
          const guard = new EcommerceChannelGuard(mockPrisma as any);

          const result: StockValidation = await guard.validateStock(
            'product-1',
            requestedQuantity,
            'tenant-1',
          );

          expect(result.available).toBe(false);
          expect(result.reason).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 12.2: Orders accepted when available minus reserved covers the request
  // ═══════════════════════════════════════════════════════════════════════

  test('Orders accepted when available minus reserved covers the request', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 5, max: 50 }),
        async (currentStock, reservePercentage) => {
          const effectiveAvailable = currentStock * (1 - reservePercentage / 100);
          // requestedQuantity must be <= effectiveAvailable
          const requestedQuantity = Math.max(1, Math.floor(effectiveAvailable));

          const mockPrisma = createMockPrisma(currentStock, reservePercentage);
          const guard = new EcommerceChannelGuard(mockPrisma as any);

          const result: StockValidation = await guard.validateStock(
            'product-1',
            requestedQuantity,
            'tenant-1',
          );

          expect(result.available).toBe(true);
          expect(result.reason).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 12.3: Default reserve percentage is 20% when no record exists
  // ═══════════════════════════════════════════════════════════════════════

  test('Default reserve percentage is 20% when no record exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 500 }),
        async (currentStock, requestedQuantity) => {
          // reservePercentage = null means no record → default 20%
          const mockPrisma = createMockPrisma(currentStock, null);
          const guard = new EcommerceChannelGuard(mockPrisma as any);

          const result: StockValidation = await guard.validateStock(
            'product-1',
            requestedQuantity,
            'tenant-1',
          );

          const expectedReserved = currentStock * 0.2;
          expect(result.reservedForEcommerce).toBeCloseTo(expectedReserved, 8);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 12.4: Physical deductions flagged for review when they would breach reserve
  // ═══════════════════════════════════════════════════════════════════════

  test('Physical deductions flagged for review when they would breach reserve', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 1000 }),
        fc.integer({ min: 5, max: 50 }),
        async (currentStock, reservePercentage) => {
          const effectiveAvailable = currentStock * (1 - reservePercentage / 100);
          // quantity exceeds effectiveAvailable → should be flagged
          const quantity = Math.ceil(effectiveAvailable) + 1;

          const mockPrisma = createMockPrisma(currentStock, reservePercentage);
          const guard = new EcommerceChannelGuard(mockPrisma as any);

          const result = await guard.validatePhysicalDeduction({
            productId: 'product-1',
            quantity,
            tenantId: 'tenant-1',
            locationId: 'location-1',
            envelopeId: 'envelope-1',
          });

          expect(result.flaggedForReview).toBe(true);
          expect(result.available).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 12.5: Physical deductions NOT flagged when within limits
  // ═══════════════════════════════════════════════════════════════════════

  test('Physical deductions NOT flagged when within limits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 5, max: 50 }),
        async (currentStock, reservePercentage) => {
          const effectiveAvailable = currentStock * (1 - reservePercentage / 100);
          // quantity within effectiveAvailable → should NOT be flagged
          const quantity = Math.max(1, Math.floor(effectiveAvailable));

          const mockPrisma = createMockPrisma(currentStock, reservePercentage);
          const guard = new EcommerceChannelGuard(mockPrisma as any);

          const result = await guard.validatePhysicalDeduction({
            productId: 'product-1',
            quantity,
            tenantId: 'tenant-1',
            locationId: 'location-1',
            envelopeId: 'envelope-1',
          });

          expect(result.flaggedForReview).toBe(false);
          expect(result.available).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
