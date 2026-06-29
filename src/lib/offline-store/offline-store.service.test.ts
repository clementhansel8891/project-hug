import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OfflineStoreService } from './offline-store.service';
import type { OfflineStoreConfig, OperationEnvelope } from './types';

let testCounter = 0;

function makeConfig(tenantId?: string, overrides: Partial<OfflineStoreConfig> = {}): OfflineStoreConfig {
  // Use unique tenant IDs by default to isolate IndexedDB state between tests
  const id = tenantId ?? `tenant-${++testCounter}-${Date.now()}`;
  return {
    tenantId: id,
    branchId: 'branch-1',
    locationId: 'location-1',
    offlineToleranceThreshold: 500,
    retentionDays: 7,
    ...overrides,
  };
}

function makeOperation(overrides: Partial<Omit<OperationEnvelope, 'id' | 'sequenceNumber' | 'status' | 'createdAt'>> = {}) {
  return {
    idempotencyKey: crypto.randomUUID(),
    tenantId: 'tenant-1',
    branchId: 'branch-1',
    locationId: 'location-1',
    sessionId: 'session-1',
    timestamp: new Date().toISOString(),
    vectorClock: { 'location-1': 1 },
    operationType: 'pos_transaction' as const,
    payload: { amount: 100, productId: 'prod-1' },
    retryCount: 0,
    ...overrides,
  };
}

describe('OfflineStoreService — initialization and lifecycle', () => {
  let store: OfflineStoreService;

  beforeEach(() => {
    store = new OfflineStoreService();
  });

  afterEach(async () => {
    await store.close();
  });

  it('throws when accessing DB before initialization', () => {
    expect(() => store.getDb()).toThrow('OfflineStore not initialized');
  });

  it('throws when accessing config before initialization', () => {
    expect(() => store.getConfig()).toThrow('OfflineStore not initialized');
  });

  it('initializes successfully with a valid config', async () => {
    const config = makeConfig();
    await store.initialize(config);

    expect(store.getDb()).toBeDefined();
    expect(store.getConfig()).toEqual(config);
  });

  it('creates a database named zenvix_offline_{tenantId}', async () => {
    await store.initialize(makeConfig('my-tenant-abc'));

    const db = store.getDb();
    expect(db.name).toBe('zenvix_offline_my-tenant-abc');
  });

  it('creates the operations object store with correct indexes', async () => {
    const config = makeConfig();
    await store.initialize(config);

    const db = store.getDb();
    expect(db.objectStoreNames.contains('operations')).toBe(true);

    const tx = db.transaction('operations', 'readonly');
    const ops = tx.objectStore('operations');
    expect(ops.keyPath).toBe('id');
    expect(ops.indexNames.contains('by-status')).toBe(true);
    expect(ops.indexNames.contains('by-sequence')).toBe(true);
    expect(ops.indexNames.contains('by-idempotency')).toBe(true);
  });

  it('creates the products object store with correct indexes', async () => {
    const config = makeConfig();
    await store.initialize(config);

    const db = store.getDb();
    expect(db.objectStoreNames.contains('products')).toBe(true);

    const tx = db.transaction('products', 'readonly');
    const products = tx.objectStore('products');
    expect(products.keyPath).toBe('id');
    expect(products.indexNames.contains('by-updated')).toBe(true);
    expect(products.indexNames.contains('by-sku')).toBe(true);
  });

  it('creates the prices object store with correct indexes', async () => {
    const config = makeConfig();
    await store.initialize(config);

    const db = store.getDb();
    expect(db.objectStoreNames.contains('prices')).toBe(true);

    const tx = db.transaction('prices', 'readonly');
    const prices = tx.objectStore('prices');
    expect(prices.keyPath).toBe('productId');
    expect(prices.indexNames.contains('by-updated')).toBe(true);
  });

  it('creates the customers object store with correct indexes', async () => {
    const config = makeConfig();
    await store.initialize(config);

    const db = store.getDb();
    expect(db.objectStoreNames.contains('customers')).toBe(true);

    const tx = db.transaction('customers', 'readonly');
    const customers = tx.objectStore('customers');
    expect(customers.keyPath).toBe('id');
    expect(customers.indexNames.contains('by-accessed')).toBe(true);
  });

  it('creates the metadata object store', async () => {
    const config = makeConfig();
    await store.initialize(config);

    const db = store.getDb();
    expect(db.objectStoreNames.contains('metadata')).toBe(true);

    const tx = db.transaction('metadata', 'readonly');
    const metadata = tx.objectStore('metadata');
    expect(metadata.keyPath).toBe('key');
  });

  it('has exactly 5 object stores', async () => {
    const config = makeConfig();
    await store.initialize(config);

    const db = store.getDb();
    expect(db.objectStoreNames.length).toBe(5);
  });
});

