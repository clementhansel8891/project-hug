/**
 * Property-Based Tests for Inventory Ledger Completeness.
 *
 * Uses fast-check (fc.assert / fc.asyncProperty) with vitest.
 * Each property runs a minimum of 100 iterations.
 *
 * // Feature: offline-sync, Property 14: Inventory Ledger Completeness
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * For any sequence of inventory movements (sales, intake, transfers, adjustments, deductions):
 * - Every recorded movement produces a ledger entry with correct fields
 * - Running balance is correctly calculated as the cumulative sum
 * - Movement history preserves all entries
 */

import { describe, test, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { InventoryLedgerService, LedgerEntry, ReconciliationResult, LocationBalance } from '../support/sync/inventory-ledger.service';

// ─── Constants ───────────────────────────────────────────────────────────────

const movementTypes = ['sale', 'intake', 'transfer_in', 'transfer_out', 'adjustment', 'deduction'];

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbMovementType = fc.constantFrom(...movementTypes);
const arbQuantityChange = fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true });
const arbProductId = fc.uuid();
const arbLocationId = fc.uuid();

// ─── Mock PrismaService ──────────────────────────────────────────────────────

/**
 * Creates a mock PrismaService that simulates database behavior in-memory.
 * Maintains an in-memory array of ledger entries and handles SELECT/INSERT queries.
 * Uses a sequence counter to guarantee stable insertion-order sorting (simulating
 * monotonically increasing timestamps like a real database).
 */
function createMockPrismaService() {
  let sequenceCounter = 0;

  const entries: Array<{
    id: string;
    tenant_id: string;
    product_id: string;
    location_id: string;
    movement_type: string;
    quantity_change: number;
    running_balance: number;
    operation_envelope_id: string | null;
    vector_clock: Record<string, number>;
    created_at: Date;
    _seq: number; // insertion order for stable sorting
  }> = [];

  /**
   * Parse a tagged template literal SQL query into a string for inspection.
   * Prisma uses tagged templates for $queryRaw, so we reconstruct the SQL text.
   */
  function extractQueryString(strings: TemplateStringsArray | string[], ...values: unknown[]): string {
    if (typeof strings === 'string') return strings;
    return strings.reduce((result, str, i) => {
      return result + str + (i < values.length ? `__PARAM_${i}__` : '');
    }, '');
  }

  /** Find the most recent entry matching product+location+tenant (by insertion order) */
  function findLatestEntry(tenantId: string, productId: string, locationId: string) {
    const matching = entries
      .filter(
        (e) =>
          e.tenant_id === tenantId &&
          e.product_id === productId &&
          e.location_id === locationId,
      )
      .sort((a, b) => b._seq - a._seq);
    return matching.length > 0 ? [matching[0]] : [];
  }

  /** Get all entries for a product+location+tenant (most recent first by insertion order) */
  function findAllEntries(tenantId: string, productId: string, locationId: string, limit: number = 50) {
    return entries
      .filter(
        (e) =>
          e.tenant_id === tenantId &&
          e.product_id === productId &&
          e.location_id === locationId,
      )
      .sort((a, b) => b._seq - a._seq)
      .slice(0, limit);
  }

  /**
   * Mock $queryRaw handler that interprets SELECT and INSERT queries.
   * For tagged template literals, we inspect the template strings to determine the query type,
   * and use the interpolated values as parameters.
   */
  function createQueryRawMock() {
    return async function $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> {
      const queryText = extractQueryString(strings, ...values);
      const upperQuery = queryText.toUpperCase();

      if (upperQuery.includes('SELECT')) {
        // Extract parameters: tenantId, productId, locationId are the first 3 values
        const tenantId = values[0] as string;
        const productId = values[1] as string;
        const locationId = values[2] as string;

        if (upperQuery.includes('LIMIT 1')) {
          return findLatestEntry(tenantId, productId, locationId);
        }

        // For movement history queries with custom limit
        const limit = typeof values[3] === 'number' ? values[3] : 50;
        return findAllEntries(tenantId, productId, locationId, limit);
      }

      if (upperQuery.includes('INSERT')) {
        // INSERT parameters order matches the service:
        // id, tenantId, productId, locationId, movementType,
        // quantityChange, runningBalance, envelopeId, vectorClock (JSON string), now
        const entry = {
          id: values[0] as string,
          tenant_id: values[1] as string,
          product_id: values[2] as string,
          location_id: values[3] as string,
          movement_type: values[4] as string,
          quantity_change: values[5] as number,
          running_balance: values[6] as number,
          operation_envelope_id: values[7] as string | null,
          vector_clock: JSON.parse(values[8] as string),
          created_at: values[9] as Date,
          _seq: sequenceCounter++,
        };
        entries.push(entry);
        return [];
      }

      return [];
    };
  }

  const queryRawMock = createQueryRawMock();

  const mockPrisma = {
    $transaction: async (callback: (tx: { $queryRaw: typeof queryRawMock }) => Promise<unknown>, _options?: unknown) => {
      const tx = { $queryRaw: queryRawMock };
      return callback(tx);
    },
    $queryRaw: queryRawMock,
  };

  return { mockPrisma, entries };
}

