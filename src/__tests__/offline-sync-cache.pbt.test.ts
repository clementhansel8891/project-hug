/**
 * Property-Based Tests for Offline Store — Read Cache Consistency
 *
 * Uses fast-check (fc.assert / fc.asyncProperty) with vitest.
 * Each property runs a minimum of 100 iterations.
 *
 * // Feature: offline-sync, Property 13: Read-Your-Writes Consistency
 *
 * **Validates: Requirements 6.6**
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { OfflineStoreService } from '@/lib/offline-store/offline-store.service';
import type { OfflineStoreConfig, OperationType } from '@/lib/offline-store/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

let tenantCounter = 0;

function makeConfig(overrides: Partial<OfflineStoreConfig> = {}): OfflineStoreConfig {
  return {
    tenantId: `pbt-cache-tenant-${++tenantCounter}-${Date.now()}`,
    branchId: 'branch-pbt',
    locationId: 'location-pbt',
    offlineToleranceThreshold: 500,
    retentionDays: 7,
    ...overrides,
  };
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

/** Generate an arbitrary product ID */
const arbProductId = () =>
  fc.uuid().map((id) => `product-${id}`);

/** Generate an arbitrary customer ID */
const arbCustomerId = () =>
  fc.uuid().map((id) => `customer-${id}`);

/** Generate an arbitrary product payload for local modification */
const arbProductPayload = (productId: string) =>
  fc.record({
    productId: fc.constant(productId),
    name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
    quantity: fc.integer({ min: 0, max: 10000 }),
    sku: fc.string({ minLength: 3, maxLength: 12 }).filter((s) => /^[A-Za-z0-9]+$/.test(s)),
  });

/** Generate an arbitrary price payload for local modification */
const arbPricePayload = (productId: string) =>
  fc.record({
    productId: fc.constant(productId),
    unitPrice: fc.double({ min: 0.01, max: 99999.99, noNaN: true, noDefaultInfinity: true }),
    discountPercent: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  });

/** Generate an arbitrary customer payload for local modification */
const arbCustomerPayload = (customerId: string) =>
  fc.record({
    customerId: fc.constant(customerId),
    name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
    email: fc.emailAddress(),
  });

/** Generate a server-confirmed product record */
const arbServerProduct = (productId: string) =>
  fc.record({
    id: fc.constant(productId),
    name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
    quantity: fc.integer({ min: 0, max: 10000 }),
    sku: fc.string({ minLength: 3, maxLength: 12 }).filter((s) => /^[A-Za-z0-9]+$/.test(s)),
    updatedAt: fc.constant(new Date().toISOString()),
  });

/** Generate a server-confirmed price record */
const arbServerPrice = (productId: string) =>
  fc.record({
    productId: fc.constant(productId),
    unitPrice: fc.double({ min: 0.01, max: 99999.99, noNaN: true, noDefaultInfinity: true }),
    discountPercent: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    updatedAt: fc.constant(new Date().toISOString()),
  });

/** Generate a server-confirmed customer record */
const arbServerCustomer = (customerId: string) =>
  fc.record({
    id: fc.constant(customerId),
    name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
    email: fc.emailAddress(),
    updatedAt: fc.constant(new Date().toISOString()),
    lastAccessedAt: fc.constant(new Date().toISOString()),
  });

// ─── Property 13: Read-Your-Writes Consistency ──────────────────────────────