describe('OfflineStoreService — tenant switch', () => {
  let store: OfflineStoreService;

  beforeEach(() => {
    store = new OfflineStoreService();
  });

  afterEach(async () => {
    await store.close();
  });

  it('handles tenant switch by closing previous DB and opening new one', async () => {
    await store.initialize(makeConfig('switch-tenant-A'));
    const dbA = store.getDb();
    expect(dbA.name).toBe('zenvix_offline_switch-tenant-A');

    await store.initialize(makeConfig('switch-tenant-B'));
    const dbB = store.getDb();
    expect(dbB.name).toBe('zenvix_offline_switch-tenant-B');
  });

  it('re-initializing the same tenant updates config without reopening', async () => {
    const tenantId = `reopen-test-${Date.now()}`;
    const config1 = makeConfig(tenantId);
    await store.initialize(config1);
    const db1 = store.getDb();

    const config2 = makeConfig(tenantId, { offlineToleranceThreshold: 1000 });
    await store.initialize(config2);
    const db2 = store.getDb();

    // Same DB instance (not reopened)
    expect(db1).toBe(db2);
    // Config updated
    expect(store.getConfig().offlineToleranceThreshold).toBe(1000);
  });
});

describe('OfflineStoreService — close', () => {
  let store: OfflineStoreService;

  beforeEach(() => {
    store = new OfflineStoreService();
  });

  it('close resets internal state', async () => {
    await store.initialize(makeConfig());
    await store.close();

    expect(() => store.getDb()).toThrow('OfflineStore not initialized');
    expect(() => store.getConfig()).toThrow('OfflineStore not initialized');
  });

  it('close is idempotent — calling twice does not throw', async () => {
    await store.initialize(makeConfig());
    await store.close();
    await store.close(); // Should not throw
  });
});