// ─── Property 14: Inventory Ledger Completeness ──────────────────────────────
// Feature: offline-sync, Property 14: Inventory Ledger Completeness

describe('Property 14: Inventory Ledger Completeness', () => {
  let mockPrisma: ReturnType<typeof createMockPrismaService>['mockPrisma'];
  let service: InventoryLedgerService;

  beforeEach(() => {
    const mock = createMockPrismaService();
    mockPrisma = mock.mockPrisma;
    service = new InventoryLedgerService(mockPrisma as any);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 14.1: Every recorded movement produces a ledger entry
  // ═══════════════════════════════════════════════════════════════════════

  test('Every recorded movement produces a ledger entry with correct fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbMovementType,
        arbQuantityChange,
        arbProductId,
        arbLocationId,
        fc.option(fc.uuid(), { nil: undefined }),
        async (movementType, quantityChange, productId, locationId, envelopeId) => {
          // Create a fresh service for each iteration to avoid state leakage
          const mock = createMockPrismaService();
          const svc = new InventoryLedgerService(mock.mockPrisma as any);

          const entry = await svc.recordMovement({
            tenantId: 'tenant-test',
            productId,
            locationId,
            movementType,
            quantityChange,
            envelopeId,
            vectorClock: { node1: 1 },
          });

          // Assert matching fields
          expect(entry.productId).toBe(productId);
          expect(entry.locationId).toBe(locationId);
          expect(entry.movementType).toBe(movementType);
          expect(entry.quantityChange).toBe(quantityChange);
          expect(entry.operationEnvelopeId).toBe(envelopeId ?? null);

          // Assert id is a non-empty string
          expect(typeof entry.id).toBe('string');
          expect(entry.id.length).toBeGreaterThan(0);

          // Assert createdAt is a valid ISO timestamp
          const parsedDate = new Date(entry.createdAt);
          expect(parsedDate.toISOString()).toBe(entry.createdAt);
          expect(Number.isNaN(parsedDate.getTime())).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 14.2: Running balance is correctly calculated
  // ═══════════════════════════════════════════════════════════════════════

  test('Running balance is correctly calculated as cumulative sum of quantity changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(arbMovementType, arbQuantityChange),
          { minLength: 2, maxLength: 10 },
        ),
        arbProductId,
        arbLocationId,
        async (movements, productId, locationId) => {
          // Create a fresh service for each iteration
          const mock = createMockPrismaService();
          const svc = new InventoryLedgerService(mock.mockPrisma as any);

          let expectedBalance = 0;

          for (const [movementType, quantityChange] of movements) {
            expectedBalance += quantityChange;

            const entry = await svc.recordMovement({
              tenantId: 'tenant-test',
              productId,
              locationId,
              movementType,
              quantityChange,
              vectorClock: { node1: 1 },
            });

            // Assert running balance matches expected cumulative sum
            expect(entry.runningBalance).toBeCloseTo(expectedBalance, 8);
          }

          // Verify getBalance returns the final running balance
          const balance = await svc.getBalance('tenant-test', productId, locationId);
          expect(balance).toBeCloseTo(expectedBalance, 8);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 14.3: Movement history preserves all entries
  // ═══════════════════════════════════════════════════════════════════════

  test('Movement history preserves all entries with correct data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(arbMovementType, arbQuantityChange),
          { minLength: 2, maxLength: 10 },
        ),
        arbProductId,
        arbLocationId,
        async (movements, productId, locationId) => {
          // Create a fresh service for each iteration
          const mock = createMockPrismaService();
          const svc = new InventoryLedgerService(mock.mockPrisma as any);

          // Record all movements
          for (const [movementType, quantityChange] of movements) {
            await svc.recordMovement({
              tenantId: 'tenant-test',
              productId,
              locationId,
              movementType,
              quantityChange,
              vectorClock: { node1: 1 },
            });
          }

          // Get movement history
          const history = await svc.getMovementHistory('tenant-test', productId, locationId);

          // Assert all N entries are returned
          expect(history.length).toBe(movements.length);

          // History is returned in reverse chronological order, so reverse to match original order
          const chronological = [...history].reverse();

          // Each entry has correct productId, locationId, movementType, quantityChange
          for (let i = 0; i < movements.length; i++) {
            const [expectedType, expectedChange] = movements[i];
            const entry = chronological[i];

            expect(entry.productId).toBe(productId);
            expect(entry.locationId).toBe(locationId);
            expect(entry.movementType).toBe(expectedType);
            expect(entry.quantityChange).toBeCloseTo(expectedChange, 8);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ─── Enhanced Mock for Aggregate Reconciliation ──────────────────────────────

/**
 * Creates an enhanced mock PrismaService that extends the base mock with support for:
 * - DISTINCT ON (location_id) queries for getLocationBalances
 * - INSERT INTO sync_reconciliation_flags for reconciliation flagging
 * - A separate flag store for verification
 */
function createReconciliationMockPrismaService() {
  let sequenceCounter = 0;

  const entries: Array<{
    id: string;
    tenant_id: string;
    product_id: string;
    location_id: string;
    movement_type: string;
    quantity_change: number;
    running_balance: number;
    operation_envelope_id: string | null;
    vector_clock: Record<string, number>;
    created_at: Date;
    _seq: number;
  }> = [];

  const reconciliationFlags: Array<{
    id: string;
    tenant_id: string;
    product_id: string;
    affected_locations: string[];
    expected_total: number;
    actual_total: number;
    discrepancy: number;
    flagged_at: string;
  }> = [];

  function extractQueryString(strings: TemplateStringsArray | string[], ...values: unknown[]): string {
    if (typeof strings === 'string') return strings;
    return strings.reduce((result, str, i) => {
      return result + str + (i < values.length ? `__PARAM_${i}__` : '');
    }, '');
  }

  function findLatestEntry(tenantId: string, productId: string, locationId: string) {
    const matching = entries
      .filter(
        (e) =>
          e.tenant_id === tenantId &&
          e.product_id === productId &&
          e.location_id === locationId,
      )
      .sort((a, b) => b._seq - a._seq);
    return matching.length > 0 ? [matching[0]] : [];
  }

  function findAllEntries(tenantId: string, productId: string, locationId: string, limit: number = 50) {
    return entries
      .filter(
        (e) =>
          e.tenant_id === tenantId &&
          e.product_id === productId &&
          e.location_id === locationId,
      )
      .sort((a, b) => b._seq - a._seq)
      .slice(0, limit);
  }

  /**
   * Get the latest entry per location_id for a given tenant+product.
   * Simulates: SELECT DISTINCT ON (location_id) ... ORDER BY location_id, created_at DESC
   */
  function getDistinctLocationBalances(tenantId: string, productId: string) {
    const matching = entries.filter(
      (e) => e.tenant_id === tenantId && e.product_id === productId,
    );

    // Group by location_id, keep the one with highest _seq (latest)
    const latestByLocation = new Map<string, typeof entries[number]>();
    for (const entry of matching) {
      const existing = latestByLocation.get(entry.location_id);
      if (!existing || entry._seq > existing._seq) {
        latestByLocation.set(entry.location_id, entry);
      }
    }

    return Array.from(latestByLocation.values()).map((e) => ({
      location_id: e.location_id,
      running_balance: e.running_balance,
      created_at: e.created_at,
    }));
  }

  function createQueryRawMock() {
    return async function $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> {
      const queryText = extractQueryString(strings, ...values);
      const upperQuery = queryText.toUpperCase();

      // Handle DISTINCT ON (location_id) query for getLocationBalances
      if (upperQuery.includes('DISTINCT ON') && upperQuery.includes('LOCATION_ID')) {
        const tenantId = values[0] as string;
        const productId = values[1] as string;
        return getDistinctLocationBalances(tenantId, productId);
      }

      // Handle INSERT INTO sync_reconciliation_flags
      if (upperQuery.includes('INSERT') && upperQuery.includes('SYNC_RECONCILIATION_FLAGS')) {
        const flag = {
          id: values[0] as string,
          tenant_id: values[1] as string,
          product_id: values[2] as string,
          affected_locations: values[3] as string[],
          expected_total: values[4] as number,
          actual_total: values[5] as number,
          discrepancy: values[6] as number,
          flagged_at: new Date().toISOString(),
        };
        reconciliationFlags.push(flag);
        return [];
      }

      if (upperQuery.includes('SELECT')) {
        const tenantId = values[0] as string;
        const productId = values[1] as string;
        const locationId = values[2] as string;

        if (upperQuery.includes('LIMIT 1')) {
          return findLatestEntry(tenantId, productId, locationId);
        }

        const limit = typeof values[3] === 'number' ? values[3] : 50;
        return findAllEntries(tenantId, productId, locationId, limit);
      }

      if (upperQuery.includes('INSERT')) {
        const entry = {
          id: values[0] as string,
          tenant_id: values[1] as string,
          product_id: values[2] as string,
          location_id: values[3] as string,
          movement_type: values[4] as string,
          quantity_change: values[5] as number,
          running_balance: values[6] as number,
          operation_envelope_id: values[7] as string | null,
          vector_clock: JSON.parse(values[8] as string),
          created_at: values[9] as Date,
          _seq: sequenceCounter++,
        };
        entries.push(entry);
        return [];
      }

      return [];
    };
  }

  const queryRawMock = createQueryRawMock();

  const mockPrisma = {
    $transaction: async (callback: (tx: { $queryRaw: typeof queryRawMock }) => Promise<unknown>, _options?: unknown) => {
      const tx = { $queryRaw: queryRawMock };
      return callback(tx);
    },
    $queryRaw: queryRawMock,
  };

  return { mockPrisma, entries, reconciliationFlags };
}

// ─── Property 15: Aggregate Inventory Consistency ────────────────────────────
// Feature: offline-sync, Property 15: Aggregate Inventory Consistency (Task 5.4)
//
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
//
// For any set of per-location inventory movements:
// - The aggregate total across all locations must equal the sum of per-location balances
// - Discrepancies exceeding tolerance must create reconciliation flags
// - Zero tolerance must catch any non-zero discrepancy

describe('Property 15: Aggregate Inventory Consistency', () => {
  // ═══════════════════════════════════════════════════════════════════════
  // Property 15.1: After sync, aggregate equals sum of all per-location balances
  // ═══════════════════════════════════════════════════════════════════════

  test('After sync, aggregate equals sum of all per-location balances', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-5 location IDs
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }),
        // Generate a product ID
        fc.uuid(),
        async (locationIds, productId) => {
          const { mockPrisma, reconciliationFlags } = createReconciliationMockPrismaService();
          const svc = new InventoryLedgerService(mockPrisma as any);
          const tenantId = 'tenant-reconcile';

          // For each location, record 1-5 movements
          let expectedSum = 0;
          for (const locationId of locationIds) {
            const numMovements = Math.floor(Math.random() * 5) + 1;
            let locationBalance = 0;
            for (let i = 0; i < numMovements; i++) {
              const change = Math.round((Math.random() * 200 - 100) * 100) / 100;
              locationBalance += change;
              await svc.recordMovement({
                tenantId,
                productId,
                locationId,
                movementType: 'adjustment',
                quantityChange: change,
                vectorClock: { node1: i + 1 },
              });
            }
            expectedSum += locationBalance;
          }

          // Call reconcileProduct with expectedTotal = actual sum
          const result: ReconciliationResult = await svc.reconcileProduct({
            tenantId,
            productId,
            expectedTotal: expectedSum,
            tolerance: 0.001, // small floating-point tolerance
          });

          // Assert: actualTotal === expectedTotal (within fp tolerance)
          expect(result.actualTotal).toBeCloseTo(expectedSum, 4);
          expect(result.withinTolerance).toBe(true);
          expect(result.flagCreated).toBe(false);
          expect(reconciliationFlags.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 15.2: Discrepancy exceeding tolerance creates reconciliation flag
  // ═══════════════════════════════════════════════════════════════════════

  test('Discrepancy exceeding tolerance creates reconciliation flag', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }),
        fc.uuid(),
        // Tolerance value between 1 and 50
        fc.double({ min: 1, max: 50, noNaN: true, noDefaultInfinity: true }),
        // Extra offset that makes discrepancy exceed tolerance (tolerance + 1 to tolerance + 100)
        fc.double({ min: 1, max: 100, noNaN: true, noDefaultInfinity: true }),
        async (locationIds, productId, tolerance, extraOffset) => {
          const { mockPrisma, reconciliationFlags } = createReconciliationMockPrismaService();
          const svc = new InventoryLedgerService(mockPrisma as any);
          const tenantId = 'tenant-reconcile';

          // Record movements across locations
          let actualTotal = 0;
          for (const locationId of locationIds) {
            const numMovements = Math.floor(Math.random() * 5) + 1;
            let locationBalance = 0;
            for (let i = 0; i < numMovements; i++) {
              const change = Math.round((Math.random() * 200 - 100) * 100) / 100;
              locationBalance += change;
              await svc.recordMovement({
                tenantId,
                productId,
                locationId,
                movementType: 'intake',
                quantityChange: change,
                vectorClock: { node1: i + 1 },
              });
            }
            actualTotal += locationBalance;
          }

          // Set expectedTotal to differ from actual by MORE than tolerance
          const wrongExpectedTotal = actualTotal + tolerance + extraOffset;

          const result: ReconciliationResult = await svc.reconcileProduct({
            tenantId,
            productId,
            expectedTotal: wrongExpectedTotal,
            tolerance,
          });

          // Assert: withinTolerance is false and flag was created
          expect(result.withinTolerance).toBe(false);
          expect(result.flagCreated).toBe(true);
          expect(result.discrepancy).toBeGreaterThan(tolerance);
          expect(reconciliationFlags.length).toBe(1);
          expect(reconciliationFlags[0].product_id).toBe(productId);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 15.3: Zero tolerance catches any discrepancy
  // ═══════════════════════════════════════════════════════════════════════

  test('Zero tolerance catches any discrepancy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }),
        fc.uuid(),
        // Small nonzero offset between 1 and 10
        fc.integer({ min: 1, max: 10 }),
        async (locationIds, productId, offset) => {
          const { mockPrisma, reconciliationFlags } = createReconciliationMockPrismaService();
          const svc = new InventoryLedgerService(mockPrisma as any);
          const tenantId = 'tenant-reconcile';

          // Record movements across locations
          let actualTotal = 0;
          for (const locationId of locationIds) {
            const numMovements = Math.floor(Math.random() * 5) + 1;
            let locationBalance = 0;
            for (let i = 0; i < numMovements; i++) {
              const change = Math.round((Math.random() * 200 - 100) * 100) / 100;
              locationBalance += change;
              await svc.recordMovement({
                tenantId,
                productId,
                locationId,
                movementType: 'sale',
                quantityChange: change,
                vectorClock: { node1: i + 1 },
              });
            }
            actualTotal += locationBalance;
          }

          // Set expectedTotal to actual + small nonzero offset
          const wrongExpectedTotal = actualTotal + offset;

          // Call with tolerance = 0 (default)
          const result: ReconciliationResult = await svc.reconcileProduct({
            tenantId,
            productId,
            expectedTotal: wrongExpectedTotal,
          });

          // Assert: zero tolerance catches the discrepancy
          expect(result.withinTolerance).toBe(false);
          expect(result.flagCreated).toBe(true);
          expect(result.discrepancy).toBeGreaterThan(0);
          expect(reconciliationFlags.length).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});