describe('Property 13: Read-Your-Writes Consistency', () => {
  let store: OfflineStoreService;
  let config: OfflineStoreConfig;

  beforeEach(async () => {
    store = new OfflineStoreService();
    config = makeConfig();
    await store.initialize(config);
  });

  afterEach(async () => {
    await store.close();
  });

  test('reads return locally modified version for products until sync acknowledgment', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbProductId(),
        fc.uuid(),
        async (productId, sessionId) => {
          // Create a fresh store for isolation
          const localStore = new OfflineStoreService();
          const localConfig = makeConfig();
          await localStore.initialize(localConfig);

          // Seed the cache with an original product
          const originalProduct = {
            id: productId,
            name: 'Original Product',
            quantity: 100,
            sku: 'ORIG001',
            updatedAt: new Date().toISOString(),
          };
          await localStore.updateCache('products', [originalProduct]);

          // Generate a local modification payload
          const localPayload = {
            productId,
            name: 'Modified Product',
            quantity: 50,
            sku: 'MOD001',
          };

          // Enqueue a local modification (inventory_adjustment modifies products)
          await localStore.enqueue({
            idempotencyKey: crypto.randomUUID(),
            tenantId: localConfig.tenantId,
            branchId: localConfig.branchId,
            locationId: localConfig.locationId,
            sessionId,
            timestamp: new Date().toISOString(),
            vectorClock: { [localConfig.locationId]: 1 },
            operationType: 'inventory_adjustment',
            payload: localPayload,
            retryCount: 0,
          });

          // Read should return the locally modified version
          const readResult = await localStore.getProduct(productId);
          expect(readResult.data).not.toBeNull();
          expect(readResult.isLocalModification).toBe(true);
          expect(readResult.data!.productId).toBe(productId);
          expect(readResult.data!.name).toBe('Modified Product');
          expect(readResult.data!.quantity).toBe(50);

          await localStore.close();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('reads return locally modified version for prices until sync acknowledgment', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbProductId(),
        fc.uuid(),
        async (productId, sessionId) => {
          const localStore = new OfflineStoreService();
          const localConfig = makeConfig();
          await localStore.initialize(localConfig);

          // Seed the cache with an original price
          const originalPrice = {
            productId,
            unitPrice: 29.99,
            discountPercent: 0,
            updatedAt: new Date().toISOString(),
          };
          await localStore.updateCache('prices', [originalPrice]);

          // Enqueue a local price modification
          const localPayload = {
            productId,
            unitPrice: 19.99,
            discountPercent: 15,
          };

          await localStore.enqueue({
            idempotencyKey: crypto.randomUUID(),
            tenantId: localConfig.tenantId,
            branchId: localConfig.branchId,
            locationId: localConfig.locationId,
            sessionId,
            timestamp: new Date().toISOString(),
            vectorClock: { [localConfig.locationId]: 1 },
            operationType: 'price_update',
            payload: localPayload,
            retryCount: 0,
          });

          // Read should return the locally modified version
          const readResult = await localStore.getPrice(productId);
          expect(readResult.data).not.toBeNull();
          expect(readResult.isLocalModification).toBe(true);
          expect(readResult.data!.productId).toBe(productId);
          expect(readResult.data!.unitPrice).toBe(19.99);
          expect(readResult.data!.discountPercent).toBe(15);

          await localStore.close();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('reads return locally modified version for customers until sync acknowledgment', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbCustomerId(),
        fc.uuid(),
        async (customerId, sessionId) => {
          const localStore = new OfflineStoreService();
          const localConfig = makeConfig();
          await localStore.initialize(localConfig);

          // Seed the cache with an original customer
          const originalCustomer = {
            id: customerId,
            name: 'Original Customer',
            email: 'original@example.com',
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
          };
          await localStore.updateCache('customers', [originalCustomer]);

          // Enqueue a local customer modification
          const localPayload = {
            customerId,
            name: 'Updated Customer',
            email: 'updated@example.com',
          };

          await localStore.enqueue({
            idempotencyKey: crypto.randomUUID(),
            tenantId: localConfig.tenantId,
            branchId: localConfig.branchId,
            locationId: localConfig.locationId,
            sessionId,
            timestamp: new Date().toISOString(),
            vectorClock: { [localConfig.locationId]: 1 },
            operationType: 'customer_update',
            payload: localPayload,
            retryCount: 0,
          });

          // Read should return the locally modified version
          const readResult = await localStore.getCustomer(customerId);
          expect(readResult.data).not.toBeNull();
          expect(readResult.isLocalModification).toBe(true);
          expect(readResult.data!.customerId).toBe(customerId);
          expect(readResult.data!.name).toBe('Updated Customer');
          expect(readResult.data!.email).toBe('updated@example.com');

          await localStore.close();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('after sync acknowledgment, reads return server-confirmed version', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbProductId(),
        fc.uuid(),
        async (productId, sessionId) => {
          const localStore = new OfflineStoreService();
          const localConfig = makeConfig();
          await localStore.initialize(localConfig);

          // Seed the cache with an original product
          const originalProduct = {
            id: productId,
            name: 'Original Product',
            quantity: 100,
            sku: 'ORIG001',
            updatedAt: new Date().toISOString(),
          };
          await localStore.updateCache('products', [originalProduct]);

          // Enqueue a local modification
          const envelope = await localStore.enqueue({
            idempotencyKey: crypto.randomUUID(),
            tenantId: localConfig.tenantId,
            branchId: localConfig.branchId,
            locationId: localConfig.locationId,
            sessionId,
            timestamp: new Date().toISOString(),
            vectorClock: { [localConfig.locationId]: 1 },
            operationType: 'inventory_adjustment',
            payload: { productId, name: 'Local Version', quantity: 50, sku: 'LOC001' },
            retryCount: 0,
          });

          // Verify local modification is returned before acknowledgment
          const beforeAck = await localStore.getProduct(productId);
          expect(beforeAck.isLocalModification).toBe(true);

          // Simulate sync acknowledgment: mark the operation as acknowledged
          await localStore.markStatus([envelope.id], 'acknowledged');

          // Simulate server writing confirmed version to cache
          const serverConfirmedProduct = {
            id: productId,
            name: 'Server Confirmed Product',
            quantity: 75,
            sku: 'SRV001',
            updatedAt: new Date().toISOString(),
          };
          await localStore.updateCache('products', [serverConfirmedProduct]);

          // After acknowledgment, reads should return server-confirmed version
          const afterAck = await localStore.getProduct(productId);
          expect(afterAck.isLocalModification).toBe(false);
          expect(afterAck.data).not.toBeNull();
          expect(afterAck.data!.id).toBe(productId);
          expect(afterAck.data!.name).toBe('Server Confirmed Product');
          expect(afterAck.data!.quantity).toBe(75);
          expect(afterAck.data!.sku).toBe('SRV001');

          await localStore.close();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('after sync acknowledgment for prices, reads return server-confirmed version', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbProductId(),
        fc.uuid(),
        async (productId, sessionId) => {
          const localStore = new OfflineStoreService();
          const localConfig = makeConfig();
          await localStore.initialize(localConfig);

          // Seed cache with original price
          await localStore.updateCache('prices', [{
            productId,
            unitPrice: 29.99,
            discountPercent: 0,
            updatedAt: new Date().toISOString(),
          }]);

          // Enqueue local price modification
          const envelope = await localStore.enqueue({
            idempotencyKey: crypto.randomUUID(),
            tenantId: localConfig.tenantId,
            branchId: localConfig.branchId,
            locationId: localConfig.locationId,
            sessionId,
            timestamp: new Date().toISOString(),
            vectorClock: { [localConfig.locationId]: 1 },
            operationType: 'price_update',
            payload: { productId, unitPrice: 19.99, discountPercent: 10 },
            retryCount: 0,
          });

          // Verify local modification is returned before acknowledgment
          const beforeAck = await localStore.getPrice(productId);
          expect(beforeAck.isLocalModification).toBe(true);

          // Simulate sync acknowledgment
          await localStore.markStatus([envelope.id], 'acknowledged');

          // Simulate server writing confirmed version to cache
          const serverConfirmedPrice = {
            productId,
            unitPrice: 24.99,
            discountPercent: 5,
            updatedAt: new Date().toISOString(),
          };
          await localStore.updateCache('prices', [serverConfirmedPrice]);

          // After acknowledgment, reads should return server-confirmed version
          const afterAck = await localStore.getPrice(productId);
          expect(afterAck.isLocalModification).toBe(false);
          expect(afterAck.data).not.toBeNull();
          expect(afterAck.data!.productId).toBe(productId);
          expect(afterAck.data!.unitPrice).toBe(24.99);
          expect(afterAck.data!.discountPercent).toBe(5);

          await localStore.close();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('after sync acknowledgment for customers, reads return server-confirmed version', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbCustomerId(),
        fc.uuid(),
        async (customerId, sessionId) => {
          const localStore = new OfflineStoreService();
          const localConfig = makeConfig();
          await localStore.initialize(localConfig);

          // Seed cache with original customer
          await localStore.updateCache('customers', [{
            id: customerId,
            name: 'Original Customer',
            email: 'original@test.com',
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
          }]);

          // Enqueue local customer modification
          const envelope = await localStore.enqueue({
            idempotencyKey: crypto.randomUUID(),
            tenantId: localConfig.tenantId,
            branchId: localConfig.branchId,
            locationId: localConfig.locationId,
            sessionId,
            timestamp: new Date().toISOString(),
            vectorClock: { [localConfig.locationId]: 1 },
            operationType: 'customer_update',
            payload: { customerId, name: 'Local Customer', email: 'local@test.com' },
            retryCount: 0,
          });

          // Verify local modification is returned before acknowledgment
          const beforeAck = await localStore.getCustomer(customerId);
          expect(beforeAck.isLocalModification).toBe(true);

          // Simulate sync acknowledgment
          await localStore.markStatus([envelope.id], 'acknowledged');

          // Simulate server writing confirmed version to cache
          const serverConfirmedCustomer = {
            id: customerId,
            name: 'Server Confirmed Customer',
            email: 'server@confirmed.com',
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
          };
          await localStore.updateCache('customers', [serverConfirmedCustomer]);

          // After acknowledgment, reads should return server-confirmed version
          const afterAck = await localStore.getCustomer(customerId);
          expect(afterAck.isLocalModification).toBe(false);
          expect(afterAck.data).not.toBeNull();
          expect(afterAck.data!.id).toBe(customerId);
          expect(afterAck.data!.name).toBe('Server Confirmed Customer');
          expect(afterAck.data!.email).toBe('server@confirmed.com');

          await localStore.close();
        }
      ),
      { numRuns: 100 }
    );
  });
});