describe('OfflineStoreService — enqueue', () => {
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

  it('generates a UUID for the envelope id', async () => {
    const envelope = await store.enqueue(makeOperation());
    expect(envelope.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('assigns monotonically increasing sequence numbers starting at 1', async () => {
    const e1 = await store.enqueue(makeOperation());
    const e2 = await store.enqueue(makeOperation());
    const e3 = await store.enqueue(makeOperation());

    expect(e1.sequenceNumber).toBe(1);
    expect(e2.sequenceNumber).toBe(2);
    expect(e3.sequenceNumber).toBe(3);
  });

  it('sets status to pending', async () => {
    const envelope = await store.enqueue(makeOperation());
    expect(envelope.status).toBe('pending');
  });

  it('sets createdAt to a valid ISO timestamp', async () => {
    const before = new Date().toISOString();
    const envelope = await store.enqueue(makeOperation());
    const after = new Date().toISOString();

    expect(envelope.createdAt).toBeDefined();
    expect(new Date(envelope.createdAt).toISOString()).toBe(envelope.createdAt);
    expect(envelope.createdAt >= before).toBe(true);
    expect(envelope.createdAt <= after).toBe(true);
  });

  it('preserves all input fields in the envelope', async () => {
    const op = makeOperation({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      locationId: 'location-1',
      operationType: 'inventory_adjustment',
      payload: { quantity: 50, reason: 'restock' },
    });
    const envelope = await store.enqueue(op);

    expect(envelope.tenantId).toBe('tenant-1');
    expect(envelope.branchId).toBe('branch-1');
    expect(envelope.locationId).toBe('location-1');
    expect(envelope.operationType).toBe('inventory_adjustment');
    expect(envelope.payload).toEqual({ quantity: 50, reason: 'restock' });
  });

  it('persists the envelope to IndexedDB', async () => {
    const envelope = await store.enqueue(makeOperation());

    // Verify directly in the DB
    const db = store.getDb();
    const result = await new Promise<OperationEnvelope | undefined>((resolve) => {
      const tx = db.transaction('operations', 'readonly');
      const objectStore = tx.objectStore('operations');
      const request = objectStore.get(envelope.id);
      request.onsuccess = () => resolve(request.result);
    });

    expect(result).toBeDefined();
    expect(result!.id).toBe(envelope.id);
    expect(result!.status).toBe('pending');
    expect(result!.sequenceNumber).toBe(envelope.sequenceNumber);
  });

  it('throws when offline_tolerance_threshold is reached', async () => {
    await store.close();
    const thresholdConfig = makeConfig(undefined, { offlineToleranceThreshold: 100 });
    await store.initialize(thresholdConfig);

    // Fill to threshold
    for (let i = 0; i < 100; i++) {
      await store.enqueue(makeOperation());
    }

    await expect(store.enqueue(makeOperation())).rejects.toThrow(/queue is full/i);
  });

  it('threshold is exact — allows up to threshold count then blocks', async () => {
    await store.close();
    const thresholdConfig = makeConfig(undefined, { offlineToleranceThreshold: 100 });
    await store.initialize(thresholdConfig);

    // Fill to threshold
    for (let i = 0; i < 100; i++) {
      await store.enqueue(makeOperation());
    }

    // Next enqueue should fail since we already have 100 (= threshold)
    await expect(store.enqueue(makeOperation())).rejects.toThrow(/queue is full/i);
  });

  it('sequence numbers never reuse within same session', async () => {
    const seqNums = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const envelope = await store.enqueue(makeOperation());
      expect(seqNums.has(envelope.sequenceNumber)).toBe(false);
      seqNums.add(envelope.sequenceNumber);
    }
  });

  it('persists sequence number to metadata for crash recovery', async () => {
    await store.enqueue(makeOperation());
    await store.enqueue(makeOperation());

    const db = store.getDb();
    const result = await new Promise<{ key: string; value: number } | undefined>((resolve) => {
      const tx = db.transaction('metadata', 'readonly');
      const objectStore = tx.objectStore('metadata');
      const request = objectStore.get('lastSequenceNumber');
      request.onsuccess = () => resolve(request.result);
    });

    expect(result).toBeDefined();
    expect(result!.value).toBe(2);
  });

  it('recovers sequence number after re-initialization', async () => {
    await store.enqueue(makeOperation());
    await store.enqueue(makeOperation());
    const e3 = await store.enqueue(makeOperation());
    expect(e3.sequenceNumber).toBe(3);

    // Re-create the store (simulates app restart) — use the SAME tenant
    const store2 = new OfflineStoreService();
    await store2.initialize(config);

    const e4 = await store2.enqueue(makeOperation());
    expect(e4.sequenceNumber).toBe(4); // Continues from 3

    await store2.close();
  });
});

describe('OfflineStoreService — getBatch', () => {
  let store: OfflineStoreService;

  beforeEach(async () => {
    store = new OfflineStoreService();
    await store.initialize(makeConfig());
  });

  afterEach(async () => {
    await store.close();
  });

  it('returns an empty array when no pending operations', async () => {
    const batch = await store.getBatch(10);
    expect(batch).toEqual([]);
  });

  it('returns pending operations ordered by sequence number', async () => {
    await store.enqueue(makeOperation());
    await store.enqueue(makeOperation());
    await store.enqueue(makeOperation());

    const batch = await store.getBatch(10);
    expect(batch).toHaveLength(3);
    expect(batch[0].sequenceNumber).toBe(1);
    expect(batch[1].sequenceNumber).toBe(2);
    expect(batch[2].sequenceNumber).toBe(3);
  });

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await store.enqueue(makeOperation());
    }

    const batch = await store.getBatch(3);
    expect(batch).toHaveLength(3);
    expect(batch[0].sequenceNumber).toBe(1);
    expect(batch[2].sequenceNumber).toBe(3);
  });

  it('only returns operations with pending status', async () => {
    const e1 = await store.enqueue(makeOperation());
    await store.enqueue(makeOperation());
    const e3 = await store.enqueue(makeOperation());

    // Mark e1 and e3 as acknowledged
    await store.markStatus([e1.id, e3.id], 'acknowledged');

    const batch = await store.getBatch(10);
    expect(batch).toHaveLength(1);
    expect(batch[0].sequenceNumber).toBe(2);
  });
});

describe('OfflineStoreService — markStatus', () => {
  let store: OfflineStoreService;

  beforeEach(async () => {
    store = new OfflineStoreService();
    await store.initialize(makeConfig());
  });

  afterEach(async () => {
    await store.close();
  });

  it('updates the status of specified envelopes', async () => {
    const e1 = await store.enqueue(makeOperation());
    const e2 = await store.enqueue(makeOperation());

    await store.markStatus([e1.id, e2.id], 'syncing');

    const db = store.getDb();
    const result = await new Promise<OperationEnvelope>((resolve) => {
      const tx = db.transaction('operations', 'readonly');
      const objectStore = tx.objectStore('operations');
      const request = objectStore.get(e1.id);
      request.onsuccess = () => resolve(request.result);
    });

    expect(result.status).toBe('syncing');
  });

  it('handles empty ids array gracefully', async () => {
    await expect(store.markStatus([], 'acknowledged')).resolves.toBeUndefined();
  });

  it('handles non-existent ids gracefully', async () => {
    await expect(store.markStatus(['non-existent-id'], 'failed')).resolves.toBeUndefined();
  });

  it('marks as acknowledged and excludes from pending count', async () => {
    const e1 = await store.enqueue(makeOperation());
    await store.enqueue(makeOperation());

    expect(await store.getPendingCount()).toBe(2);

    await store.markStatus([e1.id], 'acknowledged');

    expect(await store.getPendingCount()).toBe(1);
  });
});

describe('OfflineStoreService — getPendingCount', () => {
  let store: OfflineStoreService;

  beforeEach(async () => {
    store = new OfflineStoreService();
    await store.initialize(makeConfig());
  });

  afterEach(async () => {
    await store.close();
  });

  it('returns 0 when no operations exist', async () => {
    const count = await store.getPendingCount();
    expect(count).toBe(0);
  });

  it('returns count of pending operations only', async () => {
    const e1 = await store.enqueue(makeOperation());
    await store.enqueue(makeOperation());
    await store.enqueue(makeOperation());

    expect(await store.getPendingCount()).toBe(3);

    await store.markStatus([e1.id], 'acknowledged');

    expect(await store.getPendingCount()).toBe(2);
  });
});

describe('OfflineStoreService — threshold lockout allows reads', () => {
  let store: OfflineStoreService;

  beforeEach(async () => {
    store = new OfflineStoreService();
    await store.initialize(makeConfig(undefined, { offlineToleranceThreshold: 100 }));
  });

  afterEach(async () => {
    await store.close();
  });

  it('blocks writes when threshold is reached but getBatch still works (read)', async () => {
    for (let i = 0; i < 100; i++) {
      await store.enqueue(makeOperation());
    }

    // Write should be blocked
    await expect(store.enqueue(makeOperation())).rejects.toThrow(/queue is full/i);

    // Read operations should still work
    const batch = await store.getBatch(10);
    expect(batch).toHaveLength(10);

    const count = await store.getPendingCount();
    expect(count).toBe(100);
  });

  it('allows writes again after marking operations as acknowledged', async () => {
    const envelopes: OperationEnvelope[] = [];
    for (let i = 0; i < 100; i++) {
      envelopes.push(await store.enqueue(makeOperation()));
    }

    // Queue is full
    await expect(store.enqueue(makeOperation())).rejects.toThrow(/queue is full/i);

    // Clear one operation
    await store.markStatus([envelopes[0].id], 'acknowledged');

    // Should now be allowed again
    const next = await store.enqueue(makeOperation());
    expect(next.sequenceNumber).toBe(101);
  });
});

describe('OfflineStoreService — offlineToleranceThreshold range validation', () => {
  let store: OfflineStoreService;

  beforeEach(() => {
    store = new OfflineStoreService();
  });

  afterEach(async () => {
    await store.close();
  });

  it('rejects threshold below 100', async () => {
    await expect(
      store.initialize(makeConfig(undefined, { offlineToleranceThreshold: 99 }))
    ).rejects.toThrow(/offlineToleranceThreshold must be between 100 and 2000/);
  });

  it('rejects threshold above 2000', async () => {
    await expect(
      store.initialize(makeConfig(undefined, { offlineToleranceThreshold: 2001 }))
    ).rejects.toThrow(/offlineToleranceThreshold must be between 100 and 2000/);
  });

  it('accepts threshold at minimum boundary (100)', async () => {
    await expect(
      store.initialize(makeConfig(undefined, { offlineToleranceThreshold: 100 }))
    ).resolves.toBeUndefined();
  });

  it('accepts threshold at maximum boundary (2000)', async () => {
    await expect(
      store.initialize(makeConfig(undefined, { offlineToleranceThreshold: 2000 }))
    ).resolves.toBeUndefined();
  });

  it('accepts default threshold (500)', async () => {
    await expect(
      store.initialize(makeConfig(undefined, { offlineToleranceThreshold: 500 }))
    ).resolves.toBeUndefined();
  });
});

describe('OfflineStoreService — verifyIntegrity and purgeAcknowledged', () => {
  let store: OfflineStoreService;

  beforeEach(async () => {
    store = new OfflineStoreService();
    await store.initialize(makeConfig());
  });

  afterEach(async () => {
    await store.close();
  });

  it('verifyIntegrity returns a report with all zeros on empty store', async () => {
    const report = await store.verifyIntegrity();
    expect(report.totalEnvelopes).toBe(0);
    expect(report.validEnvelopes).toBe(0);
    expect(report.corruptEnvelopes).toBe(0);
    expect(report.recoveredEnvelopes).toBe(0);
    expect(report.orphanedEntries).toBe(0);
  });

  it('verifyIntegrity categorizes valid envelopes correctly', async () => {
    // Enqueue valid envelopes
    await store.enqueue({
      idempotencyKey: crypto.randomUUID(),
      tenantId: store.getConfig().tenantId,
      branchId: store.getConfig().branchId,
      locationId: store.getConfig().locationId,
      sessionId: 'session-1',
      timestamp: new Date().toISOString(),
      vectorClock: { 'loc-1': 1 },
      operationType: 'pos_transaction',
      payload: { amount: 100 },
      retryCount: 0,
    });

    const report = await store.verifyIntegrity();
    expect(report.totalEnvelopes).toBe(1);
    expect(report.validEnvelopes).toBe(1);
    expect(report.corruptEnvelopes).toBe(0);
    expect(report.recoveredEnvelopes).toBe(0);
  });

  it('purgeAcknowledged returns 0 when no acknowledged operations exist', async () => {
    const purged = await store.purgeAcknowledged(new Date());
    expect(purged).toBe(0);
  });

  it('purgeAcknowledged removes acknowledged operations older than the given date', async () => {
    // Enqueue and acknowledge an envelope
    const envelope = await store.enqueue({
      idempotencyKey: crypto.randomUUID(),
      tenantId: store.getConfig().tenantId,
      branchId: store.getConfig().branchId,
      locationId: store.getConfig().locationId,
      sessionId: 'session-1',
      timestamp: new Date().toISOString(),
      vectorClock: { 'loc-1': 1 },
      operationType: 'pos_transaction',
      payload: { amount: 50 },
      retryCount: 0,
    });

    await store.markStatus([envelope.id], 'acknowledged');

    // Purge operations older than tomorrow
    const tomorrow = new Date(Date.now() + 86400000);
    const purged = await store.purgeAcknowledged(tomorrow);
    expect(purged).toBe(1);

    // Verify it's gone
    const count = await store.getPendingCount();
    expect(count).toBe(0);
  });
});
